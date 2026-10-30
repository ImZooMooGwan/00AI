import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import{useEditor,EditorContent}from'@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import {TableKit} from '@tiptap/extension-table';
import {IndexeddbPersistence} from 'y-indexeddb';
import * as Y from 'yjs';
import{ArrowDown,ArrowLeft,ArrowUpRight,Bell,BookOpen,Check,ChevronDown,ChevronRight,Clock3,Command,Copy,FilePlus2,FileText,Hash,HelpCircle,Home,LayoutTemplate,Link2,LogOut,Menu,MessageCircle,MoreHorizontal,PanelLeftClose,Plus,Search,Send,Settings,Share2,Sparkles,Table2,Users,Workflow,X}from'lucide-react';
import{ConnectionStatus,YjsJournalBridge}from'./YjsJournalBridge';
import'./style.css';

type User={id:string;email:string;display_name:string;name?:string};
type Workspace={id:string;name:string;slug:string;role:string};
type Page={id:string;parent_id:string|null;title:string;icon:string;created_at:string;updated_at:string;created_by:string;role:string;has_starter?:number};
type Template={id:string;title:string;description:string;category:string;icon:string;license:string};
type Comment={id:string;body:string;created_at:string;resolved_at:string|null;email:string;display_name:string};
const api=async<T=any>(path:string,init:RequestInit={}):Promise<T>=>{
  const headers=new Headers(init.headers);if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const response=await fetch('/api'+path,{...init,headers,credentials:'same-origin'});
  const body:any=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||`요청 오류 ${response.status}`);return body as T;
};
const displayName=(user:User)=>user.display_name||user.name||user.email.split('@')[0];

