import type { Env } from './index';

type Actor = {email:string;role:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const bad=(message:string,status=400)=>json({error:message},status);
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
function mayWrite(actor:Actor){return actor.role!=='REVIEWER'}
async function log(env:Env,actor:Actor,action:string,type:string,id:string,details:unknown={}){
  await env.DB.prepare('INSERT INTO audit_logs(id,actor,action,resource_type,resource_id,details,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(uuid(),actor.email,action,type,id,JSON.stringify(details),now()).run();
}
async function body(req:Request):Promise<Record<string,unknown>>{
  try{const result=await req.json<unknown>();if(!result||typeof result!=='object'||Array.isArray(result))throw 0;return result as Record<string,unknown>}catch{throw new Error('INVALID_JSON')}
}
const str=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const iso=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const appExists=async(env:Env,id:string)=>!!(await env.DB.prepare('SELECT id FROM applications WHERE id=?').bind(id).first());
export async function managementRoute(req:Request,env:Env,actor:Actor):Promise<Response|null>{
  const u=new URL(req.url),p=u.pathname.replace(/^\/api/,'');
  const write=mayWrite(actor);
  if(p==='/email-templates' && req.method==='PATCH')return bad('템플릿 ID를 지정해주세요',400);
  const tpl=p.match(/^\/email-templates\/([^/]+)$/);
  if(tpl&&req.method==='PATCH'){
    if(!write)return bad('권한이 없습니다',403);
    const id=decodeURIComponent(tpl[1]),b=await body(req);
    const subject=str(b.subject,180),text=str(b.body_text,10000);
    if(!subject||!text)return bad('메일 제목과 본문이 필요합니다');
    const old=await env.DB.prepare('SELECT * FROM email_templates WHERE id=?').bind(id).first<any>();
    if(!old)return bad('템플릿을 찾을 수 없습니다',404);
    const version=Number(old.version)+1,updated=now();
    const html='<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.7">'+text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))+'</div>';
    await env.DB.batch([
      env.DB.prepare('UPDATE email_templates SET subject=?,body_text=?,body_html=?,version=?,updated_at=? WHERE id=? AND version=?').bind(subject,text,html,version,updated,id,old.version),
      env.DB.prepare('INSERT INTO email_template_versions(template_id,version,subject,body_text,body_html,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM email_templates WHERE id=? AND version=?)')
        .bind(id,version,subject,text,html,updated,id,version)
    ]);
    const saved=await env.DB.prepare('SELECT version FROM email_templates WHERE id=?').bind(id).first<any>();
    if(Number(saved?.version)!==version)return bad('다른 사용자가 변경했습니다. 다시 불러와주세요',409);
    await log(env,actor,'EMAIL_TEMPLATE_UPDATED','email_template',id,{version});
    return json({ok:true,id,version,updatedAt:updated});
  }
  if(p==='/interviews'&&req.method==='GET'){
    const data=await env.DB.prepare("SELECT i.*,c.name candidate_name,c.email candidate_email,a.role position_name,a.stage FROM interviews i JOIN applications a ON a.id=i.application_id JOIN candidates c ON c.id=a.candidate_id WHERE c.deleted_at IS NULL ORDER BY i.starts_at DESC LIMIT 300").all();
    return json({items:data.results});
  }
  if(p==='/interviews'&&req.method==='POST'){
    if(!write)return bad('권한이 없습니다',403);
    const b=await body(req),applicationId=str(b.applicationId,100),start=iso(b.startsAt),end=b.endsAt?iso(b.endsAt):null;
    if(!applicationId||!start||!await appExists(env,applicationId))return bad('지원자와 면접 일시를 확인해 주세요');
    if(end&&end<=start)return bad('종료시각은 시작시각 이후여야 합니다');
    const id=uuid(),people=Array.isArray(b.interviewers)?b.interviewers.filter(x=>typeof x==='string').map(x=>str(x,120)).slice(0,30):[];
    await env.DB.prepare('INSERT INTO interviews(id,application_id,starts_at,ends_at,interviewers,location,notes,status) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id,applicationId,start,end,JSON.stringify(people),str(b.location,250),str(b.notes,2000),'SCHEDULED').run();
    await log(env,actor,'INTERVIEW_CREATED','interview',id,{applicationId,startsAt:start});
    return json({ok:true,id},201);
  }
  const im=p.match(/^\/interviews\/([^/]+)$/);
  if(im&&req.method==='PATCH'){
    if(!write)return bad('권한이 없습니다',403);
    const id=decodeURIComponent(im[1]),b=await body(req),status=str(b.status,30);
    if(!['SCHEDULED','COMPLETED','CANCELLED'].includes(status))return bad('유효하지 않은 면접 상태입니다');
    const result=await env.DB.prepare('UPDATE interviews SET status=? WHERE id=?').bind(status,id).run();
    if(!result.meta.changes)return bad('면접을 찾을 수 없습니다',404);
    await log(env,actor,'INTERVIEW_STATUS_CHANGED','interview',id,{status});return json({ok:true});
  }
  if(p==='/evaluations'&&req.method==='GET'){
    const data=await env.DB.prepare('SELECT e.*,c.name candidate_name,a.role position_name FROM evaluations e JOIN applications a ON a.id=e.application_id JOIN candidates c ON c.id=a.candidate_id WHERE c.deleted_at IS NULL ORDER BY e.submitted_at DESC LIMIT 300').all();
    return json({items:data.results});
  }
  if(p==='/evaluations'&&req.method==='POST'){
    const b=await body(req),id=str(b.applicationId,100),score=Number(b.score),note=str(b.notes,2000);
    if(!id||!await appExists(env,id)||!Number.isFinite(score)||score<0||score>100)return bad('지원건과 점수(0~100)를 확인해 주세요');
    const evaluator=actor.email,existing=await env.DB.prepare('SELECT id FROM evaluations WHERE application_id=? AND evaluator_email=?').bind(id,evaluator).first<any>();
    const evalId=existing?.id||uuid(),time=now();
    if(existing){
      await env.DB.prepare('UPDATE evaluations SET score=?,notes=?,submitted_at=? WHERE id=?').bind(score,note,time,evalId).run();
    }else{
      await env.DB.prepare('INSERT INTO evaluations(id,application_id,evaluator_email,score,notes,submitted_at) VALUES(?,?,?,?,?,?)')
        .bind(evalId,id,evaluator,score,note,time).run();
    }
    await log(env,actor,'EVALUATION_SUBMITTED','evaluation',evalId,{applicationId:id});
    return json({ok:true,id:evalId});
  }
  const memo=p.match(/^\/applications\/([^/]+)\/memo$/);
  if(memo&&req.method==='PATCH'){
    if(!write)return bad('권한이 없습니다',403);
    const id=decodeURIComponent(memo[1]),b=await body(req),text=str(b.memo,5000),time=now();
    const result=await env.DB.prepare('UPDATE applications SET memo=?,updated_at=? WHERE id=?').bind(text,time,id).run();
    if(!result.meta.changes)return bad('지원자를 찾을 수 없습니다',404);
    await log(env,actor,'APPLICATION_MEMO_UPDATED','application',id);
    return json({ok:true,memo:text});
  }
  const hist=p.match(/^\/applications\/([^/]+)\/history$/);
  if(hist&&req.method==='GET'){
    const id=decodeURIComponent(hist[1]);
    if(!await appExists(env,id))return bad('지원자를 찾을 수 없습니다',404);
    const rows=await env.DB.prepare('SELECT id,from_stage,to_stage,actor,version,created_at FROM stage_events WHERE application_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();
    return json({items:rows.results});
  }
  if(p==='/ai/models'&&req.method==='GET'){
    if(!env.HASA_API_KEY)return bad('HASA API 설정이 필요합니다',503);
    const base=(env.HASA_BASE_URL||'https://open.hasa.re.kr').replace(/\/+$/,'').replace(/\/v1$/,'');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
    try{
      const res=await fetch(base+'/v1/models',{headers:{authorization:'Bearer '+env.HASA_API_KEY},signal:ctrl.signal});
      if(!res.ok)return bad('HASA 모델 목록을 확인할 수 없습니다',502);
      const data=await res.json<any>();return json({models:Array.isArray(data.data)?data.data.map((x:any)=>({id:x.id})):[]});
    }catch{return bad('HASA 연결이 원활하지 않습니다',503)}finally{clearTimeout(timer)}
  }
  return null;
}
