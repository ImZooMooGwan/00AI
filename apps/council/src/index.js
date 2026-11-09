const LIVE_URL = 'https://council.daejeon.go.kr/svc/air/AirMain.do';
const REPORT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const TRANSCRIBE_MODEL = '@cf/openai/whisper-large-v3-turbo';

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#142b49"><title>00AI COUNCIL</title>
<style>
:root{color-scheme:light;--navy:#142b49;--blue:#0173bc;--green:#00866a;--orange:#f18101;--ink:#17202b;--sub:#586779;--line:#dce4ea;--wash:#f3f6f8;--white:#fff;--red:#c53535}*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Malgun Gothic",sans-serif}button,input,textarea,select{font:inherit}button{border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);padding:10px 14px;min-height:44px;cursor:pointer;font-weight:650}button:hover{border-color:var(--blue);color:var(--blue)}button.primary{background:var(--blue);border-color:var(--blue);color:#fff;min-height:48px}button.danger{color:var(--red)}button:disabled{opacity:.5;cursor:not-allowed}a{color:var(--blue)}header{height:72px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,4vw,48px);position:sticky;top:0;z-index:2}header .brand{display:flex;gap:12px;align-items:center;font-size:20px;font-weight:780;letter-spacing:-.03em}header .bars{display:flex;gap:4px;height:24px;align-items:end}header .bars i{width:7px;border-radius:2px;background:#48a7df;height:14px}header .bars i:nth-child(2){height:20px;background:#40bb90}header .bars i:nth-child(3){height:24px;background:#ffa83c}header .user{font-size:13px;color:#dbe6f0}header .user button{margin-left:12px;border:1px solid #60748d;background:transparent;color:#fff;min-height:36px;padding:5px 10px;border-radius:8px;font-size:12px}main{width:min(98vw,2200px);max-width:2200px;margin:18px auto;padding:0 clamp(16px,1.5vw,32px)}.intro{display:flex;justify-content:space-between;align-items:end;margin-bottom:22px}.intro h1{font-size:30px;line-height:1.2;margin:0 0 6px}.intro p{margin:0;color:var(--sub)}.grid{display:grid;grid-template-columns:minmax(0,2.15fr) minmax(360px,.85fr);gap:22px}.card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 4px 16px #18344d08}.card h2{font-size:18px;margin:0 0 14px}.viewer{height:min(76vh,1000px);min-height:600px;background:#0d1b2b;border-radius:12px;overflow:hidden;position:relative}.viewer iframe{width:100%;height:100%;border:0;background:#0b1930}.viewer-fallback{position:absolute;bottom:12px;right:12px}.broadcast-note{font-size:13px;color:var(--sub);margin:10px 0 0}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.field{display:grid;gap:6px;margin:10px 0}.field label,.label{font-size:13px;color:var(--sub);font-weight:700}.field input,.field textarea,.field select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}.field textarea{min-height:85px;resize:vertical}.meeting-list{display:grid;gap:8px}.meeting{padding:12px;border:1px solid var(--line);border-radius:11px;cursor:pointer}.meeting.active{border:2px solid var(--blue);background:#f0f8fd}.meeting strong{display:block}.meeting small{color:var(--sub)}.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#006f51;background:#e5f5ef;padding:3px 8px;border-radius:999px}.live-dot{height:8px;width:8px;background:#e42323;border-radius:50%;display:inline-block}.scroll{max-height:430px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fbfcfd}.segment{border-bottom:1px solid #edf1f4;padding:8px 2px}.segment:last-child{border:0}.segment time{color:var(--blue);font-size:12px;font-variant-numeric:tabular-nums;margin-right:8px}.segment .source{font-size:11px;color:#667587}.comment{padding:10px;border-bottom:1px solid #edf1f4}.comment:last-child{border:0}.comment-head{display:flex;align-items:center;gap:7px}.comment small{margin-left:auto;color:var(--sub);font-size:11px}.chat-avatar{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#e6f2fa;color:#16649a;font-weight:800;font-size:12px;flex:none}.chat-message{padding:5px 0 0 32px;white-space:pre-wrap;overflow-wrap:anywhere}.status{min-height:24px;color:var(--sub);font-size:13px}.status.error{color:var(--red)}.hidden{display:none!important}.section-gap{margin-top:18px}.notice{background:#fff6e7;border:1px solid #f4d59e;color:#694600;padding:12px 14px;border-radius:10px;font-size:13px;margin:14px 0}.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.muted{color:var(--sub);font-size:13px}.report{white-space:pre-wrap;max-height:430px;overflow:auto;background:#fbfcfd;border:1px solid var(--line);border-radius:10px;padding:14px}.tag{display:inline-block;background:#eef4f8;color:#38536b;border-radius:6px;padding:2px 7px;font-size:12px}.login{margin:14vh auto;max-width:480px;text-align:center}.login .card{padding:32px}.foot{font-size:12px;color:var(--sub);margin-top:22px}.modal{position:fixed;inset:0;background:#15263880;display:grid;place-items:center;z-index:5;padding:16px}.modal .card{width:min(560px,100%)}@media(max-width:1100px){main{width:100%}.grid{grid-template-columns:1fr}.viewer{height:min(68vh,700px);min-height:420px}}@media(max-width:600px){main{width:100%;padding:0 12px;margin:16px auto}.intro{align-items:start;flex-direction:column;gap:12px}.intro h1{font-size:25px}.viewer{height:62vh;min-height:320px}.card{padding:15px}header{padding:0 14px}.user{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
</style></head><body>
<header><div class="brand"><span class="bars"><i></i><i></i><i></i></span><span>00AI COUNCIL</span></div><div class="user"><span id="identity">00AI 계정 확인 중</span><button id="logout" type="button">로그아웃</button></div></header>
<main id="app"><div class="login"><div class="card"><h1>공무원용 의회 방송 모니터링</h1><p class="muted">korea.kr 이메일 인증 후 회의에 참여할 수 있습니다.</p><p id="boot" class="status">회의 목록을 불러오는 중…</p><button type="button" id="retryAuth" class="hidden">다시 연결</button><a href="https://council.daejeon.go.kr/svc/air/AirMain.do" target="_blank" rel="noopener">대전시의회 공식 생방송 페이지</a></div></div></main>
<script>
const LIVE_URL='${LIVE_URL}';const ACCESS_EMAIL=__COUNCIL_EMAIL_JSON__;let me=null,meetings=[],active=null,media=null,audioContext=null,processor=null,refreshTimer=null,segmentStart=0,partial='',pcmPending=[],pcmChunkStart=0,pcmBusy=false,pcmQueue=[];const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));const fmt=t=>{const n=Math.max(0,Math.floor((t||0)/1000));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
async function api(path,options={}){let r;try{r=await fetch(path,{...options,credentials:'same-origin',signal:AbortSignal.timeout(15000),headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}})}catch(e){throw new Error(e?.name==='TimeoutError'?'서버 응답이 15초 안에 오지 않았습니다. 인증을 다시 확인한 뒤 재시도해 주세요.':'서버에 연결하지 못했습니다. 페이지를 새로고침해 주세요.')}if(r.redirected&&new URL(r.url).hostname.endsWith('cloudflareaccess.com'))throw new Error('로그인이 만료되었습니다. 페이지를 새로고침해 korea.kr 이메일 인증을 진행해 주세요.');const ct=r.headers.get('content-type')||'';if(!ct.includes('application/json'))throw new Error('인증 또는 서버 응답 형식을 확인할 수 없습니다. 새로고침 후 다시 로그인해 주세요.');const data=await r.json().catch(()=>({}));if(r.status===401||r.status===403)throw new Error(data.error||'korea.kr 이메일 인증을 확인할 수 없습니다. 새로고침 후 다시 로그인해 주세요.');if(!r.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');return data}
function status(msg,error=false){const e=$('status');if(e){e.textContent=msg||'';e.className='status'+(error?' error':'')}}
function meetingCard(m){return '<div class="meeting '+(active?.id===m.id?'active':'')+'" data-meeting="'+encodeURIComponent(m.id)+'"><strong>'+esc(m.title)+'</strong><small>'+esc(m.committee||'위원회 미입력')+' · '+esc(m.status==='LIVE'?'진행 중':m.status==='ENDED'?'종료':'일시정지')+' · '+new Date(m.updated_at).toLocaleString('ko-KR')+'</small></div>'}
function renderDynamic(){
const live=active?.status==='LIVE';
const list=$('meetings');
if(list){list.innerHTML=meetings.length?meetings.map(meetingCard).join(''):'<p class="muted">등록된 회의가 없습니다. 현재 생방송을 연결하면 회의가 자동 생성됩니다.</p>';list.querySelectorAll('[data-meeting]').forEach(el=>el.onclick=()=>selectMeeting(decodeURIComponent(el.dataset.meeting)))}
const start=$('startLive'),stop=$('stopLive'),end=$('endMeeting'),quick=$('startCurrent');
if(start){start.disabled=!active||live||active.is_owner!==true;start.textContent=live?'실시간 자막 중':'실시간 자막 시작'}
if(quick)quick.disabled=!!media;const exportBtn=$('exportMinutes');if(exportBtn)exportBtn.disabled=!(active?.segments?.length);
if(stop)stop.disabled=!media;
if(end)end.disabled=!active||active.status==='ENDED'||active.is_owner!==true;
const pill=document.querySelector('.pill');if(pill)pill.innerHTML='<i class="live-dot"></i>'+(live?'회의 연결됨':active?'회의 선택됨':'회의 미선택');
if(active)renderContent();
}
function render(){
if($('startCurrent')){renderDynamic();return}
const live=active?.status==='LIVE';$('app').innerHTML='<div class="intro"><div><h1>의회 방송 모니터링</h1><p>공식 생방송을 선택하고 실시간 자막과 내부 검토를 진행합니다.</p></div><div class="row"><button class="primary" id="startCurrent">현재 영상 연결·한글 자막 시작</button></div></div><div class="notice">방송을 재생한 뒤 <b>현재 영상 연결·한글 자막 시작</b>을 누르고 브라우저 공유창에서 이 페이지의 탭과 “탭 오디오 공유”를 선택하세요. 한국어 자막은 약 6초 단위로 생성되어 회의록에 자동 저장됩니다. 음성은 Cloudflare Workers AI로 전송되며 원본 음성은 저장하지 않습니다. 전사 결과·댓글은 로그인 사용자 간 공유 저장되며 채팅 닉네임은 자동 생성됩니다.</div><div class="grid"><section class="card"><h2>대전광역시의회 공식 생방송</h2><div class="viewer"><iframe src="'+LIVE_URL+'" title="대전시의회 인터넷방송" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe><a class="viewer-fallback" href="'+LIVE_URL+'" target="_blank" rel="noopener"><button>공식 방송 새 창에서 열기</button></a></div><p class="broadcast-note">방송을 현재 페이지에서 재생한 뒤, 자막 시작 시 브라우저 공유창에서 이 페이지의 탭과 탭 오디오를 선택하세요. 창 공유를 선택하면 오디오가 전달되지 않을 수 있습니다.</p><div class="toolbar"><span class="pill"><i class="live-dot"></i>'+ (live?'회의 연결됨':'회의 미선택')+'</span><button class="primary" id="startLive" '+(!active||live||active.is_owner!==true?'disabled':'')+'>'+ (live?'실시간 자막 중':'실시간 자막 시작')+'</button><button id="stopLive" '+(live?'':'disabled')+'>자막 중지</button><button id="endMeeting" '+(active&&active.status!=='ENDED'&&active.is_owner===true?'':'disabled')+'>회의 종료</button></div><div id="status" class="status" aria-live="polite"></div><div class="section-gap"><div class="row"><h2 style="margin:0">실시간 회의록·자막</h2><span id="liveCount" class="tag">0개 구간</span><button id="exportMinutes" disabled>회의록 TXT 내려받기</button></div><div id="transcript" class="scroll" aria-live="polite" style="margin-top:10px"><p class="muted">회의를 선택하고 자막을 시작하면 확정된 발언이 표시됩니다.</p></div></div><div class="section-gap"><h2>회의 보고서 초안</h2><div class="toolbar"><button id="makeReport" '+(!active?'disabled':'')+'>AI 보고서 초안 생성</button><button id="copyReport" '+(!active?.report?'disabled':'')+'>복사</button></div><div id="report" class="report">보고서를 만들면 AI 초안과 발언 구간 인용이 여기에 표시됩니다.</div><p class="muted">AI 초안은 공식 회의록이 아닙니다. 수치·결정·답변은 원음 및 공식 자료와 대조해야 합니다.</p></div></section><aside><section class="card"><h2>회의 목록</h2><div id="meetings" class="meeting-list">'+(meetings.length?meetings.map(meetingCard).join(''):'<p class="muted">등록된 회의가 없습니다. 현재 생방송을 연결하면 회의가 자동 생성됩니다.</p>')+'</div></section><section class="card section-gap"><h2>회의 실시간 채팅</h2><p class="muted">꿈씨패밀리 닉네임으로 대화합니다. 새 메시지는 자동으로 갱신됩니다.</p><div id="comments" class="scroll">'+(active?'<p class="muted">댓글을 불러오는 중…</p>':'<p class="muted">회의를 선택하면 댓글을 확인할 수 있습니다.</p>')+'</div><form id="commentForm" class="field section-gap"><label for="commentText">메시지 입력</label><textarea id="commentText" maxlength="1200" placeholder="회의에 참여한 공무원과 검토 의견을 실시간으로 나누세요." '+(active?'':'disabled')+'></textarea><button class="primary" '+(active?'':'disabled')+'>메시지 전송</button></form></section></aside></div><p class="foot">로그인 사용자: '+esc(me.email)+' · 전사 출처: 한국어 Whisper 실시간 구간 전사 · 방송 출처: 대전광역시의회 공식 방송. 00AI-COUNCIL은 대전시의회 공식 서비스가 아닙니다.</p>';
document.querySelectorAll('[data-meeting]').forEach(el=>el.onclick=()=>selectMeeting(decodeURIComponent(el.dataset.meeting)));$('startCurrent').onclick=startCurrentMeeting;$('startLive').onclick=()=>startLive();$('stopLive').onclick=stopLive;$('endMeeting').onclick=endMeeting;$('makeReport').onclick=makeReport;$('copyReport').onclick=()=>navigator.clipboard.writeText(active?.report||'');$('exportMinutes').onclick=downloadMinutes;$('commentForm').onsubmit=submitComment;}
async function load(){const r=await api('/api/meetings');meetings=r.items;const id=active?.id;if(id){const x=await api('/api/meetings/'+encodeURIComponent(id));active={...active,...x.meeting,segments:x.segments,comments:x.comments,report:x.report?.body||''};}render();}
async function selectMeeting(id){try{const x=await api('/api/meetings/'+encodeURIComponent(id));active={...x.meeting,segments:x.segments,comments:x.comments,report:x.report?.body||''};render()}catch(e){status(e.message,true)}}
let lastListSync=0;async function refreshLiveData(){try{if(!active||Date.now()-lastListSync>5000){const list=await api('/api/meetings');meetings=list.items;lastListSync=Date.now()}if(active){const id=active.id,x=await api('/api/meetings/'+encodeURIComponent(id));if(active?.id===id)active={...active,...x.meeting,segments:x.segments,comments:x.comments,report:x.report?.body||''}}render()}catch(e){status(e.message,true)}}
function renderContent(){if(!active)return;const t=$('transcript'),c=$('comments'),report=$('report');if(!t)return;const seg=active.segments||[];$('liveCount').textContent=seg.length+'개 구간';t.innerHTML=seg.map(x=>'<div class="segment"><time>'+fmt(x.start_ms)+'</time><span>'+esc(x.text)+'</span><div class="source">한국어 자동 받아쓰기 · 원음 확인 필요</div></div>').join('')+(partial?'<div class="segment"><time>진행 중</time><span>'+esc(partial)+'</span><div class="source">미확정 음성 인식 결과</div></div>':'')||( '<p class="muted">아직 저장된 자막이 없습니다.</p>');t.scrollTop=t.scrollHeight;c.innerHTML=(active.comments||[]).map(x=>{const nick=x.author_name||'꿈씨친구';return '<div class="comment"><div class="comment-head"><span class="chat-avatar">'+esc(nick.slice(0,1))+'</span><strong>'+esc(nick)+'</strong><small>'+new Date(x.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+'</small></div><div class="chat-message">'+esc(x.body)+'</div></div>'}).join()||'<p class="muted">등록된 댓글이 없습니다.</p>';if(report)report.textContent=active.report||'보고서를 만들면 AI 초안과 발언 구간 인용이 여기에 표시됩니다.'}
async function startCurrentMeeting(){let shared;const quick=$('startCurrent');if(quick)quick.disabled=true;try{status('현재 페이지 영상 오디오 공유를 선택하세요.');shared=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});if(!shared.getAudioTracks().length){shared.getTracks().forEach(t=>t.stop());throw new Error('공유 선택창에서 “Microsoft Edge 탭”을 고르고 현재 Council 페이지와 탭 오디오 공유를 켜세요. 창 공유와 오디오 꺼짐 상태에서는 음성을 받을 수 없습니다.')}let existing=meetings.find(m=>m.is_owner&&m.title.startsWith('대전시의회 생방송 · ')&&m.status!=='ENDED');if(existing){await selectMeeting(existing.id)}else{const now=new Date(),stamp=now.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});const r=await api('/api/meetings',{method:'POST',body:JSON.stringify({title:'대전시의회 생방송 · '+stamp,committee:'생방송 채널'})});await load();await selectMeeting(r.id)}await startLive(shared)}catch(e){shared?.getTracks().forEach(t=>t.stop());status(e.message,true);alert('생방송 연결 실패: '+e.message)}finally{if(!media&&quick)quick.disabled=false}}
function downloadMinutes(){if(!active?.segments?.length)return;const rows=active.segments.slice().sort((a,b)=>a.start_ms-b.start_ms).map(x=>'['+fmt(x.start_ms)+'] '+x.text);const body='00AI COUNCIL 실시간 회의록\n회의명: '+active.title+'\n위원회: '+(active.committee||'미입력')+'\n생성 기준: 한국어 자동 받아쓰기 초안 · 원음 및 공식 회의록 대조 필요\n\n'+rows.join('\n');const blob=new Blob(['\ufeff'+body],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(active.title||'의회회의록').replace(/[\\/:*?"<>|]/g,'_')+'.txt';a.click();URL.revokeObjectURL(a.href)}
function makeWav(samples,rate=16000){const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,samples[i],true);return buffer}
function queuePcm(samples){if(!active)return;pcmQueue.push({meetingId:active.id,samples,startMs:pcmChunkStart,clientId:crypto.randomUUID()});pcmChunkStart+=Math.round(samples.length/16);processPcmQueue()}
async function processPcmQueue(){if(pcmBusy)return;pcmBusy=true;try{while(pcmQueue.length){const item=pcmQueue[0];if(active?.id===item.meetingId){partial='한국어 자막 생성 중…';renderContent()}let succeeded=false,lastError=null;for(let attempt=0;attempt<2&&!succeeded;attempt++){try{const r=await fetch('/api/meetings/'+encodeURIComponent(item.meetingId)+'/transcribe',{method:'POST',credentials:'same-origin',headers:{'content-type':'audio/wav','x-start-ms':String(item.startMs),'x-client-id':item.clientId},body:makeWav(item.samples),signal:AbortSignal.timeout(30000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'한국어 자막을 저장하지 못했습니다.');if(active?.id===item.meetingId){partial='';if(data.text){await load();status('한국어 자막을 회의록에 저장했습니다.')}}succeeded=true}catch(e){lastError=e;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,700))}}pcmQueue.shift();if(!succeeded){if(active?.id===item.meetingId)status('음성 구간 저장 실패: '+(lastError?.message||'재시도 후에도 실패했습니다.')+' 이 구간은 복구되지 않았습니다.',true);continue}}}catch(e){status(e.message||'자막 처리 중 오류가 발생했습니다.',true)}finally{pcmBusy=false;partial='';if(active)renderContent();if(pcmQueue.length)processPcmQueue()}}
async function startLive(selectedMedia=null){if(!active)return;try{status('현재 페이지의 탭 오디오를 연결하고 한국어 자막을 시작합니다.');media=selectedMedia||await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});const tracks=media.getAudioTracks();if(!tracks.length){media.getTracks().forEach(t=>t.stop());media=null;throw new Error('공유 선택창에서 “Microsoft Edge 탭”과 현재 Council 페이지의 탭 오디오를 선택하세요.')}audioContext=new AudioContext();await audioContext.resume();const source=audioContext.createMediaStreamSource(new MediaStream(tracks));processor=audioContext.createScriptProcessor(4096,1,1);const silent=audioContext.createGain();silent.gain.value=0;source.connect(processor);processor.connect(silent);silent.connect(audioContext.destination);segmentStart=Date.now();pcmPending=[];pcmChunkStart=0;pcmQueue=[];processor.onaudioprocess=e=>{const input=e.inputBuffer.getChannelData(0),ratio=audioContext.sampleRate/16000,n=Math.floor(input.length/ratio);for(let i=0;i<n;i++){let sum=0,count=0;const a=Math.floor(i*ratio),b=Math.min(input.length,Math.floor((i+1)*ratio));for(let j=a;j<b;j++){sum+=input[j];count++}const v=count?sum/count:0;pcmPending.push(Math.max(-32768,Math.min(32767,Math.round(Math.max(-1,Math.min(1,v))*32767))))}while(pcmPending.length>=96000)queuePcm(pcmPending.splice(0,96000))};partial='음성 수신 중 · 약 6초 단위로 한국어 자막 저장';status('현재 영상 오디오가 연결됐습니다. 한국어 자막을 회의록에 저장합니다.');active.status='LIVE';api('/api/meetings/'+encodeURIComponent(active.id),{method:'PATCH',body:JSON.stringify({status:'LIVE'})}).catch(e=>status(e.message,true));media.getVideoTracks().forEach(t=>t.addEventListener('ended',stopLive,{once:true}));renderDynamic()}catch(e){if(media){media.getTracks().forEach(t=>t.stop());media=null}if(audioContext){await audioContext.close().catch(()=>{});audioContext=null}processor?.disconnect();processor=null;status(e.message||'오디오 연결을 시작하지 못했습니다.',true);renderDynamic()}}
async function stopLive(){processor?.disconnect();processor=null;if(pcmPending.length>8000){const rest=pcmPending.splice(0);pcmQueue.push({meetingId:active?.id,samples:rest,startMs:pcmChunkStart,clientId:crypto.randomUUID()});processPcmQueue()}else pcmPending=[];if(audioContext){await audioContext.close().catch(()=>{});audioContext=null}if(media){media.getTracks().forEach(t=>t.stop());media=null}if(active&&active.status==='LIVE'){active.status='PAUSED';api('/api/meetings/'+encodeURIComponent(active.id),{method:'PATCH',body:JSON.stringify({status:'PAUSED'})}).catch(()=>{})}status('실시간 자막을 중지했습니다.');renderDynamic()}
async function endMeeting(){if(!active)return;await stopLive();try{await api('/api/meetings/'+encodeURIComponent(active.id),{method:'PATCH',body:JSON.stringify({status:'ENDED'})});await load();status('회의를 종료했습니다. 보고서 초안을 생성할 수 있습니다.')}catch(e){status(e.message,true)}}
async function submitComment(e){e.preventDefault();const input=$('commentText'),body=input.value.trim();if(!active||!body)return;try{await api('/api/meetings/'+encodeURIComponent(active.id)+'/comments',{method:'POST',body:JSON.stringify({body})});input.value='';await load();status('댓글을 등록했습니다.')}catch(err){status(err.message,true)}}
async function makeReport(){if(!active)return;status('회의록 근거를 확인해 보고서 초안을 생성하고 있습니다.');try{const r=await api('/api/meetings/'+encodeURIComponent(active.id)+'/report',{method:'POST',body:JSON.stringify({})});active.report=r.body;renderContent();$('copyReport').disabled=false;status('AI 초안 생성 완료. 수치·결정사항을 원음 및 공식 자료와 대조하세요.')}catch(e){status(e.message,true)}}
async function boot(){me={email:ACCESS_EMAIL};$('identity').textContent=me.email;const logout=$('logout');if(logout)logout.onclick=async()=>{try{await api('/api/auth/logout',{method:'POST',body:JSON.stringify({})})}finally{location.replace('/')}};const retry=$('retryAuth');if(retry)retry.onclick=()=>location.reload();try{await load();if(!refreshTimer)refreshTimer=setInterval(()=>{if(!document.hidden)refreshLiveData()},2000)}catch(e){const b=$('boot');if(b){b.textContent=e.message;b.classList.add('error')}if(retry)retry.classList.remove('hidden')}}boot();
</script></body></html>`;

const loginHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#142b49"><title>00AI COUNCIL 로그인</title><style>:root{--navy:#142b49;--blue:#0878c9;--ink:#17202b;--sub:#586779;--line:#dce4ea;--wash:#f3f6f8}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--wash);font:15px/1.55 system-ui,-apple-system,"Malgun Gothic",sans-serif;color:var(--ink);padding:20px}.card{width:min(100%,460px);padding:36px;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 36px #142b4912}.brand{font-weight:800;color:var(--navy);font-size:19px;margin-bottom:32px}.bars{display:inline-flex;gap:3px;align-items:end;height:18px;margin-right:8px}.bars i{width:5px;height:10px;background:#48a7df;border-radius:2px}.bars i:nth-child(2){height:14px;background:#40bb90}.bars i:nth-child(3){height:18px;background:#ffa83c}h1{font-size:25px;line-height:1.3;margin:0 0 8px}p{color:var(--sub);margin:0 0 22px;font-size:14px}.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;font-weight:700}.field input{width:100%;padding:13px;border:1px solid var(--line);border-radius:9px;font:inherit}.field input:focus{outline:2px solid #0878c933;border-color:var(--blue)}button{border:0;background:var(--blue);color:#fff;font:inherit;font-weight:700;border-radius:9px;min-height:48px;padding:10px 16px;cursor:pointer;width:100%;margin-top:8px}button:disabled{opacity:.55;cursor:wait}.hint,.status{font-size:13px;color:var(--sub);margin-top:16px}.status.error{color:#b42318}.hidden{display:none!important}.foot{border-top:1px solid var(--line);padding-top:18px;margin-top:24px;font-size:12px;color:#768394}</style></head><body><main class="card"><div class="brand"><span class="bars"><i></i><i></i><i></i></span>00AI COUNCIL</div><h1>00AI 통합 계정으로 로그인</h1><p>korea.kr 이메일로 인증 코드를 받아 로그인하세요.</p><form id="emailForm"><div class="field"><label for="email">공직자 이메일</label><input id="email" type="email" autocomplete="email" placeholder="name@korea.kr" required></div><button id="send" type="submit">인증 코드 받기</button></form><form id="codeForm" class="hidden"><div class="field"><label for="code">이메일 인증 코드</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6자리 코드" required></div><button id="verify" type="submit">로그인</button><button id="resend" type="button" class="hidden" style="background:#eef4f8;color:#28445e">코드 다시 받기</button></form><div id="status" class="status" aria-live="polite"></div><div class="foot">인증 메일은 00AI 계정 서비스에서 발송합니다. 이 서비스는 대전광역시의회 공식 서비스가 아닙니다.</div></main><script>
const $=id=>document.getElementById(id);let email='';function msg(text,error=false){$('status').textContent=text;$('status').className='status'+(error?' error':'')}
async function post(path,body){let r;try{r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})}catch(e){throw new Error(e.name==='TimeoutError'?'인증 서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요.':'인증 서버에 연결하지 못했습니다.')}const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'인증 요청을 처리하지 못했습니다.');return data}
$('emailForm').onsubmit=async e=>{e.preventDefault();email=$('email').value.trim().toLowerCase();if(!email.endsWith('@korea.kr')){msg('korea.kr 공직자 이메일을 입력해 주세요.',true);return}const b=$('send');b.disabled=true;msg('00AI 인증 메일을 요청하고 있습니다.');try{await post('/api/auth/request-code',{email});$('emailForm').classList.add('hidden');$('codeForm').classList.remove('hidden');$('resend').classList.remove('hidden');$('code').focus();msg(email+'로 인증 코드를 보냈습니다. 메일의 6자리 코드를 입력하세요.')}catch(err){msg(err.message,true)}finally{b.disabled=false}};
$('codeForm').onsubmit=async e=>{e.preventDefault();const b=$('verify');b.disabled=true;msg('00AI 계정을 확인하고 있습니다.');try{await post('/api/auth/verify-code',{email,code:$('code').value.trim()});location.replace('/')}catch(err){msg(err.message,true)}finally{b.disabled=false}};
$('resend').onclick=async()=>{const b=$('resend');b.disabled=true;try{await post('/api/auth/request-code',{email});msg('새 인증 코드를 보냈습니다.')}catch(err){msg(err.message,true)}finally{setTimeout(()=>b.disabled=false,45000)}};
</script></body></html>`;

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  for (const part of cookies.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0,index).trim() === name) return decodeURIComponent(part.slice(index+1).trim());
  }
  return '';
}
async function hashToken(token) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function createSession(env, email) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const created = new Date(), expires = new Date(created.getTime()+12*60*60*1000).toISOString();
  await env.DB.prepare('DELETE FROM council_sessions WHERE expires_at<=?').bind(created.toISOString()).run();
  await env.DB.prepare('INSERT INTO council_sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)').bind(await hashToken(token),email,expires,created.toISOString()).run();
  return token;
}
async function userFromSession(request, env) {
  const token = cookieValue(request,'__Host-council_session');
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare('SELECT email FROM council_sessions WHERE token_hash=? AND expires_at>?').bind(await hashToken(token),now()).first();
  const email = String(row?.email||'').trim().toLowerCase();
  return email.endsWith('@korea.kr') ? {email,name:email.split('@')[0]} : null;
}
async function accountAuth(action, body) {
  const response = await fetch('https://note.00ai.kr/api/auth/'+action,{method:'POST',headers:{'content-type':'application/json','origin':'https://note.00ai.kr','referer':'https://note.00ai.kr/'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(20000)});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(String(data?.error||'00AI 계정 인증에 실패했습니다.').slice(0,240));
  return data;
}
async function bodyJson(request, limit = 64_000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw new Error('요청 내용이 너무 큽니다.');
  const raw = await request.text();
  if (raw.length > limit) throw new Error('요청 내용이 너무 큽니다.');
  return JSON.parse(raw || '{}');
}
function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
async function hasMeeting(db, meetingId) {
  return db.prepare('SELECT id FROM meetings WHERE id=?').bind(meetingId).first();
}
async function nicknameFor(email) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)));
  const adjectives = ['하품하는','낮잠자는','기분좋은','꿈꾸는','방긋웃는','반짝이는','포근한','산책하는','별을보는','두근두근','몽글몽글한','호기심많은'];
  const characters = ['꿈돌이','꿈순이','꿈몽이'];
  const adjective = adjectives[digest[0] % adjectives.length];
  const character = characters[digest[1] % characters.length];
  const number = String(digest[2] % 100).padStart(2, '0');
  return `${adjective} ${character} ${number}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' } });
    let user;
    if (url.pathname.startsWith('/api/')) {
      if (!isSameOrigin(request) && request.method !== 'GET') return json({ error: '허용되지 않은 요청 출처입니다.' }, 403);
      if (request.method === 'POST' && (url.pathname === '/api/auth/request-code' || url.pathname === '/api/auth/verify-code')) {
        try {
          const b = await bodyJson(request,3000), email = String(b.email||'').trim().toLowerCase();
          if (!/^[^\s@]+@korea\.kr$/.test(email)) return json({error:'korea.kr 공직자 이메일만 사용할 수 있습니다.'},400);
          if (url.pathname === '/api/auth/request-code') {
            await accountAuth('request-code',{email});
            return json({ok:true,message:'인증 코드를 발송했습니다.'},200);
          }
          const code=String(b.code||'').trim();
          if (!/^\d{6}$/.test(code)) return json({error:'이메일로 받은 6자리 인증 코드를 입력하세요.'},400);
          const verified=await accountAuth('verify-code',{email,code});
          const verifiedEmail=String(verified?.user?.email||verified?.email||email).trim().toLowerCase();
          if (verifiedEmail !== email || !verifiedEmail.endsWith('@korea.kr')) return json({error:'인증된 계정 정보를 확인할 수 없습니다.'},403);
          const token=await createSession(env,email);
          const headers=new Headers({'cache-control':'no-store'});
          headers.set('set-cookie','__Host-council_session='+token+'; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax');
          return Response.json({ok:true,email},{status:200,headers});
        } catch(error) { return json({error:String(error?.message||'인증 서버 오류').slice(0,240)},502); }
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const token=cookieValue(request,'__Host-council_session');
        if(token) await env.DB.prepare('DELETE FROM council_sessions WHERE token_hash=?').bind(await hashToken(token)).run();
        return new Response(null,{status:204,headers:{'set-cookie':'__Host-council_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax','cache-control':'no-store'}});
      }
      try { user = await userFromSession(request, env); } catch (error) { return json({ error: '로그인 세션을 확인하지 못했습니다. 페이지를 새로고침해 다시 로그인해 주세요.' }, 503); }
      if (!user) return json({ error: '00AI 통합 계정 세션이 만료되었습니다. 다시 로그인해 주세요.' }, 401);
      try {
        if (request.method === 'GET' && url.pathname === '/api/me') return json({ email: user.email, name: user.name });
        if (request.method === 'GET' && url.pathname === '/api/meetings') {
          const r = await env.DB.prepare('SELECT id,title,committee,broadcast_url,status,owner_email,created_at,updated_at FROM meetings ORDER BY updated_at DESC LIMIT 100').all();
          return json({ items: r.results.map(({ owner_email, ...row }) => ({ ...row, is_owner: owner_email === user.email })) });
        }
        if (request.method === 'POST' && url.pathname === '/api/meetings') {
          const b = await bodyJson(request, 6000);
          const title = String(b.title || '').trim().slice(0, 180);
          if (!title) return json({ error: '회의명을 입력하세요.' }, 400);
          const committee = String(b.committee || '').trim().slice(0, 120);
          const meetingId = id(), at = now();
          await env.DB.prepare('INSERT INTO meetings(id,title,committee,broadcast_url,status,owner_email,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(meetingId,title,committee,LIVE_URL,'PAUSED',user.email,at,at).run();
          return json({ id: meetingId }, 201);
        }
        const m = url.pathname.match(/^\/api\/meetings\/([0-9a-f-]{36})(?:\/(comments|transcript|transcribe|report))?$/i);
        if (m) {
          const meetingId = m[1], action = m[2] || '';
          const exists = await hasMeeting(env.DB, meetingId);
          if (!exists) return json({ error: '회의를 찾을 수 없습니다.' }, 404);
          if (request.method === 'GET' && !action) {
            const [meeting, segments, comments, report] = await Promise.all([
              env.DB.prepare('SELECT id,title,committee,broadcast_url,status,owner_email,created_at,updated_at FROM meetings WHERE id=?').bind(meetingId).first(),
              env.DB.prepare('SELECT id,text,start_ms,end_ms,source,speaker,created_at FROM transcript_segments WHERE meeting_id=? ORDER BY start_ms DESC LIMIT 4000').bind(meetingId).all(),
              env.DB.prepare('SELECT id,body,author_name,created_at FROM comments WHERE meeting_id=? ORDER BY created_at DESC LIMIT 200').bind(meetingId).all(),
              env.DB.prepare('SELECT body,model,created_by,created_at FROM reports WHERE meeting_id=? ORDER BY created_at DESC LIMIT 1').bind(meetingId).first()
            ]);
            const safeMeeting = { ...meeting, is_owner: meeting.owner_email === user.email }; delete safeMeeting.owner_email;
            return json({ meeting: safeMeeting, segments: segments.results.reverse(), comments: comments.results.reverse(), report });
          }
          if (request.method === 'PATCH' && !action) {
            const b = await bodyJson(request, 2000), status = String(b.status || '');
            const meetingOwner = await env.DB.prepare('SELECT owner_email FROM meetings WHERE id=?').bind(meetingId).first();
            if (meetingOwner?.owner_email !== user.email) return json({ error: '회의를 만든 사용자만 상태를 변경할 수 있습니다.' }, 403);
            if (!['LIVE','PAUSED','ENDED'].includes(status)) return json({ error: '회의 상태 값이 잘못되었습니다.' }, 400);
            await env.DB.prepare('UPDATE meetings SET status=?,updated_at=? WHERE id=?').bind(status,now(),meetingId).run();
            return json({ ok: true });
          }
          if (request.method === 'POST' && action === 'comments') {
            const b = await bodyJson(request, 4000), text = String(b.body || '').trim();
            if (!text || text.length > 1200) return json({ error: '댓글은 1~1,200자여야 합니다.' }, 400);
            await env.DB.prepare('INSERT INTO comments(id,meeting_id,body,author_email,author_name,created_at) VALUES(?,?,?,?,?,?)').bind(id(),meetingId,text,user.email,await nicknameFor(user.email),now()).run();
            await env.DB.prepare('UPDATE meetings SET updated_at=? WHERE id=?').bind(now(),meetingId).run();
            return json({ ok: true }, 201);
          }
          if (request.method === 'POST' && action === 'transcribe') {
            if (!env.AI) return json({ error: '한국어 음성인식 모델을 사용할 수 없습니다.' }, 503);
            const declared = Number(request.headers.get('content-length') || 0);
            if (declared > 500_000) return json({ error: '음성 구간이 너무 큽니다.' }, 413);
            if (!request.headers.get('content-type')?.startsWith('audio/wav')) return json({ error: 'WAV 음성 구간만 처리할 수 있습니다.' }, 415);
            const bytes = new Uint8Array(await request.arrayBuffer());
            if (bytes.length < 44 || bytes.length > 500_000) return json({ error: '음성 구간 크기가 올바르지 않습니다.' }, 400);
            const start = Math.max(0,Math.min(86_400_000,Number(request.headers.get('x-start-ms'))||0));
            const clientId = String(request.headers.get('x-client-id')||'').slice(0,80);
            if (!clientId) return json({ error: '음성 구간 식별자가 없습니다.' }, 400);
            const result = await env.AI.run(TRANSCRIBE_MODEL,{audio:[...bytes],language:'ko',task:'transcribe',vad_filter:true,initial_prompt:'대전광역시의회 회의입니다. 한국어 회의 발언을 그대로 받아쓰세요. 의원, 위원장, 대전광역시, 상임위원회, 질의, 답변, 행정사무감사, 예산안, 조례안 등 의회 용어를 정확히 표기하세요.'});
            const text = String(result?.text||result?.transcription_info?.text||result?.result?.text||'').trim();
            if (!text) return json({ ok:true,text:'' });
            await env.DB.prepare('INSERT OR IGNORE INTO transcript_segments(id,meeting_id,client_id,text,start_ms,end_ms,source,speaker,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),meetingId,clientId,text,start,start+6000,'whisper-ko','',user.email,now()).run();
            await env.DB.prepare('UPDATE meetings SET updated_at=? WHERE id=?').bind(now(),meetingId).run();
            return json({ ok:true,text,start_ms:start,end_ms:start+6000 },201);
          }
          if (request.method === 'POST' && action === 'transcript') {
            const b = await bodyJson(request, 4000), text = String(b.text || '').trim(), clientId = String(b.client_id || '').slice(0, 80);
            if (!text || text.length > 1800 || !clientId) return json({ error: '전사 구간 내용이 올바르지 않습니다.' }, 400);
            const start = Math.max(0,Math.min(86_400_000,Number(b.start_ms)||0)), end = Math.max(start,Math.min(86_400_000,Number(b.end_ms)||start));
            await env.DB.prepare('INSERT OR IGNORE INTO transcript_segments(id,meeting_id,client_id,text,start_ms,end_ms,source,speaker,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id(),meetingId,clientId,text,start,end,'workers-ai','',user.email,now()).run();
            return json({ ok: true }, 201);
          }
          if (request.method === 'POST' && action === 'report') {
            if (!env.AI) return json({ error: 'AI 모델을 사용할 수 없습니다.' }, 503);
            const rows = await env.DB.prepare('SELECT id,text,start_ms FROM transcript_segments WHERE meeting_id=? ORDER BY start_ms LIMIT 4000').bind(meetingId).all();
            if (!rows.results.length) return json({ error: '보고서 생성에 사용할 자막이 없습니다.' }, 400);
            const meeting = await env.DB.prepare('SELECT title,committee FROM meetings WHERE id=?').bind(meetingId).first();
            const transcript = rows.results.map(x=>`[${Math.floor(x.start_ms/60000)}분 ${String(Math.floor(x.start_ms/1000)%60).padStart(2,'0')}초 · ${x.id}] ${x.text}`).join('\n');
            const truncated = rows.results.length >= 4000;
            const prompt = `다음은 대전시의회 인터넷방송의 한국어 자동 받아쓰기 초안입니다. ${truncated ? '입력은 4,000구간 상한에 도달했을 수 있으므로 전체 회의를 다룬 것처럼 쓰지 말고 범위 제한을 명시하세요.' : ''} 공식 회의록이나 확정 사실로 표현하지 말고 검토용 보고서 초안으로 작성하세요. 질의·답변·요구자료·후속조치를 분리하고, 모든 항목에 실제 제공된 세그먼트 ID를 [근거: id]로 표시하세요. 제공된 원문에 없는 수치·이름·답변은 만들지 말고 '미확인'으로 남기세요. 외부 공식자료를 확인하지 않았으므로 사실검증 완료라고 쓰지 마세요. 제목: ${meeting.title}; 위원회/업무분야: ${meeting.committee||'미입력'}\n\n받아쓰기:\n${transcript}`;
            const result = await env.AI.run(REPORT_MODEL,{messages:[{role:'system',content:'공공 회의 기록을 원문 근거에 한정해 정리한다. 미확인 정보를 추측하지 않는다.'},{role:'user',content:prompt}],max_tokens:2200});
            const text = String(result?.response || result?.result?.response || '').trim();
            if (!text) return json({ error: 'AI가 보고서 내용을 반환하지 않았습니다.' }, 502);
            const warning = '> AI 초안 · 근거 인용은 원문 위치를 찾기 위한 표시이며 사실 확인을 대신하지 않습니다. 공식 회의록·원음·공식자료를 담당자가 대조해야 합니다.'+(truncated?' 입력은 4,000구간으로 제한되어 일부 내용이 포함되지 않았을 수 있습니다.':'')+'\n\n';
            const reportId=id(), at=now(), full=warning+text;
            await env.DB.prepare('INSERT INTO reports(id,meeting_id,body,model,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(reportId,meetingId,full,REPORT_MODEL,user.email,at).run();
            return json({ body: full, model: REPORT_MODEL, created_at: at }, 201);
          }
          return json({ error: '지원하지 않는 회의 요청입니다.' }, 405);
        }
        if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, service: '00AI-COUNCIL', ai: !!env.AI, database: !!env.DB });
        return json({ error: 'API 경로를 찾을 수 없습니다.' }, 404);
      } catch (error) {
        return json({ error: error instanceof SyntaxError ? 'JSON 요청 형식이 올바르지 않습니다.' : String(error?.message || error).slice(0, 300) }, 400);
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed',{status:405});
    try { user = await userFromSession(request,env); } catch (error) { return new Response('로그인 상태를 확인하지 못했습니다. 새로고침해 주세요.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}}); }
    const headers = new Headers({'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' wss:; frame-src https://council.daejeon.go.kr https://webcast.daejeon.go.kr; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'SAMEORIGIN'});
    if (!user) return new Response(loginHtml,{headers});
    return new Response(html.replace('__COUNCIL_EMAIL_JSON__',JSON.stringify(user.email)),{headers});
  }
};
