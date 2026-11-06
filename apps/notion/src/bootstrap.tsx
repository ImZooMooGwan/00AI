import './style.css';

const root=document.getElementById('root')!;
root.innerHTML='<div class="splash"><div class="brand-mark"><img src="/note-mark.svg" alt=""></div><span>공간을 불러오는 중</span></div>';

async function start(){
  try{
    const response=await fetch('/api/me',{credentials:'same-origin',headers:{accept:'application/json'}});
    if(response.ok){await import('./main');return;}
    const [{default:LoginScreen},{createRoot}]=await Promise.all([import('./LoginScreen'),import('react-dom/client')]);
    createRoot(root).render(<LoginScreen/>);
  }catch(error){
    console.error('NOTE bootstrap failed',error);
    root.innerHTML='<main role="alert" style="padding:32px;max-width:560px;margin:auto"><h1>화면을 불러오지 못했습니다</h1><p>연결 상태를 확인한 뒤 다시 시도해 주세요.</p><button type="button">다시 불러오기</button></main>';
    root.querySelector('button')?.addEventListener('click',()=>location.reload());
  }
}
void start();
