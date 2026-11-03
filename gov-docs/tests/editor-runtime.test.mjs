import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Script} from 'node:vm';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const H=(.*)$/m);
assert(match,'HTML template exists');
const html=JSON.parse(match[1].replace(/;$/,''));
test('inline editor scripts parse as JavaScript',()=>{
 let count=0;
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  if(!match[1].trim())continue;
  new Script(match[1],{filename:'00ai-docs-editor-inline-'+(++count)+'.js'});
 }
 assert(count>0,'expected at least one executable inline script');
});
test('basic Office OpenXML generator is wired',()=>{
 for(const token of ['onclick="downloadDOCX()"','async function downloadDOCX()','[Content_Types].xml','word/document.xml','document.xml.rels','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',"compression:'DEFLATE'"]){
  assert(html.includes(token),'missing DOCX export capability: '+token);
 }
});
test('DOCX does not silently claim lossless HWPX export',()=>{
 assert(html.includes('복잡한 표·이미지·쪽 레이아웃은 원본과 비교'));
});
