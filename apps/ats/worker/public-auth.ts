/** Public email OTP authentication for 00AI ATS (Cloudflare D1).
 * Each verified user receives an isolated organization. Existing historic records remain quarantined.
 * Never expose protected ATS APIs without a verified getSession() result.
 */
export interface AuthEnv {
  DB: D1Database;
  ATS_AUTH_PEPPER?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM_NAME: string;
  EMAIL_FROM_ADDRESS: string;
}
export type Session={userId:string;email:string;organizationId:string;organizationName:string;role:'OWNER'|'ADMIN'|'RECRUITER'|'REVIEWER'};
const now=()=>new Date().toISOString();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const encoder=new TextEncoder();
function strongPepper(env:AuthEnv){if(!env.ATS_AUTH_PEPPER||env.ATS_AUTH_PEPPER.length<32)throw new Error('AUTH_NOT_CONFIGURED');return env.ATS_AUTH_PEPPER;}
async function hash(env:AuthEnv,value:string){const data=encoder.encode(strongPepper(env)+'\u0000'+value);const digest=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
function token(){const a=crypto.getRandomValues(new Uint8Array(32));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
function code(){const a=crypto.getRandomValues(new Uint32Array(1));return String(a[0]%1000000).padStart(6,'0');}
function sameOrigin(req:Request){const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin;}
const cookie=(t:string)=>`ats_v2_session=${t}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`;
const clearCookie='ats_v2_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0';
const emailOK=(s:string)=>s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
async function limit(env:AuthEnv,key:string,max:number,minutes:number){
  const n=now(),expiry=new Date(Date.now()+minutes*60_000).toISOString();
  await env.DB.prepare(`INSERT INTO login_rate_limits(bucket,count,window_expires_at) VALUES(?,1,?)
     ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_expires_at<=? THEN 1 ELSE count+1 END,
       window_expires_at=CASE WHEN window_expires_at<=? THEN excluded.window_expires_at ELSE window_expires_at END`)
    .bind(key,expiry,n,n).run();
  const r=await env.DB.prepare('SELECT count FROM login_rate_limits WHERE bucket=?').bind(key).first<{count:number}>();
  return (r?.count||0)<=max;
}
async function sendCode(env:AuthEnv,email:string,value:string){
  if(!env.BREVO_API_KEY)throw new Error('MAIL_NOT_CONFIGURED');
  const result=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({sender:{email:env.EMAIL_FROM_ADDRESS,name:env.EMAIL_FROM_NAME},to:[{email}],subject:'00AI ATS · 로그인 인증번호',textContent:`인증번호: ${value}\n10분 이내에 입력하세요. 요청하지 않았다면 이 메시지를 무시하세요.`})});
  if(!result.ok)throw new Error('MAIL_FAILED_'+result.status);
}
export async function getSession(req:Request,env:AuthEnv):Promise<Session|null>{
  if(!env.ATS_AUTH_PEPPER)return null;
  const t=/\bats_v2_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];if(!t)return null;
  const row=await env.DB.prepare(`SELECT u.id AS userId,u.email,s.organization_id AS organizationId,
      o.name AS organizationName,m.role FROM auth_sessions s
    JOIN app_users u ON u.id=s.user_id AND u.disabled_at IS NULL
    JOIN memberships m ON m.user_id=u.id AND m.organization_id=s.organization_id
    JOIN organizations o ON o.id=s.organization_id AND o.status='ACTIVE'
    WHERE s.token_digest=? AND s.expires_at>? AND s.revoked_at IS NULL`)
    .bind(await hash(env,'session:'+t),now()).first<Session>();
  return row||null;
}
async function completeAuth(env:AuthEnv,email:string,organizationName:string,inviteToken:string):Promise<{token:string;session:Session}>{
  const at=now();let u=await env.DB.prepare('SELECT id FROM app_users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
  if(!u){
    const userId=crypto.randomUUID();
    await env.DB.prepare('INSERT OR IGNORE INTO app_users(id,email,email_verified_at,created_at) VALUES(?,?,?,?)').bind(userId,email,at,at).run();
    u=await env.DB.prepare('SELECT id FROM app_users WHERE email=? COLLATE NOCASE').bind(email).first<{id:string}>();
  }
  if(!u)throw new Error('USER_CREATE_FAILED');
  let orgId:string|undefined;
  if(inviteToken&&/^[a-f0-9]{64}$/.test(inviteToken)){
    const digest=await hash(env,'invite:'+inviteToken);
    const inv=await env.DB.prepare(`SELECT i.id,i.organization_id,i.role FROM organization_invites i
      JOIN organizations o ON o.id=i.organization_id AND o.status='ACTIVE'
      WHERE i.token_digest=? AND i.recipient_email=? COLLATE NOCASE AND i.accepted_at IS NULL AND i.expires_at>?`).bind(digest,email,at).first<{id:string;organization_id:string;role:string}>();
    if(inv){
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)').bind(inv.organization_id,u.id,inv.role,at),
        env.DB.prepare('UPDATE organization_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL').bind(at,inv.id)
      ]);
      orgId=inv.organization_id;
    }
  }
  if(!orgId){
    const existing=await env.DB.prepare(`SELECT m.organization_id FROM memberships m
      JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND o.status='ACTIVE' ORDER BY m.created_at LIMIT 1`)
      .bind(u.id).first<{organization_id:string}>();orgId=existing?.organization_id;
  }
  if(!orgId){
    orgId=crypto.randomUUID();const title=(organizationName.trim().slice(0,80)||'내 채용 워크스페이스');
    const templateId=orgId+':rejection',subject='[{{company_name}}] 채용 결과 안내';
    const body='안녕하세요, {{candidate_name}}님.\n\n{{company_name}} 채용에 관심을 가지고 지원해 주셔서 감사합니다.\n신중한 검토 끝에 이번 채용에서는 아쉽게도 함께하지 못하게 되었음을 안내드립니다.\n앞으로의 도전과 성장을 진심으로 응원합니다.\n\n{{company_name}} 채용담당자 드림';
    const html='<div style="white-space:pre-wrap;font-family:sans-serif">'+body+'</div>';
    await env.DB.batch([
      env.DB.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').bind(orgId,title,at),
      env.DB.prepare('INSERT INTO memberships(organization_id,user_id,role,created_at) VALUES(?,?,?,?)').bind(orgId,u.id,'OWNER',at),
      env.DB.prepare('INSERT INTO email_templates(id,name,subject,body_text,body_html,version,active,updated_at,organization_id) VALUES(?,?,?,?,?,1,1,?,?)')
        .bind(templateId,'불합격 위로 이메일',subject,body,html,at,orgId),
      env.DB.prepare('INSERT INTO email_template_versions(template_id,version,subject,body_text,body_html,created_at) VALUES(?,1,?,?,?,?)')
        .bind(templateId,subject,body,html,at)
    ]);
  }
  const roleRow=await env.DB.prepare(`SELECT o.name AS organizationName,m.role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.organization_id=? AND o.status='ACTIVE'`)
    .bind(u.id,orgId).first<{organizationName:string;role:Session['role']}>();
  if(!roleRow)throw new Error('MEMBERSHIP_INVALID');
  const t=token();await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,organization_id,token_digest,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),u.id,orgId,await hash(env,'session:'+t),new Date(Date.now()+12*60*60*1000).toISOString(),at).run();
  return {token:t,session:{userId:u.id,email,organizationId:orgId,organizationName:roleRow.organizationName,role:roleRow.role}};
}
export async function authRoute(req:Request,env:AuthEnv):Promise<Response|null>{
  const path=new URL(req.url).pathname;
  if(!path.startsWith('/api/auth/'))return null;
  if(req.method==='GET'&&path==='/api/auth/me'){return json({session:await getSession(req,env)});}
  if(req.method!=='POST'||!sameOrigin(req))return json({error:'허용되지 않은 요청입니다.'},403);
  if(path==='/api/auth/logout'){
    const t=/\bats_v2_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];
    if(t&&env.ATS_AUTH_PEPPER)await env.DB.prepare('UPDATE auth_sessions SET revoked_at=? WHERE token_digest=?').bind(now(),await hash(env,'session:'+t)).run();
    const r=json({ok:true});r.headers.set('set-cookie',clearCookie);return r;
  }
  if(!env.ATS_AUTH_PEPPER||env.ATS_AUTH_PEPPER.length<32)return json({error:'로그인 서비스 설정이 완료되지 않았습니다.'},503);
  let data:Record<string,unknown>;try{data=(await req.json()) as Record<string,unknown>;if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{return json({error:'올바른 요청을 입력해 주세요.'},400);}
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(!emailOK(email))return json({error:'올바른 이메일 주소를 입력해 주세요.'},400);
  const ip=(req.headers.get('cf-connecting-ip')||'unknown').slice(0,64);
  if(!await limit(env,'ip:'+await hash(env,'ip:'+ip),24,15)||!await limit(env,'email:'+await hash(env,'email:'+email),8,15))return json({error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
  if(path==='/api/auth/request-code'){
    if(!env.BREVO_API_KEY)return json({error:'이메일 인증 발송이 설정되지 않았습니다.'},503);
    const t=crypto.randomUUID(),value=code(),at=now(),expiry=new Date(Date.now()+10*60*1000).toISOString();
    await env.DB.prepare('INSERT INTO otp_challenges(id,email,code_digest,expires_at,created_at) VALUES(?,?,?,?,?)').bind(t,email,await hash(env,'code:'+t+':'+value),expiry,at).run();
    try{await sendCode(env,email,value);}catch(e){await env.DB.prepare('DELETE FROM otp_challenges WHERE id=?').bind(t).run();return json({error:'인증 이메일 발송에 실패했습니다.'},502);}
    return json({ok:true,challengeId:t,expiresIn:600});
  }
  if(path==='/api/auth/verify-code'){
    const challengeId=typeof data.challengeId==='string'?data.challengeId:'';
    const value=typeof data.code==='string'?data.code:'';
    if(!/^[0-9]{6}$/.test(value)||!/^[0-9a-f-]{36}$/.test(challengeId))return json({error:'인증번호를 확인해 주세요.'},400);
    const c=await env.DB.prepare('SELECT code_digest,attempts,consumed_at,expires_at FROM otp_challenges WHERE id=? AND email=? COLLATE NOCASE')
      .bind(challengeId,email).first<{code_digest:string;attempts:number;consumed_at:string|null;expires_at:string}>();
    if(!c||c.consumed_at||c.expires_at<=now()||c.attempts>=5)return json({error:'인증번호가 만료되었거나 올바르지 않습니다.'},401);
    const match=(await hash(env,'code:'+challengeId+':'+value))===c.code_digest;
    const at=now();const used=await env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1,consumed_at=CASE WHEN ? THEN ? ELSE consumed_at END WHERE id=? AND consumed_at IS NULL AND attempts<5 AND expires_at>?')
      .bind(match?1:0,match?at:null,challengeId,at).run();
    if(!match||!used.meta.changes)return json({error:'인증번호가 올바르지 않습니다.'},401);
    const info=await completeAuth(env,email,typeof data.organizationName==='string'?data.organizationName:'',typeof data.inviteToken==='string'?data.inviteToken:'');
    const r=json({ok:true,session:info.session});r.headers.set('set-cookie',cookie(info.token));return r;
  }
  return json({error:'찾을 수 없습니다.'},404);
}