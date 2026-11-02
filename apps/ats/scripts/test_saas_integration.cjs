/* Node 22 integration tests using real SQLite and a D1-compatible adapter. No live email is sent. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const app=require('../.saas-build/worker/saas.js').default;
const root=path.resolve(__dirname,'..');
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON');}
  exec(sql){this.db.exec(sql);}
  prepare(sql){const db=this.db;let params=[];return {bind(...p){params=p;return this},async first(){return db.prepare(sql).get(...params)||null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){const x=db.prepare(sql).run(...params);return {meta:{changes:Number(x.changes)}}}};}
  async batch(stmts){this.db.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of stmts)r.push(await s.run());this.db.exec('COMMIT');return r}catch(e){this.db.exec('ROLLBACK');throw e}}
}
function setup(){
 const db=new D1();const source=fs.readFileSync(path.join(root,'scripts/test_saas_schema.py'),'utf8');
 const fixture=source.split("connection.executescript('''")[1].split("''')")[0];
 db.exec(fixture);db.exec(fs.readFileSync(path.join(root,'migrations/0003_public_saas.sql'),'utf8'));return db;
}
const origin='https://ats.test.example';
const identity=(cookie)=>({'origin':origin,'cookie':cookie||''});
const request=(url,method='GET',body=null,cookie='',extra={})=>new Request(origin+url,{method,headers:{...identity(cookie),...extra,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
async function decode(res){return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')}}
const emailCodes=new Map(),sent=[];
const realFetch=global.fetch;
global.fetch=async (url,opts)=>{
 const data=opts?.body?JSON.parse(opts.body):{};
 if(String(url).includes('brevo')){
  if(data.subject.includes('인증번호')){emailCodes.set(data.to[0].email,/([0-9]{6})/.exec(data.textContent)[1]);return new Response(JSON.stringify({messageId:'verification-ok'}),{status:201,headers:{'content-type':'application/json'}})}
  sent.push({recipient:data.to[0].email,subject:data.subject});return new Response(JSON.stringify({messageId:'rejection-ok'}),{status:201,headers:{'content-type':'application/json'}});
 }
 if(String(url).endsWith('/v1/models'))return new Response(JSON.stringify({data:[{id:'test-model'}]}),{status:200});
 return new Response('{}',{status:200});
};
const env=(db)=>({DB:db,ATS_AUTH_PEPPER:'a-very-long-high-entropy-test-only-secret-00000000',BREVO_API_KEY:'MOCK_NEVER_SEND',EMAIL_FROM_NAME:'ATS',EMAIL_FROM_ADDRESS:'noreply@test.example',EMAIL_SERVICE_VERIFIED:'true',HASA_API_KEY:'MOCK_HASA',RESUME_FILES:{async put(){},async get(){return null}},EMAIL_QUEUE:{async send(){}}});
async function post(env,route,data,cookie){return decode(await app.fetch(request(route,'POST',data,cookie),env,{}))}
async function get(env,route,cookie){return decode(await app.fetch(request(route,'GET',null,cookie),env,{}))}
async function patch(env,route,data,cookie){return decode(await app.fetch(request(route,'PATCH',data,cookie),env,{}))}
async function signup(env,email,organizationName){
 const step=await post(env,'/api/auth/request-code',{email});assert.equal(step.status,200,JSON.stringify(step.body));
 const verify=await post(env,'/api/auth/verify-code',{email,challengeId:step.body.challengeId,code:emailCodes.get(email),organizationName});
 assert.equal(verify.status,200,JSON.stringify(verify.body));return {cookie:verify.cookie.split(';')[0],...verify.body.session};
}
test('public signup, organization isolation, verified OTP and rejection workflow',async()=>{
 const db=setup(),e=env(db);const alice=await signup(e,'alice@test.example','Alice Inc');const bob=await signup(e,'bob@test.example','Bob Inc');
 assert.notEqual(alice.organizationId,bob.organizationId);
 assert.equal((await get(e,'/api/applications',bob.cookie)).body.items.length,0);
 assert.equal((await get(e,'/api/applications',alice.cookie)).body.items.length,0);
 const added=await post(e,'/api/candidates',{name:'Alice Candidate',email:'candidate@test.example',role:'Engineer'},alice.cookie);
 assert.equal(added.status,201,JSON.stringify(added.body));const appId=added.body.id;
 assert.equal((await get(e,'/api/applications',alice.cookie)).body.items.length,1);
 assert.equal((await get(e,'/api/applications',bob.cookie)).body.items.length,0);
 assert.equal((await post(e,'/api/applications/'+appId+'/move',{stage:'REJECTED'},bob.cookie)).status,404);
 assert.equal((await get(e,'/api/resumes/'+appId,bob.cookie)).status,404);
 assert.equal((await patch(e,'/api/applications/'+appId+'/memo',{memo:'wrong tenant'},bob.cookie)).status,404);
 assert.equal((await get(e,'/api/applications/'+appId+'/history',bob.cookie)).status,404);
 const reject1=await post(e,'/api/applications/'+appId+'/move',{stage:'REJECTED'},alice.cookie);
 assert.equal(reject1.status,200);
 assert.equal(reject1.body.emailScheduleId,null,'automation must be disabled at signup');
 const settings=await patch(e,'/api/organization/automation',{emailEnabled:true,aiEnabled:true},alice.cookie);assert.equal(settings.status,200);
 await post(e,'/api/applications/'+appId+'/move',{stage:'DOCUMENT'},alice.cookie);
 const reject2=await post(e,'/api/applications/'+appId+'/move',{stage:'REJECTED'},alice.cookie);
 assert.equal(reject2.status,200,JSON.stringify(reject2.body));assert.ok(reject2.body.emailScheduleId);
 const schedule=db.db.prepare('SELECT * FROM email_schedules WHERE id=?').get(reject2.body.emailScheduleId);
 assert.equal(Math.round((Date.parse(schedule.scheduled_at)-Date.now())/60000),10);
 assert.equal((await get(e,'/api/email-schedules',bob.cookie)).body.items.length,0);
 assert.equal((await patch(e,'/api/email-templates/'+bob.organizationId+':rejection',{subject:'oops',body_text:'oops'},alice.cookie)).status,404);
 const targetA=(await get(e,'/api/email-templates',alice.cookie)).body.items[0];
 assert.equal(targetA.id,alice.organizationId+':rejection');
 assert.equal((await patch(e,'/api/email-templates/'+targetA.id,{subject:'Hi {{candidate_name}}',body_text:'Thank you {{candidate_name}}'},alice.cookie)).status,200);
 const cancel=await post(e,'/api/email-schedules/'+schedule.id+'/cancel',{},alice.cookie);assert.equal(cancel.status,200);
 db.db.prepare('UPDATE email_schedules SET scheduled_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',schedule.id);
 await app.scheduled({},e);assert.equal(sent.length,0,'cancelled message must not send');
 await post(e,'/api/applications/'+appId+'/move',{stage:'DOCUMENT'},alice.cookie);
 const again=await post(e,'/api/applications/'+appId+'/move',{stage:'REJECTED'},alice.cookie);
 db.db.prepare('UPDATE email_schedules SET scheduled_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z',again.body.emailScheduleId);
 await app.scheduled({},e);assert.equal(sent.length,1);assert.equal(sent[0].recipient,'candidate@test.example');
 await app.scheduled({},e);assert.equal(sent.length,1,'Cron retry must not double send');
 assert.equal((await post(e,'/api/ai/resume-summary',{model:'test-model',messages:[{role:'user',content:'hello'}]},bob.cookie)).status,403);
 assert.equal((await get(e,'/api/ai/models',alice.cookie)).status,200);
 const s=await get(e,'/api/me',alice.cookie);assert.equal(s.body.organizationId,alice.organizationId);
 const signedOut=await post(e,'/api/auth/logout',{},alice.cookie);assert.equal(signedOut.status,200);
 assert.equal((await get(e,'/api/me',alice.cookie)).status,401);
 const legacy=db.db.prepare('SELECT status FROM organizations WHERE id=?').get('legacy-ats-quarantined');assert.equal(legacy.status,'SUSPENDED');
 assert.ok((await get(e,'/api/applications',bob.cookie)).body.items.every(x=>x.id!=='old-a'));
 console.log('OK: signup, org separation, legacy quarantine, OTP sessions, no cross-tenant access, 10-minute scheduling, cancellation, send-once');
});
