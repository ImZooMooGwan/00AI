import * as Y from 'yjs';
const decode=(str)=>{const b=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))};
const encode=(bytes)=>{let b='';for(const value of bytes)b+=String.fromCharCode(value);return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const send=(socket,type,data={})=>socket.send(JSON.stringify({type,...data}));
export class DocumentCollaborationRoom {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.doc=new Y.Doc();this.seq=0;
  ctx.blockConcurrencyWhile(async()=>{
   const sql=ctx.storage.sql;
   sql.exec('CREATE TABLE IF NOT EXISTS updates(seq INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,payload TEXT NOT NULL,saved_at INTEGER NOT NULL)');
   sql.exec('CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,seq INTEGER NOT NULL)');
   const rows=sql.exec('SELECT payload,seq FROM snapshots WHERE id=1').toArray();
   let cursor=0;
   if(rows.length){const row=rows[0];Y.applyUpdate(this.doc,decode(row.payload),'remote');cursor=row.seq}
   const updates=sql.exec('SELECT seq,payload FROM updates WHERE seq>? ORDER BY seq',cursor).toArray();
   for(const row of updates){Y.applyUpdate(this.doc,decode(row.payload),'remote');cursor=row.seq}
   this.seq=cursor;
  })
 }
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  const actor=request.headers.get('x-doc-actor'),role=request.headers.get('x-doc-role'),docId=request.headers.get('x-doc-id');
  if(!actor||!docId||!['owner','editor','viewer'].includes(role))return new Response('Forbidden',{status:403});
  if(this.ctx.getWebSockets().length>=60)return new Response('Too many editors',{status:503});
  const pair=new WebSocketPair(),server=pair[1];
  this.ctx.acceptWebSocket(server,[JSON.stringify({actor,role,docId})]);
  send(server,'ready',{protocol:'yjs-snapshot-v2',maxBytes:65536});
  return new Response(null,{status:101,webSocket:pair[0]});
 }
 async permitted(actor,docId,write=false){
  const document=await this.env.DB.prepare('SELECT owner,status FROM docs_v2 WHERE id=?').bind(docId).first();
  if(!document)return false;
  const member=await this.env.DB.prepare('SELECT role FROM docs_v2_members WHERE doc_id=? AND email=?').bind(docId,actor.replace(/^email:/,'')).first();
  const role=document.owner===actor?'owner':member?.role;
  if(!['owner','editor','viewer'].includes(role))return false;
  return !write||(document.status==='draft'&&['owner','editor'].includes(role));
 }
 async webSocketMessage(socket,message){
  if(typeof message!=='string'||message.length>100000)return send(socket,'error',{reason:'Invalid frame'});
  let request;try{request=JSON.parse(message)}catch{return send(socket,'error',{reason:'Invalid JSON'})}
  let ident;try{ident=JSON.parse(this.ctx.getTags(socket)[0])}catch{socket.close(1008,'Invalid session');return}
  if(!(await this.permitted(ident.actor,ident.docId,false))){send(socket,'error',{reason:'Access revoked'});socket.close(1008,'Permission revoked');return}
  if(request.type==='sync'){
   const snapshot=encode(Y.encodeStateAsUpdate(this.doc));
   if(snapshot.length<=60000)send(socket,'update',{seq:this.seq,data:snapshot});
   else {
    const size=50000,parts=Math.ceil(snapshot.length/size);
    if(parts>150)return send(socket,'error',{reason:'Document too large'});
    send(socket,'snapshot-start',{parts,seq:this.seq});
    for(let index=0;index<parts;index++)send(socket,'snapshot-part',{index,data:snapshot.slice(index*size,(index+1)*size)});
    send(socket,'snapshot-end',{seq:this.seq});
   }
   send(socket,'synced',{through:this.seq});
   return;
  }
  if(request.type==='update'){
   if(!['owner','editor'].includes(ident.role)||!(await this.permitted(ident.actor,ident.docId,true))){send(socket,'error',{reason:'Read-only or locked'});return}
   if(typeof request.data!=='string'||request.data.length>90000||!/^[a-zA-Z0-9_-]+$/.test(request.data))return send(socket,'error',{reason:'Malformed CRDT frame'});
   let bytes;try{bytes=decode(request.data);const test=new Y.Doc();Y.applyUpdate(test,bytes)}catch{return send(socket,'error',{reason:'Corrupt Yjs update'})}
   // The journal is durable before acknowledgement or broadcast.
   const row=this.ctx.storage.sql.exec('INSERT INTO updates(actor,payload,saved_at) VALUES (?,?,?) RETURNING seq',ident.actor,request.data,Date.now()).one();
   this.seq=row.seq;Y.applyUpdate(this.doc,bytes,'remote');
   if(this.seq%200===0){
    const payload=encode(Y.encodeStateAsUpdate(this.doc));
    this.ctx.storage.sql.exec('INSERT INTO snapshots(id,payload,seq) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,seq=excluded.seq',payload,this.seq);
    this.ctx.storage.sql.exec('DELETE FROM updates WHERE seq<=?',this.seq);
   }
   send(socket,'ack',{seq:this.seq});
   const update=JSON.stringify({type:'update',seq:this.seq,data:request.data});
   for(const peer of this.ctx.getWebSockets())if(peer!==socket){
    let target;try{target=JSON.parse(this.ctx.getTags(peer)[0])}catch{continue}
    if(!(await this.permitted(target.actor,target.docId,false))){try{peer.close(1008,'Revoked')}catch{};continue}
    try{peer.send(update)}catch{}
   }
   return;
  }
  if(request.type==='awareness'){
   if(typeof request.data!=='string'||request.data.length>2000)return send(socket,'error',{reason:'Awareness too large'});
   const notice=JSON.stringify({type:'awareness',data:request.data,actor:ident.actor});
   for(const peer of this.ctx.getWebSockets())if(peer!==socket)try{peer.send(notice)}catch{}
   return;
  }
  send(socket,'error',{reason:'Unknown operation'});
 }
 webSocketClose(socket,code,reason){try{socket.close(code,reason)}catch{}}
 webSocketError(socket){try{socket.close(1011,'Server error')}catch{}}
}

