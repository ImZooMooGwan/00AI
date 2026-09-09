import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

function runtime() {
  const nodes = new Map();
  function element() { return {value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,dataset:{},files:[],classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},scrollIntoView(){},focus(){},click(){}}; }
  const html = fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  for(const [,id] of html.matchAll(/id="([^"]+)"/g)) nodes.set(id,element());
  const context=vm.createContext({document:{body:{dataset:{}},querySelector(selector){return nodes.get(selector.slice(1));},querySelectorAll(){return [];},addEventListener(){}},window:{scrollTo(){}},localStorage:{getItem(){return null;},setItem(){}},navigator:{clipboard:{writeText:async()=>{}}},setTimeout(callback){callback();return 1;},clearTimeout(){},performance,crypto:webcrypto,TextEncoder,Blob,AbortSignal,console,fetch:async()=>{throw new Error('Unexpected network request');}});
  vm.runInContext(fs.readFileSync(new URL('../../harness-app-v5.js',import.meta.url),'utf8'),context);
  return {context,nodes};
}

test('browser runner extracts evidence and hashes selected documents without network',async()=>{
  const {context,nodes}=runtime();
  context.documentFile={name:'plan.txt',size:100,text:async()=> '청년 주거지원은 100명을 대상으로 진행합니다.\n총 사업비는 1억원입니다.'};
  nodes.get('taskInput').value='청년 주거지원의 대상과 사업비를 확인해주세요.';
  vm.runInContext('selectDocuments([documentFile])',context);
  assert.equal(nodes.get('runButton').disabled,false);
  await vm.runInContext('executeRun()',context);
  assert.equal(context.document.body.dataset.state,'verified');
  const result=vm.runInContext('lastResult',context);
  assert.equal(result.hasa_used,false);
  assert.equal(result.documents.length,1);
  assert.match(result.documents[0].hash,/^[a-f0-9]{64}$/);
  assert.ok(result.evidence.some(item=>item.text.includes('100명')));
  assert.match(result.markdown,/HASA: 미사용/);
  assert.equal(nodes.get('activeTitle').textContent,'완료된 실행 내역');
});

test('empty, invalid, and oversized selections cannot be executed',()=>{
  const {context,nodes}=runtime();
  nodes.get('taskInput').value='청년 주거지원의 대상과 사업비를 확인해주세요.';
  vm.runInContext('selectDocuments([])',context);
  assert.equal(nodes.get('runButton').disabled,true);
  context.invalid={name:'unsupported.pdf',size:100};
  vm.runInContext('selectDocuments([invalid])',context);
  assert.equal(nodes.get('runButton').disabled,true);
  context.large={name:'large.txt',size:11*1024*1024};
  vm.runInContext('selectDocuments([large])',context);
  assert.equal(nodes.get('runButton').disabled,true);
});
