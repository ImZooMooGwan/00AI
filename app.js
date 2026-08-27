const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 30;
const ALLOWED_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "html", "htm"]);
const STOP_WORDS = new Set(["그리고", "하지만", "관련", "대해서", "대한", "문서", "첨부", "정리", "근거", "함께", "에서", "으로", "에게", "까지", "있는", "없는", "해주세요", "해줘", "이번", "최근"]);

const stateMeta = {
  ready: "00AI HARNESS / LOCAL RUNNER",
  active: "00AI HARNESS / LOCAL EXECUTION",
  verified: "00AI HARNESS / RESULT"
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
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
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
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeText(raw, extension) {
  if (extension === 'json') {
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
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
  scored.sort((a, b) => b.score - a.score || a.line - b.line);
  return scored.slice(0, 10);
}

function renderFileList() {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  $('#fileMetric').textContent = String(files.length);
  $('#fileMetricNote').textContent = files.length ? formatBytes(total) : '문서를 선택하세요';
  $('#fileSummary').textContent = files.length ? `${files.length}개 문서 · ${formatBytes(total)}` : '선택된 문서 없음';
  $('#fileList').innerHTML = files.map((file) => `<span>${escapeHtml(file.name)} <small>${formatBytes(file.size)}</small></span>`).join('');
  runButton.disabled = files.length === 0 || taskInput.value.trim().length < 10;
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

taskInput.addEventListener('input', renderFileList);
$$('[data-example]').forEach((button) => button.addEventListener('click', () => {
  taskInput.value = button.dataset.example;
  renderFileList();
}));

function renderSteps(activeIndex, details) {
  const steps = [
    ['01', 'REQUEST VALIDATE', details[0]],
    ['02', 'LOCAL FILE READ', details[1]],
    ['03', 'CONTENT HASH', details[2]],
    ['04', 'EVIDENCE MATCH', details[3]],
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
    : '- 요청어와 직접 일치하는 근거 문장을 찾지 못했습니다. 검색어를 더 구체적으로 입력해 다시 실행하세요.';
  const fileLines = result.documents.map((doc) => `- ${doc.name} · ${formatBytes(doc.size)} · SHA-256 \`${doc.hash}\``).join('\n');
  return `# 00AI Harness 로컬 문서 검토 결과\n\n- 실행시각: ${result.createdAt}\n- 실행 ID: ${result.id}\n- 처리 방식: 브라우저 로컬 처리\n- 문서 외부 전송: 0 B\n\n## 업무 요청\n\n${result.request}\n\n## 실행 요약\n\n- 처리 문서: ${result.documents.length}개\n- 추출 근거: ${result.evidence.length}건\n- 검색 키워드: ${result.keywords.join(', ') || '없음'}\n\n## 확인된 근거\n\n${evidenceLines}\n\n## 검토 메모\n\n- 위 근거는 요청어와의 문자열 일치 및 수치 포함 여부로 추출했습니다.\n- 법적·정책적 판단과 최종 문안은 담당자가 원문을 재확인해야 합니다.\n- HWPX 작성과 내부 MCP 검색은 아직 연결되지 않았습니다.\n\n## 원본 파일 무결성\n\n${fileLines}\n`;
}

async function executeRun() {
  const request = taskInput.value.trim();
  if (request.length < 10) return showToast('업무 요청을 10자 이상 입력해 주세요.');
  if (!files.length) return showToast('실제 실행할 문서를 먼저 선택해 주세요.');

  const id = `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const started = performance.now();
  const details = [`요청 ${request.length}자 확인`, `${files.length}개 문서 읽기`, 'SHA-256 계산 대기', '요청어 일치 근거 추출 대기', 'Markdown 결과 생성 대기'];
  $('#runLabel').textContent = `HARNESS RUN · ${id}`;
  $('#requestText').textContent = request;
  $('#planOutput').textContent = JSON.stringify({ mode: 'browser_local', files: files.length, egress: '0 B', output: 'markdown', mcp: 'not_connected' }, null, 2);
  $('#evidenceFiles').textContent = '0';
  $('#evidenceMatched').textContent = '0';
  $('#evidenceHashed').textContent = '0';
  renderSteps(0, details);
  setState('active');
  await new Promise((resolve) => setTimeout(resolve, 250));

  const documents = [];
  renderSteps(1, details);
  for (const file of files) {
    const raw = await file.text();
    documents.push({ name: file.name, size: file.size, text: normalizeText(raw, extensionOf(file.name)), hash: '' });
  }
  $('#evidenceFiles').textContent = String(documents.length);

  renderSteps(2, details);
  for (const document of documents) document.hash = await sha256(document.text);
  $('#evidenceHashed').textContent = String(documents.length);

  const keywords = keywordsFrom(request);
  renderSteps(3, details);
  const evidence = documents.flatMap((document) => extractEvidence(document, keywords)).sort((a, b) => b.score - a.score).slice(0, 30);
  $('#evidenceMatched').textContent = String(evidence.length);

  renderSteps(4, details);
  const result = { id, request, keywords, documents, evidence, createdAt: new Date().toLocaleString('ko-KR') };
  result.markdown = buildMarkdown(result);
  result.fileName = `${id}_00AI-Harness-result.md`;
  lastResult = result;
  $('#elapsed').textContent = `${((performance.now() - started) / 1000).toFixed(2)}s`;
  await new Promise((resolve) => setTimeout(resolve, 250));
  renderResult(result);
  setState('verified');
  showToast('실제 로컬 문서 검토가 완료됐습니다.');
}

function renderResult(result) {
  $('#verifiedRunLabel').textContent = `LOCAL RUN RESULT · ${result.id}`;
  $('#resultFiles').textContent = String(result.documents.length);
  $('#resultEvidence').textContent = String(result.evidence.length);
  $('#resultFileName').textContent = result.fileName;
  $('#resultFileMeta').textContent = `${formatBytes(new Blob([result.markdown]).size)} · Markdown`;
  $('#ledgerCount').textContent = `${result.evidence.length} ITEMS`;
  $('#resultPreview').innerHTML = `<dl><div><dt>업무 요청</dt><dd>${escapeHtml(result.request)}</dd></div><div><dt>처리 문서</dt><dd>${result.documents.length}개</dd></div><div><dt>검색 키워드</dt><dd>${escapeHtml(result.keywords.join(', ') || '없음')}</dd></div><div><dt>추출 근거</dt><dd>${result.evidence.length}건</dd></div></dl>`;
  $('#ledgerRows').innerHTML = result.evidence.length ? result.evidence.map((item) => `<div class="ledger-row"><b>FACT</b><strong>${item.line}</strong><span>${escapeHtml(item.text)}</span><small>${escapeHtml(item.file)}</small></div>`).join('') : '<div class="empty-ledger">일치 근거가 없습니다. 요청어를 구체화해 다시 실행하세요.</div>';
}

runButton.addEventListener('click', () => executeRun().catch((error) => {
  console.error('[local-harness] run failed', error);
  setState('ready');
  showToast('문서를 처리하지 못했습니다. 파일 형식과 용량을 확인해 주세요.');
}));

$('#downloadResult').addEventListener('click', () => {
  if (!lastResult) return showToast('먼저 문서 검토를 실행해 주세요.');
  const url = URL.createObjectURL(new Blob([lastResult.markdown], { type: 'text/markdown;charset=utf-8' }));
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
  if (next === 'active' && !lastResult) return showToast('문서를 선택하고 RUN LOCAL HARNESS를 실행해 주세요.');
  if (next === 'verified' && !lastResult) return showToast('아직 생성된 결과가 없습니다.');
  setState(next);
}));

$$('[data-action]').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.action === 'documents') {
    setState('ready');
    documentInput.click();
  } else if (item.dataset.action === 'mcp') {
    showToast('내부 MCP는 아직 연결되지 않았습니다. 현재는 브라우저 로컬 도구만 실행합니다.');
  } else if (item.dataset.action === 'audit') {
    showToast(lastResult ? `${lastResult.id} · 파일 ${lastResult.documents.length}개 · 근거 ${lastResult.evidence.length}건` : '실행 기록이 없습니다.');
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