function LoginScreen(){
  const[email,setEmail]=useState(''),[code,setCode]=useState(''),[name,setName]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function request(){setBusy(true);setError('');try{await api('/auth/request-code',{method:'POST',body:JSON.stringify({email})});setSent(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function verify(){setBusy(true);setError('');try{await api('/auth/verify-code',{method:'POST',body:JSON.stringify({email,code,name})});location.reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="login-shell"><div className="login-brand"><div className="brand-mark">00</div><span>00AI WORKSPACE</span></div><div className="login-card"><div className="login-icon"><Workflow size={22}/></div><div className="eyebrow">PUBLIC KNOWLEDGE WORKSPACE</div><h1>함께 만드는<br/>공공 지식공간</h1><p>문서와 업무 지식을 한 공간에서 정리하고 동료와 실시간으로 협업하세요.</p>{!sent?<><label className="field-label" htmlFor="email">이메일 주소</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@organization.kr" autoComplete="email"/><button className="primary wide" disabled={busy||!email} onClick={request}>{busy?'보내는 중…':'로그인 코드 받기'}<ArrowUpRight size={16}/></button></>:<><label className="field-label" htmlFor="code">이메일로 받은 6자리 코드</label><input id="code" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000"/><label className="field-label" htmlFor="name">표시 이름 <span>처음 가입할 때만 사용</span></label><input id="name" value={name} onChange={e=>setName(e.target.value)} placeholder="이름 또는 기관명"/><button className="primary wide" disabled={busy||code.length!==6} onClick={verify}>{busy?'확인 중…':'공간 열기'}<ArrowUpRight size={16}/></button><button className="text-button wide" onClick={()=>{setSent(false);setCode('');}}>이메일 주소 변경</button></>}{error&&<div className="form-error" role="alert">{error}</div>}<div className="login-foot"><span><Check size={14}/> 초대받은 동료와 함께 사용</span><span><Check size={14}/> 변경 사항 자동 저장</span></div></div><footer>00AI WORKSPACE · 공공기관과 시민을 위한 협업 지식공간</footer></div>;
}

function App(){
  const[user,setUser]=useState<User|null>(null),[workspaces,setWorkspaces]=useState<Workspace[]>([]),[workspaceId,setWorkspaceId]=useState(''),[pages,setPages]=useState<Page[]>([]),[templates,setTemplates]=useState<Template[]>([]),[pageId,setPageId]=useState(''),[pageTitle,setPageTitle]=useState(''),[pageIcon,setPageIcon]=useState('📄'),[busy,setBusy]=useState(true),[toast,setToast]=useState(''),[query,setQuery]=useState(''),[createOpen,setCreateOpen]=useState(false),[templateOpen,setTemplateOpen]=useState(false),[shareOpen,setShareOpen]=useState(false),[shareEmail,setShareEmail]=useState(''),[shareRole,setShareRole]=useState('editor'),[commentsOpen,setCommentsOpen]=useState(false),[railOpen,setRailOpen]=useState(true);
  const workspace=workspaces.find(item=>item.id===workspaceId),active=pages.find(item=>item.id===pageId);
  const notify=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),3200);};
  const loadPages=useCallback(async(id:string)=>{if(!id)return;const result=await api<{items:Page[]}>(`/pages?workspaceId=${encodeURIComponent(id)}`);setPages(result.items);setPageId(current=>result.items.some(page=>page.id===current)?current:result.items[0]?.id||'');},[]);
  const loadWorkspaces=useCallback(async()=>{const result=await api<{items:Workspace[]}>('/workspaces');setWorkspaces(result.items);setWorkspaceId(current=>result.items.some(w=>w.id===current)?current:result.items[0]?.id||'');},[]);
  useEffect(()=>{api<{user:User}>('/me').then(async result=>{setUser(result.user);const [w,t]=await Promise.all([api<{items:Workspace[]}>('/workspaces'),api<{items:Template[]}>('/templates')]);setWorkspaces(w.items);setWorkspaceId(w.items[0]?.id||'');setTemplates(t.items);}).catch(()=>setUser(null)).finally(()=>setBusy(false));},[]);
  useEffect(()=>{if(workspaceId)loadPages(workspaceId).catch(e=>notify((e as Error).message));},[workspaceId,loadPages]);
  useEffect(()=>{if(active){setPageTitle(active.title);setPageIcon(active.icon||'📄');}},[active?.id]);
  if(busy)return <div className="splash"><div className="brand-mark">00</div><span>공간을 불러오는 중</span></div>;
  if(!user)return <LoginScreen/>;
  const visiblePages=pages.filter(page=>`${page.title} ${page.icon}`.toLowerCase().includes(query.toLowerCase()));
  async function createPage(templateId?:string){
    if(!workspaceId)return;
    try{const result=await api<{id:string}>('/pages',{method:'POST',body:JSON.stringify({workspaceId,title:templateId?templates.find(t=>t.id===templateId)?.title:'새 페이지',templateId})});await loadPages(workspaceId);setPageId(result.id);setCreateOpen(false);setTemplateOpen(false);notify(templateId?'템플릿을 복제했습니다.':'페이지를 만들었습니다.');}
    catch(e){notify((e as Error).message);}
  }
  async function createWorkspace(){const name=window.prompt('새 협업 공간 이름');if(!name?.trim())return;try{await api('/workspaces',{method:'POST',body:JSON.stringify({name})});await loadWorkspaces();notify('새 협업 공간을 만들었습니다.');}catch(e){notify((e as Error).message);}}
  async function renamePage(){if(!active||!pageTitle.trim())return;try{await api(`/pages/${active.id}/title`,{method:'PATCH',body:JSON.stringify({title:pageTitle,icon:pageIcon})});await loadPages(workspaceId);notify('페이지 제목을 저장했습니다.');}catch(e){notify((e as Error).message);}}
  async function duplicatePage(){if(!active)return;try{const result=await api<{id:string}>(`/pages/${active.id}/duplicate`,{method:'POST'});await loadPages(workspaceId);setPageId(result.id);notify('페이지 사본을 만들었습니다.');}catch(e){notify((e as Error).message);}}
  async function sharePage(){if(!active||!shareEmail.trim())return;try{const result=await api<{invited:boolean}>(`/pages/${active.id}/share`,{method:'POST',body:JSON.stringify({email:shareEmail,role:shareRole})});notify(result.invited?'초대할 이메일을 권한 목록에 추가했습니다.':'페이지 권한을 업데이트했습니다.');setShareEmail('');setShareOpen(false);}catch(e){notify((e as Error).message);}}
  async function logout(){try{await api('/auth/logout',{method:'POST'});}finally{location.reload();}}
  const canEdit=Boolean(active&&['owner','admin','member','editor'].includes(active.role));
  return <div className="app-frame">
    <header className="topbar"><div className="top-left"><button className="icon-btn mobile-menu" aria-label="탐색 열기" onClick={()=>setRailOpen(!railOpen)}><Menu size={18}/></button><a className="wordmark" href="/"><span className="brand-mark small">00</span><span>00AI <b>WORKSPACE</b></span></a><div className="top-divider"/><button className="workspace-switch" onClick={()=>setCreateOpen(v=>!v)}>{workspace?.name||'협업 공간'}<ChevronDown size={15}/></button></div><div className="top-center"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="페이지 검색" aria-label="페이지 검색"/><kbd>⌘ K</kbd></div><div className="top-right"><span className="top-avatar">{displayName(user).slice(0,1).toUpperCase()}</span><span className="top-user">{displayName(user)}</span><button className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={logout}><LogOut size={17}/></button></div></header>
    <div className="workspace-layout">
      <aside className={`sidebar ${railOpen?'open':''}`}>
        <div className="side-section"><div className="side-heading"><span>워크스페이스</span><button className="mini-icon" aria-label="협업 공간 추가" onClick={createWorkspace}><Plus size={15}/></button></div><button className="workspace-row"><span className="workspace-dot">{(workspace?.name||'00').slice(0,1)}</span><span>{workspace?.name||'협업 공간'}</span><ChevronDown size={14}/></button></div>
        <div className="side-section page-section"><div className="side-heading"><span>개인</span><button className="mini-icon" aria-label="새 페이지" onClick={()=>setCreateOpen(v=>!v)}><Plus size={15}/></button></div><button className="nav-row active"><Home size={16}/> 홈</button><button className="nav-row" onClick={()=>notify('최근 페이지 기능을 준비하고 있습니다.')}><Clock3 size={16}/> 최근 페이지</button><button className="nav-row" onClick={()=>setTemplateOpen(true)}><LayoutTemplate size={16}/> 템플릿</button></div>
        <div className="side-section pages-section"><div className="side-heading"><span>페이지</span><button className="mini-icon" aria-label="페이지 만들기" onClick={()=>setCreateOpen(v=>!v)}><Plus size={15}/></button></div>{createOpen&&<div className="quick-create"><button onClick={()=>createPage()}><FilePlus2 size={15}/> 빈 페이지</button><button onClick={()=>setTemplateOpen(true)}><LayoutTemplate size={15}/> 템플릿에서 만들기</button></div>}<div className="page-tree">{visiblePages.map(page=><button key={page.id} className={`page-row ${page.id===pageId?'selected':''}`} onClick={()=>{setPageId(page.id);setRailOpen(false);}}><span className="page-emoji">{page.icon||'📄'}</span><span className="page-name">{page.title}</span><MoreHorizontal size={15} className="page-more"/></button>)}{visiblePages.length===0&&<div className="empty-tree">페이지가 없습니다.</div>}</div></div>
        <div className="sidebar-bottom"><button className="nav-row" onClick={()=>notify('설정 기능은 관리 화면에서 이어집니다.')}><Settings size={16}/> 설정</button><button className="nav-row" onClick={()=>notify('공공 템플릿 생태계의 게시·검수 기능을 개발 중입니다.')}><HelpCircle size={16}/> 도움말</button><div className="plan-card"><div className="plan-icon"><BookOpen size={16}/></div><div><b>함께 만드는 지식</b><span>공공 템플릿을 나눠 보세요</span></div><ArrowUpRight size={15}/></div><div className="sidebar-user"><span className="top-avatar">{displayName(user).slice(0,1).toUpperCase()}</span><div><b>{displayName(user)}</b><span>{user.email}</span></div><button className="mini-icon" title="로그아웃" onClick={logout}><MoreHorizontal size={17}/></button></div></div>
      </aside>
      <main className="main-area">
        {!active?<Welcome templates={templates} onCreate={createPage} onTemplates={()=>setTemplateOpen(true)}/>:<>
          <div className="breadcrumbs"><span>{workspace?.name||'워크스페이스'}</span><ChevronRight size={14}/><span>{active.title}</span><span className="saved-label"><span className="status-dot"/> 자동 저장</span></div>
          <div className="page-head"><div className="page-heading"><button className="page-icon-button" aria-label="페이지 아이콘 변경" onClick={()=>{const icons=['📄','📝','📌','💡','📊','🗂️','🌱'];const index=icons.indexOf(pageIcon);setPageIcon(icons[(index+1)%icons.length]);}}>{pageIcon}</button><input className="page-title" value={pageTitle} onChange={e=>setPageTitle(e.target.value)} onBlur={renamePage} onKeyDown={e=>e.key==='Enter'&&e.currentTarget.blur()} aria-label="페이지 제목"/></div><div className="page-actions"><LivePresence page={active} user={user}/><button className="secondary-btn" onClick={()=>setShareOpen(true)}><Share2 size={15}/> 공유</button><button className={`icon-btn ${commentsOpen?'selected':''}`} title="댓글" aria-label="댓글" onClick={()=>setCommentsOpen(v=>!v)}><MessageCircle size={17}/></button><button className="icon-btn" title="사본 만들기" aria-label="사본 만들기" onClick={duplicatePage}><Copy size={16}/></button><button className="icon-btn" title="페이지 옵션"><MoreHorizontal size={18}/></button></div></div>
          <EditorArea key={active.id} page={active} user={user} canEdit={canEdit} notify={notify} commentsOpen={commentsOpen} onCommentsClose={()=>setCommentsOpen(false)}/>
        </>}
      </main>
    </div>
    {templateOpen&&<TemplateDialog templates={templates} onClose={()=>setTemplateOpen(false)} onSelect={id=>createPage(id)}/>}
    {shareOpen&&active&&<ShareDialog email={shareEmail} role={shareRole} setEmail={setShareEmail} setRole={setShareRole} onClose={()=>setShareOpen(false)} onShare={sharePage}/>}
    {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>;
}

function LivePresence({page,user}:{page:Page;user:User}){
  const [users,setUsers]=useState<Array<{id:string;name:string}>>([]);
  useEffect(()=>{const handler=(event:Event)=>{const custom=event as CustomEvent<{pageId:string;users:Array<{id:string;name:string}>}>;if(custom.detail.pageId===page.id)setUsers(custom.detail.users);};window.addEventListener('notion-presence',handler);return()=>window.removeEventListener('notion-presence',handler);},[page.id]);
  const others=users.filter(item=>item.id!==user.id);
  return <div className="presence-stack" title={others.length?`${others.length}명이 함께 보고 있습니다.`:'혼자 보고 있습니다.'}>{others.slice(0,3).map((item,index)=><span className={`presence-avatar tone-${index}`} key={item.id}>{item.name.slice(0,1).toUpperCase()}</span>)}{!others.length&&<span className="presence-avatar self">{displayName(user).slice(0,1).toUpperCase()}</span>}{others.length>3&&<span className="presence-count">+{others.length-3}</span>}</div>;
}

function EditorArea({page,user,canEdit,notify,commentsOpen,onCommentsClose}:{page:Page;user:User;canEdit:boolean;notify:(message:string)=>void;commentsOpen:boolean;onCommentsClose:()=>void}){
  const ydoc=useMemo(()=>new Y.Doc(),[page.id]);
  const [connection,setConnection]=useState<{status:ConnectionStatus;label:string}>({status:'connecting',label:'연결 준비 중'}),[pending,setPending]=useState(0),[aiText,setAiText]=useState(''),[aiOpen,setAiOpen]=useState(false),[aiBusy,setAiBusy]=useState(false),[aiResult,setAiResult]=useState('');
  const bridgeRef=useRef<YjsJournalBridge|null>(null);
  const editor=useEditor({extensions:[StarterKit.configure({undoRedo:false}),TableKit.configure({table:{resizable:true}}),Collaboration.configure({document:ydoc,field:'default'})],editable:canEdit,editorProps:{attributes:{class:'tiptap-content','aria-label':'협업 문서 편집기'}}},[ydoc]);
  useEffect(()=>{editor?.setEditable(canEdit);},[editor,canEdit]);
  useEffect(()=>{
    if(!editor)return;
    let disposed=false;const persistence=new IndexeddbPersistence(`00ai-notion:${user.id}:${page.id}`,ydoc);let bridge:YjsJournalBridge|null=null;
    const start=async()=>{
      await persistence.whenSynced;if(disposed)return;
      const fragment=ydoc.getXmlFragment('default');
      if(canEdit&&fragment.length===0){
        try{const result=await api<{starter:any}>('/pages/'+page.id+'/starter',{method:'POST',body:JSON.stringify({claim:true})});if(!disposed&&result.starter)editor.commands.setContent(result.starter);}
        catch(error){notify((error as Error).message);}
      }
      if(disposed)return;
      bridge=new YjsJournalBridge(ydoc,page.id);
      bridge.onStatus=(status,label)=>{setConnection({status,label});};
      bridge.onPending=setPending;
      bridge.onPresence=users=>window.dispatchEvent(new CustomEvent('notion-presence',{detail:{pageId:page.id,users}}));
      bridgeRef.current=bridge;bridge.connect();
    };
    void start();
    return()=>{disposed=true;bridge?.destroy();bridgeRef.current=null;persistence.destroy();};
  },[editor,ydoc,page.id,user.id,canEdit]);
  const saveTitle=async()=>{try{await api(`/pages/${page.id}/title`,{method:'PATCH',body:JSON.stringify({title:page.title,icon:page.icon})});}catch{}}
  async function assist(action:string){if(!editor)return;const selection=editor.state.selection;const selected=editor.state.doc.textBetween(selection.from,selection.to,'\n');if(!selected){notify('먼저 AI 작업을 할 문장이나 문단을 선택해 주세요.');return;}setAiBusy(true);setAiResult('');try{const result=await api<{text:string}>('/ai/assist',{method:'POST',body:JSON.stringify({action,text:selected})});setAiText(selected);setAiResult(result.text);setAiOpen(true);}catch(error){notify((error as Error).message);}finally{setAiBusy(false);}}
  function insertAi(){if(!editor||!aiResult)return;editor.chain().focus().insertContent(aiResult).run();setAiOpen(false);notify('AI 결과를 문서에 삽입했습니다.');}
  return <div className="editor-layout">
    <section className="editor-column">
      <div className="editor-tools"><div className="tools-group"><button title="굵게" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleBold().run()}><b>B</b></button><button title="기울임" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleItalic().run()}><i>I</i></button><button title="취소선" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleStrike().run()}><s>S</s></button><span className="tool-divider"/><button title="제목 1" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleHeading({level:1}).run()}>H1</button><button title="제목 2" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>H2</button><button title="제목 3" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleHeading({level:3}).run()}>H3</button><span className="tool-divider"/><button title="목록" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleBulletList().run()}>•</button><button title="번호 목록" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleOrderedList().run()}>1.</button><button title="인용" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleBlockquote().run()}>❝</button><button title="코드" disabled={!canEdit} onClick={()=>editor?.chain().focus().toggleCodeBlock().run()}>{'{}'}</button><button title="표 삽입" disabled={!canEdit} onClick={()=>editor?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}><Table2 size={15}/></button></div><button className="ai-tool" disabled={!canEdit||aiBusy} onClick={()=>assist('polish')}><Sparkles size={15}/>{aiBusy?'AI 처리 중':'AI 도우미'}</button></div>
      <div className="connection-line"><span className={`connection-dot ${connection.status}`}/><span>{pending?`저장 대기 ${pending}건`:connection.label}</span><span className="local-label"><Check size={13}/> 이 기기에도 임시 저장</span></div>
      <div className="page-canvas"><div className="canvas-inner"><EditorContent editor={editor}/>{editor?.isEditable&&<div className="editor-hint"><span>문서 안에서 자유롭게 작성하세요.</span><span><kbd>/</kbd> 블록을 입력하고 상단 도구로 서식을 바꿀 수 있습니다.</span></div>}</div></div>
      <div className="editor-footer"><span><ShieldCheckIcon/> 워크스페이스 권한에 따라 저장됩니다.</span><button onClick={()=>assist('summarize')} disabled={!canEdit||aiBusy}><Sparkles size={14}/> 선택한 내용 요약</button><button onClick={()=>assist('tasks')} disabled={!canEdit||aiBusy}><Workflow size={14}/> 할 일 추출</button><button onClick={()=>assist('translate')} disabled={!canEdit||aiBusy}>번역</button></div>
      {aiOpen&&<div className="ai-result"><div className="ai-result-head"><span><Sparkles size={15}/> AI 제안</span><button className="mini-icon" onClick={()=>setAiOpen(false)}><X size={16}/></button></div><div className="ai-original"><small>선택한 원문</small>{aiText}</div><div className="ai-suggestion"><small>제안 결과</small>{aiResult}</div><div className="ai-result-actions"><button className="secondary-btn" onClick={()=>setAiOpen(false)}>닫기</button><button className="primary" onClick={insertAi}>현재 위치에 삽입</button></div></div>}
    </section>
    {commentsOpen&&<CommentsPanel page={page} user={user} onClose={onCommentsClose} notify={notify}/>}
  </div>;
}
function ShieldCheckIcon(){return <span className="shield-check"><Check size={12}/></span>}