const enc=new TextEncoder(),base64=x=>btoa(String.fromCharCode(...new Uint8Array(x))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function signature(secret,data){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64(await crypto.subtle.sign('HMAC',key,enc.encode(data)))}
async function session(req,env){try{const match=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)govsession=([^;]+)/);if(!match)return null;const parts=match[1].split('.');if(!parts[1]||await signature(env.SESSION_SECRET,parts[0])!==parts[1])return null;const data=JSON.parse(atob(parts[0].replace(/-/g,'+').replace(/_/g,'/')));if(data.exp<=Date.now()/1000)return null;return await env.DB.prepare('SELECT sub,email FROM users WHERE sub=?').bind(data.sub).first()}catch{return null}}
export default {async fetch(req,env){const url=new URL(req.url);if(url.pathname==='/health')return Response.json({service:'00AI DOCS collab',status:'canary'});if(url.pathname!=='/collab'||req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('Not found',{status:404});if(req.headers.get('Origin')!=='https://docs.00ai.kr')return new Response('Wrong origin',{status:403});const user=await session(req,env);if(!user)return new Response('Login required',{status:401});const id=url.searchParams.get('doc');if(!id||!/^[a-f0-9-]{36}$/i.test(id))return new Response('Invalid document',{status:400});const doc=await env.DB.prepare('SELECT owner,status FROM docs_v2 WHERE id=?').bind(id).first();if(!doc)return new Response('Not found',{status:404});const member=await env.DB.prepare('SELECT role FROM docs_v2_members WHERE doc_id=? AND email=?').bind(id,user.email).first();const role=doc.owner===user.sub?'owner':member?.role;if(!['owner','editor','viewer'].includes(role))return new Response('Forbidden',{status:403});const stub=env.DOC_ROOM.getByName(id);const headers=new Headers({Upgrade:'websocket','x-doc-id':id,'x-doc-actor':user.sub,'x-doc-role':role});return stub.fetch(new Request('https://internal/collab',{headers}))}}