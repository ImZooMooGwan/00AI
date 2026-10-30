import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DOC_ROOM: DurableObjectNamespace<DocumentRoom>;
  SESSION_SECRET: string;
  BREVO_API_KEY?: string;
  HASA_API_KEY?: string;
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
function decodePayload(value: string) {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return JSON.parse(raw) as { sub: string; exp: number };
}
async function setSession(userId: string, env: Env) {
  const payload = btoa(JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
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
    if (!payload || !signature || await hmac(env.SESSION_SECRET, payload) !== signature) return null;
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
  if (!env.BREVO_API_KEY) throw new Error('EMAIL_NOT_CONFIGURED');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
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

async function routeApi(request: Request, env: Env, user: User | null): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;

  if (method === 'GET' && path === '/health') return json({ ok: true, app: '00AI WORKSPACE', auth: Boolean(env.BREVO_API_KEY), ai: Boolean(env.HASA_API_KEY), database: true, realtime: true });

  if (method === 'POST' && path === '/auth/request-code') {
    if (!originAllowed(request)) return json({ error: '허용되지 않은 요청입니다.' }, 403);
    const body = await request.json<{email?:string}>();
    const email = clean(body.email,180).toLowerCase();
    if (!emailPattern.test(email)) return json({ error: '이메일 주소를 확인해 주세요.' }, 400);
    if (!env.SESSION_SECRET) return json({ error: '인증 설정이 준비되지 않았습니다.' }, 503);
    if (!env.BREVO_API_KEY) return json({ error: '이메일 발송 설정을 확인 중입니다. 잠시 후 다시 시도해 주세요.' }, 503);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const fingerprint = await hmac(env.SESSION_SECRET, `otp-ip:${ip}`);
    const rate = await env.DB.prepare('SELECT window_started,count FROM email_rate_limits WHERE fingerprint=?').bind(fingerprint).first<{window_started:number;count:number}>();
    if (rate && Date.now()-rate.window_started < 60*60_000 && rate.count >= 8) return json({error:'요청 횟수가 많습니다. 한 시간 뒤 다시 시도해 주세요.'},429);
    if (!rate || Date.now()-rate.window_started >= 60*60_000) await env.DB.prepare('INSERT INTO email_rate_limits(fingerprint,window_started,count) VALUES(?,?,1) ON CONFLICT(fingerprint) DO UPDATE SET window_started=excluded.window_started,count=1').bind(fingerprint,Date.now()).run();
    else await env.DB.prepare('UPDATE email_rate_limits SET count=count+1 WHERE fingerprint=?').bind(fingerprint).run();
    const recent = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email=? COLLATE NOCASE').bind(email).first<{sent_at:number}>();
    if (recent && Date.now() - recent.sent_at < 45_000) return json({ ok: true, message: '해당 이메일로 로그인 코드를 보냈다면 잠시 후 도착합니다.' });
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6,'0');
    const codeHash = await hmac(env.SESSION_SECRET, `${email}:${code}`);
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
    const actual = await hmac(env.SESSION_SECRET,`${email}:${code}`);
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
  if (!user) return json({error:'로그인이 필요합니다.'},401);

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
    const rows=await env.DB.prepare('SELECT p.id,p.parent_id,p.title,p.icon,p.created_at,p.updated_at,p.created_by,COALESCE(pm.role,wm.role) AS role,p.starter_json IS NOT NULL AND p.starter_claimed_at IS NULL AS has_starter FROM pages p LEFT JOIN workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=? LEFT JOIN page_members pm ON pm.page_id=p.id AND pm.user_id=? WHERE p.workspace_id=? AND p.archived_at IS NULL AND (wm.user_id IS NOT NULL OR pm.user_id IS NOT NULL) ORDER BY p.updated_at DESC LIMIT 500').bind(user.id,user.id,workspaceId).all();
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
      const template=await env.DB.prepare("SELECT blocks_json FROM templates WHERE id=? AND visibility='public'").bind(clean(body.templateId,100)).first<{blocks_json:string}>();
      if (!template) return json({error:'템플릿을 찾을 수 없습니다.'},404);
      starterJson=template.blocks_json;
      await env.DB.prepare('INSERT INTO audit_log(id,workspace_id,actor_id,action,resource_type,resource_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(),workspaceId,user.id,'TEMPLATE_COPIED','template',body.templateId,at).run();
    }
    await env.DB.prepare('INSERT INTO pages(id,workspace_id,parent_id,title,icon,created_by,created_at,updated_at,starter_json) VALUES(?,?,?,?,?,?,?,?,?)').bind(pageId,workspaceId,parentId,title,icon,user.id,at,at,starterJson).run();
    await audit(env,user,workspaceId,'PAGE_CREATED','page',pageId);
    return json({ok:true,id:pageId},201);
  }
  if (method === 'GET' && path === '/templates') {
    const result=await env.DB.prepare("SELECT id,title,description,category,icon,license FROM templates WHERE visibility='public' ORDER BY category,title").all();
    return json({items:result.results});
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
    await audit(env,user,record.page.workspace_id,'COMMENT_ADDED','page',pageId);
    return json({ok:true,id:commentId,createdAt:at},201);
  }
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
  if(method==='POST'&&inviteMatch){
    const workspaceId=decodeURIComponent(inviteMatch[1]),member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first<{role:string}>();
    if(!member||!['owner','admin'].includes(member.role))return json({error:'공간 관리자만 초대할 수 있습니다.'},403);
    const body=await request.json<{email?:string;role?:string}>(),email=clean(body.email,180).toLowerCase(),role=['admin','member','guest'].includes(body.role||'')?body.role!:'member';
    if(!emailPattern.test(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
    const invited=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
    if(invited){await env.DB.prepare('INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role').bind(workspaceId,invited.id,role,now()).run();}
    else await env.DB.prepare('INSERT INTO workspace_invites(id,workspace_id,email,role,invited_by,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by,created_at=excluded.created_at,accepted_at=NULL').bind(id(),workspaceId,email,role,user.id,now()).run();
    await audit(env,user,workspaceId,'MEMBER_INVITED','workspace',workspaceId);
    return json({ok:true,accepted:!!invited});
  }
  const shareMatch=path.match(/^\/pages\/([^/]+)\/share$/);
  if(method==='POST'&&shareMatch){
    const pageId=decodeURIComponent(shareMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canManage(record.access))return json({error:'공간 관리자만 공유 권한을 설정할 수 있습니다.'},403);
    const body=await request.json<{email?:string;role?:string}>(),email=clean(body.email,180).toLowerCase(),role=['editor','commenter','viewer'].includes(body.role||'')?body.role!:'viewer';
    if(!emailPattern.test(email))return json({error:'이메일 주소를 확인해 주세요.'},400);
    const target=await env.DB.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
    if(!target){await env.DB.prepare('INSERT INTO page_invites(id,page_id,email,role,invited_by,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(page_id,email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by,created_at=excluded.created_at,accepted_at=NULL').bind(id(),pageId,email,role,user.id,now()).run();return json({ok:true,invited:true});}
    await env.DB.prepare('INSERT INTO page_members(page_id,user_id,role,granted_by,created_at) VALUES(?,?,?,?,?) ON CONFLICT(page_id,user_id) DO UPDATE SET role=excluded.role,granted_by=excluded.granted_by,created_at=excluded.created_at').bind(pageId,target.id,role,user.id,now()).run();
    await audit(env,user,record.page.workspace_id,'PAGE_SHARED','page',pageId);
    return json({ok:true,invited:false});
  }
  const collabMatch=path.match(/^\/collab\/([^/]+)$/);
  if(method==='GET'&&collabMatch&&request.headers.get('upgrade')?.toLowerCase()==='websocket'){
    const pageId=decodeURIComponent(collabMatch[1]),record=await accessFor(env,user,pageId);
    if(!record||!canRead(record.access))return json({error:'문서 접근 권한이 없습니다.'},403);
    const headers=new Headers({Upgrade:'websocket','x-actor-id':user.id,'x-actor-name':user.display_name||user.email.split('@')[0],'x-actor-role':record.access.role,'x-page-id':pageId});
    return env.DOC_ROOM.getByName(pageId).fetch(new Request('https://notion-internal/collab',{headers}));
  }
  if(method==='POST'&&path==='/ai/assist'){
    if(!env.HASA_API_KEY)return json({error:'AI 연결 설정이 아직 준비되지 않았습니다.'},503);
    const body=await request.json<{action?:string;text?:string}>(),text=clean(body.text,12000),action=clean(body.action,40);
    if(!text)return json({error:'AI 작업에 사용할 텍스트를 선택해 주세요.'},400);
    const actions:Record<string,string>={summarize:'핵심 내용을 간결하게 요약해 주세요.',polish:'의미를 유지하면서 명확하고 자연스럽게 다듬어 주세요.',tasks:'합의된 후속 업무를 담당자와 기한이 확인되는 범위에서 목록으로 정리해 주세요.',translate:'한국어로 자연스럽게 번역해 주세요.'};
    const instruction=actions[action]||actions.polish;
    const base=(env.HASA_BASE_URL||'https://open.hasa.re.kr').replace(/\/$/,'');
    const response=await fetch(`${base}/v1/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${env.HASA_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.HASA_MODEL||'exaone-4.0-32b',messages:[{role:'system',content:`너는 사용자가 선택한 문서 일부를 돕는 한국어 문서 보조자다. 선택한 텍스트 밖의 사실을 지어내지 말고, 원문을 자동 저장하지 않는다. ${instruction}`},{role:'user',content:text}],temperature:0.2})});
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
