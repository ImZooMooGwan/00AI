import * as Y from 'yjs';

type Message = {type:string; data?:string; seq?:number; reason?:string; through?:number};
type Status = 'connecting'|'syncing'|'connected'|'disconnected'|'error';
const asBase64 = (buf:Uint8Array) => {
  let text=''; for(const value of buf) text+=String.fromCharCode(value);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const fromBase64=(text:string)=>{
  const str=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));
  return Uint8Array.from(str,c=>c.charCodeAt(0));
};

export class YjsJournalBridge {
  private ws:WebSocket|null=null;
  private pending:string[]=[];
  private awaiting=false;
  private generation=0;
  private disposed=false;
  private attempts=0;
  private ackedSeq=0;
  private synced=false;
  public onStatus:(status:Status,message:string)=>void=()=>{};
  public onPending:(count:number)=>void=()=>{};
  constructor(public readonly ydoc:Y.Doc, private readonly documentId:string) {
    this.ydoc.on('update',this.onUpdate);
  }
  private onUpdate=(update:Uint8Array,origin:any)=>{
    if(origin==='remote')return;
    const data=asBase64(update);
    if(data.length>89000){this.onStatus('error','단일 수정이 제한 크기를 초과했습니다.');return;}
    this.pending.push(data);
    this.onPending(this.pending.length);
    this.flush();
  };
  public connect(){
    if(this.disposed)return;
    const generation=++this.generation;
    this.awaiting=false;
    this.synced=false;
    this.ws?.close();
    this.onStatus('connecting','서버 연결 중');
    const scheme=location.protocol==='https:'?'wss':'ws';
    const ws=new WebSocket(scheme+'://'+location.host+'/api/v2/collab?doc='+encodeURIComponent(this.documentId));
    this.ws=ws;
    ws.onopen=()=>{
      if(generation!==this.generation)return;
      this.onStatus('syncing','저장 이력 재동기화 중');
      ws.send(JSON.stringify({type:'sync',since:0}));
    };
    ws.onmessage=({data})=>{
      if(generation!==this.generation)return;
      let msg:Message;try{msg=JSON.parse(data)}catch{return;}
      if(msg.type==='update' && msg.data){
        try{Y.applyUpdate(this.ydoc,fromBase64(msg.data),'remote');this.ackedSeq=Math.max(this.ackedSeq,msg.seq||0);}
        catch{this.onStatus('error','업데이트 적용 실패');}
      }
      if(msg.type==='synced'){
        this.synced=true;this.attempts=0;
        this.ackedSeq=Math.max(this.ackedSeq,msg.through||0);
        this.onStatus('connected','연결됨 · 변경 병합 활성화');
        this.flush();
      }
      if(msg.type==='ack'){
        if(this.awaiting && this.pending.length){
          this.pending.shift();this.awaiting=false;this.onPending(this.pending.length);this.flush();
        }
      }
      if(msg.type==='error'||msg.type==='reset-required'){
        this.onStatus('error',msg.reason||'동기화 오류');
        this.synced=false;
      }
    };
    ws.onclose=()=>{
      if(this.disposed||generation!==this.generation)return;
      this.synced=false;this.awaiting=false;
      this.onStatus('disconnected','연결이 끊겼습니다. 편집을 잠급니다.');
      if(this.attempts++<6) setTimeout(()=>this.connect(),Math.min(15000,1500*this.attempts));
    };
    ws.onerror=()=>this.onStatus('error','연결 장애');
  }
  private flush(){
    if(!this.synced||this.awaiting||!this.pending.length||this.ws?.readyState!==WebSocket.OPEN)return;
    this.awaiting=true;
    this.ws.send(JSON.stringify({type:'update',data:this.pending[0]}));
  }
  public get pendingCount(){return this.pending.length;}
  public get serverSequence(){return this.ackedSeq;}
  public destroy(){this.disposed=true;this.ws?.close();this.ydoc.off('update',this.onUpdate);}
}
