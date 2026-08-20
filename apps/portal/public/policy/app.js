const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  mode: "균형",
  running: false,
  score: 92,
  budget: 18,
};

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function setPipeline(stage) {
  $$(".pipeline-node").forEach((node) => {
    const index = Number(node.dataset.stage);
    node.classList.toggle("is-done", index < stage);
    node.classList.toggle("is-active", index === stage);
    node.classList.toggle("is-revealed", index === stage || index < stage);
  });
}

function updateBudget(value) {
  state.budget = Number(value);
  $("#budget-value").textContent = `${state.budget}억원`;
  $("#budget-status").textContent = state.budget <= 20 ? "20억원 이내" : "한도 초과";
  $("#budget-status").style.color = state.budget <= 20 ? "var(--signal)" : "#ff7c70";
}

$$('.mode-button').forEach((button) => {
  button.addEventListener("click", () => {
    $$(".mode-button").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    state.mode = button.dataset.mode;
    $("#command-note").textContent = `${state.mode} 모드 · 공공데이터 128개 신호를 함께 검토합니다.`;
  });
});

$$('.policy-option').forEach((option) => {
  option.addEventListener("click", () => {
    $$(".policy-option").forEach((item) => item.classList.remove("is-recommended"));
    option.classList.add("is-recommended");
    state.score = Number(option.dataset.score);
    $("#fit-score").textContent = state.score;
    showToast(`${option.querySelector("strong").textContent}을(를) 선택했습니다.`);
  });
});

$("#budget-range").addEventListener("input", (event) => updateBudget(event.target.value));

$("#run-simulation").addEventListener("click", () => {
  if (state.running) return;
  state.running = true;
  const button = $("#run-simulation");
  button.classList.add("is-running");
  button.textContent = "분석 진행 중 · 03.8s";
  $("#engine-status").textContent = "HASA · RUNNING";
  setPipeline(0);
  [1, 2, 3].forEach((stage, index) => {
    window.setTimeout(() => setPipeline(stage), 520 * (index + 1));
  });
  window.setTimeout(() => {
    state.running = false;
    button.classList.remove("is-running");
    button.textContent = "정책 시뮬레이션 다시 실행";
    $("#engine-status").textContent = "HASA · 03.8s";
    setPipeline(3);
    showToast("정책 조합과 근거 레이어를 갱신했습니다.");
  }, 1800);
});

$("#copy-result").addEventListener("click", async () => {
  const summary = `00AI 정책 시뮬레이션\n정책 적합도 ${state.score}/100\n예상 연간 사업비 ${state.budget}억원\n분석 모드 ${state.mode}`;
  try {
    await navigator.clipboard.writeText(summary);
    showToast("결과 요약을 클립보드에 복사했습니다.");
  } catch {
    showToast("브라우저가 클립보드를 허용하지 않았습니다.");
  }
});

updateBudget($("#budget-range").value);
