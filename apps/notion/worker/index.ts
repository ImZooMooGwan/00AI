import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DOC_ROOM: DurableObjectNamespace<DocumentRoom>;
  SESSION_SECRET?: string;
  BREVO_API_KEY?: SecretsStoreSecret | string;
  HASA_API_KEY?: SecretsStoreSecret | string;
  HASA_BASE_URL?: string;
  HASA_MODEL?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME?: string;
  SIGNUP_ENABLED?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

type User = { id: string; email: string; display_name: string };
type Access = { role: 'owner' | 'admin' | 'member' | 'guest' | 'editor' | 'commenter' | 'viewer'; workspaceRole: string };

const encoder = new TextEncoder();
const now = () => new Date().toISOString();
async function resolveSecret(value?: SecretsStoreSecret | string): Promise<string | undefined> {
  if (typeof value === 'string') return value;
  if (!value) return undefined;
  try { return await value.get(); } catch { return undefined; }
}
const id = () => crypto.randomUUID();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
const clean = (value: unknown, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const emailPattern = /^[^\s@]{1,100}@[^\s@.]{1,100}(?:\.[^\s@.]{1,24})+$/;

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function sessionSecret(env: Env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const generated = `00ai_${Array.from(crypto.getRandomValues(new Uint8Array(48)), byte => byte.toString(16).padStart(2,'0')).join('')}`;
  await env.DB.prepare("INSERT OR IGNORE INTO app_secrets(key,value,created_at) VALUES('session_secret',?,?)").bind(generated,now()).run();
  const stored = await env.DB.prepare("SELECT value FROM app_secrets WHERE key='session_secret'").first<{value:string}>();
  if (!stored?.value) throw new Error('SESSION_SECRET_UNAVAILABLE');
  return stored.value;
}
function decodePayload(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return JSON.parse(raw) as { sub: string; exp: number };
}
async function setSession(userId: string, env: Env) {
  const payload = btoa(JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${payload}.${await hmac(await sessionSecret(env), payload)}`;
  return `00ai_notion=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600`;
}
async function currentUser(request: Request, env: Env): Promise<User | null> {
  // Cloudflare Access is supported when explicitly configured; signed app sessions remain the default.
  const accessToken = request.headers.get('cf-access-jwt-assertion');
  if (accessToken && env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    try {
      const domain = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '');
      const jwks = createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`));
      const { payload } = await jwtVerify(accessToken, jwks, { issuer: domain, audience: env.ACCESS_AUD });
      const email = clean(payload.email, 180).toLowerCase();
      if (!emailPattern.test(email)) return null;
      return await ensureUser(env, email, clean(email.split('@')[0], 80));
    } catch { return null; }
  }
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.match(/(?:^|;\s*)00ai_notion=([^;]+)/)?.[1];
  if (!token) return null;
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature || await hmac(await sessionSecret(env), payload) !== signature) return null;
    const data = decodePayload(payload);
    if (!data.sub || data.exp < Date.now()) return null;
    return await env.DB.prepare('SELECT id,email,display_name FROM users WHERE id=?').bind(data.sub).first<User>();
  } catch { return null; }
}
async function ensureUser(env: Env, email: string, name: string) {
  let user = await env.DB.prepare('SELECT id,email,display_name FROM users WHERE email=? COLLATE NOCASE').bind(email).first<User>();
  if (user) return user;
  const userId = id();
  await env.DB.prepare('INSERT INTO users(id,email,display_name,created_at,last_seen_at) VALUES(?,?,?,?,?)').bind(userId, email, name, now(), now()).run();
  user = { id: userId, email, display_name: name };
  await createPersonalWorkspace(env, user);
  // Accept outstanding workspace invitations after account creation.
  const invites = await env.DB.prepare('SELECT id,workspace_id,role FROM workspace_invites WHERE email=? COLLATE NOCASE AND accepted_at IS NULL').bind(email).all<{id:string;workspace_id:string;role:string}>();
  for (const invite of invites.results) {
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,?,?)').bind(invite.workspace_id,userId,invite.role,now()),
      env.DB.prepare('UPDATE workspace_invites SET accepted_at=? WHERE id=?').bind(now(),invite.id),
    ]);
  }
  const pageInvites = await env.DB.prepare('SELECT id,page_id,role FROM page_invites WHERE email=? COLLATE NOCASE AND accepted_at IS NULL').bind(email).all<{id:string;page_id:string;role:string}>();
  for (const invite of pageInvites.results) {
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO page_members(page_id,user_id,role,granted_by,created_at) SELECT ?,?,?,invited_by,? FROM page_invites WHERE id=?').bind(invite.page_id,userId,invite.role,now(),invite.id),
      env.DB.prepare('UPDATE page_invites SET accepted_at=? WHERE id=?').bind(now(),invite.id),
    ]);
  }
  return user;
}
async function createPersonalWorkspace(env: Env, user: User) {
  const wsId = id();
  const base = (user.display_name || user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'workspace';
  const slug = `${base}-${wsId.slice(0, 6)}`;
  const pageId = id();
  const at = now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO workspaces(id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)').bind(wsId, `${user.display_name || '나'}의 공간`, slug, user.id, at),
    env.DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").bind(wsId,user.id,at),
    env.DB.prepare("INSERT INTO pages(id,workspace_id,title,icon,created_by,created_at,updated_at) VALUES(?,?,?, ?,?,?,?)").bind(pageId,wsId,'시작하기','👋',user.id,at,at),
  ]);
}
async function accessFor(env: Env, user: User, pageId: string): Promise<{ page: { id: string; workspace_id: string; title: string; parent_id: string | null; icon: string }; access: Access } | null> {
  const page = await env.DB.prepare('SELECT id,workspace_id,title,parent_id,icon FROM pages WHERE id=? AND archived_at IS NULL').bind(pageId).first<{id:string;workspace_id:string;title:string;parent_id:string|null;icon:string}>();
  if (!page) return null;
  const member = await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(page.workspace_id,user.id).first<{role:string}>();
  const specific = await env.DB.prepare('SELECT role FROM page_members WHERE page_id=? AND user_id=?').bind(pageId,user.id).first<{role:string}>();
  if(!member&&!specific)return null;
  return { page, access: { role: (specific?.role || member?.role) as Access['role'], workspaceRole: member?.role||'external' } };
}
function canRead(access: Access) { return ['owner','admin','member','guest','editor','commenter','viewer'].includes(access.role); }
function canWrite(access: Access) { return ['owner','admin','member','editor'].includes(access.role); }
function canManage(access: Access) { return ['owner','admin'].includes(access.workspaceRole); }
async function audit(env: Env, user: User, workspaceId: string, action: string, resourceType: string, resourceId: string) {
  await env.DB.prepare('INSERT INTO audit_log(id,workspace_id,actor_id,action,resource_type,resource_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(),workspaceId,user.id,action,resourceType,resourceId,now()).run();
}
function originAllowed(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function sendLoginCode(env: Env, email: string, code: string) {
  const apiKey = await resolveSecret(env.BREVO_API_KEY);
  if (!apiKey) throw new Error('EMAIL_NOT_CONFIGURED');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env.EMAIL_FROM_ADDRESS || 'no-reply@00ai.kr', name: env.EMAIL_FROM_NAME || '00AI WORKSPACE' },
      to: [{ email }],
      subject: '00AI WORKSPACE 로그인 코드',
      textContent: `로그인 코드 ${code}를 입력하세요. 이 코드는 10분 동안 유효합니다. 요청하지 않았다면 이 메일을 무시하세요.`,
      htmlContent: `<div style="font-family:sans-serif;color:#172033"><h2>00AI WORKSPACE 로그인</h2><p>아래 코드를 입력하세요. 10분 동안 유효합니다.</p><div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:16px 0">${code}</div><p>요청하지 않았다면 이 메일을 무시하세요.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
}

async function sendCollaborationInvite(env:Env,email:string,kind:'workspace'|'page',title:string,role:string,url:string){
  const apiKey=await resolveSecret(env.BREVO_API_KEY);if(!apiKey)return false;
  const safe=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
  const roleNames:Record<string,string>={owner:'소유자',admin:'관리자',member:'멤버',guest:'게스트',editor:'편집자',commenter:'댓글 작성자',viewer:'열람자'};
  const kindName=kind==='workspace'?'워크스페이스':'페이지',subject=`00AI WORKSPACE ${kindName} 초대: ${title}`;
  const text=`00AI WORKSPACE ${kindName}에 초대되었습니다.\n\n${title}\n권한: ${roleNames[role]||role}\n\n${url}\n\n초대받은 이메일 주소로 로그인하면 권한이 연결됩니다.`;
  const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#25312a"><p style="color:#4a7056;font-weight:bold">00AI WORKSPACE</p><h2>${kindName} 초대</h2><p>협업 공간에 초대되었습니다.</p><div style="padding:16px;background:#f4f7f4;border-radius:10px"><b>${safe(title)}</b><br><span>권한: ${safe(roleNames[role]||role)}</span></div><p>초대받은 이메일 주소로 로그인하면 권한이 연결됩니다.</p><p><a href="${safe(url)}" style="display:inline-block;background:#345c42;color:white;padding:11px 16px;border-radius:8px;text-decoration:none">00AI WORKSPACE 열기</a></p></div>`;
  const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':apiKey,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:env.EMAIL_FROM_ADDRESS||'no-reply@00ai.kr',name:env.EMAIL_FROM_NAME||'00AI WORKSPACE'},to:[{email}],subject,textContent:text,htmlContent:html})});
  if(!response.ok)throw new Error(`EMAIL_PROVIDER_${response.status}`);return true;
}

async function routeApi(request: Request, env: Env, user: User | null): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;

  if (method === 'GET' && path === '/health') {
    const [mailKey, aiKey] = await Promise.all([resolveSecret(env.BREVO_API_KEY), resolveSecret(env.HASA_API_KEY)]);
    return json({ ok: true, app: '00AI WORKSPACE', auth: Boolean(mailKey), ai: Boolean(aiKey), database: true, realtime: true });
  }

  if (method === 'POST' && path === '/auth/request-code') {
    if (!originAllowed(request)) return json({ error: '허용되지 않은 요청입니다.' }, 403);
    const body = await request.json<{email?:string}>();
    const email = clean(body.email,180).toLowerCase();
    if (!emailPattern.test(email)) return json({ error: '이메일 주소를 확인해 주세요.' }, 400);
    const secret = await sessionSecret(env);
    if (!await resolveSecret(env.BREVO_API_KEY)) return json({ error: '이메일 발송 설정을 확인 중입니다. 잠시 후 다시 시도해 주세요.' }, 503);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const fingerprint = await hmac(secret, `otp-ip:${ip}`);
    const rate = await env.DB.prepare('SELECT window_started,count FROM email_rate_limits WHERE fingerprint=?').bind(fingerprint).first<{window_started:number;count:number}>();
    if (rate && Date.now()-rate.window_started < 60*60_000 && rate.count >= 8) return json({error:'요청 횟수가 많습니다. 한 시간 뒤 다시 시도해 주세요.'},429);
    if (!rate || Date.now()-rate.window_started >= 60*60_000) await env.DB.prepare('INSERT INTO email_rate_limits(fingerprint,window_started,count) VALUES(?,?,1) ON CONFLICT(fingerprint) DO UPDATE SET window_started=excluded.window_started,count=1').bind(fingerprint,Date.now()).run();
    else await env.DB.prepare('UPDATE email_rate_limits SET count=count+1 WHERE fingerprint=?').bind(fingerprint).run();
    const recent = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email=? COLLATE NOCASE').bind(email).first<{sent_at:number}>();
    if (recent && Date.now() - recent.sent_at < 45_000) return json({ ok: true, message: '해당 이메일로 로그인 코드를 보냈다면 잠시 후 도착합니다.' });
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6,'0');
    const codeHash = await hmac(secret, `${email}:${code}`);
    await env.DB.prepare('INSERT INTO login_codes(email,code_hash,expires_at,attempts,sent_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at').bind(email,codeHash,Date.now()+10*60_000,Date.now()).run();
    try { await sendLoginCode(env,email,code); }
    catch (error) { await env.DB.prepare('DELETE FROM login_codes WHERE email=? COLLATE NOCASE').bind(email).run(); console.error(JSON.stringify({event:'login_email_failed',reason:error instanceof Error?error.message:'unknown'})); return json({error:'인증 메일을 보내지 못했습니다. 발신 설정을 확인해 주세요.'},503); }
    return json({ok:true,message:'로그인 코드를 이메일로 보냈습니다.'});
  }
  if (method === 'POST' && path === '/auth/verify-code') {
    if (!originAllowed(request)) return json({error:'허용되지 않은 요청입니다.'},403);
    const body = await request.json<{email?:string;code?:string;name?:string}>();
    const email = clean(body.email,180).toLowerCase(), code = clean(body.code,6);
    if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) return json({error:'이메일 또는 코드를 확인해 주세요.'},400);
    const record = await env.DB.prepare('SELECT code_hash,expires_at,attempts FROM login_codes WHERE email=? COLLATE NOCASE').bind(email).first<{code_hash:string;expires_at:number;attempts:number}>();
    if (!record || record.expires_at < Date.now() || record.attempts >= 5) return json({error:'코드가 만료되었거나 입력 횟수를 초과했습니다. 새 코드를 요청해 주세요.'},401);
    const actual = await hmac(await sessionSecret(env),`${email}:${code}`);
    if (actual !== record.code_hash) { await env.DB.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE email=? COLLATE NOCASE').bind(email).run(); return json({error:'인증 코드가 올바르지 않습니다.'},401); }
    await env.DB.prepare('DELETE FROM login_codes WHERE email=? COLLATE NOCASE').bind(email).run();
    let account = await env.DB.prepare('SELECT id,email,display_name FROM users WHERE email=? COLLATE NOCASE').bind(email).first<User>();
    if (!account) {
      if (env.SIGNUP_ENABLED === 'false') return json({error:'현재는 초대된 사용자만 가입할 수 있습니다.'},403);
      account = await ensureUser(env,email,clean(body.name,80) || email.split('@')[0]);
    }
    await env.DB.prepare('UPDATE users SET last_seen_at=? WHERE id=?').bind(now(),account.id).run();
    return new Response(JSON.stringify({ok:true,user:{email:account.email,name:account.display_name}}),{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':await setSession(account.id,env)}});
  }
  if (method === 'POST' && path === '/auth/logout') return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':'00ai_notion=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}});
  if (method === 'GET' && path === '/me') return user ? json({user:{id:user.id,email:user.email,display_name:user.display_name,name:user.display_name}}) : json({user:null},401);
  if(method==='GET'&&path==='/templates'){
    const result=await env.DB.prepare("SELECT t.id,t.title,t.description,t.category,t.icon,t.license,t.source_name,t.source_url,t.copy_count,t.version,t.created_at,COALESCE(u.display_name,t.source_name) AS author_name FROM templates t LEFT JOIN users u ON u.id=t.owner_id WHERE t.visibility='public' AND t.review_status='published' ORDER BY t.category,t.title").all();
    return json({items:result.results});
  }
  if (!user) return json({error:'로그인이 필요합니다.'},401);

  if(method==='PATCH'&&path==='/profile'){
    const body=await request.json<{displayName?:string}>(),displayName=clean(body.displayName,80);
    if(displayName.length<2)return json({error:'표시 이름은 두 글자 이상 입력해 주세요.'},400);
    await env.DB.prepare('UPDATE users SET display_name=?,last_seen_at=? WHERE id=?').bind(displayName,now(),user.id).run();
    return json({ok:true,user:{id:user.id,email:user.email,display_name:displayName}});
  }

  if (method === 'GET' && path === '/workspaces') {
    const result = await env.DB.prepare('SELECT w.id,w.name,w.slug,wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=? ORDER BY w.created_at').bind(user.id).all();
    return json({items:result.results});
  }
  if (method === 'POST' && path === '/workspaces') {
    const body = await request.json<{name?:string}>(), name = clean(body.name,80);
    if (!name) return json({error:'공간 이름을 입력해 주세요.'},400);
    const workspaceId=id(), at=now(), base=name.toLowerCase().replace(/[^a-z0-9가-힣]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'workspace';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO workspaces(id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)').bind(workspaceId,name,`${base}-${workspaceId.slice(0,6)}`,user.id,at),
      env.DB.prepare("INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,'owner',?)").bind(workspaceId,user.id,at),
      env.DB.prepare("INSERT INTO pages(id,workspace_id,title,icon,created_by,created_at,updated_at) VALUES(?,?,?,'👋',?,?,?)").bind(id(),workspaceId,'시작하기',user.id,at,at),
    ]);
    await audit(env,user,workspaceId,'WORKSPACE_CREATED','workspace',workspaceId);
    return json({ok:true,id:workspaceId},201);
  }
  if (method === 'GET' && path === '/pages') {
    const workspaceId=clean(url.searchParams.get('workspaceId'),60);
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();
    const direct=await env.DB.prepare('SELECT 1 AS ok FROM page_members pm JOIN pages p ON p.id=pm.page_id WHERE p.workspace_id=? AND pm.user_id=? LIMIT 1').bind(workspaceId,user.id).first();
    if (!member&&!direct) return json({error:'공간에 접근할 수 없습니다.'},403);
    const rows=await env.DB.prepare('SELECT p.id,p.parent_id,p.title,p.icon,p.created_at,p.updated_at,p.created_by,COALESCE(pm.role,wm.role) AS role,p.starter_json IS NOT NULL AND p.starter_claimed_at IS NULL AS has_starter,CASE WHEN f.page_id IS NULL THEN 0 ELSE 1 END AS favorite FROM pages p LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? LEFT JOIN page_favorites f ON f.page_id=p.id AND f.user_id=? WHERE p.workspace_id=? AND p.archived_at IS NULL AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) ORDER BY p.updated_at DESC LIMIT 500').bind(user.id,user.id,user.id,workspaceId).all();
    return json({items:rows.results});
  }
  if (method === 'GET' && path === '/search') {
    const workspaceId=clean(url.searchParams.get('workspaceId'),60), query=clean(url.searchParams.get('q'),120);
    if(!workspaceId||query.length<2)return json({items:[]});
    const escaped=query.replace(/[\\%_]/g,'\\$&');
    const rows=await env.DB.prepare("SELECT p.id,p.parent_id,p.title,p.icon,p.updated_at,COALESCE(pm.role,wm.role) AS role,CASE WHEN lower(p.title) LIKE lower(?) ESCAPE '\\' THEN 'title' ELSE 'content' END AS match_type,CASE WHEN instr(lower(c.body_text),lower(?))>0 THEN substr(c.body_text,max(instr(lower(c.body_text),lower(?))-45,1),140) ELSE '' END AS snippet FROM pages p LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? LEFT JOIN page_content c ON c.page_id=p.id WHERE p.workspace_id=? AND p.archived_at IS NULL AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) AND (p.title LIKE ? ESCAPE '\\' OR c.body_text LIKE ? ESCAPE '\\') ORDER BY CASE WHEN lower(p.title) LIKE lower(?) ESCAPE '\\' THEN 0 ELSE 1 END,p.updated_at DESC LIMIT 30")
      .bind(`%${escaped}%`,query,query,user.id,user.id,workspaceId,`%${escaped}%`,`%${escaped}%`,`%${escaped}%`).all();
    return json({items:rows.results});
  }
  const recentMatch=path.match(/^\/pages\/([^/]+)\/visit$/);
  if(method==='POST'&&recentMatch){
    const pageId=decodeURIComponent(recentMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    await env.DB.prepare('INSERT INTO page_visits(user_id,page_id,visited_at) VALUES(?,?,?) ON CONFLICT(user_id,page_id) DO UPDATE SET visited_at=excluded.visited_at').bind(user.id,pageId,now()).run();
    return json({ok:true});
  }
  const pageMove=path.match(/^\/pages\/([^/]+)\/move$/);
  if(pageMove&&method==='PATCH'){
    const pageId=decodeURIComponent(pageMove[1]),page=await env.DB.prepare('SELECT id,workspace_id FROM pages WHERE id=? AND archived_at IS NULL').bind(pageId).first<{id:string;workspace_id:string}>();
    if(!page)return json({error:'페이지를 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,pageId);if(!record||!canWrite(record.access))return json({error:'페이지를 이동할 권한이 없습니다.'},403);
    const body=await request.json<{parentId?:string|null}>(),parentId=body.parentId?clean(body.parentId,60):null;
    if(parentId===pageId)return json({error:'페이지를 자기 자신 아래로 이동할 수 없습니다.'},400);
    if(parentId){const parent=await accessFor(env,user,parentId);if(!parent||parent.page.workspace_id!==page.workspace_id||!canWrite(parent.access))return json({error:'같은 워크스페이스에서 편집 가능한 상위 페이지를 선택해 주세요.'},403);let cursor:string|null=parentId;const seen=new Set<string>();for(let i=0;i<500&&cursor;i++){if(cursor===pageId)return json({error:'하위 페이지를 상위 페이지로 지정할 수 없습니다.'},400);if(seen.has(cursor))break;seen.add(cursor);cursor=await env.DB.prepare('SELECT parent_id FROM pages WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(cursor,page.workspace_id).first<{parent_id:string|null}>().then(row=>row?.parent_id||null);}}
    await env.DB.prepare('UPDATE pages SET parent_id=?,updated_at=? WHERE id=?').bind(parentId,now(),pageId).run();
    await audit(env,user,page.workspace_id,'PAGE_MOVED','page',pageId);return json({ok:true,parentId});
  }
  const favoriteMatch=path.match(/^\/pages\/([^/]+)\/favorite$/);
  if(favoriteMatch&&(method==='POST'||method==='DELETE')){
    const pageId=decodeURIComponent(favoriteMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    if(method==='POST')await env.DB.prepare('INSERT OR IGNORE INTO page_favorites(user_id,page_id,created_at) VALUES(?,?,?)').bind(user.id,pageId,now()).run();
    else await env.DB.prepare('DELETE FROM page_favorites WHERE user_id=? AND page_id=?').bind(user.id,pageId).run();
    return json({ok:true,favorite:method==='POST'});
  }
  if(method==='GET'&&path==='/recent'){
    const workspaceId=clean(url.searchParams.get('workspaceId'),60);
    const rows=await env.DB.prepare('SELECT p.id,p.parent_id,p.title,p.icon,p.updated_at,COALESCE(pm.role,wm.role) AS role,v.visited_at FROM page_visits v JOIN pages p ON p.id=v.page_id LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? WHERE v.user_id=? AND p.workspace_id=? AND p.archived_at IS NULL AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) ORDER BY v.visited_at DESC LIMIT 30').bind(user.id,user.id,user.id,workspaceId).all();
    return json({items:rows.results});
  }
  if(method==='GET'&&path==='/favorites'){
    const workspaceId=clean(url.searchParams.get('workspaceId'),60);
    const rows=await env.DB.prepare('SELECT p.id,p.parent_id,p.title,p.icon,p.updated_at,COALESCE(pm.role,wm.role) AS role,f.created_at AS favorited_at FROM page_favorites f JOIN pages p ON p.id=f.page_id LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? WHERE f.user_id=? AND p.workspace_id=? AND p.archived_at IS NULL AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) ORDER BY f.created_at DESC LIMIT 100').bind(user.id,user.id,user.id,workspaceId).all();
    return json({items:rows.results});
  }
  if (method === 'POST' && path === '/pages') {
    const body=await request.json<{workspaceId?:string;parentId?:string|null;title?:string;icon?:string;templateId?:string}>();
    const workspaceId=clean(body.workspaceId,60), parentId=body.parentId?clean(body.parentId,60):null;
    const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first<{role:string}>();
    if (!member || !['owner','admin','member'].includes(member.role)) return json({error:'페이지 생성 권한이 없습니다.'},403);
    if (parentId) { const parent=await accessFor(env,user,parentId); if(!parent||parent.page.workspace_id!==workspaceId||!canWrite(parent.access))return json({error:'상위 페이지 권한이 없습니다.'},403); }
    const pageId=id(),at=now(),title=clean(body.title,200)||'새 페이지',icon=clean(body.icon,8)||'📄';
    let starterJson:string|null=null;
    if (body.templateId) {
      const template=await env.DB.prepare("SELECT blocks_json FROM templates WHERE id=? AND visibility='public' AND review_status='published'").bind(clean(body.templateId,100)).first<{blocks_json:string}>();
      if (!template) return json({error:'템플릿을 찾을 수 없습니다.'},404);
      starterJson=template.blocks_json;
      await env.DB.prepare('UPDATE templates SET copy_count=copy_count+1 WHERE id=?').bind(body.templateId).run();
      await env.DB.prepare('INSERT INTO audit_log(id,workspace_id,actor_id,action,resource_type,resource_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(),workspaceId,user.id,'TEMPLATE_COPIED','template',body.templateId,at).run();
    }
    await env.DB.prepare('INSERT INTO pages(id,workspace_id,parent_id,title,icon,created_by,created_at,updated_at,starter_json) VALUES(?,?,?,?,?,?,?,?,?)').bind(pageId,workspaceId,parentId,title,icon,user.id,at,at,starterJson).run();
    await audit(env,user,workspaceId,'PAGE_CREATED','page',pageId);
    return json({ok:true,id:pageId},201);
  }
  if(method==='GET'&&path==='/templates/mine'){
    const result=await env.DB.prepare("SELECT id,title,description,category,icon,license,source_name,source_url,review_status,version,copy_count,visibility FROM templates WHERE owner_id=? ORDER BY updated_at DESC").bind(user.id).all();
    return json({items:result.results});
  }
  if(method==='POST'&&path==='/templates'){
    const body=await request.json<{title?:string;description?:string;category?:string;icon?:string;license?:string;sourceName?:string;sourceUrl?:string;blocks?:unknown;publish?:boolean}>();
    const title=clean(body.title,120),description=clean(body.description,500),category=clean(body.category,60)||'기타',license=clean(body.license,80),sourceName=clean(body.sourceName,120),sourceUrl=clean(body.sourceUrl,500);
    if(!title||!description||!sourceName||!license||!body.blocks||typeof body.blocks!=='object')return json({error:'제목, 설명, 작성자/출처, 이용조건과 문서 내용은 필수입니다.'},400);
    let blocks:string;try{blocks=JSON.stringify(body.blocks);}catch{return json({error:'문서 내용을 읽을 수 없습니다.'},400);}
    if(blocks.length>350_000)return json({error:'템플릿 내용이 너무 큽니다.'},413);
    if(sourceUrl&&!/^https:\/\//i.test(sourceUrl))return json({error:'출처 URL은 https 주소를 입력해 주세요.'},400);
    const templateId=id(),at=now(),publish=body.publish===true;
    await env.DB.prepare('INSERT INTO templates(id,title,description,category,icon,visibility,license,blocks_json,created_at,updated_at,owner_id,source_name,source_url,review_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(templateId,title,description,category,clean(body.icon,8)||'📄',publish?'public':'private',license,blocks,at,at,user.id,sourceName,sourceUrl,publish?'published':'pending').run();
    await env.DB.prepare('INSERT INTO template_versions(id,template_id,version,title,description,category,icon,visibility,license,blocks_json,source_name,source_url,created_by,created_at) VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?,?)').bind(id(),templateId,title,description,category,clean(body.icon,8)||'📄',publish?'public':'private',license,blocks,sourceName,sourceUrl,user.id,at).run();
    return json({ok:true,id:templateId,review_status:publish?'published':'pending'},201);
  }
  const templateHistory=path.match(/^\/templates\/([^/]+)\/versions$/);
  if(templateHistory&&method==='GET'){
    const templateId=decodeURIComponent(templateHistory[1]),template=await env.DB.prepare('SELECT owner_id FROM templates WHERE id=?').bind(templateId).first<{owner_id:string|null}>();
    if(!template)return json({error:'템플릿을 찾을 수 없습니다.'},404);if(template.owner_id!==user.id)return json({error:'작성한 템플릿만 이력을 볼 수 있습니다.'},403);
    const result=await env.DB.prepare('SELECT id,version,title,description,category,visibility,license,created_at FROM template_versions WHERE template_id=? ORDER BY version DESC').bind(templateId).all();return json({items:result.results});
  }
  const templateRestore=path.match(/^\/templates\/([^/]+)\/versions\/([^/]+)\/restore$/);
  if(templateRestore&&method==='POST'){
    const templateId=decodeURIComponent(templateRestore[1]),versionId=decodeURIComponent(templateRestore[2]),template=await env.DB.prepare('SELECT owner_id,version FROM templates WHERE id=?').bind(templateId).first<{owner_id:string|null;version:number}>();
    if(!template)return json({error:'템플릿을 찾을 수 없습니다.'},404);if(template.owner_id!==user.id)return json({error:'작성한 템플릿만 복원할 수 있습니다.'},403);
    const snapshot=await env.DB.prepare('SELECT title,description,category,icon,visibility,license,blocks_json,source_name,source_url FROM template_versions WHERE id=? AND template_id=?').bind(versionId,templateId).first<{title:string;description:string;category:string;icon:string;visibility:string;license:string;blocks_json:string;source_name:string;source_url:string}>();
    if(!snapshot)return json({error:'저장 버전을 찾을 수 없습니다.'},404);const at=now(),nextVersion=template.version+1;
    await env.DB.prepare("UPDATE templates SET title=?,description=?,category=?,icon=?,visibility=?,license=?,blocks_json=?,source_name=?,source_url=?,review_status=CASE WHEN ?='public' THEN 'published' ELSE review_status END,version=?,updated_at=? WHERE id=?").bind(snapshot.title,snapshot.description,snapshot.category,snapshot.icon,snapshot.visibility,snapshot.license,snapshot.blocks_json,snapshot.source_name,snapshot.source_url,snapshot.visibility,nextVersion,at,templateId).run();
    await env.DB.prepare('INSERT INTO template_versions(id,template_id,version,title,description,category,icon,visibility,license,blocks_json,source_name,source_url,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id(),templateId,nextVersion,snapshot.title,snapshot.description,snapshot.category,snapshot.icon,snapshot.visibility,snapshot.license,snapshot.blocks_json,snapshot.source_name,snapshot.source_url,user.id,at).run();return json({ok:true,version:nextVersion});
  }
  const templateMatch=path.match(/^\/templates\/([^/]+)$/);
  if(templateMatch&&method==='PATCH'){
    const templateId=decodeURIComponent(templateMatch[1]),current=await env.DB.prepare('SELECT owner_id,title,description,category,icon,visibility,license,blocks_json,source_name,source_url,version FROM templates WHERE id=?').bind(templateId).first<{owner_id:string|null;title:string;description:string;category:string;icon:string;visibility:string;license:string;blocks_json:string;source_name:string;source_url:string;version:number}>();
    if(!current)return json({error:'템플릿을 찾을 수 없습니다.'},404);if(current.owner_id!==user.id)return json({error:'작성한 템플릿만 수정할 수 있습니다.'},403);
    const body=await request.json<{title?:string;description?:string;category?:string;visibility?:string}>(),visibility=['public','private','unlisted'].includes(body.visibility||'')?body.visibility!:'private',title=clean(body.title,120)||'템플릿',description=clean(body.description,500),category=clean(body.category,60)||'기타',at=now(),nextVersion=current.version+1;
    await env.DB.prepare("UPDATE templates SET title=?,description=?,category=?,visibility=?,review_status=CASE WHEN ?='public' THEN 'published' ELSE review_status END,version=?,updated_at=? WHERE id=?").bind(title,description,category,visibility,visibility,nextVersion,at,templateId).run();
    await env.DB.prepare('INSERT INTO template_versions(id,template_id,version,title,description,category,icon,visibility,license,blocks_json,source_name,source_url,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id(),templateId,nextVersion,title,description,category,current.icon,visibility,current.license,current.blocks_json,current.source_name,current.source_url,user.id,at).run();
    return json({ok:true,version:nextVersion});
  }
  if(templateMatch&&method==='DELETE'){
    const templateId=decodeURIComponent(templateMatch[1]),current=await env.DB.prepare('SELECT owner_id FROM templates WHERE id=?').bind(templateId).first<{owner_id:string|null}>();
    if(!current)return json({error:'템플릿을 찾을 수 없습니다.'},404);if(current.owner_id!==user.id)return json({error:'작성한 템플릿만 삭제할 수 있습니다.'},403);
    await env.DB.prepare('DELETE FROM templates WHERE id=?').bind(templateId).run();return json({ok:true});
  }
  const templateReport=path.match(/^\/templates\/([^/]+)\/reports$/);
  if(templateReport&&method==='POST'){
    const templateId=decodeURIComponent(templateReport[1]),template=await env.DB.prepare("SELECT id FROM templates WHERE id=? AND visibility='public' AND review_status='published'").bind(templateId).first();
    if(!template)return json({error:'공개 템플릿을 찾을 수 없습니다.'},404);
    const body=await request.json<{reason?:string}>(),reason=clean(body.reason,500);if(!reason)return json({error:'신고 사유를 입력해 주세요.'},400);
    await env.DB.prepare('INSERT INTO template_reports(id,template_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?)').bind(id(),templateId,user.id,reason,now()).run();return json({ok:true},201);
  }
  const starterMatch=path.match(/^\/pages\/([^/]+)\/starter$/);
  if(method==='POST'&&starterMatch){
    const pageId=decodeURIComponent(starterMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const body=await request.json<{claim?:boolean}>();
    if(body.claim&&canWrite(record.access)){
      const result=await env.DB.prepare('UPDATE pages SET starter_claimed_at=? WHERE id=? AND starter_json IS NOT NULL AND starter_claimed_at IS NULL').bind(now(),pageId).run();
      if(result.meta.changes){const row=await env.DB.prepare('SELECT starter_json FROM pages WHERE id=?').bind(pageId).first<{starter_json:string}>();return json({starter:row?.starter_json?JSON.parse(row.starter_json):null});}
      return json({starter:null});
    }
    return json({starter:null});
  }
  const titleMatch=path.match(/^\/pages\/([^/]+)\/title$/);
  if (method === 'PATCH' && titleMatch) {
    const pageId=decodeURIComponent(titleMatch[1]), record=await accessFor(env,user,pageId);
    if(!record||!canWrite(record.access))return json({error:'수정 권한이 없습니다.'},403);
    const body=await request.json<{title?:string;icon?:string}>(), title=clean(body.title,200), icon=clean(body.icon,8);
    if(!title)return json({error:'제목을 입력해 주세요.'},400);
    await env.DB.prepare('UPDATE pages SET title=?,icon=?,updated_at=? WHERE id=?').bind(title,icon||record.page.icon,now(),pageId).run();
    await audit(env,user,record.page.workspace_id,'PAGE_RENAMED','page',pageId);
    return json({ok:true});
  }
  const duplicateMatch=path.match(/^\/pages\/([^/]+)\/duplicate$/);
  if (method === 'POST' && duplicateMatch) {
    const sourceId=decodeURIComponent(duplicateMatch[1]), source=await accessFor(env,user,sourceId);
    if(!source||!canRead(source.access)||!['owner','admin','member'].includes(source.access.workspaceRole))return json({error:'복제 권한이 없습니다.'},403);
    const pageId=id(),at=now();
    await env.DB.prepare('INSERT INTO pages(id,workspace_id,parent_id,title,icon,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(pageId,source.page.workspace_id,null,`${source.page.title} 사본`,source.page.icon,user.id,at,at).run();
    await audit(env,user,source.page.workspace_id,'PAGE_DUPLICATED','page',pageId);
    return json({ok:true,id:pageId,sourceId});
  }
  const versionsMatch=path.match(/^\/pages\/([^/]+)\/versions$/);
  if(versionsMatch&&method==='GET'){
    const pageId=decodeURIComponent(versionsMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const rows=await env.DB.prepare('SELECT v.id,v.label,v.created_at,u.display_name AS actor_name,u.email AS actor_email FROM page_versions v JOIN users u ON u.id=v.actor_id WHERE v.page_id=? ORDER BY v.created_at DESC LIMIT 60').bind(pageId).all();
    return json({items:rows.results});
  }
  if(versionsMatch&&method==='POST'){
    const pageId=decodeURIComponent(versionsMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canWrite(record.access))return json({error:'변경 이력을 저장할 권한이 없습니다.'},403);
    const body=await request.json<{content?:unknown;label?:string}>();
    if(!body.content||typeof body.content!=='object')return json({error:'저장할 문서 내용이 없습니다.'},400);
    const content=JSON.stringify(body.content);if(content.length>350_000)return json({error:'문서가 너무 커서 이력으로 저장할 수 없습니다.'},413);
    const versionId=id(),label=clean(body.label,120),at=now();
    await env.DB.prepare('INSERT INTO page_versions(id,page_id,actor_id,label,content_json,created_at) VALUES(?,?,?,?,?,?)').bind(versionId,pageId,user.id,label,content,at).run();
    await env.DB.prepare('DELETE FROM page_versions WHERE page_id=? AND id NOT IN (SELECT id FROM page_versions WHERE page_id=? ORDER BY created_at DESC LIMIT 60)').bind(pageId,pageId).run();
    await audit(env,user,record.page.workspace_id,'PAGE_VERSION_SAVED','page',pageId);
    return json({ok:true,id:versionId,created_at:at},201);
  }
  const versionMatch=path.match(/^\/pages\/([^/]+)\/versions\/([^/]+)$/);
  if(versionMatch&&method==='GET'){
    const pageId=decodeURIComponent(versionMatch[1]),versionId=decodeURIComponent(versionMatch[2]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const row=await env.DB.prepare('SELECT id,label,created_at,content_json FROM page_versions WHERE id=? AND page_id=?').bind(versionId,pageId).first<{id:string;label:string;created_at:string;content_json:string}>();
    if(!row)return json({error:'저장된 버전을 찾을 수 없습니다.'},404);
    return json({id:row.id,label:row.label,created_at:row.created_at,content:JSON.parse(row.content_json)});
  }
  const pageDatabase=path.match(/^\/pages\/([^/]+)\/database$/);
  if(pageDatabase&&method==='GET'){
    const pageId=decodeURIComponent(pageDatabase[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const database=await env.DB.prepare('SELECT id,page_id,title,CASE WHEN calendar_view=1 THEN \'calendar\' ELSE view_type END AS view_type,created_at,updated_at FROM databases WHERE page_id=?').bind(pageId).first<{id:string;page_id:string;title:string;view_type:string;created_at:string;updated_at:string}>();
    if(!database)return json({database:null,rows:[],views:[]});
    const [rows,views]=await Promise.all([
      env.DB.prepare('SELECT id,title,status,assignee,due_date,priority,description,position,created_at,updated_at FROM database_rows WHERE database_id=? ORDER BY position,created_at').bind(database.id).all(),
      env.DB.prepare('SELECT id,database_id,name,view_type,status_filter,sort_by,group_by,created_at,updated_at FROM database_views WHERE database_id=? ORDER BY created_at').bind(database.id).all(),
    ]);
    return json({database,rows:rows.results,views:views.results});
  }
  if(pageDatabase&&method==='POST'){
    const pageId=decodeURIComponent(pageDatabase[1]),record=await accessFor(env,user,pageId);
    if(!record||!canWrite(record.access))return json({error:'데이터베이스를 만들 권한이 없습니다.'},403);
    const existing=await env.DB.prepare('SELECT id FROM databases WHERE page_id=?').bind(pageId).first<{id:string}>();
    if(existing)return json({ok:true,id:existing.id});
    const body=await request.json<{title?:string}>(),databaseId=id(),at=now();
    await env.DB.prepare('INSERT INTO databases(id,page_id,workspace_id,title,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(databaseId,pageId,record.page.workspace_id,clean(body.title,120)||'업무 목록',user.id,at,at).run();
    await audit(env,user,record.page.workspace_id,'DATABASE_CREATED','database',databaseId);
    return json({ok:true,id:databaseId},201);
  }
  const databaseMatch=path.match(/^\/databases\/([^/]+)$/);
  if(databaseMatch&&method==='PATCH'){
    const databaseId=decodeURIComponent(databaseMatch[1]),database=await env.DB.prepare('SELECT page_id,workspace_id FROM databases WHERE id=?').bind(databaseId).first<{page_id:string;workspace_id:string}>();
    if(!database)return json({error:'데이터베이스를 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,database.page_id);if(!record||!canWrite(record.access))return json({error:'데이터베이스 수정 권한이 없습니다.'},403);
    const body=await request.json<{title?:string;view_type?:string}>(),title=clean(body.title,120)||'업무 목록',calendarView=body.view_type==='calendar'?1:0,viewType=body.view_type==='board'?'board':'table';
    await env.DB.prepare('UPDATE databases SET title=?,view_type=?,calendar_view=?,updated_at=? WHERE id=?').bind(title,viewType,calendarView,now(),databaseId).run();
    return json({ok:true});
  }
  const databaseViews=path.match(/^\/databases\/([^/]+)\/views$/);
  if(databaseViews&&method==='POST'){
    const databaseId=decodeURIComponent(databaseViews[1]),database=await env.DB.prepare('SELECT page_id FROM databases WHERE id=?').bind(databaseId).first<{page_id:string}>();
    if(!database)return json({error:'데이터베이스를 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,database.page_id);if(!record||!canWrite(record.access))return json({error:'저장 뷰를 만들 권한이 없습니다.'},403);
    const body=await request.json<{name?:string;view_type?:string;status_filter?:string;sort_by?:string;group_by?:string}>(),name=clean(body.name,60);
    if(!name)return json({error:'저장 뷰 이름을 입력해 주세요.'},400);
    const viewType=['table','board','calendar'].includes(body.view_type||'')?body.view_type!:'table',statusFilter=['전체','할 일','진행 중','완료'].includes(body.status_filter||'')?body.status_filter!:'전체',sortBy=['manual','due_date','title'].includes(body.sort_by||'')?body.sort_by!:'manual',groupBy=body.group_by==='status'?'status':'none',viewId=id(),at=now();
    await env.DB.prepare('INSERT INTO database_views(id,database_id,name,view_type,status_filter,sort_by,group_by,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(viewId,databaseId,name,viewType,statusFilter,sortBy,groupBy,user.id,at,at).run();
    return json({ok:true,view:{id:viewId,database_id:databaseId,name,view_type:viewType,status_filter:statusFilter,sort_by:sortBy,group_by:groupBy,created_at:at,updated_at:at}},201);
  }
  const databaseView=path.match(/^\/database-views\/([^/]+)$/);
  if(databaseView&&(method==='PATCH'||method==='DELETE')){
    const viewId=decodeURIComponent(databaseView[1]),view=await env.DB.prepare('SELECT database_id,name,view_type,status_filter,sort_by,group_by FROM database_views WHERE id=?').bind(viewId).first<{database_id:string;name:string;view_type:string;status_filter:string;sort_by:string;group_by:string}>();
    if(!view)return json({error:'저장 뷰를 찾을 수 없습니다.'},404);
    const database=await env.DB.prepare('SELECT page_id FROM databases WHERE id=?').bind(view.database_id).first<{page_id:string}>(),record=database?await accessFor(env,user,database.page_id):null;
    if(!record||!canWrite(record.access))return json({error:'저장 뷰를 수정할 권한이 없습니다.'},403);
    if(method==='DELETE'){await env.DB.prepare('DELETE FROM database_views WHERE id=?').bind(viewId).run();return json({ok:true});}
    const body=await request.json<{name?:string;view_type?:string;status_filter?:string;sort_by?:string;group_by?:string}>(),name=clean(body.name,60)||view.name,viewType=['table','board','calendar'].includes(body.view_type||'')?body.view_type!:view.view_type,statusFilter=['전체','할 일','진행 중','완료'].includes(body.status_filter||'')?body.status_filter!:view.status_filter,sortBy=['manual','due_date','title'].includes(body.sort_by||'')?body.sort_by!:view.sort_by,groupBy=body.group_by==='status'?'status':'none',at=now();
    await env.DB.prepare('UPDATE database_views SET name=?,view_type=?,status_filter=?,sort_by=?,group_by=?,updated_at=? WHERE id=?').bind(name,viewType,statusFilter,sortBy,groupBy,at,viewId).run();
    return json({ok:true,view:{id:viewId,database_id:view.database_id,name,view_type:viewType,status_filter:statusFilter,sort_by:sortBy,group_by:groupBy,updated_at:at}});
  }
  const databaseRows=path.match(/^\/databases\/([^/]+)\/rows$/);
  if(databaseRows&&method==='POST'){
    const databaseId=decodeURIComponent(databaseRows[1]),database=await env.DB.prepare('SELECT page_id,workspace_id FROM databases WHERE id=?').bind(databaseId).first<{page_id:string;workspace_id:string}>();
    if(!database)return json({error:'데이터베이스를 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,database.page_id);if(!record||!canWrite(record.access))return json({error:'항목을 추가할 권한이 없습니다.'},403);
    const body=await request.json<{title?:string;status?:string;assignee?:string;due_date?:string;priority?:string;description?:string}>(),status=['할 일','진행 중','완료'].includes(body.status||'')?body.status!:'할 일',priority=['긴급','높음','보통','낮음'].includes(body.priority||'')?body.priority!:'보통';
    const rowId=id(),at=now(),position=(await env.DB.prepare('SELECT COALESCE(MAX(position),-1)+1 AS next FROM database_rows WHERE database_id=?').bind(databaseId).first<{next:number}>())?.next||0;
    await env.DB.prepare('INSERT INTO database_rows(id,database_id,title,status,assignee,due_date,priority,description,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(rowId,databaseId,clean(body.title,200)||'새 항목',status,clean(body.assignee,120),clean(body.due_date,20),priority,clean(body.description,10000),position,at,at).run();
    return json({ok:true,id:rowId},201);
  }
  const databaseRow=path.match(/^\/database-rows\/([^/]+)$/);
  if(databaseRow&&(method==='PATCH'||method==='DELETE')){
    const rowId=decodeURIComponent(databaseRow[1]),row=await env.DB.prepare('SELECT r.database_id,d.page_id,d.workspace_id,r.title,r.status,r.assignee,r.due_date,r.priority,r.description FROM database_rows r JOIN databases d ON d.id=r.database_id WHERE r.id=?').bind(rowId).first<{database_id:string;page_id:string;workspace_id:string;title:string;status:string;assignee:string;due_date:string;priority:string;description:string}>();
    if(!row)return json({error:'항목을 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,row.page_id);if(!record||!canWrite(record.access))return json({error:'항목을 수정할 권한이 없습니다.'},403);
    if(method==='DELETE'){await env.DB.prepare('DELETE FROM database_rows WHERE id=?').bind(rowId).run();return json({ok:true});}
    const body=await request.json<{title?:string;status?:string;assignee?:string;due_date?:string;priority?:string;description?:string}>(),status=['할 일','진행 중','완료'].includes(body.status||'')?body.status!:row.status,priority=['긴급','높음','보통','낮음'].includes(body.priority||'')?body.priority!:row.priority;
    await env.DB.prepare('UPDATE database_rows SET title=?,status=?,assignee=?,due_date=?,priority=?,description=?,updated_at=? WHERE id=?').bind(clean(body.title,200)||row.title,status,body.assignee===undefined?row.assignee:clean(body.assignee,120),body.due_date===undefined?row.due_date:clean(body.due_date,20),priority,body.description===undefined?row.description:clean(body.description,10000),now(),rowId).run();
    return json({ok:true});
  }
  const rowLinks=path.match(/^\/database-rows\/([^/]+)\/links$/);
  if(rowLinks&&(method==='GET'||method==='POST')){
    const sourceId=decodeURIComponent(rowLinks[1]),source=await env.DB.prepare('SELECT r.database_id,d.page_id,d.workspace_id FROM database_rows r JOIN databases d ON d.id=r.database_id WHERE r.id=?').bind(sourceId).first<{database_id:string;page_id:string;workspace_id:string}>();
    if(!source)return json({error:'업무 항목을 찾을 수 없습니다.'},404);
    const access=await accessFor(env,user,source.page_id);if(!access||!(method==='GET'?canRead(access.access):canWrite(access.access)))return json({error:'업무 항목에 접근할 권한이 없습니다.'},403);
    if(method==='GET'){const result=await env.DB.prepare('SELECT l.id,l.to_row_id AS row_id,r.title,r.status,r.priority,r.due_date FROM database_row_links l JOIN database_rows r ON r.id=l.to_row_id WHERE l.from_row_id=? ORDER BY l.created_at').bind(sourceId).all();return json({items:result.results});}
    const body=await request.json<{targetRowId?:string}>(),targetId=clean(body.targetRowId,60),target=await env.DB.prepare('SELECT r.id,database_id,d.page_id FROM database_rows r JOIN databases d ON d.id=r.database_id WHERE r.id=?').bind(targetId).first<{id:string;database_id:string;page_id:string}>();
    if(!target||target.database_id!==source.database_id)return json({error:'같은 데이터베이스의 업무를 연결해 주세요.'},400);
    const targetAccess=await accessFor(env,user,target.page_id);if(!targetAccess||!canWrite(targetAccess.access))return json({error:'연결 대상 업무를 수정할 권한이 없습니다.'},403);
    if(targetId===sourceId)return json({error:'자기 자신은 연결할 수 없습니다.'},400);
    const linkId=id(),at=now();await env.DB.prepare('INSERT OR IGNORE INTO database_row_links(id,from_row_id,to_row_id,created_by,created_at) VALUES(?,?,?,?,?)').bind(linkId,sourceId,targetId,user.id,at).run();
    const link=await env.DB.prepare('SELECT id FROM database_row_links WHERE from_row_id=? AND to_row_id=?').bind(sourceId,targetId).first<{id:string}>();return json({ok:true,id:link?.id||linkId},201);
  }
  const rowLink=path.match(/^\/database-row-links\/([^/]+)$/);
  if(rowLink&&method==='DELETE'){
    const linkId=decodeURIComponent(rowLink[1]),link=await env.DB.prepare('SELECT l.from_row_id,l.to_row_id,dp.page_id AS source_page,tp.page_id AS target_page FROM database_row_links l JOIN database_rows fr ON fr.id=l.from_row_id JOIN databases fd ON fd.id=fr.database_id JOIN database_rows tr ON tr.id=l.to_row_id JOIN databases td ON td.id=tr.database_id JOIN pages dp ON dp.id=fd.page_id JOIN pages tp ON tp.id=td.page_id WHERE l.id=?').bind(linkId).first<{from_row_id:string;to_row_id:string;source_page:string;target_page:string}>();
    if(!link)return json({error:'업무 연결을 찾을 수 없습니다.'},404);
    const [sourceAccess,targetAccess]=await Promise.all([accessFor(env,user,link.source_page),accessFor(env,user,link.target_page)]);if(!sourceAccess||!targetAccess||!canWrite(sourceAccess.access)||!canWrite(targetAccess.access))return json({error:'업무 연결을 변경할 권한이 없습니다.'},403);
    await env.DB.prepare('DELETE FROM database_row_links WHERE id=?').bind(linkId).run();return json({ok:true});
  }
  const commentMatch=path.match(/^\/pages\/([^/]+)\/comments$/);
  if(commentMatch&&method==='GET'){
    const pageId=decodeURIComponent(commentMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const rows=await env.DB.prepare('SELECT c.id,c.body,c.created_at,c.resolved_at,u.email,u.display_name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.page_id=? ORDER BY c.created_at ASC LIMIT 300').bind(pageId).all();
    return json({items:rows.results});
  }
  if(commentMatch&&method==='POST'){
    const pageId=decodeURIComponent(commentMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access)||record.access.role==='viewer')return json({error:'댓글 권한이 없습니다.'},403);
    const body=await request.json<{body?:string}>(),text=clean(body.body,4000);
    if(!text)return json({error:'댓글 내용을 입력해 주세요.'},400);
    const commentId=id(),at=now();await env.DB.prepare('INSERT INTO comments(id,page_id,user_id,body,created_at) VALUES(?,?,?,?,?)').bind(commentId,pageId,user.id,text,at).run();
    const targets=await env.DB.prepare('SELECT DISTINCT u.id,u.email,u.display_name FROM users u LEFT JOIN workspace_members wm ON wm.user_id=u.id AND wm.workspace_id=? LEFT JOIN page_members pm ON pm.user_id=u.id AND pm.page_id=? WHERE u.id<>? AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL)').bind(record.page.workspace_id,pageId,user.id).all<{id:string;email:string;display_name:string}>();
    const mentioned=targets.results.filter(target=>{
      const tokens=text.match(/@[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|@[\p{L}\p{N}._-]+/gu)||[];
      return tokens.some(token=>{const name=token.slice(1).toLocaleLowerCase();return name===target.email.toLocaleLowerCase()||name===target.email.split('@')[0].toLocaleLowerCase()||name===target.display_name.toLocaleLowerCase();});
    });
    if(mentioned.length)await env.DB.batch(mentioned.map(target=>env.DB.prepare('INSERT INTO notifications(id,user_id,workspace_id,page_id,comment_id,actor_id,kind,body,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id(),target.id,record.page.workspace_id,pageId,commentId,user.id,'mention',text,at)));
    await audit(env,user,record.page.workspace_id,'COMMENT_ADDED','page',pageId);
    return json({ok:true,id:commentId,createdAt:at,notified:mentioned.length},201);
  }
  if(path==='/notification-preferences'&&method==='GET'){
    await env.DB.prepare('INSERT OR IGNORE INTO notification_preferences(user_id,updated_at) VALUES(?,?)').bind(user.id,now()).run();
    const preferences=await env.DB.prepare('SELECT mentions_enabled,page_shares_enabled FROM notification_preferences WHERE user_id=?').bind(user.id).first<{mentions_enabled:number;page_shares_enabled:number}>();
    return json({mentions:Boolean(preferences?.mentions_enabled),pageShares:Boolean(preferences?.page_shares_enabled)});
  }
  if(path==='/notification-preferences'&&method==='PATCH'){
    const body=await request.json<{mentions?:boolean;pageShares?:boolean}>();
    await env.DB.prepare('INSERT INTO notification_preferences(user_id,mentions_enabled,page_shares_enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mentions_enabled=excluded.mentions_enabled,page_shares_enabled=excluded.page_shares_enabled,updated_at=excluded.updated_at').bind(user.id,body.mentions===false?0:1,body.pageShares===false?0:1,now()).run();
    return json({ok:true});
  }
  if(method==='GET'&&path==='/notifications'){
    const rows=await env.DB.prepare("SELECT n.id,n.workspace_id,n.page_id,n.comment_id,n.kind,n.body,n.created_at,n.read_at,p.title AS page_title,u.display_name AS actor_name,u.email AS actor_email FROM notifications n JOIN pages p ON p.id=n.page_id JOIN users u ON u.id=n.actor_id LEFT JOIN workspace_members wm ON wm.workspace_id=n.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=n.page_id AND pm.user_id=? LEFT JOIN notification_preferences pref ON pref.user_id=n.user_id WHERE n.user_id=? AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) AND (n.kind!='mention' OR COALESCE(pref.mentions_enabled,1)=1) AND (n.kind!='page_share' OR COALESCE(pref.page_shares_enabled,1)=1) ORDER BY n.created_at DESC LIMIT 100").bind(user.id,user.id,user.id).all();
    const unread=await env.DB.prepare("SELECT COUNT(*) AS count FROM notifications n LEFT JOIN notification_preferences pref ON pref.user_id=n.user_id WHERE n.user_id=? AND n.read_at IS NULL AND (n.kind!='mention' OR COALESCE(pref.mentions_enabled,1)=1) AND (n.kind!='page_share' OR COALESCE(pref.page_shares_enabled,1)=1)").bind(user.id).first<{count:number}>();
    return json({items:rows.results,unread:unread?.count||0});
  }
  const notificationRead=path.match(/^\/notifications\/([^/]+)\/read$/);
  if(method==='POST'&&notificationRead){const notificationId=decodeURIComponent(notificationRead[1]);await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(now(),notificationId,user.id).run();return json({ok:true});}
  if(method==='POST'&&path==='/notifications/read-all'){await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(now(),user.id).run();return json({ok:true});}
  const resolveComment=path.match(/^\/comments\/([^/]+)\/resolve$/);
  if(resolveComment&&method==='POST'){
    const commentId=decodeURIComponent(resolveComment[1]);
    const row=await env.DB.prepare('SELECT c.page_id,p.workspace_id FROM comments c JOIN pages p ON p.id=c.page_id WHERE c.id=?').bind(commentId).first<{page_id:string;workspace_id:string}>();
    if(!row)return json({error:'댓글을 찾을 수 없습니다.'},404);
    const record=await accessFor(env,user,row.page_id);if(!record||!canManage(record.access))return json({error:'댓글을 해결할 권한이 없습니다.'},403);
    await env.DB.prepare('UPDATE comments SET resolved_at=CASE WHEN resolved_at IS NULL THEN ? ELSE NULL END WHERE id=?').bind(now(),commentId).run();
    await audit(env,user,row.workspace_id,'COMMENT_RESOLUTION_CHANGED','comment',commentId);
    return json({ok:true});
  }
  const inviteMatch=path.match(/^\/workspaces\/([^/]+)\/invites$/);
  const workspaceMembers=path.match(/^\/workspaces\/([^/]+)\/members$/);
  if(method==='GET'&&workspaceMembers){
    const workspaceId=decodeURIComponent(workspaceMembers[1]),member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();
    if(!member)return json({error:'워크스페이스에 접근할 수 없습니다.'},403);
    const [members,invites]=await Promise.all([
      env.DB.prepare('SELECT u.id,u.email,u.display_name,wm.role,wm.joined_at FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=? ORDER BY CASE wm.role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, u.display_name').bind(workspaceId).all(),
      env.DB.prepare('SELECT id,email,role,created_at FROM workspace_invites WHERE workspace_id=? AND accepted_at IS NULL ORDER BY created_at DESC').bind(workspaceId).all(),
    ]);
    return json({members:members.results,invites:invites.results,canManage:['owner','admin'].includes(member.role as string),canAssignAdmin:member.role==='owner'});
  }
  const memberMatch=path.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)$/);
  if(memberMatch&&(method==='PATCH'||method==='DELETE')){
    const workspaceId=decodeURIComponent(memberMatch[1]),targetId=decodeURIComponent(memberMatch[2]);
    const actor=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first<{role:string}>();
    if(!actor||!['owner','admin'].includes(actor.role))return json({error:'워크스페이스 관리자만 멤버를 관리할 수 있습니다.'},403);
    const target=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,targetId).first<{role:string}>();
    if(!target)return json({error:'멤버를 찾을 수 없습니다.'},404);
    if(target.role==='owner')return json({error:'소유자 역할은 이 화면에서 변경하거나 제거할 수 없습니다.'},409);
    if(actor.role==='admin'&&target.role==='admin')return json({error:'관리자 역할은 소유자만 변경할 수 있습니다.'},403);
    if(method==='DELETE'){
      if(targetId===user.id)return json({error:'본인을 제거할 수 없습니다. 다른 소유자에게 먼저 소유권을 이전해 주세요.'},409);
      await env.DB.prepare('DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,targetId).run();
      await audit(env,user,workspaceId,'MEMBER_REMOVED','user',targetId);
      return json({ok:true});
    }
    const body=await request.json<{role?:string}>(),role=body.role;
    if(!['admin','member','guest'].includes(role||''))return json({error:'관리자·멤버·게스트 중에서 선택해 주세요.'},400);
    if(role==='admin'&&actor.role!=='owner')return json({error:'관리자 지정은 소유자만 할 수 있습니다.'},403);
    await env.DB.prepare('UPDATE workspace_members SET role=? WHERE workspace_id=? AND user_id=?').bind(role,workspaceId,targetId).run();
    await audit(env,user,workspaceId,'MEMBER_ROLE_CHANGED','user',targetId);
    return json({ok:true,role});
  }
  const inviteItem=path.match(/^\/workspaces\/([^/]+)\/invites\/([^/]+)$/);
  if(method==='DELETE'&&inviteItem){
    const workspaceId=decodeURIComponent(inviteItem[1]),inviteId=decodeURIComponent(inviteItem[2]);
    const actor=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first<{role:string}>();
    if(!actor||!['owner','admin'].includes(actor.role))return json({error:'워크스페이스 관리자만 초대를 취소할 수 있습니다.'},403);
    await env.DB.prepare('DELETE FROM workspace_invites WHERE id=? AND workspace_id=? AND accepted_at IS NULL').bind(inviteId,workspaceId).run();
    await audit(env,user,workspaceId,'INVITE_REVOKED','invite',inviteId);
    return json({ok:true});
  }
  if(method==='POST'&&inviteMatch){
    const workspaceId=decodeURIComponent(inviteMatch[1]),member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first<{role:string}>();
    if(!member||!['owner','admin'].includes(member.role))return json({error:'공간 관리자만 초대할 수 있습니다.'},403);
    const body=await request.json<{email?:string;role?:string}>(),email=clean(body.email,180).toLowerCase(),role=['admin','member','guest'].includes(body.role||'')?body.role!:'member';
    if(!emailPattern.test(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
    if(role==='admin'&&member.role!=='owner')return json({error:'관리자 초대는 소유자만 할 수 있습니다.'},403);
    const invited=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
    if(invited){await env.DB.prepare('INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role').bind(workspaceId,invited.id,role,now()).run();}
    else await env.DB.prepare('INSERT INTO workspace_invites(id,workspace_id,email,role,invited_by,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by,created_at=excluded.created_at,accepted_at=NULL').bind(id(),workspaceId,email,role,user.id,now()).run();
    await audit(env,user,workspaceId,'MEMBER_INVITED','workspace',workspaceId);
    let invitationSent=false;{const workspace=await env.DB.prepare('SELECT name FROM workspaces WHERE id=?').bind(workspaceId).first<{name:string}>();try{invitationSent=await sendCollaborationInvite(env,email,'workspace',workspace?.name||'공공 협업 공간',role,new URL('/',request.url).toString());}catch(error){console.error(JSON.stringify({event:'workspace_invite_email_failed',reason:error instanceof Error?error.message:'unknown'}));}}
    return json({ok:true,accepted:!!invited,invitationSent});
  }
  const shareMatch=path.match(/^\/pages\/([^/]+)\/share$/);
  if(method==='POST'&&shareMatch){
    const pageId=decodeURIComponent(shareMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canManage(record.access))return json({error:'공간 관리자만 공유 권한을 설정할 수 있습니다.'},403);
    const body=await request.json<{email?:string;role?:string}>(),email=clean(body.email,180).toLowerCase(),role=['editor','commenter','viewer'].includes(body.role||'')?body.role!:'viewer';
    if(!emailPattern.test(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
    const target=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
    if(!target){await env.DB.prepare('INSERT INTO page_invites(id,page_id,email,role,invited_by,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(page_id,email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by,created_at=excluded.created_at,accepted_at=NULL').bind(id(),pageId,email,role,user.id,now()).run();let invitationSent=false;try{invitationSent=await sendCollaborationInvite(env,email,'page',record.page.title,role,new URL('/',request.url).toString());}catch(error){console.error(JSON.stringify({event:'page_invite_email_failed',reason:error instanceof Error?error.message:'unknown'}));}return json({ok:true,invited:true,invitationSent});}
    const at=now();await env.DB.prepare('INSERT INTO page_members(page_id,user_id,role,granted_by,created_at) VALUES(?,?,?,?,?) ON CONFLICT(page_id,user_id) DO UPDATE SET role=excluded.role,granted_by=excluded.granted_by,created_at=excluded.created_at').bind(pageId,target.id,role,user.id,at).run();
    await env.DB.prepare('INSERT INTO notifications(id,user_id,workspace_id,page_id,actor_id,kind,body,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id(),target.id,record.page.workspace_id,pageId,user.id,'page_share',`${user.display_name||user.email}님이 '${record.page.title}' 페이지를 공유했습니다.`,at).run();
    await audit(env,user,record.page.workspace_id,'PAGE_SHARED','page',pageId);
    let invitationSent=false;try{invitationSent=await sendCollaborationInvite(env,email,'page',record.page.title,role,new URL('/',request.url).toString());}catch(error){console.error(JSON.stringify({event:'page_share_email_failed',reason:error instanceof Error?error.message:'unknown'}));}
    return json({ok:true,invited:false,invitationSent});
  }
  const collabMatch=path.match(/^\/collab\/([^/]+)$/);
  if(method==='GET'&&collabMatch&&request.headers.get('upgrade')?.toLowerCase()==='websocket'){
    const pageId=decodeURIComponent(collabMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const headers=new Headers({Upgrade:'websocket','x-actor-id':user.id,'x-actor-name':user.display_name||user.email.split('@')[0],'x-actor-role':record.access.role,'x-page-id':pageId});
    return env.DOC_ROOM.getByName(pageId).fetch(new Request('https://notion-internal/collab',{headers}));
  }
  if(method==='POST'&&path==='/ai/assist'){
    const aiKey=await resolveSecret(env.HASA_API_KEY);
    if(!aiKey)return json({error:'AI 연결 설정이 아직 준비되지 않았습니다.'},503);
    const body=await request.json<{action?:string;text?:string}>(),text=clean(body.text,12000),action=clean(body.action,40);
    if(!text)return json({error:'AI 작업에 사용할 텍스트를 선택해 주세요.'},400);
    const actions:Record<string,string>={summarize:'핵심 내용을 간결하게 요약해 주세요.',polish:'의미를 유지하면서 명확하고 자연스럽게 다듬어 주세요.',tasks:'합의된 후속 업무를 담당자와 기한이 확인되는 범위에서 목록으로 정리해 주세요.',translate:'한국어로 자연스럽게 번역해 주세요.'};
    const instruction=actions[action]||actions.polish;
    const base=(env.HASA_BASE_URL||'https://open.hasa.re.kr').replace(/\/$/,'');
    const response=await fetch(`${base}/v1/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${aiKey}`,'content-type':'application/json'},body:JSON.stringify({model:env.HASA_MODEL||'exaone-4.0-32b',messages:[{role:'system',content:`너는 사용자가 선택한 문서 일부를 돕는 한국어 문서 보조자다. 선택한 텍스트 밖의 사실을 지어내지 말고, 원문을 자동 저장하지 않는다. ${instruction}`},{role:'user',content:text}],temperature:0.2})});
    if(!response.ok)return json({error:'AI 요청을 처리하지 못했습니다.'},502);
    const result=await response.json<{choices?:Array<{message?:{content?:string}}>}>();
    return json({text:result.choices?.[0]?.message?.content||''});
  }
  return json({error:'요청을 찾을 수 없습니다.'},404);
}

export class DocumentRoom extends DurableObject<Env> {
  private doc = new Y.Doc();
  private sequence = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const sql=this.ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS updates(seq INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,payload TEXT NOT NULL,saved_at INTEGER NOT NULL)');
      sql.exec('CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,seq INTEGER NOT NULL)');
      const snapshot=sql.exec('SELECT payload,seq FROM snapshots WHERE id=1').toArray()[0] as {payload:string;seq:number}|undefined;
      let cursor=0;
      if(snapshot){Y.applyUpdate(this.doc,this.decode(snapshot.payload),'remote');cursor=snapshot.seq;}
      for(const row of sql.exec('SELECT payload,seq FROM updates WHERE seq>? ORDER BY seq',cursor).toArray() as Array<{payload:string;seq:number}>){Y.applyUpdate(this.doc,this.decode(row.payload),'remote');cursor=row.seq;}
      this.sequence=cursor;
    });
  }

  private encode(bytes:Uint8Array){let result='';for(const byte of bytes)result+=String.fromCharCode(byte);return btoa(result).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
  private decode(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
  private send(socket:WebSocket,type:string,data:Record<string,unknown>={}){socket.send(JSON.stringify({type,...data}));}
  private async indexSearchContent(pageId:string){
    const existing=await this.env.DB.prepare('SELECT 1 AS found FROM page_content WHERE page_id=?').bind(pageId).first();
    if(existing)return;
    const extract=(node:any):string=>node.toArray().map((child:any)=>child instanceof Y.XmlText?child.toString():child instanceof Y.XmlElement?extract(child):'').filter(Boolean).join('\n');
    const text=extract(this.doc.getXmlFragment('default')).slice(0,500_000);
    await this.env.DB.prepare('INSERT OR IGNORE INTO page_content(page_id,body_text,updated_at) VALUES(?,?,?)').bind(pageId,text,now()).run();
  }

  async fetch(request:Request){
    if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    const actor=request.headers.get('x-actor-id'),name=request.headers.get('x-actor-name')||'협업자',role=request.headers.get('x-actor-role'),pageId=request.headers.get('x-page-id');
    if(!actor||!pageId||!['owner','admin','member','guest','editor','commenter','viewer'].includes(role||''))return new Response('Forbidden',{status:403});
    if(this.ctx.getWebSockets().length>=80)return new Response('Room capacity reached',{status:503});
    const pair=new WebSocketPair(),server=pair[1];
    this.ctx.acceptWebSocket(server,[JSON.stringify({actor,name,role,pageId})]);
    this.send(server,'presence',{users:this.onlineUsers()});
    this.broadcast('presence',{users:this.onlineUsers()},server);
    return new Response(null,{status:101,webSocket:pair[0]});
  }
  private onlineUsers(){
    const users=new Map<string,string>();
    for(const socket of this.ctx.getWebSockets()){try{const meta=JSON.parse(this.ctx.getTags(socket)[0]||'{}') as {actor?:string;name?:string};if(meta.actor)users.set(meta.actor,meta.name||'협업자');}catch{}}
    return [...users].map(([id,name])=>({id,name}));
  }
  private broadcast(type:string,data:Record<string,unknown>,except?:WebSocket){
    const message=JSON.stringify({type,...data});
    for(const peer of this.ctx.getWebSockets())if(peer!==except){try{peer.send(message);}catch{}}
  }
  private async canWrite(socket:WebSocket){
    try{
      const identity=JSON.parse(this.ctx.getTags(socket)[0]||'{}') as {actor:string;pageId:string;role:string};
      const page=await this.env.DB.prepare("SELECT p.workspace_id,wm.role AS workspace_role,pm.role AS page_role FROM pages p LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? WHERE p.id=? AND p.archived_at IS NULL").bind(identity.actor,identity.actor,identity.pageId).first<{workspace_id:string;workspace_role:string|null;page_role:string|null}>();
      const role=page?.page_role||page?.workspace_role;
      return Boolean(page&&role&&['owner','admin','member','editor'].includes(role));
    }catch{return false;}
  }
  async webSocketMessage(socket:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>100_000){this.send(socket,'error',{reason:'입력 크기가 제한을 초과했습니다.'});return;}
    let request:{type?:string;data?:string};try{request=JSON.parse(message);}catch{this.send(socket,'error',{reason:'잘못된 메시지입니다.'});return;}
    let identity:{actor:string;name:string;role:string;pageId:string};try{identity=JSON.parse(this.ctx.getTags(socket)[0]||'{}');}catch{socket.close(1008,'Invalid session');return;}
    if(request.type==='sync'){
      try{await this.indexSearchContent(identity.pageId);}catch(error){console.error(JSON.stringify({event:'search_index_backfill_failed',pageId:identity.pageId,error:error instanceof Error?error.message:'unknown'}));}
      const state=this.encode(Y.encodeStateAsUpdate(this.doc));
      if(state.length<60_000)this.send(socket,'update',{seq:this.sequence,data:state});
      else {const size=48_000,parts=Math.ceil(state.length/size);if(parts>100){this.send(socket,'error',{reason:'페이지가 너무 커서 동기화할 수 없습니다.'});return;}this.send(socket,'snapshot-start',{parts,seq:this.sequence});for(let index=0;index<parts;index++)this.send(socket,'snapshot-part',{index,data:state.slice(index*size,(index+1)*size)});this.send(socket,'snapshot-end',{seq:this.sequence});}
      this.send(socket,'synced',{through:this.sequence});return;
    }
    if(request.type==='update'){
      if(!await this.canWrite(socket)){this.send(socket,'error',{reason:'편집 권한이 없거나 권한이 회수되었습니다.'});socket.close(1008,'Permission revoked');return;}
      if(!request.data||request.data.length>90_000||!/^[A-Za-z0-9_-]+$/.test(request.data)){this.send(socket,'error',{reason:'변경 내용이 올바르지 않습니다.'});return;}
      let update:Uint8Array;try{update=this.decode(request.data);const check=new Y.Doc();Y.applyUpdate(check,update);check.destroy();}catch{this.send(socket,'error',{reason:'변경 내용을 해석하지 못했습니다.'});return;}
      const saved=this.ctx.storage.sql.exec('INSERT INTO updates(actor,payload,saved_at) VALUES(?,?,?) RETURNING seq',identity.actor,request.data,Date.now()).one() as {seq:number};
      this.sequence=saved.seq;Y.applyUpdate(this.doc,update,'remote');
      try {
        const extract=(node:any):string=>node.toArray().map((child:any)=>child instanceof Y.XmlText?child.toString():child instanceof Y.XmlElement?extract(child):'').filter(Boolean).join('\n');
        const text=extract(this.doc.getXmlFragment('default')).slice(0,500_000);
        await this.env.DB.prepare('INSERT INTO page_content(page_id,body_text,updated_at) VALUES(?,?,?) ON CONFLICT(page_id) DO UPDATE SET body_text=excluded.body_text,updated_at=excluded.updated_at').bind(identity.pageId,text,now()).run();
      } catch(error) { console.error(JSON.stringify({event:'search_index_update_failed',pageId:identity.pageId,error:error instanceof Error?error.message:'unknown'})); }
      if(this.sequence%100===0){const state=this.encode(Y.encodeStateAsUpdate(this.doc));this.ctx.storage.sql.exec('INSERT INTO snapshots(id,payload,seq) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,seq=excluded.seq',state,this.sequence);this.ctx.storage.sql.exec('DELETE FROM updates WHERE seq<=?',this.sequence);}
      this.send(socket,'ack',{seq:this.sequence});
      this.broadcast('update',{seq:this.sequence,data:request.data,actor:identity.actor,name:identity.name},socket);return;
    }
    this.send(socket,'error',{reason:'지원하지 않는 작업입니다.'});
  }
  webSocketClose(socket:WebSocket){try{socket.close();}catch{}this.broadcast('presence',{users:this.onlineUsers()});}
  webSocketError(socket:WebSocket){try{socket.close(1011,'Connection error');}catch{}this.broadcast('presence',{users:this.onlineUsers()});}
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      if(!['GET','HEAD','OPTIONS'].includes(request.method)&&!originAllowed(request))return json({error:'요청 출처를 확인해 주세요.'},403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':url.origin,'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400'}});
      if(request.method==='POST'&&['/api/auth/request-code','/api/auth/verify-code','/api/auth/logout'].includes(url.pathname)){
        try{return await routeApi(request,env,null);}catch(error){console.error(JSON.stringify({event:'auth_request_error',path:url.pathname,error:error instanceof Error?error.message:'unknown'}));return json({error:'요청을 처리하지 못했습니다.'},500);}
      }
      try{return await routeApi(request,env,await currentUser(request,env));}
      catch(error){console.error(JSON.stringify({event:'api_error',path:url.pathname,error:error instanceof Error?error.message:'unknown'}));return json({error:'요청을 처리하지 못했습니다.'},500);}
    }
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','strict-origin-when-cross-origin');headers.set('x-frame-options','DENY');
    headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' wss: https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    return new Response(response.body,{status:response.status,headers});
  },
};
