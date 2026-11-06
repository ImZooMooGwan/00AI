type JsonNode={type:string;attrs?:Record<string,unknown>;content?:JsonNode[];text?:string};
type ZipEntry={name:string;method:number;compressedSize:number;size:number;localOffset:number};
const wordNs='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const attr=(el:Element,name:string)=>el.getAttributeNS(wordNs,name)||el.getAttribute('w:'+name)||el.getAttribute(name)||'';
const kids=(el:Element,name:string)=>Array.from(el.children).filter(child=>child.localName===name);
const all=(el:Element,name:string)=>Array.from(el.getElementsByTagName('*')).filter(child=>child.localName===name);

function zipEntries(bytes:Uint8Array):ZipEntry[]{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),lower=Math.max(0,bytes.length-65_557);let end=-1;
 for(let i=bytes.length-22;i>=lower;i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Office 문서의 ZIP 목차를 읽을 수 없습니다.');
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),start=view.getUint32(end+16,true);
 if(count>3000||start+size>bytes.length)throw new Error('Office 문서의 내부 파일 목록이 올바르지 않습니다.');
 const decoder=new TextDecoder(),entries:ZipEntry[]=[];let offset=start;
 for(let i=0;i<count;i++){
  if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)throw new Error('Office 문서의 내부 파일 목록이 손상되었습니다.');
  const method=view.getUint16(offset+10,true),compressedSize=view.getUint32(offset+20,true),fileSize=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),localOffset=view.getUint32(offset+42,true);
  if(offset+46+nameLength+extraLength+commentLength>bytes.length)throw new Error('Office 문서의 파일 이름을 읽을 수 없습니다.');
  const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength));entries.push({name,method,compressedSize,size:fileSize,localOffset});offset+=46+nameLength+extraLength+commentLength;
 }
 return entries;
}
async function readEntry(bytes:Uint8Array,entry:ZipEntry):Promise<Uint8Array>{
 if(entry.size>25_000_000||entry.compressedSize>bytes.length)throw new Error('문서 내부 파일이 너무 큽니다.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),offset=entry.localOffset;
 if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw new Error('Office 문서 내부 데이터가 손상되었습니다.');
 const dataStart=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true),dataEnd=dataStart+entry.compressedSize;
 if(dataEnd>bytes.length)throw new Error('Office 문서의 압축 데이터가 잘렸습니다.');
 const compressed=bytes.slice(dataStart,dataEnd);
 if(entry.method===0){if(compressed.length!==entry.size)throw new Error('Office 문서 크기 확인에 실패했습니다.');return compressed;}
 if(entry.method!==8)throw new Error('지원하지 않는 Office 문서 압축 방식입니다.');
 if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저는 Office 문서 압축 해제를 지원하지 않습니다. 최신 Edge 또는 Chrome에서 다시 시도해 주세요.');
 const stream=new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>entry.size||total>25_000_000){await reader.cancel();throw new Error('Office 문서의 압축 해제 크기가 허용 범위를 초과했습니다.');}chunks.push(value);}}finally{reader.releaseLock();}
 if(total!==entry.size)throw new Error('Office 문서 압축을 확인할 수 없습니다.');
 const result=new Uint8Array(total);let position=0;for(const chunk of chunks){result.set(chunk,position);position+=chunk.length;}return result;
}
function textInParagraph(el:Element):string{
 let result='';
 const walk=(node:Node)=>{if(node.nodeType!==Node.ELEMENT_NODE)return;const item=node as Element;if(item.localName==='t'){result+=item.textContent||'';return;}if(item.localName==='tab'){result+='\t';return;}if(item.localName==='br'||item.localName==='cr'){result+='\n';return;}for(const child of Array.from(item.childNodes))walk(child);};
 for(const child of Array.from(el.childNodes))walk(child);return result.replace(/\u0000/g,'');
}
function paragraph(text:string,level=0):JsonNode{
 const content:JsonNode[]=[];text.split('\n').forEach((line,index)=>{if(index)content.push({type:'hardBreak'});if(line)content.push({type:'text',text:line});});
 return level?{type:'heading',attrs:{level},content}:{type:'paragraph',content};
}
function listFormats(xml:string):Map<string,string>{
 const result=new Map<string,string>();if(!xml)return result;const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))return result;
 const abstracts=new Map<string,Map<string,string>>();
 for(const item of all(doc.documentElement,'abstractNum')){const levels=new Map<string,string>();for(const lvl of kids(item,'lvl')){const fmt=all(lvl,'numFmt')[0];if(fmt)levels.set(attr(lvl,'ilvl')||'0',attr(fmt,'val'));}abstracts.set(attr(item,'abstractNumId'),levels);}
 for(const item of all(doc.documentElement,'num')){const abstract=kids(item,'abstractNumId')[0],id=attr(item,'numId');if(!abstract)continue;for(const [level,format] of abstracts.get(attr(abstract,'val'))||[])result.set(id+':'+level,format);}
 return result;
}
function tableNode(table:Element):JsonNode{
 const rows=all(table,'tr').map(row=>({type:'tableRow',content:kids(row,'tc').map(cell=>{const blocks=kids(cell,'p').map(item=>paragraph(textInParagraph(item)));return{type:'tableCell',content:blocks.length?blocks:[{type:'paragraph'}]};})}));
 return{type:'table',content:rows.length?rows:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'paragraph'}]}]}]};
}
function parseDocx(xml:string,numbering:string):JsonNode{
 if(xml.length>25_000_000||numbering.length>5_000_000||/<!\s*(?:doctype|entity)\b/i.test(xml+numbering))throw new Error('DOCX 내부 XML이 너무 크거나 지원하지 않는 선언을 포함합니다.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('DOCX 문서 XML을 해석할 수 없습니다.');
 const body=all(doc.documentElement,'body')[0];if(!body)throw new Error('DOCX 문서 본문을 찾을 수 없습니다.');
 const formats=listFormats(numbering),content:JsonNode[]=[];let group:any=null;
 const flush=()=>{if(group){content.push({type:group.type,attrs:group.type==='orderedList'?{start:1}:undefined,content:group.items});group=null;}};
 for(const block of Array.from(body.children)){
  if(block.localName==='tbl'){flush();content.push(tableNode(block));continue;}if(block.localName!=='p')continue;
  const text=textInParagraph(block),pPr=kids(block,'pPr')[0],style=pPr&&kids(pPr,'pStyle')[0],styleId=style?attr(style,'val'):'',outline=pPr&&kids(pPr,'outlineLvl')[0],outlineLevel=outline?Number(attr(outline,'val')):NaN;
  const heading=styleId.match(/(?:heading|제목)([1-6])/i),level=heading?Math.min(3,Number(heading[1])):Number.isFinite(outlineLevel)?Math.min(3,outlineLevel+1):/^(title|제목)$/i.test(styleId)?1:0;
  const numPr=pPr&&kids(pPr,'numPr')[0],numId=numPr&&all(numPr,'numId')[0]?attr(all(numPr,'numId')[0],'val'):'',ilvl=numPr&&all(numPr,'ilvl')[0]?attr(all(numPr,'ilvl')[0],'val'):'0';
  if(numId){const format=formats.get(numId+':'+ilvl)||'bullet',type=format==='bullet'?'bulletList':'orderedList',key=numId+':'+ilvl+':'+format;if(group?.key!==key){flush();group={key,type,items:[]};}group.items.push({type:'listItem',content:[paragraph(text)]});continue;}
  flush();if(text.trim()||level)content.push(paragraph(text,level));
 }
 flush();return{type:'doc',content:content.length?content:[{type:'paragraph'}]};
}
function parseHwpx(xmls:string[]):JsonNode{
 if(xmls.reduce((sum,xml)=>sum+xml.length,0)>25_000_000||xmls.some(xml=>/<!\s*(?:doctype|entity)\b/i.test(xml)))throw new Error('HWPX 본문이 너무 크거나 지원하지 않는 XML 선언을 포함합니다.');
 const content:JsonNode[]=[];for(const xml of xmls){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('HWPX 문서 XML을 해석할 수 없습니다.');for(const item of all(doc.documentElement,'p')){const text=all(item,'t').map(node=>node.textContent||'').join('').replace(/\u0000/g,'');if(text.trim())content.push(paragraph(text));}}
 return{type:'doc',content:content.length?content:[{type:'paragraph'}]};
}
export async function importOfficeDocument(file:File):Promise<JsonNode>{
 const bytes=new Uint8Array(await file.arrayBuffer()),entries=zipEntries(bytes),byName=new Map(entries.map(item=>[item.name,item]));
 if(/\.docx$/i.test(file.name)){const doc=byName.get('word/document.xml');if(!doc)throw new Error('DOCX 본문 파일(word/document.xml)이 없습니다.');const num=byName.get('word/numbering.xml');if(doc.size+(num?.size||0)>25_000_000)throw new Error('DOCX 본문이 너무 큽니다.');const parts=await Promise.all([readEntry(bytes,doc),num?readEntry(bytes,num):Promise.resolve(new Uint8Array())]);return parseDocx(new TextDecoder().decode(parts[0]),parts[1].length?new TextDecoder().decode(parts[1]):'');}
 if(/\.hwpx$/i.test(file.name)){const sections=entries.filter(item=>/^Contents\/section\d+\.xml$/i.test(item.name)).sort((a,b)=>Number(a.name.match(/section(\d+)/i)?.[1]||0)-Number(b.name.match(/section(\d+)/i)?.[1]||0));if(!sections.length)throw new Error('HWPX 문서에서 본문 구역을 찾을 수 없습니다.');if(sections.reduce((sum,item)=>sum+item.size,0)>25_000_000)throw new Error('HWPX 본문이 너무 큽니다.');return parseHwpx(await Promise.all(sections.map(async item=>new TextDecoder().decode(await readEntry(bytes,item)))));}
 throw new Error('지원하는 Office 파일은 DOCX와 HWPX입니다.');
}
