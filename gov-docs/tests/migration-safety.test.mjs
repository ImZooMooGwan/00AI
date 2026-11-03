import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
test('preflight is access controlled and never mutates stored document',()=>{
 const begin=code.indexOf("if(p==='/api/v2/migration-preflight'&&r.method==='GET')");
 const end=code.indexOf("if(p==='/api/v2/export-backup')",begin);
 assert(begin>=0&&end>begin,'preflight API handler is present');
 const handler=code.slice(begin,end);
 for(const fragment of ["await docAccess(id)","SELECT id,title,body,rev,status,updated_at FROM docs_v2","crypto.subtle.digest('SHA-256'","sourceRevision:doc.rev","canonicalEditor:'legacy-html'","requiresExplicitImport:true"]){
  assert(handler.includes(fragment),'missing migration safeguard: '+fragment);
 }
 assert(!/UPDATE\s+docs_v2|DELETE\s+FROM|INSERT\s+INTO/i.test(handler),'preflight must be read-only');
});
test('Yjs transition blocks unsaved changes and requires matching backup',()=>{
 const begin=code.indexOf('async function openRichCollab(){');
 const end=code.indexOf('\\nfunction openCollabLab(){',begin);
 assert(begin>=0&&end>begin,'safe launch function is present');
 const launch=code.slice(begin,end);
 const safeguards=[
  'if(saving)', 'if(dirty)', 'await saveDoc(true)',
  "request('v2/migration-preflight?id=",
  'info.sourceRevision!==rev','!info.ready',
  "request('v2/export-backup?id=",
  'backup.doc.rev!==info.sourceRevision',
  "crypto.subtle.digest('SHA-256'",
  'checkSha!==info.sha256',
  'checkBytes.length!==info.htmlBytes',
  '00ai-docs-before-collab-',
  'window.location.assign(target)'
 ];
 safeguards.forEach(s=>assert(launch.includes(s),'missing safety guard '+s));
 assert(launch.indexOf('link.click()')<launch.indexOf('window.location.assign(target)'),'backup must trigger before navigation');
});
test('legacy documents and collaboration remain distinct until verified migration',()=>{
 assert(code.includes("richEditor:'isolated-yjs'"));
 assert(code.includes("requiresExplicitImport:true"));
 assert(code.includes("function downloadBackup()"));
 assert(code.includes("function openCollabLab()"));
});
