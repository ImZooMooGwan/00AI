/** Integrates public-auth + ATS SaaS worker into the existing 00AI React/Vite project.
 * Execute from apps/ats after copying v2 files into matching directories.
 * Abort on unexpected source changes rather than corrupting the UI.
 */
import fs from 'node:fs';
function update(file,mapper){const old=fs.readFileSync(file,'utf8'),next=mapper(old);if(next===old)throw Error('No changes in '+file);fs.writeFileSync(file,next);console.log('Updated '+file)}
function once(s,a,b){if(!s.includes(a))throw Error('Missing expected code: '+a.slice(0,95));return s.replace(a,b)}
update('src/main.tsx',s=>{
 s=once(s,"import './style.css';","import './style.css';\nimport {AuthGate,type ATSIdentity} from './AuthGate';");
 const oldInit="useEffect(()=>{api('/me').then(()=>{setAuthenticated(true);return api('/applications')}).then((d:any)=>{if(Array.isArray(d.items)){setPeople(d.items);setApiLive(true)}}).catch((e:any)=>{if(String(e).includes('401'))setAuthenticated(false);else setAuthenticated(true)});},[]);";
 const newInit="useEffect(()=>{api('/me').then((me:ATSIdentity)=>{setIdentity(me);setAuthenticated(true);return api('/applications')}).then((d:any)=>{if(Array.isArray(d?.items)){setPeople(d.items);setApiLive(true)}}).catch(()=>setAuthenticated(false));},[]);";
 s=once(s,oldInit,newInit);
 s=once(s,"const[people,setPeople]=useState(initial)","const[identity,setIdentity]=useState<ATSIdentity|null>(null),[people,setPeople]=useState(initial)");
 const loginStart=s.indexOf('if(authenticated===false)return '),loginEnd=s.indexOf('return <div className={dark?',loginStart);
 if(loginStart<0||loginEnd<0)throw Error('Unexpected login form layout');
 s=s.slice(0,loginStart)+"if(authenticated===false)return <AuthGate onAuthenticated={(session)=>{setIdentity(session);setAuthenticated(true);api('/applications').then((d:any)=>{setPeople(d.items||[]);setApiLive(true)}).catch(()=>setToast('지원자 목록을 가져오지 못했습니다.'))}}/>;"+s.slice(loginEnd);
 s=once(s,'People Team <ChevronDown size={14}/>','{identity?.organizationName||\'내 워크스페이스\'} <ChevronDown size={14}/>');
 s=once(s,'<strong>민재명</strong><small>관리자</small>','<strong>{identity?.email?.split(\'@\')[0]||\'내 계정\'}</strong><small>{identity?.role||\'구성원\'}</small>');
 s=once(s,'<ShieldCheck size={14}/> 사내 전용','<ShieldCheck size={14}/> 조직별 보호');
 s=once(s,'<div className="crumb">채용 관리','<div className="crumb">{identity?.organizationName||\'채용 관리\'}');
 // A failed POST must never leave a local-only candidate that looks persisted.
 s=once(s,"}catch{setToast(selectedResume?'지원자는 화면에 추가했지만 서버 저장 또는 파일 업로드에 실패했습니다.':'지원자를 화면에 추가했습니다. 서버 저장은 연결 후 동작합니다.')}};","}catch{setPeople(ps=>ps.filter(p=>p.id!==localId));setToast('저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.')}};");
 return s;
});
update('wrangler.jsonc',s=>{const a=JSON.parse(s);a.main='worker/saas.ts';a.vars={...a.vars,EMAIL_SERVICE_VERIFIED:'false'};delete a.vars.DEMO_MODE;delete a.vars.ACCESS_TEAM_DOMAIN;delete a.vars.ACCESS_AUD;return JSON.stringify(a,null,2)+'\n';});
update('package.json',s=>{const a=JSON.parse(s);a.scripts.test='vitest run';a.scripts['test:saas']='node scripts/compile-saas.cjs && node --test scripts/test_saas_integration.cjs';return JSON.stringify(a,null,2)+'\n';});
console.log('Public SaaS integration patch applied. Deploy ONLY after reviewing deployment gates.');
