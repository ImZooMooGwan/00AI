import React,{useState} from 'react';
import {ArrowRight,Building2,CheckCircle2,KeyRound,Mail,ShieldCheck,Sparkles,Users} from 'lucide-react';
import './auth.css';
export type ATSIdentity={email:string;role:string;organizationId:string;organizationName:string;userId:string};
export async function atsAPI(path:string,init:RequestInit={}){
  const response=await fetch('/api'+path,{...init,credentials:'same-origin',headers:{...(!(init.body instanceof FormData)?{'content-type':'application/json'}:{}),...(init.headers||{})}});
  const json=await response.json().catch(()=>({error:'서버 응답을 확인할 수 없습니다.'}));
  if(!response.ok)throw new Error(json.error||'요청이 실패했습니다.');
  return json;
}
export function AuthGate({onAuthenticated}:{onAuthenticated:(session:ATSIdentity)=>void}){
  const[email,setEmail]=useState('');const[organizationName,setOrganizationName]=useState('');
  const[challengeId,setChallengeId]=useState('');const[code,setCode]=useState('');
  const[error,setError]=useState('');const[busy,setBusy]=useState(false);
  const[mode,setMode]=useState<'login'|'signup'>('login');
  const inviteToken=new URLSearchParams(location.search).get('invite')||'';
  const requestCode=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);
    try{const d=await atsAPI('/auth/request-code',{method:'POST',body:JSON.stringify({email})});setChallengeId(d.challengeId);}
    catch(e){setError(e instanceof Error?e.message:'인증메일 발송에 실패했습니다.')}finally{setBusy(false)}
  };
  const verify=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);
    try{const d=await atsAPI('/auth/verify-code',{method:'POST',body:JSON.stringify({email,code,challengeId,organizationName,inviteToken})});onAuthenticated(d.session);}
    catch(e){setError(e instanceof Error?e.message:'인증에 실패했습니다.')}finally{setBusy(false)}
  };
  return <div className="ats-auth-shell">
    <div className="ats-auth-glow" aria-hidden="true"/>
    <header className="ats-auth-header"><div className="ats-auth-symbol">A</div><strong>00AI <span>ATS</span></strong><span className="ats-auth-secure"><ShieldCheck size={15}/> 채용관리 워크스페이스</span></header>
    <main className="ats-auth-main"><section className="ats-auth-intro"><div className="ats-auth-kicker"><Sparkles size={16}/> 채용의 모든 순간을 더 단순하게</div>
      <h1>사람을 찾는 일에<br/><em>더 집중하세요.</em></h1>
      <p>지원자 관리부터 면접, 평가, 이메일 안내까지. 채용 업무의 흐름을 하나의 공간에서 관리하세요.</p>
      <div className="ats-auth-highlights"><span><Users size={17}/> 직관적인 파이프라인</span><span><Mail size={17}/> 10분 후 자동 안내</span><span><ShieldCheck size={17}/> 조직별 데이터 보호</span></div>
    </section><section className="ats-auth-card"><div className="ats-auth-card-eyebrow">WELCOME TO 00AI ATS</div>
      <h2>{challengeId?'이메일 인증':'ATS 시작하기'}</h2>
      <p>{challengeId?<><b>{email}</b> 주소로 전송된 6자리 인증번호를 입력하세요.</>:'가입하거나 로그인하여 나만의 채용 워크스페이스를 이용하세요.'}</p>
      {!challengeId?<><div className="ats-auth-switch" role="group" aria-label="인증 유형"><button type="button" className={mode==='login'?'on':''} onClick={()=>setMode('login')}>로그인</button><button type="button" className={mode==='signup'?'on':''} onClick={()=>setMode('signup')}>무료 시작하기</button></div>
       <form onSubmit={requestCode}><label className="ats-auth-label" htmlFor="auth-email">이메일 주소</label><div className="ats-auth-input"><Mail size={19}/><input autoFocus id="auth-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email"/></div>
       {mode==='signup'&&<><label className="ats-auth-label" htmlFor="auth-org">회사 또는 팀 이름</label><div className="ats-auth-input"><Building2 size={19}/><input id="auth-org" value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="예: 우리회사 채용팀" maxLength={80}/></div></>}
       <button className="ats-auth-submit" disabled={busy}>{busy?'전송 중…':'이메일로 계속하기'}<ArrowRight size={18}/></button></form></>
      :<form onSubmit={verify}><label className="ats-auth-label" htmlFor="auth-code">6자리 인증번호</label><div className="ats-auth-input"><KeyRound size={19}/><input autoFocus id="auth-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000" autoComplete="one-time-code"/></div><button className="ats-auth-submit" disabled={busy||code.length!==6}>{busy?'확인 중…':'인증하고 시작하기'}<ArrowRight size={18}/></button><button type="button" className="ats-auth-back" onClick={()=>{setCode('');setChallengeId('');setError('')}}>이메일 다시 입력</button></form>}
      {error&&<div className="ats-auth-error" role="alert">{error}</div>}
      <div className="ats-auth-note"><CheckCircle2 size={15}/> 인증번호는 10분간 유효합니다. 비밀번호 없이 안전하게 로그인하세요.</div>
    </section></main><footer className="ats-auth-footer">© 00AI ATS · 채용 데이터는 조직별로 독립 관리됩니다.</footer>
  </div>;
}
