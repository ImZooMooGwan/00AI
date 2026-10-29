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
