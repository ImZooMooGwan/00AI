import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useEditor,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import {YjsJournalBridge} from './YjsJournalBridge';
import './style.css';

type DocumentInfo={title:string,status:string,rev:number};
const docId=new URL(location.href).searchParams.get('doc')||'';
const checkId=/^[a-f0-9-]{36}$/i.test(docId);

function App(){
  const ydoc=useMemo(()=>new Y.Doc(),[]);
  const [doc,setDoc]=useState<DocumentInfo|null>(null);
  const [role,setRole]=useState('viewer');
  const [status,setStatus]=useState('loading');
  const [statusText,setStatusText]=useState('문서 접근권한 확인 중');
  const [pending,setPending]=useState(0);
  const [sequence,setSequence]=useState(0);
  const canWrite=(role==='owner'||role==='editor')&&doc?.status==='draft';
  const connected=status==='connected';
  const editor=useEditor({extensions:[
    StarterKit.configure({undoRedo:false}),
    Table.configure({resizable:true}),TableRow,TableCell,TableHeader,
    Collaboration.configure({document:ydoc,field:'default'}),
  ],editable:false,editorProps:{attributes:{class:'doc-editor','aria-label':'실시간 공동편집 문서'}}},[ydoc]);

  useEffect(()=>{
    if(!editor)return;
    editor.setEditable(Boolean(canWrite&&connected));
  },[editor,canWrite,connected]);

  useEffect(()=>{
    if(!checkId){setStatus('error');setStatusText('문서 ID가 올바르지 않습니다');return;}
    let dead=false;let bridge:YjsJournalBridge|undefined;
    fetch('/api/v2/doc?id='+encodeURIComponent(docId),{credentials:'same-origin'})
      .then(async res=>{if(!res.ok)throw new Error('로그인 또는 문서 접근권한 확인 실패: HTTP '+res.status);return res.json()})
      .then(data=>{
        if(dead)return;
        setDoc(data.doc);setRole(data.role||'viewer');
        bridge=new YjsJournalBridge(ydoc,docId);
        bridge.onStatus=(next,text)=>{if(!dead){setStatus(next);setStatusText(text);setSequence(bridge!.serverSequence)}};
        bridge.onPending=n=>{if(!dead)setPending(n)};
        bridge.connect();
        (window as any).__collabBridge=bridge;
      }).catch(error=>{if(!dead){setStatus('error');setStatusText(error.message)}});
    return()=>{dead=true;bridge?.destroy();ydoc.destroy()};
  },[ydoc]);

  useEffect(()=>{
    const handler=(ev:BeforeUnloadEvent)=>{if(pending){ev.preventDefault();ev.returnValue=''}};
    window.addEventListener('beforeunload',handler);
    return()=>window.removeEventListener('beforeunload',handler);
  },[pending]);

  function run(cb:()=>void){if(!editor||!editor.isEditable)return;cb()}
  const tableActions=[
    {name:'표 추가',ok:()=>true,run:()=>editor?.chain().focus().insertTable({rows:3,cols:4,withHeaderRow:false}).run()},
    {name:'행 추가',ok:()=>Boolean(editor?.can().addRowAfter()),run:()=>editor?.chain().focus().addRowAfter().run()},
    {name:'열 추가',ok:()=>Boolean(editor?.can().addColumnAfter()),run:()=>editor?.chain().focus().addColumnAfter().run()},
    {name:'셀 병합',ok:()=>Boolean(editor?.can().mergeCells()),run:()=>editor?.chain().focus().mergeCells().run()},
    {name:'셀 분할',ok:()=>Boolean(editor?.can().splitCell()),run:()=>editor?.chain().focus().splitCell().run()},
    {name:'행 삭제',ok:()=>Boolean(editor?.can().deleteRow()),run:()=>editor?.chain().focus().deleteRow().run()},
    {name:'열 삭제',ok:()=>Boolean(editor?.can().deleteColumn()),run:()=>editor?.chain().focus().deleteColumn().run()}
  ];
  return <div className="app">
    <header><strong>✦ 00AI DOCS</strong><span>구조화 공동편집 실험실</span><div className={'status '+status}>{statusText}</div></header>
    <main>
      <div className="heading"><h1>{doc?.title||'문서 확인 중'}</h1><a href={'/?doc='+encodeURIComponent(docId)}>기존 문서로 돌아가기</a></div>
      <div className="warning"><b>시험용 편집기:</b> Yjs 기반으로 문단·표·제목을 동시에 편집하지만 현재 정식 문서 본문(documents/D1)과 별도로 저장됩니다. 기존 한글문서 자동 변환·버전 복원은 연결되지 않았습니다. 공개·가상자료로만 시험하세요.</div>
      <div className="metrics"><span>문서 권한: {role}</span><span>서버 업데이트: {sequence}</span><span>미확인 전송: {pending}건</span></div>
      <nav className="toolbar" aria-label="문서 편집 도구">
        <button disabled={!editor?.isEditable} onClick={()=>run(()=>editor?.chain().focus().toggleBold().run())}><b>B</b></button>
        <button disabled={!editor?.isEditable} onClick={()=>run(()=>editor?.chain().focus().toggleItalic().run())}><i>I</i></button>
        <button disabled={!editor?.isEditable} onClick={()=>run(()=>editor?.chain().focus().toggleHeading({level:2}).run())}>제목 2</button>
        <button disabled={!editor?.isEditable} onClick={()=>run(()=>editor?.chain().focus().toggleBulletList().run())}>• 목록</button>
        {tableActions.map(item=><button key={item.name} disabled={!editor?.isEditable||!item.ok()} onClick={()=>run(()=>{item.run();})}>{item.name}</button>)}
      </nav>
      <section className="paper"><EditorContent editor={editor}/></section>
      <footer>이 화면은 별도 Yjs 공동편집 파일럿입니다. 최종 행정문서의 버전·승인·HWPX 호환을 보증하지 않습니다.</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
