const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 30;
const ALLOWED_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "html", "htm"]);
const STOP_WORDS = new Set(["그리고", "하지만", "관련", "대해서", "대한", "문서", "첨부", "정리", "근거", "함께", "에서", "으로", "에게", "까지", "있는", "없는", "해주세요", "해줘", "이번", "최근"]);

const RUNNERS = {
  browser: {
    label: 'BROWSER LOCAL', metric: 'BROWSER', endpoint: '', connected: true,
    title: '브라우저 로컬 실행 준비됨', note: '문서 원문은 브라우저 메모리에서만 처리됩니다.'
  },
  agent: {
    label: 'PC AGENT', metric: 'PC AGENT', endpoint: 'http://127.0.0.1:43120', connected: false,
    title: 'PC 에이전트 연결 필요', note: 'GitHub에서 에이전트를 설치·실행한 뒤 연결을 확인하세요.'
  },
  server: {
    label: 'INTERNAL SERVER', metric: 'SERVER', endpoint: '', connected: false,
    title: '기관 내부 서버 연결 필요', note: 'HTTPS 실행기 주소와 접근 토큰을 입력하세요.'
  }
};

const stateMeta = {
  ready: '00AI HARNESS / EXECUTION HUB',
  active: '00AI HARNESS / EXECUTION',
  verified: '00AI HARNESS / RESULT'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const views = $$('[data-view]');
const navItems = $$('[data-nav]');
const toast = $('#toast');
const taskInput = $('#taskInput');
const documentInput = $('#documentInput');
const runButton = $('#runButton');
const stepList = $('#stepList');
let files = [];
let lastResult = null;
let runnerMode = 'browser';
let preferredRunner = 'browser';
let toastTimer;
let runnerToken = '';

try {
  RUNNERS.server.endpoint = localStorage.getItem('00ai_harness_server') || '';
  const storedRunner = localStorage.getItem('00ai_harness_runner');
  if (storedRunner && RUNNERS[storedRunner]) preferredRunner = storedRunner;
} catch (_) {}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function setState(next) {
  if (!stateMeta[next]) return;
  document.body.dataset.state = next;
  $('#breadcrumb').textContent = stateMeta[next];
  views.forEach((view) => { view.hidden = view.dataset.view !== next; });
  navItems.forEach((item) => item.classList.toggle('is-selected', item.dataset.nav === next));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function extensionOf(name) {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeText(raw, extension) {
  if (extension === 'json') {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch (_) { return raw; }
  }
  if (extension === 'html' || extension === 'htm') {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return doc.body?.innerText || '';
  }
  return raw;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function keywordsFrom(request) {
  return [...new Set((request.match(/[가-힣A-Za-z0-9]{2,}/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => !STOP_WORDS.has(token)))]
    .slice(0, 24);
}

function extractEvidence(document, keywords) {
  const lines = document.text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 12 && line.length <= 500);
  const scored = lines.map((line, index) => {
    const lower = line.toLowerCase();
    const hits = keywords.filter((keyword) => lower.includes(keyword));
    const numeric = /\d[\d,.]*\s*(원|명|개|건|%|년|월|일)?/.test(line);
    return { file: document.name, line: index + 1, text: line, hits, score: hits.length * 4 + (numeric ? 1 : 0) };
  }).filter((item) => item.score > 0);
  return scored.sort((a, b) => b.score - a.score || a.line - b.line).slice(0, 10);
}

function runnerEndpoint() {
  return ($('#runnerEndpoint').value || '').trim().replace(/\/+$/, '');
}

function runnerHeaders(withJson = false) {
  const headers = {};
  if (withJson) headers['Content-Type'] = 'application/json';
  if (runnerToken) headers.Authorization = `Bearer ${runnerToken}`;
  return headers;
}

function refreshRunButton() {
  const validRequest = taskInput.value.trim().length >= 10;
  runButton.disabled = !files.length || !validRequest || !RUNNERS[runnerMode].connected;
  runButton.innerHTML = `RUN ${RUNNERS[runnerMode].label} <span>→</span>`;
}

function renderFileList() {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  $('#fileSummary').textContent = files.length ? `${files.length}개 문서 · ${formatBytes(total)}` : '선택된 문서 없음';
  $('#fileList').innerHTML = files.map((file) => `<span>${escapeHtml(file.name)} <small>${formatBytes(file.size)}</small></span>`).join('');
  refreshRunButton();
}

function setConnectionVisual(status, title, note) {
  $('#connectionDot').className = `connection-dot ${status === 'ready' ? 'is-ready' : status === 'checking' ? 'is-checking' : 'is-off'}`;
  $('#connectionTitle').textContent = title;
  $('#connectionNote').textContent = note;
  $('#securityConnection').textContent = status === 'ready' ? 'READY' : status === 'checking' ? 'CHECKING' : 'NOT CONNECTED';
  $('#footerState').textContent = status === 'ready' ? 'READY' : 'NOT CONNECTED';
}

function applyRunner(mode) {
  runnerMode = mode;
  try { localStorage.setItem('00ai_harness_runner', mode); } catch (_) {}
  const runner = RUNNERS[mode];
  $$('.runner-option').forEach((button) => {
    const active = button.dataset.runner === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const remote = mode !== 'browser';
  $('#endpointForm').hidden = !remote;
  $('#agentInstall').hidden = !remote;
  $('#runnerEndpoint').placeholder = mode === 'agent' ? 'http://127.0.0.1:43120' : 'https://runner.internal.example';
  $('#runnerEndpoint').value = runner.endpoint;
  $('#runnerToken').value = '';
  runnerToken = '';
  $('#executorMetric').textContent = runner.metric;
  $('#footerRunner').textContent = runner.label;
  $('#routeExecutor').textContent = runner.label;

  if (mode === 'browser') {
    $('#executorMetricNote').textContent = '연결 없이 즉시 실행';
    $('#hasaMetric').textContent = 'OFF';
    $('#hasaMetricNote').textContent = '에이전트에서만 호출';
    $('#routeExecutorNote').textContent = '원문이 이 탭을 벗어나지 않음';
    $('#routeInference').textContent = 'NOT USED';
    $('#securityProcessing').textContent = 'IN BROWSER';
    $('#securityEgress').textContent = '0 B';
    $('#securityHasa').textContent = 'NOT USED';
    $('#securityKey').textContent = 'NOT REQUIRED';
    $('#sealTitle').textContent = 'BROWSER LOCAL';
    $('#sealNote').textContent = '선택한 문서만 이 탭에서 처리합니다.';
    $('#egressPill').innerHTML = '<span class="live-dot"></span>DOCUMENT EGRESS · 0 B';
    setConnectionVisual('ready', runner.title, runner.note);
  } else {
    $('#executorMetricNote').textContent = mode === 'agent' ? '이 PC의 실행기' : '기관망 실행기';
    $('#hasaMetric').textContent = 'CHECK';
    $('#hasaMetricNote').textContent = '연결 후 설정 확인';
    $('#routeExecutorNote').textContent = mode === 'agent' ? '원문이 이 PC 안에서 처리됨' : '원문이 지정한 내부 서버로 전송됨';
    $('#routeInference').textContent = 'HASA VIA RUNNER';
    $('#securityProcessing').textContent = mode === 'agent' ? 'ON THIS PC' : 'INTERNAL SERVER';
    $('#securityEgress').textContent = mode === 'agent' ? 'PC LOCAL' : 'TO INTERNAL SERVER';
    $('#securityHasa').textContent = 'REDACTED EVIDENCE';
    $('#securityKey').textContent = 'RUNNER ENV';
    $('#sealTitle').textContent = mode === 'agent' ? 'PC AGENT' : 'INTERNAL SERVER';
    $('#sealNote').textContent = 'HASA 키는 웹이 아닌 실행기 환경변수에만 둡니다.';
    $('#egressPill').innerHTML = '<span class="live-dot"></span>HASA · REDACTED EVIDENCE ONLY';
    setConnectionVisual(runner.connected ? 'ready' : 'off', runner.connected ? `${runner.label} 연결됨` : runner.title, runner.note);
  }
  refreshRunButton();
  if (mode === 'agent' && !runner.connected) {
    setTimeout(() => connectRunner({ silent: true }), 0);
  }
}

async function connectRunner(options = {}) {
  const silent = options.silent === true;
  const endpoint = runnerEndpoint();
  if (!endpoint) {
    if (!silent) showToast('실행기 주소를 입력해 주세요.');
    return;
  }
  RUNNERS[runnerMode].connected = false;
  runnerToken = $('#runnerToken').value;
  setConnectionVisual('checking', '실행기 연결 확인 중', endpoint);
  $('#connectRunner').disabled = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${endpoint}/health`, { headers: runnerHeaders(), signal: controller.signal, cache: 'no-store' });
    const health = await response.json();
    if (!response.ok || health.status !== 'healthy') throw new Error(health.status || `HTTP ${response.status}`);
    RUNNERS[runnerMode].connected = true;
    RUNNERS[runnerMode].endpoint = endpoint;
    if (runnerMode === 'server') {
      try { localStorage.setItem('00ai_harness_server', endpoint); } catch (_) {}
    }
    $('#hasaMetric').textContent = health.hasa_configured ? 'READY' : 'OFF';
    $('#hasaMetricNote').textContent = health.hasa_configured ? health.hasa_model : '실행기에 키 미설정';
    $('#routeInference').textContent = health.hasa_configured ? `HASA · ${health.hasa_model}` : 'HASA NOT CONFIGURED';
    setConnectionVisual('ready', `${RUNNERS[runnerMode].label} 연결됨`, health.hasa_configured ? `HASA ${health.hasa_model} 사용 가능` : '로컬 근거 추출만 사용 가능');
    if (!silent) showToast('실행기 연결을 확인했습니다.');
  } catch (error) {
    RUNNERS[runnerMode].connected = false;
    setConnectionVisual('off', '실행기에 연결할 수 없음', error.name === 'AbortError' ? '7초 안에 응답하지 않았습니다.' : '에이전트 실행, 주소, 토큰, 방화벽을 확인하세요.');
    if (!silent) showToast('연결 확인에 실패했습니다.');
  } finally {
    clearTimeout(timer);
    $('#connectRunner').disabled = false;
    refreshRunButton();
  }
}

documentInput.addEventListener('change', () => {
  const selected = [...documentInput.files];
  const invalid = selected.filter((file) => !ALLOWED_EXTENSIONS.has(extensionOf(file.name)));
  const valid = selected.filter((file) => ALLOWED_EXTENSIONS.has(extensionOf(file.name))).slice(0, MAX_FILES);
  const total = valid.reduce((sum, file) => sum + file.size, 0);
  if (invalid.length) showToast(`지원하지 않는 파일 ${invalid.length}개를 제외했습니다.`);
  if (total > MAX_TOTAL_BYTES) {
    files = [];
    documentInput.value = '';
    showToast('문서 합계는 10MB 이하여야 합니다.');
  } else {
    files = valid;
  }
  renderFileList();
});

taskInput.addEventListener('input', refreshRunButton);
$$('[data-example]').forEach((button) => button.addEventListener('click', () => {
  taskInput.value = button.dataset.example;
  refreshRunButton();
}));
$$('[data-runner]').forEach((button) => button.addEventListener('click', () => applyRunner(button.dataset.runner)));
$('#connectRunner').addEventListener('click', () => connectRunner());
$('#runnerEndpoint').addEventListener('input', () => {
  if (runnerMode === 'browser') return;
  RUNNERS[runnerMode].connected = false;
  setConnectionVisual('off', '주소 변경됨 · 연결 확인 필요', '새 주소에 실제 실행기가 응답하는지 확인하세요.');
  refreshRunButton();
});

function renderSteps(activeIndex, details) {
  const steps = [
    ['01', 'REQUEST VALIDATE', details[0]],
    ['02', 'RUNNER CONNECT', details[1]],
    ['03', 'DOCUMENT PROCESS', details[2]],
    ['04', 'EVIDENCE / HASA', details[3]],
    ['05', 'RESULT RENDER', details[4]]
  ];
  stepList.innerHTML = steps.map((step, index) => {
    const done = index < activeIndex;
    const active = index === activeIndex;
    return `<div class="step ${done ? 'done' : ''} ${active ? 'active' : ''}"><span class="step-number">${step[0]}</span><span class="step-copy"><strong>${step[1]}</strong><small>${escapeHtml(step[2])}</small></span><span class="step-state">${done ? 'DONE' : active ? 'ACTIVE' : 'QUEUED'}</span></div>`;
  }).join('');
}

function buildMarkdown(result) {
  const evidenceLines = result.evidence.length
    ? result.evidence.map((item, index) => `${index + 1}. **${item.file} · 문장 ${item.line}**  \n   ${item.text}`).join('\n')
    : '- 요청어와 직접 일치하는 근거 문장을 찾지 못했습니다.';
  const fileLines = result.documents.map((doc) => `- ${doc.name} · ${formatBytes(doc.size)} · SHA-256 \`${doc.hash}\``).join('\n');
  return `# 00AI Harness 실행 결과\n\n- 실행시각: ${result.createdAt}\n- 실행 ID: ${result.id}\n- 실행기: ${result.runnerLabel}\n- HASA: 미사용\n- 문서 외부 전송: 0 B\n\n## 업무 요청\n\n${result.request}\n\n## 확인된 근거\n\n${evidenceLines}\n\n## 원본 파일 무결성\n\n${fileLines}\n\n> 문자열 일치 기반 결과입니다. 최종 판단은 담당자가 원문을 재확인해야 합니다.\n`;
}

async function executeBrowser(request, details) {
  const documents = [];
  renderSteps(2, details);
  for (const file of files) {
    const raw = await file.text();
    const text = normalizeText(raw, extensionOf(file.name));
    documents.push({ name: file.name, size: file.size, text, hash: await sha256(text) });
  }
  $('#evidenceFiles').textContent = String(documents.length);
  $('#evidenceHashed').textContent = String(documents.length);
  const keywords = keywordsFrom(request);
  renderSteps(3, details);
  const evidence = documents.flatMap((document) => extractEvidence(document, keywords)).sort((a, b) => b.score - a.score).slice(0, 30);
  $('#evidenceMatched').textContent = String(evidence.length);
  const result = {
    id: `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`,
    request, keywords, documents, evidence,
    runnerMode: 'browser', runnerLabel: RUNNERS.browser.label,
    createdAt: new Date().toLocaleString('ko-KR'), hasa_used: false, ai_summary: null, hasa_error: null
  };
  result.markdown = buildMarkdown(result);
  return result;
}

async function executeRemote(request, details) {
  const endpoint = runnerEndpoint();
  renderSteps(2, details);
  const payloadFiles = [];
  for (const file of files) {
    payloadFiles.push({ name: file.name, content: normalizeText(await file.text(), extensionOf(file.name)) });
  }
  $('#evidenceFiles').textContent = String(payloadFiles.length);
  const response = await fetch(`${endpoint}/v1/runs`, {
    method: 'POST', headers: runnerHeaders(true), body: JSON.stringify({ request, files: payloadFiles })
  });
  const body = await response.json();
  if (!response.ok || body.status !== 'completed') throw new Error(body.message || body.status || `HTTP ${response.status}`);
  renderSteps(3, details);
  const remote = body.result;
  $('#evidenceMatched').textContent = String(remote.evidence?.length || 0);
  $('#evidenceHashed').textContent = String(remote.documents?.length || 0);
  return {
    ...remote,
    runnerMode,
    runnerLabel: RUNNERS[runnerMode].label,
    createdAt: remote.created_at,
    fileName: `${remote.id}_00AI-Harness-result.md`
  };
}

async function executeRun() {
  const request = taskInput.value.trim();
  if (request.length < 10) return showToast('업무 요청을 10자 이상 입력해 주세요.');
  if (!files.length) return showToast('실제 실행할 문서를 먼저 선택해 주세요.');
  if (!RUNNERS[runnerMode].connected) return showToast('실행기 연결 확인이 필요합니다.');

  const started = performance.now();
  const runId = `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const details = [
    `요청 ${request.length}자 확인`,
    `${RUNNERS[runnerMode].label} 연결 확인`,
    `${files.length}개 문서 읽기와 해시`,
    runnerMode === 'browser' ? '요청어 일치 근거 추출' : '로컬 근거 추출 후 HASA 선택 분석',
    'Markdown 결과 생성'
  ];
  $('#runLabel').textContent = `HARNESS RUN · ${runId}`;
  $('#requestText').textContent = request;
  $('#planOutput').textContent = JSON.stringify({
    runner: runnerMode,
    endpoint: runnerMode === 'browser' ? 'browser-memory' : runnerEndpoint(),
    files: files.length,
    original_file_to_hasa: false,
    hasa_input: runnerMode === 'browser' ? 'none' : 'redacted evidence only',
    output: 'markdown'
  }, null, 2);
  $('#policyCheck').textContent = runnerMode === 'server' ? '✓ ORIGINAL FILES GO ONLY TO SELECTED INTERNAL SERVER' : '✓ ORIGINAL FILES STAY ON THIS DEVICE';
  $('#evidenceFiles').textContent = '0';
  $('#evidenceMatched').textContent = '0';
  $('#evidenceHashed').textContent = '0';
  renderSteps(0, details);
  setState('active');
  await new Promise((resolve) => setTimeout(resolve, 180));
  renderSteps(1, details);

  const result = runnerMode === 'browser'
    ? await executeBrowser(request, details)
    : await executeRemote(request, details);
  renderSteps(4, details);
  result.fileName = result.fileName || `${result.id}_00AI-Harness-result.md`;
  lastResult = result;
  $('#elapsed').textContent = `${((performance.now() - started) / 1000).toFixed(2)}s`;
  renderResult(result);
  setState('verified');
  showToast(result.hasa_error ? `실행 완료 · ${result.hasa_error}` : '실제 실행이 완료됐습니다.');
}

function renderResult(result) {
  const documents = result.documents || [];
  const evidence = result.evidence || [];
  const hasaUsed = Boolean(result.hasa_used && result.ai_summary);
  $('#verifiedRunLabel').textContent = `RUN RESULT · ${result.id}`;
  $('#resultRunner').textContent = result.runnerMode === 'browser' ? 'BROWSER' : result.runnerMode === 'agent' ? 'PC AGENT' : 'SERVER';
  $('#resultFiles').textContent = String(documents.length);
  $('#resultEvidence').textContent = String(evidence.length);
  $('#resultHasa').textContent = hasaUsed ? 'USED' : 'OFF';
  $('#resultHasaNote').textContent = hasaUsed ? (result.hasa_model || 'HASA') : (result.hasa_error || '추론 미사용');
  $('#resultFileName').textContent = result.fileName;
  $('#resultFileMeta').textContent = `${formatBytes(new Blob([result.markdown || '']).size)} · Markdown`;
  $('#ledgerCount').textContent = `${evidence.length} ITEMS`;
  $('#resultPrivacyCheck').textContent = hasaUsed ? '✓ HASA에는 비식별 근거만 전송' : '✓ HASA 전송 0 B';
  $('#resultPreview').innerHTML = `<dl><div><dt>업무 요청</dt><dd>${escapeHtml(result.request)}</dd></div><div><dt>실행기</dt><dd>${escapeHtml(result.runnerLabel)}</dd></div><div><dt>처리 문서</dt><dd>${documents.length}개</dd></div><div><dt>검색 키워드</dt><dd>${escapeHtml((result.keywords || []).join(', ') || '없음')}</dd></div><div><dt>추출 근거</dt><dd>${evidence.length}건</dd></div></dl>`;
  $('#aiSummary').hidden = !hasaUsed;
  $('#aiSummaryText').textContent = result.ai_summary || '';
  $('#ledgerRows').innerHTML = evidence.length
    ? evidence.map((item) => `<div class="ledger-row"><b>FACT</b><strong>${item.line}</strong><span>${escapeHtml(item.text)}</span><small>${escapeHtml(item.file)}</small></div>`).join('')
    : '<div class="empty-ledger">일치 근거가 없습니다. 요청어를 구체화해 다시 실행하세요.</div>';
}

runButton.addEventListener('click', () => executeRun().catch((error) => {
  console.error('[00ai-harness] run failed', error);
  setState('ready');
  if (runnerMode !== 'browser') RUNNERS[runnerMode].connected = false;
  refreshRunButton();
  showToast(`실행 실패: ${error.message || '연결과 파일 형식을 확인하세요.'}`);
}));

$('#downloadResult').addEventListener('click', () => {
  if (!lastResult) return showToast('먼저 문서 검토를 실행해 주세요.');
  const url = URL.createObjectURL(new Blob([lastResult.markdown || ''], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = lastResult.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

navItems.forEach((item) => item.addEventListener('click', () => {
  const next = item.dataset.nav;
  if (next === 'active' && !lastResult) return showToast('문서를 선택하고 실행해 주세요.');
  if (next === 'verified' && !lastResult) return showToast('아직 생성된 결과가 없습니다.');
  setState(next);
}));

$$('[data-action]').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.action === 'documents') {
    setState('ready');
    documentInput.click();
  } else if (item.dataset.action === 'connection') {
    setState('ready');
    $('#connectionBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (item.dataset.action === 'audit') {
    showToast(lastResult ? `${lastResult.id} · 파일 ${(lastResult.documents || []).length}개 · 근거 ${(lastResult.evidence || []).length}건` : '실행 기록이 없습니다.');
  }
}));

$('#resetButton').addEventListener('click', () => setState('ready'));
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!runButton.disabled) runButton.click();
  }
});

renderFileList();
applyRunner(preferredRunner);
