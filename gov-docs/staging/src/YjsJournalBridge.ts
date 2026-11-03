import * as Y from 'yjs';

type Message = {type:string; data?:string; seq?:number; reason?:string; through?:number; requestId?:string};
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
  private pending:Array<{id:string;data:string}>=[];
  private awaiting=false;
  private generation=0;
  private disposed=false;
  private attempts=0;
  private ackedSeq=0;
  private synced=false;
  private readonly clientId=crypto.randomUUID();
  private reconnectTimer:ReturnType<typeof setTimeout>|null=null;
  private readonly handleOnline=()=>{if(!this.disposed&&!this.synced)this.connect()};
  private requestCounter=0;
  private snapshotParts:string[]=[];
  private snapshotExpected=0;
  private snapshotFailed=false;
  private fatalLocalEdit=false;
  public onStatus:(status:Status,message:string)=>void=()=>{};
  public onPending:(count:number)=>void=()=>{};
  constructor(public readonly ydoc:Y.Doc, private readonly documentId:string) {
    this.ydoc.on('update',this.onUpdate);
    window.addEventListener('online',this.handleOnline);
  }
  private onUpdate=(update:Uint8Array,origin:any)=>{
    if(origin==='remote')return;
    const data=asBase64(update);
    if(data.length>89000){this.fatalLocalEdit=true;this.onStatus('error','편집 내용이 전송 허용 크기를 초과했습니다. 이 창을 닫지 말고 현재 내용을 별도 백업하세요.');this.onPending(this.pending.length+1);return;}
    this.pending.push({id:this.clientId+'-'+(++this.requestCounter),data});
    this.onPending(this.pending.length);
    this.flush();
  };
  public connect(){
    if(this.disposed)return;
    if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}
    if(this.synced&&this.ws?.readyState===WebSocket.OPEN)return;
    const generation=++this.generation;
    this.awaiting=false;
    this.synced=false;
    this.snapshotFailed=false;
    this.snapshotParts=[];
    this.snapshotExpected=0;
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
      if(msg.type==='snapshot-start'){this.snapshotParts=[];this.snapshotExpected=Number((msg as any).parts)||0;if(this.snapshotExpected<1||this.snapshotExpected>150)this.snapshotFailed=true;}
      if(msg.type==='snapshot-part' && msg.data){const index=Number((msg as any).index);if(Number.isInteger(index)&&index>=0&&index<this.snapshotExpected&&/^[A-Za-z0-9_-]+$/.test(msg.data))this.snapshotParts[index]=msg.data;else this.snapshotFailed=true;}
      if(msg.type==='snapshot-end'){if(this.snapshotExpected&&this.snapshotParts.length===this.snapshotExpected&&this.snapshotParts.every(Boolean)){try{Y.applyUpdate(this.ydoc,fromBase64(this.snapshotParts.join('')),'remote')}catch{this.snapshotFailed=true;this.onStatus('error','스냅샷 적용 실패')}}else {this.snapshotFailed=true;this.onStatus('error','스냅샷 일부가 누락됐습니다')}this.snapshotParts=[];this.snapshotExpected=0;}
      if(msg.type==='update' && msg.data){
        try{Y.applyUpdate(this.ydoc,fromBase64(msg.data),'remote');this.ackedSeq=Math.max(this.ackedSeq,msg.seq||0);}
        catch{this.snapshotFailed=true;this.onStatus('error','업데이트 적용 실패');}
      }
      if(msg.type==='synced'){
        if(this.snapshotFailed){this.onStatus('error','원격 상태 검증에 실패했습니다. 편집을 잠그고 재연결합니다.');this.ws?.close();return;}
        this.synced=true;this.attempts=0;
        this.ackedSeq=Math.max(this.ackedSeq,msg.through||0);
        this.onStatus(this.fatalLocalEdit?'error':'connected',this.fatalLocalEdit?'크기 초과로 저장되지 않은 변경이 있습니다. 백업하세요.':'연결됨 · 변경 병합 활성화');
        this.flush();
      }
      if(msg.type==='ack'){
        if(this.awaiting && this.pending.length){
          // Only the matching server acknowledgement may remove a queued edit.
          if(msg.requestId!==this.pending[0].id)return;
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
      this.attempts++;
      const delay=Math.min(30000,1000*2**Math.min(this.attempts,5));
      this.reconnectTimer=setTimeout(()=>this.connect(),delay);
    };
    ws.onerror=()=>this.onStatus('error','연결 장애');
  }
  private flush(){
    if(!this.synced||this.fatalLocalEdit||this.awaiting||!this.pending.length||this.ws?.readyState!==WebSocket.OPEN)return;
    this.awaiting=true;
    this.ws.send(JSON.stringify({type:'update',requestId:this.pending[0].id,data:this.pending[0].data}));
  }
  public get pendingCount(){return this.pending.length+(this.fatalLocalEdit?1:0);}
  public get hasUnsentChanges(){return this.pendingCount>0;}
  public get serverSequence(){return this.ackedSeq;}
  public destroy(){this.disposed=true;if(this.reconnectTimer)clearTimeout(this.reconnectTimer);window.removeEventListener('online',this.handleOnline);this.ws?.close();this.ydoc.off('update',this.onUpdate);}
}
