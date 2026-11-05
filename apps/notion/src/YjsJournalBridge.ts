import * as Y from 'yjs';

type WireMessage = { type:string; data?:string; seq?:number; reason?:string; through?:number; users?:Array<{id:string;name:string}>; parts?:number; index?:number };
export type ConnectionStatus = 'connecting'|'syncing'|'connected'|'disconnected'|'error';
const encode=(bytes:Uint8Array)=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')};
const decode=(text:string)=>{const raw=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};

export class YjsJournalBridge {
  private socket:WebSocket|null=null;
  private pending:string[]=[];
  private awaiting=false;
  private generation=0;
  private disposed=false;
  private attempts=0;
  private synced=false;
  private connected=false;
  private snapshotParts:string[]=[];
  private snapshotExpected=0;
  private saveWaiters=new Set<{resolve:()=>void;reject:(error:Error)=>void;timer:number}>();
  onStatus:(status:ConnectionStatus,label:string)=>void=()=>{};
  onPending:(count:number)=>void=()=>{};
  onPresence:(users:Array<{id:string;name:string}>)=>void=()=>{};
  constructor(private readonly ydoc:Y.Doc,private readonly pageId:string){ydoc.on('update',this.onUpdate);}
  waitForSaved(timeout=15000){
    if(this.connected&&this.pending.length===0&&!this.awaiting)return Promise.resolve();
    return new Promise<void>((resolve,reject)=>{const waiter={resolve,reject,timer:window.setTimeout(()=>{this.saveWaiters.delete(waiter);reject(new Error('대상 문서 저장 확인 시간이 초과되었습니다. 원본 블록은 그대로 유지했습니다.'));},timeout)};this.saveWaiters.add(waiter);});
  }
  private settleSaveWaiters(error?:Error){
    if(!error&&(!this.connected||this.pending.length||this.awaiting))return;
    for(const waiter of this.saveWaiters){window.clearTimeout(waiter.timer);error?waiter.reject(error):waiter.resolve();}
    this.saveWaiters.clear();
  }
  private onUpdate=(update:Uint8Array,origin:unknown)=>{
    if(origin==='remote')return;
    const data=encode(update);
    if(data.length>88_000){this.onStatus('error','한 번에 저장할 변경이 너무 큽니다.');return;}
    this.pending.push(data);this.onPending(this.pending.length);this.flush();
  };
  connect(){
    if(this.disposed)return;
    const generation=++this.generation;this.synced=false;this.connected=false;this.awaiting=false;this.socket?.close();
    this.onStatus('connecting','협업 공간에 연결 중');
    const scheme=location.protocol==='https:'?'wss':'ws';
    const socket=new WebSocket(`${scheme}://${location.host}/api/collab/${encodeURIComponent(this.pageId)}`);this.socket=socket;
    socket.onopen=()=>{if(generation!==this.generation)return;this.onStatus('syncing','변경 내용을 동기화 중');socket.send(JSON.stringify({type:'sync'}));};
    socket.onmessage=event=>{
      if(generation!==this.generation)return;
      let message:WireMessage;try{message=JSON.parse(event.data as string);}catch{return;}
      if(message.type==='snapshot-start'){this.snapshotParts=[];this.snapshotExpected=Number(message.parts)||0;}
      if(message.type==='snapshot-part'&&message.data&&Number.isInteger(message.index)&&Number(message.index)>=0&&Number(message.index)<this.snapshotExpected)this.snapshotParts[Number(message.index)]=message.data;
      if(message.type==='snapshot-end'){
        if(this.snapshotExpected&&this.snapshotParts.length===this.snapshotExpected&&this.snapshotParts.every(Boolean))try{Y.applyUpdate(this.ydoc,decode(this.snapshotParts.join('')),'remote');}catch{this.onStatus('error','저장 상태를 불러오지 못했습니다.');}
        else this.onStatus('error','저장 데이터 일부가 누락되었습니다.');
        this.snapshotParts=[];this.snapshotExpected=0;
      }
      if(message.type==='update'&&message.data)try{Y.applyUpdate(this.ydoc,decode(message.data),'remote');}catch{this.onStatus('error','변경 내용을 반영하지 못했습니다.');}
      if(message.type==='presence'&&message.users)this.onPresence(message.users);
      if(message.type==='synced'){this.synced=true;this.connected=true;this.attempts=0;this.onStatus('connected','실시간 저장 중');this.flush();this.settleSaveWaiters();}
      if(message.type==='ack'&&this.awaiting&&this.pending.length){this.pending.shift();this.awaiting=false;this.onPending(this.pending.length);this.flush();}
      if(message.type==='error'){this.synced=false;this.connected=false;const error=new Error(message.reason||'협업 저장에 실패했습니다.');this.onStatus('error',error.message);this.settleSaveWaiters(error);}
    };
    socket.onclose=()=>{
      if(this.disposed||generation!==this.generation)return;
      this.synced=false;this.connected=false;this.awaiting=false;this.onStatus('disconnected','연결이 끊겼습니다. 로컬 변경은 보관하고 다시 연결합니다.');
      if(this.attempts<8){const delay=Math.min(20_000,1000*2**this.attempts++);setTimeout(()=>this.connect(),delay);}
    };
    socket.onerror=()=>this.onStatus('error','서버 연결에 문제가 있습니다.');
  }
  private flush(){if(!this.synced||this.awaiting||this.socket?.readyState!==WebSocket.OPEN)return;if(!this.pending.length){this.settleSaveWaiters();return;}this.awaiting=true;this.socket.send(JSON.stringify({type:'update',data:this.pending[0]}));}
  destroy(){this.disposed=true;this.generation++;this.socket?.close();this.ydoc.off('update',this.onUpdate);this.settleSaveWaiters(new Error('대상 문서 연결이 종료되어 저장 확인을 마치지 못했습니다.'));}
}
