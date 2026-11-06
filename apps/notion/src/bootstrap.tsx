import './style.css';

const root=document.getElementById('root')!;
root.innerHTML='<div class="splash"><div class="brand-mark"><img src="/note-mark.svg" alt=""></div><span>공간을 불러오는 중</span></div>';

async function renderLogin(bootstrapNotice?:string){
  const [{default:LoginScreen},{createRoot}]=await Promise.all([import('./LoginScreen'),import('react-dom/client')]);
  createRoot(root).render(<LoginScreen bootstrapNotice={bootstrapNotice}/>);
}

async function start(){
  let authenticated=false;
  try{
    const response=await fetch('/api/me',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
    authenticated=response.ok;
  }catch(error){
    // A transient session-check failure should not strand a signed-out user on a dead page.
    console.error('NOTE session check failed',error);
    try{await renderLogin('로그인 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');return;}
    catch(loginError){console.error('NOTE login screen failed',loginError);}
  }
  if(!authenticated){
    try{await renderLogin();return;}
    catch(error){console.error('NOTE login screen failed',error);}
  }else{
    try{await import('./main');return;}
    catch(error){
      console.error('NOTE application bundle failed',error);
      root.innerHTML='<main role="alert" style="padding:32px;max-width:560px;margin:auto"><h1>작업 공간을 불러오지 못했습니다</h1><p>화면 파일을 불러오는 중 문제가 발생했습니다. 연결을 확인하고 다시 시도해 주세요.</p><button type="button">다시 불러오기</button></main>';
      root.querySelector('button')?.addEventListener('click',()=>location.reload());
      return;
    }
  }
  root.innerHTML='<main role="alert" style="padding:32px;max-width:560px;margin:auto"><h1>로그인 화면을 불러오지 못했습니다</h1><p>연결을 확인하고 다시 시도해 주세요.</p><button type="button">다시 불러오기</button></main>';
  root.querySelector('button')?.addEventListener('click',()=>location.reload());
}
void start();
