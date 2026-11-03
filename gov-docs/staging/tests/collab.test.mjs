import assert from 'node:assert/strict';
import * as Y from 'yjs';

// Two independently edited clients must converge regardless of message order.
{
 const a=new Y.Doc(),b=new Y.Doc();
 const updatesA=[],updatesB=[];
 a.on('update',u=>updatesA.push(u));b.on('update',u=>updatesB.push(u));
 a.getText('text').insert(0,'행정업무');
 b.getText('text').insert(0,'공동편집');
 for(const u of updatesA)Y.applyUpdate(b,u);
 for(const u of updatesB)Y.applyUpdate(a,u);
 assert.equal(a.getText('text').toString(),b.getText('text').toString());
}

// Applying replayed journal entries again must be idempotent.
{
 const source=new Y.Doc(),replica=new Y.Doc();const journal=[];
 source.on('update',u=>journal.push(u));
 source.getText('text').insert(0,'테스트');
 source.getText('text').insert(3,' 문서');
 for(const update of journal)Y.applyUpdate(replica,update);
 const state=replica.getText('text').toString();
 for(const update of journal)Y.applyUpdate(replica,update);
 assert.equal(replica.getText('text').toString(),state);
}

// Shared XML content (used by Tiptap) converges across two clients.
{
 const a=new Y.Doc(),b=new Y.Doc();
 const xml=a.getXmlFragment('default');
 const el=new Y.XmlElement('paragraph');const content=new Y.XmlText();content.insert(0,'공동문서');el.insert(0,[content]);xml.insert(0,[el]);
 Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
 assert.deepEqual(Y.encodeStateVector(a),Y.encodeStateVector(b));
}
console.log('PASS Yjs convergence, journal replay, shared XML document');


// Retransmitting a durable Yjs update must never change the shared document twice.
{
 const source=new Y.Doc(),replica=new Y.Doc(),receipts=new Map();
 source.getText('text').insert(0,'행정 AI 공동편집');
 const update=Y.encodeStateAsUpdate(source);
 const sameId='client-77-edit-1';
 function receive(requestId,payload){
  if(receipts.has(requestId))return {seq:receipts.get(requestId),duplicate:true};
  const seq=receipts.size+1;
  Y.applyUpdate(replica,payload);
  receipts.set(requestId,seq);
  return {seq,duplicate:false};
 }
 const first=receive(sameId,update),again=receive(sameId,update);
 assert.deepEqual(again,{seq:first.seq,duplicate:true});
 assert.equal(receipts.size,1);
 assert.equal(replica.getText('text').toString(),'행정 AI 공동편집');
}

// Source guard: each queued update has an ID; server stores a durable receipt.
{
 const fs=await import('node:fs');
 const client=fs.readFileSync(new URL('../src/YjsJournalBridge.ts',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../src/collab-server.js',import.meta.url),'utf8');
 assert.match(client,/requestId:this\.pending\[0\]\.id/);
 assert.match(client,/requestId.*pending\[0\]\.id/);
 assert.match(server,/CREATE TABLE IF NOT EXISTS request_receipts/);
 assert.match(server,/SELECT seq FROM request_receipts WHERE actor=\? AND request_id=\?/);
 assert.match(server,/transactionSync/);
 assert.match(server,/send\(socket,'ack',\{seq:this\.seq,requestId\}\)/);
}
console.log('PASS idempotent update receipts and replay guard');

// Reconnect guard: never stop permanently after a fixed number of outages.
{
 const fs=await import('node:fs');
 const client=fs.readFileSync(new URL('../src/YjsJournalBridge.ts',import.meta.url),'utf8');
 const view=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(client,/Math\.min\(30000,1000\*2\*\*/);
 assert.match(client,/window\.addEventListener\('online',this\.handleOnline\)/);
 assert.match(client,/window\.removeEventListener\('online',this\.handleOnline\)/);
 assert.doesNotMatch(client,/this\.attempts\+\+<6/);
 assert.match(view,/다시 연결/);
}
console.log('PASS reconnection and manual recovery guard');

// Fail-closed collaboration protocol and authorization regression checks.
{
 const fs=await import('node:fs');
 const client=fs.readFileSync(new URL('../src/YjsJournalBridge.ts',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../src/collab-server.js',import.meta.url),'utf8');
 assert.match(client,/msg\.requestId!==this\.pending\[0\]\.id/, 'stale or unidentified ACKs cannot discard a queued edit');
 assert.match(client,/this\.snapshotFailed/, 'invalid snapshot must block connected state');
 assert.match(client,/if\(this\.snapshotFailed\)/, 'sync must not be announced after a snapshot failure');
 assert.match(client,/this\.fatalLocalEdit=true/, 'oversize local edits are not silently discarded');
 assert.match(client,/this\.pending\.length\+\(this\.fatalLocalEdit\?1:0\)/, 'unsent oversize edits must trigger navigation guard');
 assert.match(server,/target\.docId!==ident\.docId\|\|!\(await this\.permitted\(target\.actor,target\.docId,false\)\)/, 'revoked peers must not receive awareness');
}
console.log('PASS fail-closed snapshot, acknowledgement, oversize update and peer ACL guards');

{
 const fs=await import('node:fs');
 const ui=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(ui,/downloadSnapshot\(format:'html'\|'json'\)/);
 assert.match(ui,/editor\.getHTML\(\)/);
 assert.match(ui,/editor\.getJSON\(\)/);
 assert.match(ui,/HTML 백업/);
 assert.match(ui,/JSON 백업/);
 assert.match(ui,/URL\.revokeObjectURL/);
}
console.log('PASS local realtime recovery exports');
