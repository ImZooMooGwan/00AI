const stateMeta = {
  ready: { crumb: "00AI HARNESS  /  COMMAND CENTER" },
  active: { crumb: "00AI HARNESS  /  HARNESS RUN  /  TASK-042" },
  verified: { crumb: "00AI HARNESS  /  SECURITY  /  EVIDENCE" }
};

const steps = [
  ["01", "PLAN VALIDATED", "허용 도구 5개 · 반출 0 B"],
  ["02", "WORKSPACE SEARCH", "관련 파일 18개 발견"],
  ["03", "EVIDENCE EXTRACT", "사실 42건 · 표 7개 연결"],
  ["04", "CROSS VALIDATE", "예산 · 날짜 · 대상 교차검증 중"],
  ["05", "DRAFT RENDER", "HWPX 신규 파일 생성 예정"]
];

const body = document.body;
const views = [...document.querySelectorAll("[data-view]")];
const navItems = [...document.querySelectorAll("[data-nav-state]")];
const stepList = document.querySelector("#stepList");
const toast = document.querySelector("#toast");
const palette = document.querySelector("#commandPalette");
let toastTimer;

function renderSteps(activeIndex = 3) {
  stepList.innerHTML = steps.map((step, index) => {
    const done = index < activeIndex;
    const active = index === activeIndex;
    const queued = index > activeIndex;
    return `<button class="step ${done ? "done" : ""} ${active ? "active" : ""}" data-step-index="${index}" type="button">
      <span class="step-number">${step[0]}</span>
      <span class="step-copy"><strong>${step[1]}</strong><small>${step[2]}</small></span>
      <span class="step-state">${done ? "DONE" : active ? "ACTIVE" : queued ? "QUEUED" : ""}</span>
    </button>`;
  }).join("");
  stepList.querySelectorAll("[data-step-index]").forEach((node) => {
    node.addEventListener("click", () => {
      if (Number(node.dataset.stepIndex) === 4) setState("verified");
      else showToast("현재 단계는 로컬 실행 중입니다.");
    });
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function setState(next) {
  if (!stateMeta[next]) return;
  body.dataset.state = next;
  document.querySelector("#breadcrumb").textContent = stateMeta[next].crumb;
  views.forEach((view) => { view.hidden = view.dataset.view !== next; });
  navItems.forEach((item) => item.classList.toggle("is-selected", item.dataset.navState === next));
  if (next === "active") renderSteps(3);
  if (next === "verified") showToast("결과가 생성됐습니다 · 경계 검증 완료");
}

document.querySelector("#runButton").addEventListener("click", () => {
  setState("active");
  showToast("하네스 실행 시작 · 내부 경계 확인");
});
document.querySelector("#verifyButton").addEventListener("click", () => setState("verified"));
document.querySelector("#openResult").addEventListener("click", () => showToast("데모 모드에서는 결과 파일 생성을 시뮬레이션합니다."));
document.querySelector("#promptBox").addEventListener("click", () => showToast("요청 편집 모드 · 로컬 입력 대기"));

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#promptBox span:last-child").innerHTML = `${button.dataset.example} 요청을 내부 자료 기준으로 작성해줘.`;
    showToast(`${button.dataset.example} 데모 요청을 불러왔습니다.`);
  });
});

navItems.forEach((item) => item.addEventListener("click", () => {
  if (item.dataset.navState) setState(item.dataset.navState);
  else showToast("이 메뉴는 다음 구현 단계에서 연결됩니다.");
}));

function openPalette() { palette.hidden = false; palette.querySelector("[data-command]").focus(); }
function closePalette() { palette.hidden = true; }
document.querySelector("#commandButton").addEventListener("click", openPalette);
document.querySelector("#closePalette").addEventListener("click", closePalette);
palette.addEventListener("click", (event) => { if (event.target === palette) closePalette(); });
palette.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("click", () => { setState(button.dataset.command); closePalette(); }));
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openPalette(); }
  if (event.key === "Escape") closePalette();
  if (event.ctrlKey && event.key === "Enter" && body.dataset.state === "ready") { event.preventDefault(); setState("active"); }
});

renderSteps();