function CommentsPanel({page,user,onClose,notify}:{page:Page;user:User;onClose:()=>void;notify:(text:string)=>void}){
  const[items,setItems]=useState<Comment[]>([]),[body,setBody]=useState(''),[busy,setBusy]=useState(false);
  async function load(){try{const result=await api<{items:Comment[]}>(`/pages/${page.id}/comments`);setItems(result.items);}catch(error){notify((error as Error).message);}}
  useEffect(()=>{void load();},[page.id]);
  async function send(){if(!body.trim())return;setBusy(true);try{await api(`/pages/${page.id}/comments`,{method:'POST',body:JSON.stringify({body})});setBody('');await load();}catch(error){notify((error as Error).message);}finally{setBusy(false);}}
  async function resolve(commentId:string){try{await api(`/comments/${commentId}/resolve`,{method:'POST'});await load();}catch(error){notify((error as Error).message);}}
  return <aside className="comments-panel"><div className="panel-head"><div><span className="eyebrow">DISCUSSION</span><h3>페이지 댓글</h3></div><button className="mini-icon" onClick={onClose}><X size={17}/></button></div><div className="comment-list">{items.map(item=><article className={`comment ${item.resolved_at?'resolved':''}`} key={item.id}><div className="comment-by"><span className="comment-avatar">{(item.display_name||item.email).slice(0,1).toUpperCase()}</span><div><b>{item.display_name||item.email.split('@')[0]}</b><time>{new Date(item.created_at).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div><button className="mini-icon" title={item.resolved_at?'다시 열기':'해결'} onClick={()=>resolve(item.id)}><Check size={15}/></button></div><p>{item.body}</p>{item.resolved_at&&<small>해결됨</small>}</article>)}{items.length===0&&<div className="comments-empty"><MessageCircle size={20}/><span>아직 댓글이 없습니다.</span><small>질문이나 검토 의견을 남겨 보세요.</small></div>}</div><div className="comment-compose"><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={`${displayName(user)} 이름으로 댓글 쓰기`} rows={3}/><div><span>댓글은 워크스페이스 멤버와 공유됩니다.</span><button className="primary" disabled={!body.trim()||busy} onClick={send}><Send size={14}/> 보내기</button></div></div></aside>;
}

function Welcome({templates,onCreate,onTemplates}:{templates:Template[];onCreate:(templateId?:string)=>void;onTemplates:()=>void}){
  return <div className="welcome"><div className="welcome-kicker"><span className="welcome-spark">✦</span> 00AI PUBLIC WORKSPACE</div><h1>좋은 일은<br/><em>함께 정리할 때</em> 시작됩니다.</h1><p>문서, 업무 지식, 팀의 기록을 한 공간에서 만들고<br/>동료와 실시간으로 함께 다듬어 보세요.</p><div className="welcome-actions"><button className="primary" onClick={()=>onCreate()}><Plus size={16}/> 빈 페이지 만들기</button><button className="secondary-btn" onClick={onTemplates}><LayoutTemplate size={16}/> 템플릿 둘러보기</button></div><div className="welcome-section"><div className="welcome-section-title"><div><span className="eyebrow">START WITH A TEMPLATE</span><h2>바로 사용할 수 있는 시작점</h2></div><button className="link-button" onClick={onTemplates}>모든 템플릿 <ArrowUpRight size={14}/></button></div><div className="template-cards">{templates.slice(0,3).map(item=><button className="template-card" key={item.id} onClick={()=>onCreate(item.id)}><span className="template-icon">{item.icon}</span><span className="template-meta">{item.category}</span><b>{item.title}</b><span className="template-description">{item.description}</span><span className="template-copy"><Copy size={14}/> 복제하여 사용</span></button>)}</div></div><div className="welcome-foot"><div className="feature-note"><Users size={16}/><span><b>실시간 협업</b><small>동료의 변경 사항을 바로 확인</small></span></div><div className="feature-note"><ShieldCheckIcon/><span><b>권한으로 안전하게</b><small>공간과 페이지별 역할 제어</small></span></div><div className="feature-note"><Sparkles size={16}/><span><b>AI 문서 도우미</b><small>선택한 내용만 요약·다듬기</small></span></div></div></div>;
}

function TemplateDialog({templates,onClose,onSelect}:{templates:Template[];onClose:()=>void;onSelect:(id:string)=>void}){
  const[categories,setCategories]=useState('전체');const all=['전체',...new Set(templates.map(item=>item.category))];const visible=categories==='전체'?templates:templates.filter(item=>item.category===categories);
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="dialog template-dialog"><div className="dialog-head"><div><span className="eyebrow">PUBLIC TEMPLATE LIBRARY</span><h2>공공 템플릿</h2><p>복제한 페이지는 내 워크스페이스에서 자유롭게 수정할 수 있습니다.</p></div><button className="mini-icon" onClick={onClose}><X size={18}/></button></div><div className="category-tabs">{all.map(name=><button key={name} className={categories===name?'active':''} onClick={()=>setCategories(name)}>{name}</button>)}</div><div className="template-grid">{visible.map(item=><button className="template-card" key={item.id} onClick={()=>onSelect(item.id)}><span className="template-icon">{item.icon}</span><span className="template-meta">{item.category}</span><b>{item.title}</b><span className="template-description">{item.description}</span><span className="template-copy"><Copy size={14}/> 복제</span></button>)}</div><div className="dialog-note"><ShieldCheckIcon/> 출처와 이용 조건이 확인된 템플릿만 게시합니다.</div></div></div>;
}

function ShareDialog({email,role,setEmail,setRole,onClose,onShare}:{email:string;role:string;setEmail:(x:string)=>void;setRole:(x:string)=>void;onClose:()=>void;onShare:()=>void}){
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="dialog share-dialog"><div className="dialog-head"><div><span className="eyebrow">PAGE ACCESS</span><h2>페이지 공유</h2><p>이메일 주소로 협업자를 추가합니다.</p></div><button className="mini-icon" onClick={onClose}><X size={18}/></button></div><div className="share-form"><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="동료 이메일 주소" autoFocus/><select value={role} onChange={e=>setRole(e.target.value)}><option value="editor">편집 가능</option><option value="commenter">댓글 가능</option><option value="viewer">보기 가능</option></select><button className="primary" disabled={!email.trim()} onClick={onShare}><Plus size={15}/> 초대</button></div><div className="permission-note"><Users size={16}/><span><b>초대받은 계정만 이 페이지를 볼 수 있습니다.</b><small>아직 계정이 없는 이메일은 가입 후 권한이 연결됩니다.</small></span></div><div className="share-link-row"><div><Link2 size={15}/> 공개 링크는 꺼져 있습니다</div><span>비공개</span></div></div></div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
