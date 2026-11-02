import { authRoute, getSession, type AuthEnv, type Session } from './public-auth';

export interface Env extends AuthEnv {
  ASSETS?: Fetcher;
  RESUMES?: R2Bucket;
  RESUME_FILES?: KVNamespace;
  EMAIL_QUEUE?: Queue;
  HASA_API_KEY?: string;
  HASA_BASE_URL?: string;
  EMAIL_SERVICE_VERIFIED?: string;
}
const STAGES=['DOCUMENT','FIRST_INTERVIEW','FINAL_INTERVIEW','HIRED','REJECTED'] as const;
type Stage=typeof STAGES[number];
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const err=(message:string,status=400)=>respond({error:message},status);
const str=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const replacement=(s:string,values:Record<string,string>)=>s.replace(/\{\{([a-z_]+)\}\}/gi,(_,key)=>values[key]||'');
const isAdmin=(s:Session)=>s.role==='OWNER'||s.role==='ADMIN';
const canManage=(s:Session)=>s.role!=='REVIEWER';
const EMAIL_DELAY=600_000;
const TPL_SUFFIX=':rejection';
const templateId=(org:string)=>org+TPL_SUFFIX;
const mimeTypes:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',hwp:'application/x-hwp',hwpx:'application/vnd.hancom.hwpx',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
const parseJSON=async(req:Request)=>{const data=await req.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID_JSON');return data as Record<string,unknown>};
function mailEnabled(env:Env){return !!env.BREVO_API_KEY&&env.EMAIL_SERVICE_VERIFIED==='true';}
async function audit(env:Env,actor:Session,action:string,resource:string,id:string,details:unknown={}){
  await env.DB.prepare('INSERT INTO audit_logs(id,actor,action,resource_type,resource_id,details,created_at,organization_id) VALUES(?,?,?,?,?,?,?,?)')
    .bind(uid(),actor.email,action,resource,id,JSON.stringify(details).slice(0,4000),now(),actor.organizationId).run();
}
async function belongs(env:Env,s:Session,appId:string){
  return env.DB.prepare(`SELECT a.id,a.candidate_id,a.role,a.stage,a.version,a.resume_key,a.resume_name,a.memo,c.name,c.email,c.phone
    FROM applications a JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=a.organization_id
    WHERE a.id=? AND a.organization_id=? AND c.deleted_at IS NULL`)
    .bind(appId,s.organizationId).first<any>();
}
async function orgSettings(env:Env,org:string){return env.DB.prepare('SELECT id,name,email_enabled,ai_enabled FROM organizations WHERE id=? AND status=\'ACTIVE\'').bind(org).first<any>()}
async function dueEmails(env:Env,at=now()){
  // No automatic repeat after an unknown provider result: manual reconciliation avoids double sending.
  const stale=new Date(Date.now()-15*60*1000).toISOString();
  await env.DB.prepare("UPDATE email_schedules SET status='UNKNOWN',last_error='DELIVERY_STATUS_UNCERTAIN',updated_at=? WHERE status='PROCESSING' AND claimed_at<?").bind(at,stale).run();
  const results=await env.DB.prepare(`SELECT s.id,s.application_id,s.event_id,s.version,s.organization_id,s.recipient_email,s.template_version,s.scheduled_at,
    a.stage,a.version AS application_version,c.name AS candidate_name,c.email AS candidate_email,
    o.name AS organization_name,v.subject,v.body_text,v.body_html
    FROM email_schedules s
    JOIN applications a ON a.id=s.application_id AND a.organization_id=s.organization_id
    JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=s.organization_id AND c.deleted_at IS NULL
    JOIN organizations o ON o.id=s.organization_id AND o.status='ACTIVE' AND o.email_enabled=1
    JOIN email_template_versions v ON v.template_id=s.organization_id || ':rejection' AND v.version=s.template_version
    WHERE s.status='PENDING' AND s.scheduled_at<=? AND a.stage='REJECTED' AND a.version=s.version
    ORDER BY s.scheduled_at ASC LIMIT 50`).bind(at).all<any>();
  // The template join uses a correlated key created per organization; avoid a new template lookup with user input.
  for(const s of results.results){
    const changed=await env.DB.prepare(`UPDATE email_schedules SET status='PROCESSING',claimed_at=?,updated_at=?
      WHERE id=? AND organization_id=? AND status='PENDING' AND scheduled_at<=?
      AND EXISTS(SELECT 1 FROM applications WHERE id=? AND organization_id=? AND stage='REJECTED' AND version=?)`)
      .bind(at,at,s.id,s.organization_id,at,s.application_id,s.organization_id,s.version).run();
    if(!changed.meta.changes)continue;
    if(!mailEnabled(env)){
      await env.DB.prepare("UPDATE email_schedules SET status='FAILED',last_error='EMAIL_PROVIDER_NOT_READY',updated_at=? WHERE id=? AND status='PROCESSING'").bind(now(),s.id).run();continue;
    }
    const variables={candidate_name:s.candidate_name,company_name:s.organization_name,job_title:''};
    const subject=replacement(s.subject,variables),content=replacement(s.body_text,variables),html=replacement(s.body_html,{candidate_name:escapeHTML(s.candidate_name),company_name:escapeHTML(s.organization_name),job_title:''});
    try{
      const resp=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({sender:{name:env.EMAIL_FROM_NAME,email:env.EMAIL_FROM_ADDRESS},to:[{email:s.recipient_email}],subject,textContent:content,htmlContent:html})});
      if(!resp.ok){
        const code=resp.status;
        await env.DB.prepare("UPDATE email_schedules SET status='FAILED',last_error=?,retry_count=retry_count+1,updated_at=? WHERE id=? AND status='PROCESSING'").bind('EMAIL_PROVIDER_HTTP_'+code,now(),s.id).run();continue;
      }
      let obj:any={};try{obj=await resp.json()}catch{}
      await env.DB.prepare("UPDATE email_schedules SET status='SENT',sent_at=?,provider_message_id=?,updated_at=? WHERE id=? AND status='PROCESSING'")
        .bind(now(),str(obj.messageId,200)||'provider-accepted',now(),s.id).run();
    }catch(e){
      // Provider may have delivered an email despite timeout; do not automatically retry.
      await env.DB.prepare("UPDATE email_schedules SET status='UNKNOWN',last_error='DELIVERY_UNCONFIRMED',updated_at=? WHERE id=? AND status='PROCESSING'").bind(now(),s.id).run();
    }
  }
  return results.results.length;
}
async function route(req:Request,env:Env,s:Session){
  const pathname=new URL(req.url).pathname.replace(/^\/api/,'');
  const org=s.organizationId;
  if(req.method==='GET'&&pathname==='/me')return respond({email:s.email,role:s.role,organizationId:org,organizationName:s.organizationName,userId:s.userId});
  if(req.method==='GET'&&pathname==='/health')return respond({ok:true,service:'00AI ATS',emailEnabled:mailEnabled(env),storage:!!(env.RESUMES||env.RESUME_FILES),hasaConfigured:!!env.HASA_API_KEY});
  if(req.method==='GET'&&pathname==='/organization'){
    const settings=await orgSettings(env,org);return respond({organization:settings});
  }
  if(req.method==='PATCH'&&pathname==='/organization'){
    if(!isAdmin(s))return err('관리자 권한이 필요합니다.',403);
    const b=await parseJSON(req),name=str(b.name,80);if(!name)return err('조직 이름을 입력해 주세요.');
    await env.DB.prepare('UPDATE organizations SET name=? WHERE id=? AND status=\'ACTIVE\'').bind(name,org).run();
    await audit(env,s,'ORGANIZATION_UPDATED','organization',org);return respond({ok:true,name});
  }
  if(req.method==='PATCH'&&pathname==='/organization/automation'){
    if(!isAdmin(s))return err('관리자 권한이 필요합니다.',403);
    const b=await parseJSON(req),enable=b.emailEnabled===true,ai=b.aiEnabled===true;
    if(enable&&!mailEnabled(env))return err('발신 도메인 인증을 먼저 완료해야 합니다.',409);
    await env.DB.prepare('UPDATE organizations SET email_enabled=?,ai_enabled=? WHERE id=? AND status=\'ACTIVE\'')
      .bind(enable?1:0,ai?1:0,org).run();
    if(!enable)await env.DB.prepare("UPDATE email_schedules SET status='CANCELLED',cancelled_at=?,updated_at=? WHERE organization_id=? AND status='PENDING'").bind(now(),now(),org).run();
    await audit(env,s,'AUTOMATION_UPDATED','organization',org,{emailEnabled:enable,aiEnabled:ai});return respond({ok:true,emailEnabled:enable,aiEnabled:ai});
  }
  if(req.method==='GET'&&pathname==='/positions'){
    const data=await env.DB.prepare('SELECT id,title,department,status,created_at FROM positions WHERE organization_id=? ORDER BY created_at DESC LIMIT 200').bind(org).all();return respond({items:data.results});
  }
  if(req.method==='POST'&&pathname==='/positions'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const b=await parseJSON(req),title=str(b.title,150),department=str(b.department,100);if(!title)return err('채용 직무를 입력해 주세요.');
    const id=uid();await env.DB.prepare('INSERT INTO positions(id,title,department,status,created_at,organization_id) VALUES(?,?,?,?,?,?)').bind(id,title,department,'OPEN',now(),org).run();
    await audit(env,s,'POSITION_CREATED','position',id);return respond({id,title},201);
  }
  if(req.method==='GET'&&pathname==='/applications'){
    const data=await env.DB.prepare(`SELECT a.id,c.name,c.email,c.phone,a.role,a.stage,a.applied_at,a.experience,a.owner_name,a.rating,a.memo,a.resume_name,a.version,
      es.id AS email_schedule_id,es.status AS email_status,es.scheduled_at AS email_scheduled_at
      FROM applications a
      JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=a.organization_id
      LEFT JOIN email_schedules es ON es.id=(SELECT s2.id FROM email_schedules s2 WHERE s2.application_id=a.id AND s2.organization_id=a.organization_id ORDER BY s2.created_at DESC LIMIT 1)
      WHERE a.organization_id=? AND c.deleted_at IS NULL ORDER BY a.updated_at DESC LIMIT 500`).bind(org).all<any>();
    return respond({items:data.results.map(r=>({id:r.id,name:r.name,email:r.email,phone:r.phone||'',role:r.role,stage:r.stage,applied:r.applied_at,experience:r.experience||'미등록',owner:r.owner_name||'미지정',rating:r.rating||0,tags:[],resume:r.resume_name||'이력서 미첨부',memo:r.memo||'',activity:'최근 업데이트',version:r.version,emailScheduleId:r.email_schedule_id||undefined,emailStatus:r.email_status||undefined,emailScheduledAt:r.email_scheduled_at||undefined}))});
  }
  if(req.method==='POST'&&pathname==='/candidates'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const b=await parseJSON(req),name=str(b.name,120),email=str(b.email,254).toLowerCase(),role=str(b.role,150)||'미지정';
    if(!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err('이름과 올바른 이메일이 필요합니다.');
    const at=now(),candidate=await env.DB.prepare('SELECT id FROM candidates WHERE email=? AND organization_id=? AND deleted_at IS NULL LIMIT 1').bind(email,org).first<{id:string}>();
    const candidateId=candidate?.id||uid(),applicationId=uid();
    const ops:D1PreparedStatement[]=[];
    if(!candidate)ops.push(env.DB.prepare('INSERT INTO candidates(id,name,email,phone,created_at,updated_at,organization_id) VALUES(?,?,?,?,?,?,?)').bind(candidateId,name,email,str(b.phone,60),at,at,org));
    ops.push(env.DB.prepare('INSERT INTO applications(id,candidate_id,role,stage,applied_at,owner_email,owner_name,updated_at,organization_id) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(applicationId,candidateId,role,'DOCUMENT',at,s.email,s.email.split('@')[0],at,org));
    ops.push(env.DB.prepare('INSERT INTO stage_events(id,application_id,from_stage,to_stage,actor,version,created_at,organization_id) VALUES(?,?,?,?,?,?,?,?)')
      .bind(uid(),applicationId,null,'DOCUMENT',s.email,1,at,org));
    await env.DB.batch(ops);await audit(env,s,'CANDIDATE_CREATED','application',applicationId,{reusedCandidate:!!candidate});
    return respond({id:applicationId,candidateId},201);
  }
  const move=pathname.match(/^\/applications\/([^/]+)\/move$/);
  if(move&&req.method==='POST'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const id=decodeURIComponent(move[1]),b=await parseJSON(req),stage=str(b.stage,30) as Stage;
    if(!STAGES.includes(stage))return err('유효하지 않은 단계입니다.');
    const old=await belongs(env,s,id);if(!old)return err('지원건이 없습니다.',404);
    if(old.stage===stage)return respond({ok:true,stage,version:old.version});
    if(b.version!==undefined&&Number(b.version)!==Number(old.version))return err('다른 사용자가 먼저 수정했습니다. 새로고침해 주세요.',409);
    const time=now(),version=Number(old.version)+1,event=uid(),scheduleId=uid(),sendAt=new Date(Date.parse(time)+EMAIL_DELAY).toISOString();
    const settings=await orgSettings(env,org),shouldSchedule=stage==='REJECTED'&&!!settings?.email_enabled&&mailEnabled(env);
    const stmts:D1PreparedStatement[]=[
      env.DB.prepare('UPDATE applications SET stage=?,version=?,updated_at=? WHERE id=? AND organization_id=? AND version=?')
        .bind(stage,version,time,id,org,old.version),
      env.DB.prepare(`INSERT INTO stage_events(id,application_id,from_stage,to_stage,actor,version,created_at,organization_id)
        SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM applications WHERE id=? AND organization_id=? AND version=? AND stage=?)`)
        .bind(event,id,old.stage,stage,s.email,version,time,org,id,org,version,stage),
      env.DB.prepare(`UPDATE email_schedules SET status='CANCELLED',cancelled_at=?,updated_at=? WHERE application_id=? AND organization_id=? AND status='PENDING'
        AND EXISTS(SELECT 1 FROM stage_events WHERE id=? AND organization_id=?)`)
        .bind(time,time,id,org,event,org)
    ];
    if(shouldSchedule){
      const tpl=await env.DB.prepare('SELECT version FROM email_templates WHERE id=? AND organization_id=? AND active=1').bind(templateId(org),org).first<{version:number}>();
      if(tpl)stmts.push(env.DB.prepare(`INSERT INTO email_schedules(id,application_id,event_id,version,template_version,recipient_email,scheduled_at,status,created_at,updated_at,organization_id)
        SELECT ?,?,?,?,?,?,?,'PENDING',?,?,? WHERE EXISTS(SELECT 1 FROM stage_events WHERE id=? AND organization_id=?)`)
        .bind(scheduleId,id,event,version,tpl.version,old.email,sendAt,time,time,org,event,org));
    }
    await env.DB.batch(stmts);
    const checked=await env.DB.prepare('SELECT a.version,a.stage,EXISTS(SELECT 1 FROM stage_events e WHERE e.id=? AND e.organization_id=?) AS event_created FROM applications a WHERE a.id=? AND a.organization_id=?')
      .bind(event,org,id,org).first<any>();
    if(!checked?.event_created||Number(checked.version)!==version||checked.stage!==stage)return err('동시 수정으로 변경하지 못했습니다.',409);
    await audit(env,s,'STAGE_CHANGED','application',id,{from:old.stage,to:stage});
    if(shouldSchedule&&env.EMAIL_QUEUE){try{await env.EMAIL_QUEUE.send({scheduleId},{delaySeconds:600,contentType:'json'});}catch(e){console.error('EMAIL_ENQUEUE_FAILED',scheduleId);}}
    return respond({ok:true,stage,version,emailScheduleId:shouldSchedule?scheduleId:null,scheduledAt:shouldSchedule?sendAt:null,emailAutomationEnabled:!!settings?.email_enabled});
  }
  const hist=pathname.match(/^\/applications\/([^/]+)\/history$/);
  if(hist&&req.method==='GET'){
    const id=decodeURIComponent(hist[1]);if(!await belongs(env,s,id))return err('지원건이 없습니다.',404);
    const data=await env.DB.prepare('SELECT from_stage,to_stage,actor,created_at,version FROM stage_events WHERE application_id=? AND organization_id=? ORDER BY created_at DESC LIMIT 100').bind(id,org).all();return respond({items:data.results});
  }
  const memo=pathname.match(/^\/applications\/([^/]+)\/memo$/);
  if(memo&&req.method==='PATCH'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const id=decodeURIComponent(memo[1]);if(!await belongs(env,s,id))return err('지원건이 없습니다.',404);
    const b=await parseJSON(req),value=str(b.memo,5000);
    await env.DB.prepare('UPDATE applications SET memo=?,updated_at=? WHERE id=? AND organization_id=?').bind(value,now(),id,org).run();
    await audit(env,s,'MEMO_UPDATED','application',id);return respond({ok:true,memo:value});
  }
  if(req.method==='GET'&&pathname==='/email-schedules'){
    const data=await env.DB.prepare(`SELECT s.id,s.application_id,s.status,s.scheduled_at,s.sent_at,s.last_error,s.retry_count,c.name AS candidate_name,a.role
      FROM email_schedules s JOIN applications a ON a.id=s.application_id AND a.organization_id=s.organization_id
      JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=s.organization_id
      WHERE s.organization_id=? ORDER BY s.created_at DESC LIMIT 200`).bind(org).all();return respond({items:data.results});
  }
  const cancel=pathname.match(/^\/email-schedules\/([^/]+)\/cancel$/);
  if(cancel&&req.method==='POST'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const id=decodeURIComponent(cancel[1]);const r=await env.DB.prepare("UPDATE email_schedules SET status='CANCELLED',cancelled_at=?,updated_at=? WHERE id=? AND organization_id=? AND status='PENDING'")
      .bind(now(),now(),id,org).run();if(!r.meta.changes)return err('취소 가능한 예약이 없습니다.',409);
    await audit(env,s,'EMAIL_CANCELLED','email_schedule',id);return respond({ok:true});
  }
  if(req.method==='GET'&&pathname==='/email-templates'){
    const data=await env.DB.prepare('SELECT id,name,subject,body_text,version,active,updated_at FROM email_templates WHERE organization_id=?').bind(org).all();return respond({items:data.results});
  }
  const template=pathname.match(/^\/email-templates\/([^/]+)$/);
  if(template&&req.method==='PATCH'){
    if(!isAdmin(s))return err('관리자 권한이 필요합니다.',403);
    const id=decodeURIComponent(template[1]);const old=await env.DB.prepare('SELECT id,version FROM email_templates WHERE id=? AND organization_id=?').bind(id,org).first<any>();if(!old)return err('템플릿이 없습니다.',404);
    const b=await parseJSON(req),subject=str(b.subject,180),body=str(b.body_text,9000);if(!subject||!body)return err('제목과 본문이 필요합니다.');
    const version=Number(old.version)+1,html='<div style="white-space:pre-wrap;font-family:sans-serif">'+escapeHTML(body)+'</div>',time=now();
    await env.DB.batch([
      env.DB.prepare('UPDATE email_templates SET subject=?,body_text=?,body_html=?,version=?,updated_at=? WHERE id=? AND organization_id=? AND version=?')
        .bind(subject,body,html,version,time,id,org,old.version),
      env.DB.prepare(`INSERT INTO email_template_versions(template_id,version,subject,body_text,body_html,created_at)
        SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM email_templates WHERE id=? AND organization_id=? AND version=?)`)
        .bind(id,version,subject,body,html,time,id,org,version)
    ]);
    const verify=await env.DB.prepare('SELECT version FROM email_templates WHERE id=? AND organization_id=?').bind(id,org).first<any>();
    if(verify?.version!==version)return err('다른 사용자가 먼저 수정했습니다.',409);
    await audit(env,s,'EMAIL_TEMPLATE_UPDATED','email_template',id,{version});return respond({ok:true,version});
  }
  if(req.method==='GET'&&pathname==='/interviews'){
    const data=await env.DB.prepare(`SELECT i.*,c.name AS candidate_name,a.role AS position_name
      FROM interviews i JOIN applications a ON a.id=i.application_id AND a.organization_id=i.organization_id
      JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=i.organization_id
      WHERE i.organization_id=? AND c.deleted_at IS NULL ORDER BY i.starts_at DESC LIMIT 200`).bind(org).all();return respond({items:data.results});
  }
  if(req.method==='POST'&&pathname==='/interviews'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    const b=await parseJSON(req),id=str(b.applicationId,80),start=str(b.startsAt,80),end=str(b.endsAt,80);
    if(!await belongs(env,s,id)||!Number.isFinite(Date.parse(start))||(end&&Date.parse(end)<=Date.parse(start)))return err('지원건과 면접 일정을 확인해 주세요.');
    const id2=uid(),interviewers=Array.isArray(b.interviewers)?b.interviewers.map(x=>str(x,120)).slice(0,20):[];
    await env.DB.prepare('INSERT INTO interviews(id,application_id,starts_at,ends_at,interviewers,location,notes,status,organization_id) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id2,id,new Date(start).toISOString(),end?new Date(end).toISOString():null,JSON.stringify(interviewers),str(b.location,200),str(b.notes,1000),'SCHEDULED',org).run();
    await audit(env,s,'INTERVIEW_CREATED','interview',id2);return respond({ok:true,id:id2},201);
  }
  if(req.method==='GET'&&pathname==='/evaluations'){
    const data=await env.DB.prepare(`SELECT e.id,e.application_id,e.evaluator_email,e.score,e.notes,e.submitted_at,c.name AS candidate_name
      FROM evaluations e JOIN applications a ON a.id=e.application_id AND a.organization_id=e.organization_id
      JOIN candidates c ON c.id=a.candidate_id AND c.organization_id=e.organization_id
      WHERE e.organization_id=? ORDER BY e.submitted_at DESC LIMIT 300`).bind(org).all();return respond({items:data.results});
  }
  if(req.method==='POST'&&pathname==='/evaluations'){
    const b=await parseJSON(req),id=str(b.applicationId,80),score=Number(b.score),notes=str(b.notes,2000);
    if(!await belongs(env,s,id)||!Number.isFinite(score)||score<0||score>100)return err('지원건과 점수(0~100)를 확인해 주세요.');
    const evalId=uid();await env.DB.prepare('INSERT INTO evaluations(id,application_id,evaluator_email,score,notes,submitted_at,organization_id) VALUES(?,?,?,?,?,?,?)')
      .bind(evalId,id,s.email,score,notes,now(),org).run();await audit(env,s,'EVALUATION_SUBMITTED','evaluation',evalId,{applicationId:id});return respond({id:evalId,ok:true},201);
  }
  if(req.method==='GET'&&pathname==='/dashboard/stats'){
    const data=await env.DB.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN stage NOT IN('REJECTED','HIRED') THEN 1 ELSE 0 END),0) AS active,
      COALESCE(SUM(CASE WHEN stage='HIRED' THEN 1 ELSE 0 END),0) AS hired,
      COALESCE(SUM(CASE WHEN stage IN('FIRST_INTERVIEW','FINAL_INTERVIEW') THEN 1 ELSE 0 END),0) AS interviewing
      FROM applications WHERE organization_id=?`).bind(org).first<any>();
    const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM email_schedules WHERE organization_id=? AND status='PENDING'").bind(org).first<any>();
    return respond({...data,pendingEmails:pending?.count||0});
  }
  if(req.method==='GET'&&pathname==='/integrations/status'){
    const settings=await orgSettings(env,org);
    return respond({cloudflare:{d1:true,r2:!!env.RESUMES,kv:!!env.RESUME_FILES,resumeStorage:!!(env.RESUMES||env.RESUME_FILES),queues:!!env.EMAIL_QUEUE},email:{configured:mailEnabled(env),enabled:!!settings?.email_enabled},hasa:{configured:!!env.HASA_API_KEY,enabled:!!settings?.ai_enabled}});
  }
  if(req.method==='POST'&&pathname==='/resumes/upload'){
    if(!canManage(s))return err('권한이 없습니다.',403);
    if(!env.RESUMES&&!env.RESUME_FILES)return err('파일 저장소가 설정되지 않았습니다.',503);
    const form=await req.formData(),file=form.get('file'),id=str(form.get('applicationId'),100);
    if(!(file instanceof File)||!await belongs(env,s,id))return err('파일 또는 지원건을 확인해 주세요.',404);
    if(file.size<1||file.size>10*1024*1024)return err('파일 크기는 10MB 이하여야 합니다.',413);
    const ext=file.name.toLowerCase().split('.').pop()||'',mime=mimeTypes[ext];if(!mime)return err('지원되지 않는 형식입니다.',415);
    const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
    const check=ext==='pdf'?new TextDecoder().decode(head.slice(0,5))==='%PDF-':
      ['docx','hwpx'].includes(ext)?head[0]===0x50&&head[1]===0x4b:
      ext==='hwp'?head[0]===0xd0&&head[1]===0xcf:
      ext==='png'?head[0]===0x89&&head[1]===0x50&&head[2]===0x4e:
      ['jpg','jpeg'].includes(ext)?head[0]===0xff&&head[1]===0xd8:true;
    if(!check)return err('파일 내용과 형식이 일치하지 않습니다.',415);
    const key=`tenants/${org}/resumes/${id}/${uid()}`,data=await file.arrayBuffer();
    if(env.RESUMES)await env.RESUMES.put(key,data,{httpMetadata:{contentType:mime}});
    else await env.RESUME_FILES!.put(key,data,{metadata:{contentType:mime}});
    await env.DB.prepare('UPDATE applications SET resume_key=?,resume_name=?,updated_at=? WHERE id=? AND organization_id=?')
      .bind(key,file.name.slice(0,240),now(),id,org).run();
    await audit(env,s,'RESUME_UPLOADED','application',id,{bytes:file.size,extension:ext});return respond({ok:true,name:file.name});
  }
  const download=pathname.match(/^\/resumes\/([^/]+)$/);
  if(req.method==='GET'&&download){
    if(!env.RESUMES&&!env.RESUME_FILES)return err('파일 저장소가 없습니다.',503);
    const app=await belongs(env,s,decodeURIComponent(download[1]));if(!app?.resume_key)return err('이력서를 찾을 수 없습니다.',404);
    let data:ReadableStream|ArrayBuffer|null=null,mime='application/octet-stream';
    if(env.RESUMES){const obj=await env.RESUMES.get(app.resume_key);if(!obj)return err('이력서를 찾을 수 없습니다.',404);data=obj.body;mime=obj.httpMetadata?.contentType||mime;}
    else{data=await env.RESUME_FILES!.get(app.resume_key,'arrayBuffer');if(!data)return err('이력서를 찾을 수 없습니다.',404);mime=mimeTypes[String(app.resume_name).toLowerCase().split('.').pop()||'']||mime;}
    await audit(env,s,'RESUME_DOWNLOADED','application',app.id);
    return new Response(data,{headers:{'content-type':mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(app.resume_name)}`,'x-content-type-options':'nosniff','cache-control':'private, no-store'}});
  }
  if(req.method==='GET'&&pathname==='/ai/models'){
    const settings=await orgSettings(env,org);if(!settings?.ai_enabled||!env.HASA_API_KEY)return err('AI 기능이 활성화되지 않았습니다.',403);
    const base=(env.HASA_BASE_URL||'https://open.hasa.re.kr').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const r=await fetch(base+'/v1/models',{headers:{authorization:'Bearer '+env.HASA_API_KEY}});if(!r.ok)return err('AI 모델 목록을 조회할 수 없습니다.',502);
    const result=await r.json() as any;return respond({items:Array.isArray(result.data)?result.data.map((x:any)=>({id:x.id})):[]});
  }
  if(req.method==='POST'&&pathname==='/ai/resume-summary'){
    const settings=await orgSettings(env,org);if(!settings?.ai_enabled||!env.HASA_API_KEY)return err('AI 기능이 활성화되지 않았습니다.',403);
    const raw=await req.text();if(raw.length>18000)return err('AI 요청 크기를 초과했습니다.',413);
    let b:any;try{b=JSON.parse(raw)}catch{return err('AI 요청 형식 오류');}
    if(!Array.isArray(b.messages)||b.messages.length>10||typeof b.model!=='string')return err('유효하지 않은 AI 요청입니다.');
    // AI is advisory only: no autonomous acceptance/rejection or cross-organization candidate lookups.
    const base=(env.HASA_BASE_URL||'https://open.hasa.re.kr').replace(/\/v1\/?$/,'').replace(/\/$/,'');
    const r=await fetch(base+'/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+env.HASA_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:b.model,messages:b.messages,temperature:0.2,max_tokens:900})});
    await audit(env,s,'AI_REQUEST','organization',org,{model:b.model,status:r.status});
    return new Response(r.body,{status:r.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }
  return err('요청한 기능을 찾을 수 없습니다.',404);
}
const securityHeaders:Record<string,string>={'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",'strict-transport-security':'max-age=31536000; includeSubDomains'};
export default {
  async fetch(req:Request,env:Env,_ctx:ExecutionContext):Promise<Response>{
    let response:Response;
    try{
      const path=new URL(req.url).pathname;
      if(path.startsWith('/api/auth/'))response=(await authRoute(req,env))||err('요청을 찾을 수 없습니다.',404);
      else if(path.startsWith('/api/')){
        const session=await getSession(req,env);
        if(!session)response=err('로그인이 필요합니다.',401);
        else if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.get('origin')!==new URL(req.url).origin)response=err('허용되지 않은 요청입니다.',403);
        else response=await route(req,env,session);
      }else if(env.ASSETS)response=await env.ASSETS.fetch(req);
      else response=err('웹 화면이 구성되지 않았습니다.',503);
    }catch(e){console.error('ATS_REQUEST_FAILED',String(e).slice(0,200));response=err('요청을 처리하지 못했습니다.',500);}
    const headers=new Headers(response.headers);for(const [k,v]of Object.entries(securityHeaders))headers.set(k,v);
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
  async scheduled(_event:ScheduledEvent,env:Env){await dueEmails(env);},
  async queue(batch:MessageBatch<{scheduleId:string}>,env:Env){
    try{await dueEmails(env);for(const m of batch.messages)m.ack();}
    catch(e){console.error('ATS_QUEUE_ERROR',String(e).slice(0,150));for(const m of batch.messages)m.retry({delaySeconds:60});}
  }
};