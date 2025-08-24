/**
 * KR-EN Math Quiz
 * Plain vanilla JS (ES modules). No frameworks.
 *
 * Keyboard:
 * - Enter: submit typing / next
 * - 1–4: choose MCQ option
 * - F: flip flashcard
 * - R: retry missed (on results)
 * - M: change mode
 */

/** @typedef {{ ko: string, en: string, hint: string, synonyms?: string[] }} Term */
/** @typedef {{ id: string, name: string, description: string, terms: Term[] }} Level */
/** @typedef {{ levels: Level[] }} DataModel */

const APP_PREFIX = "krEnQuiz:v1";
const SELECTORS = {
  views: {
    levels: byId("view-levels"),
    quiz: byId("view-quiz"),
    results: byId("view-results"),
  },
  levelsGrid: byId("levelsGrid"),
  breadcrumb: byId("breadcrumb"),
  modeSelect: byId("modeSelect"),
  btnExport: byId("btnExport"),
  btnImport: byId("btnImport"),
  fileInput: byId("fileInput"),
  btnReset: byId("btnReset"),
  // Quiz
  statQ: byId("statQ"),
  statScore: byId("statScore"),
  statStreak: byId("statStreak"),
  statTime: byId("statTime"),
  progressBar: byId("progressBar"),
  questionCard: byId("questionCard"),
  questionStem: byId("questionStem"),
  mcqOptions: byId("mcqOptions"),
  typingWrap: byId("typingWrap"),
  typingInput: byId("typingInput"),
  flashWrap: byId("flashWrap"),
  flashCard: byId("flashCard"),
  btnGotIt: byId("btnGotIt"),
  btnAgain: byId("btnAgain"),
  hintArea: byId("hintArea"),
  hintText: byId("hintText"),
  feedback: byId("feedback"),
  btnSkip: byId("btnSkip"),
  btnHint: byId("btnHint"),
  btnReport: byId("btnReport"),
  btnNext: byId("btnNext"),
  btnEnd: byId("btnEnd"),
  // Results
  resAccuracy: byId("resAccuracy"),
  resTime: byId("resTime"),
  resTotal: byId("resTotal"),
  resCorrect: byId("resCorrect"),
  resWrong: byId("resWrong"),
  missedList: byId("missedList"),
  btnRetryMissed: byId("btnRetryMissed"),
  btnBackHome: byId("btnBackHome"),
  // Modal & Toast
  modal: byId("modal"),
  modalTitle: byId("modalTitle"),
  modalBody: byId("modalBody"),
  modalActions: byId("modalActions"),
  modalClose: byId("modalClose"),
  toasts: byId("toasts"),
  srLive: byId("sr-live"),
  // HUD
  xpEl: /** @type {HTMLElement|null} */(document.getElementById("xp")),
  heartsEl: /** @type {HTMLElement|null} */(document.getElementById("hearts")),
  streakEl: /** @type {HTMLElement|null} */(document.getElementById("streak")),
};

const MODE = { MCQ: "mcq", TYPING: "typing", FLASH: "flash" };

/** @type {{ data: DataModel, levelsById: Map<string, Level> }} */
const DATA = { data: { levels: [] }, levelsById: new Map() };

/** @type {{
 *  currentMode: 'mcq'|'typing'|'flash',
 *  currentLevelId: string | null,
 *  queue: Term[],
 *  allTerms: Term[],
 *  index: number,
 *  score: number,
 *  streak: number,
 *  startTime: number,
 *  elapsedTimer: number | null,
 *  allowAnswer: boolean,
 *  lastAnswerCorrect: boolean | null,
 *  missed: Term[],
 *  flashFlipped: boolean,
 *  reportedIssues: { levelId: string, term: Term, note: string, time: number }[],
 *  ended?: boolean,
 * }} */
const STATE = {
  currentMode: MODE.MCQ,
  currentLevelId: null,
  queue: [],
  allTerms: [],
  index: 0,
  score: 0,
  streak: 0,
  startTime: 0,
  elapsedTimer: null,
  allowAnswer: true,
  lastAnswerCorrect: null,
  missed: [],
  flashFlipped: false,
  reportedIssues: [],
  ended: false,
};

/** @type {{
 * lastMode: string,
 * perLevel: Record<string, {
 *   bestAccuracy: number,
 *   totalAttempts: number,
 *   mistakes: Term[],
 *   lastSessionAt: string
 * }>,
 * dataOverrides?: Record<string, Term[]>
 * }} */
let PERSIST = {
  lastMode: MODE.MCQ,
  perLevel: {},
  dataOverrides: {},
};

init();

/** Initialize app: load data/state, setup UI and events */
async function init() {
  await loadData();
  loadState();
  initUI();
  renderLevelSelect();
  SELECTORS.modeSelect.value = PERSIST.lastMode || MODE.MCQ;
  STATE.currentMode = SELECTORS.modeSelect.value;
  initHUD();
}

function initHUD() {
  const xp = Number(localStorage.getItem(`${APP_PREFIX}:xp`) || 0) || 0;
  const hearts = Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5) || 5;
  const streak = Number(localStorage.getItem(`${APP_PREFIX}:streak`) || 0) || 0;
  updateHUD({ xp, hearts, streak });
}

function updateHUD({ xp, hearts, streak }) {
  const xpChip = SELECTORS.xpEl?.closest('.chip');
  const heartsChip = SELECTORS.heartsEl?.closest('.chip');
  const streakChip = SELECTORS.streakEl?.closest('.chip');

  const prevXp = Number(SELECTORS.xpEl?.textContent || 0);
  const prevHearts = Number(SELECTORS.heartsEl?.textContent || 5);
  const prevStreak = Number(SELECTORS.streakEl?.textContent || 0);

  if (SELECTORS.xpEl && typeof xp === 'number') {
    SELECTORS.xpEl.textContent = String(xp);
    try { localStorage.setItem(`${APP_PREFIX}:xp`, String(xp)); } catch {}
    if (xp !== prevXp && xpChip) {
      xpChip.classList.add('tick');
      setTimeout(() => xpChip.classList.remove('tick'), 200);
    }
  }
  if (SELECTORS.heartsEl && typeof hearts === 'number') {
    SELECTORS.heartsEl.textContent = String(hearts);
    try { localStorage.setItem(`${APP_PREFIX}:hearts`, String(hearts)); } catch {}
    if (hearts !== prevHearts && heartsChip) {
      heartsChip.classList.add(hearts < prevHearts ? 'bounce' : 'tick');
      setTimeout(() => {
        heartsChip.classList.remove('bounce');
        heartsChip.classList.remove('tick');
      }, 260);
    }
  }
  if (SELECTORS.streakEl && typeof streak === 'number') {
    SELECTORS.streakEl.textContent = String(streak);
    try { localStorage.setItem(`${APP_PREFIX}:streak`, String(streak)); } catch {}
    if (streak !== prevStreak && streakChip) {
      streakChip.classList.add('tick');
      setTimeout(() => streakChip.classList.remove('tick'), 200);
    }
  }
}

/** Load data from JSON with localStorage overrides and fallback seed if file:// fetch fails. */
async function loadData() {
  try {
    const res = await fetch("data/kr_en_terms.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = /** @type {DataModel} */ (await res.json());
    DATA.data = json;
  } catch (e) {
    // Fallback to embedded seed if fetch fails in file://
    console.warn("Failed to fetch data/kr_en_terms.json; using embedded seed.", e);
    DATA.data = SEED_DATA;
  }

  // Apply overrides
  const overridesRaw = localStorage.getItem(`${APP_PREFIX}:overrides`);
  if (overridesRaw) {
    try {
      const overrides = JSON.parse(overridesRaw);
      PERSIST.dataOverrides = overrides || {};
      for (const lvl of DATA.data.levels) {
        if (overrides[lvl.id]) {
          lvl.terms = overrides[lvl.id];
        }
      }
    } catch {}
  }

  DATA.levelsById.clear();
  for (const lvl of DATA.data.levels) {
    DATA.levelsById.set(lvl.id, lvl);
  }
}

/** Init top-level UI events */
function initUI() {
  SELECTORS.btnReset.addEventListener("click", onResetProgress);
  SELECTORS.modeSelect.addEventListener("change", onModeChange);
  SELECTORS.btnExport.addEventListener("click", () => {
    if (STATE.currentLevelId) exportCSV(STATE.currentLevelId);
  });
  SELECTORS.btnImport.addEventListener("click", () => {
    if (!STATE.currentLevelId) return;
    openImportModal(STATE.currentLevelId);
  });
  SELECTORS.fileInput.addEventListener("change", onFileChosen);

  // Quiz buttons
  SELECTORS.btnSkip.addEventListener("click", () => handleSkip());
  SELECTORS.btnHint.addEventListener("click", () => revealHint());
  SELECTORS.btnReport.addEventListener("click", () => reportIssue());
  SELECTORS.btnNext.addEventListener("click", () => nextQuestion());
  SELECTORS.btnEnd.addEventListener("click", () => endQuiz());
  SELECTORS.btnGotIt.addEventListener("click", () => flashMark(true));
  SELECTORS.btnAgain.addEventListener("click", () => flashMark(false));
  SELECTORS.flashCard.addEventListener("click", flipFlash);
  SELECTORS.flashCard.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      flipFlash();
    }
  });

  // Results buttons
  SELECTORS.btnRetryMissed.addEventListener("click", () => {
    const levelId = STATE.currentLevelId;
    if (!levelId) { showView('levels'); return; }
    const missed = dedupeByKo(STATE.missed || []);
    if (!missed.length) { toast('No missed terms to retry.', 'warn'); return; }
    startQuiz(levelId, STATE.currentMode, missed);
  });
  SELECTORS.btnBackHome.addEventListener("click", () => {
    if (STATE.elapsedTimer) { clearInterval(STATE.elapsedTimer); STATE.elapsedTimer = null; }
    showView('levels');
    SELECTORS.breadcrumb.textContent = '';
    SELECTORS.btnExport.disabled = true;
    SELECTORS.btnImport.disabled = true;
  });

  // Typing submit with Enter
  SELECTORS.typingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTypingSubmit();
    }
  });

  // Modal close
  SELECTORS.modalClose.addEventListener("click", () => openModal(null));

  // Global shortcuts
  window.addEventListener("keydown", onGlobalKeyDown);
}

/** Render the level selection grid */
function renderLevelSelect() {
  showView("levels");
  SELECTORS.breadcrumb.textContent = "";
  SELECTORS.btnExport.disabled = true;
  SELECTORS.btnImport.disabled = true;

  SELECTORS.levelsGrid.innerHTML = "";
  for (const lvl of DATA.data.levels) {
    const card = document.createElement("article");
    card.className = "card level-card";
    card.setAttribute("role", "listitem");

    const title = el("div", "title", lvl.name);
    const desc = el("div", "desc", lvl.description);

    const meta = el("div", "level-meta");
    const termCount = el("span", "", `용어 ${lvl.terms.length}개`);
    const stats = getLevelStats(lvl.id);
    const statsBadge = el("span", "stats-badge", `Best ${Math.round(stats.bestAccuracy * 100)}% • Attempts ${stats.totalAttempts}`);
    meta.append(termCount, statsBadge);

    const actions = el("div", "level-actions");
    const start = button("Start Quiz", "primary", () => startQuiz(lvl.id, STATE.currentMode));
    start.setAttribute("aria-label", `Start quiz for ${lvl.name}`);
    const exportBtn = button("Export CSV", "secondary", () => exportCSV(lvl.id));
    const importBtn = button("Import CSV", "secondary", () => openImportModal(lvl.id));
    actions.append(start, exportBtn, importBtn);

    card.append(title, desc, meta, actions);
    SELECTORS.levelsGrid.append(card);
  }
}

/** Start a quiz for the given level and mode. If a custom terms list is provided, use it. */
function startQuiz(levelId, mode = STATE.currentMode, customTerms = null) {
  STATE.currentMode = mode;
  STATE.currentLevelId = levelId;
  PERSIST.lastMode = mode;
  saveState();

  const level = DATA.levelsById.get(levelId);
  if (!level) return;

  const terms = customTerms ?? level.terms.slice();
  const shuffled = shuffle(terms);

  STATE.queue = shuffled.slice();
  STATE.allTerms = shuffled.slice();
  STATE.index = 0;
  STATE.score = 0;
  STATE.streak = 0;
  STATE.startTime = Date.now();
  STATE.missed = [];
  STATE.lastAnswerCorrect = null;
  STATE.allowAnswer = true;
  STATE.flashFlipped = false;
  STATE.ended = false;

  SELECTORS.feedback.textContent = "";
  SELECTORS.hintArea.hidden = true;
  SELECTORS.hintText.textContent = "";

  // Breadcrumb and header controls
  SELECTORS.breadcrumb.textContent = `${level.name} • ${modeLabel(mode)}`;
  SELECTORS.btnExport.disabled = false;
  SELECTORS.btnImport.disabled = false;

  // View states
  showView("quiz");
  SELECTORS.btnNext.hidden = true;
  SELECTORS.btnEnd.hidden = false;

  if (STATE.elapsedTimer) { clearInterval(STATE.elapsedTimer); }
  STATE.elapsedTimer = setInterval(updateElapsed, 1000);

  updateStatsUI();
  updateProgress();

  // Render first question
  nextQuestion(true);
}

/** Proceed to next question or show results when done */
function nextQuestion(initial = false) {
  if (!initial) {
    STATE.index++;
  }
  if (STATE.index >= STATE.allTerms.length) {
    endQuiz();
    return;
  }

  const term = STATE.allTerms[STATE.index];
  SELECTORS.questionStem.textContent = term.ko;
  SELECTORS.hintArea.hidden = true;
  SELECTORS.hintText.textContent = term.hint || "";
  SELECTORS.feedback.textContent = "";
  SELECTORS.feedback.className = "feedback";
  SELECTORS.btnNext.hidden = true;
  SELECTORS.btnEnd.hidden = false;
  STATE.allowAnswer = true;

  if (STATE.currentMode === MODE.MCQ) {
    SELECTORS.mcqOptions.hidden = false;
    SELECTORS.typingWrap.hidden = true;
    SELECTORS.flashWrap.hidden = true;
    renderMCQ(term);
  } else if (STATE.currentMode === MODE.TYPING) {
    SELECTORS.mcqOptions.hidden = true;
    SELECTORS.typingWrap.hidden = false;
    SELECTORS.flashWrap.hidden = true;
    SELECTORS.typingInput.value = "";
    SELECTORS.typingInput.focus();
  } else {
    // Flashcards
    SELECTORS.mcqOptions.hidden = true;
    SELECTORS.typingWrap.hidden = true;
    SELECTORS.flashWrap.hidden = false;
    STATE.flashFlipped = false;
    SELECTORS.flashCard.classList.remove("flipped");
    SELECTORS.flashCard.setAttribute("aria-pressed", "false");
    SELECTORS.flashCard.querySelector(".flash-front").textContent = term.ko;
    SELECTORS.flashCard.querySelector(".flash-back").textContent = `${term.en}`;
    SELECTORS.btnGotIt.focus();
  }

  updateStatsUI();
  updateProgress();
}

/** Render Multiple Choice options */
function renderMCQ(term) {
  SELECTORS.mcqOptions.innerHTML = "";
  const level = DATA.levelsById.get(STATE.currentLevelId);
  const distractors = pickDistractors(level.terms, term, 3);
  const options = shuffle([term.en, ...distractors.map(d => d.en)]);
  const correctIndex = options.findIndex(o => normalizeAnswer(o) === normalizeAnswer(term.en));

  options.forEach((text, idx) => {
    const btn = button(`${idx + 1}. ${text}`, "option-btn answer-pill", () => {
      handleMCQSelect(idx, correctIndex, term, btn);
    });
    btn.dataset.index = String(idx);
    btn.setAttribute("aria-label", `Option ${idx + 1}: ${text}`);
    SELECTORS.mcqOptions.append(btn);
  });
}

function handleMCQSelect(selectedIdx, correctIdx, term, btnEl) {
  if (!STATE.allowAnswer || STATE.ended) return;
  STATE.allowAnswer = false;
  const optionButtons = [...SELECTORS.mcqOptions.querySelectorAll("button")];
  optionButtons.forEach(b => (b.disabled = true));
  const selectedBtn = btnEl;
  const correctBtn = optionButtons[correctIdx];
  const isCorrect = selectedIdx === correctIdx;
  showFeedback(isCorrect, term);
  if (isCorrect) {
    selectedBtn.classList.add("correct", "answer-correct");
    STATE.score++;
    STATE.streak++;
    const xp = Number(localStorage.getItem(`${APP_PREFIX}:xp`) || 0) + 10;
    const streak = Number(localStorage.getItem(`${APP_PREFIX}:streak`) || 0) + 1;
    updateHUD({ xp, streak });
    SELECTORS.questionCard.classList.add('pop');
    setTimeout(() => SELECTORS.questionCard.classList.remove('pop'), 220);
    triggerConfetti();
  } else {
    selectedBtn.classList.add("incorrect", "answer-wrong");
    correctBtn.classList.add("correct");
    STATE.streak = 0;
    STATE.missed.push(term);
    const hearts = Math.max(0, Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5) - 1);
    updateHUD({ hearts, streak: 0 });
    maybeEndOnHearts();
  }
  if (!STATE.ended) {
    SELECTORS.btnNext.hidden = false;
    SELECTORS.btnNext.focus();
    updateStatsUI();
    updateProgress();
  }
}

function handleTypingSubmit() {
  if (!STATE.allowAnswer) { nextQuestion(); return; }
  if (STATE.ended) return;
  const term = STATE.allTerms[STATE.index];
  const input = SELECTORS.typingInput.value;
  const isCorrect = checkAnswer(input, term);
  showFeedback(isCorrect, term);
  STATE.allowAnswer = false;
  if (isCorrect) {
    STATE.score++;
    STATE.streak++;
    const xp = Number(localStorage.getItem(`${APP_PREFIX}:xp`) || 0) + 10;
    const streak = Number(localStorage.getItem(`${APP_PREFIX}:streak`) || 0) + 1;
    updateHUD({ xp, streak });
    SELECTORS.questionCard.classList.add('pop');
    setTimeout(() => SELECTORS.questionCard.classList.remove('pop'), 220);
    triggerConfetti();
  } else {
    STATE.streak = 0;
    STATE.missed.push(term);
    const hearts = Math.max(0, Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5) - 1);
    updateHUD({ hearts, streak: 0 });
    maybeEndOnHearts();
  }
  if (!STATE.ended) {
    SELECTORS.btnNext.hidden = false;
    SELECTORS.btnNext.focus();
    updateStatsUI();
    updateProgress();
  }
}

/** Reveal hint */
function revealHint() {
  const term = STATE.allTerms[STATE.index];
  if (term?.hint) {
    SELECTORS.hintText.textContent = term.hint;
    SELECTORS.hintArea.hidden = false;
  }
}

/** Skip current question */
function handleSkip() {
  STATE.streak = 0;
  SELECTORS.feedback.textContent = "Skipped.";
  SELECTORS.feedback.className = "feedback";
  nextQuestion();
}

/** Report issue: collect note and store in memory */
function reportIssue() {
  const term = STATE.allTerms[STATE.index];
  const level = DATA.levelsById.get(STATE.currentLevelId);

  const body = document.createElement("div");
  body.innerHTML = `
    <p><strong>Term:</strong> ${term.ko} → ${term.en}</p>
    <label for="reportNote" style="display:block;margin:8px 0 6px;">What’s the issue?</label>
    <textarea id="reportNote" rows="4" style="width:100%;"></textarea>
  `;

  const textarea = body.querySelector("#reportNote");
  openModal({
    title: "Report issue",
    body,
    actions: [
      { label: "Cancel", className: "secondary", onClick: () => openModal(null) },
      {
        label: "Submit",
        className: "primary",
        onClick: () => {
          const note = String(textarea.value || "").trim();
          STATE.reportedIssues.push({ levelId: level.id, term, note, time: Date.now() });
          openModal(null);
          toast("Thanks! Your report was recorded (local only).", "ok");
        },
      },
    ],
  });
}

/** Flip flashcard */
function flipFlash() {
  STATE.flashFlipped = !STATE.flashFlipped;
  SELECTORS.flashCard.classList.toggle("flipped", STATE.flashFlipped);
  SELECTORS.flashCard.setAttribute("aria-pressed", STATE.flashFlipped ? "true" : "false");
}

/** Mark flashcard got-it/again */
function flashMark(gotIt) {
  const term = STATE.allTerms[STATE.index];
  if (gotIt) {
    STATE.score++;
    STATE.streak++;
    const xp = Number(localStorage.getItem(`${APP_PREFIX}:xp`) || 0) + 10;
    const streak = Number(localStorage.getItem(`${APP_PREFIX}:streak`) || 0) + 1;
    updateHUD({ xp, streak });
    SELECTORS.questionCard.classList.add('pop');
    setTimeout(() => SELECTORS.questionCard.classList.remove('pop'), 220);
    triggerConfetti();
  } else {
    STATE.streak = 0;
    STATE.missed.push(term);
    const insertAt = Math.min(STATE.allTerms.length, STATE.index + 3);
    STATE.allTerms.splice(insertAt, 0, term);
    const hearts = Math.max(0, Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5) - 1);
    updateHUD({ hearts, streak: 0 });
    maybeEndOnHearts();
    if (STATE.ended) return;
  }
  nextQuestion();
}

/** End quiz and show results */
function endQuiz(reason) {
  if (STATE.ended) return;
  STATE.ended = true;
  STATE.allowAnswer = false;
  // stop timer
  if (STATE.elapsedTimer) { clearInterval(STATE.elapsedTimer); STATE.elapsedTimer = null; }

  // Compute stats
  const total = STATE.allTerms.length;
  const correct = STATE.score;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  // Update results UI
  SELECTORS.resAccuracy.textContent = `${accuracy}%`;
  SELECTORS.resTotal.textContent = String(total);
  SELECTORS.resCorrect.textContent = String(correct);
  SELECTORS.resWrong.textContent = String(wrong);
  const elapsedSec = Math.round((Date.now() - STATE.startTime) / 1000);
  SELECTORS.resTime.textContent = formatTime(elapsedSec);

  // Fill missed list
  SELECTORS.missedList.innerHTML = "";
  for (const t of STATE.missed) {
    const li = el('li');
    li.textContent = `${t.ko} → ${t.en}`;
    SELECTORS.missedList.append(li);
  }

  // Show special message if out of hearts
  if (reason === 'out-of-hearts') {
    const card = document.querySelector('.results-card');
    if (card) {
      const banner = document.createElement('div');
      banner.className = 'toast bad';
      banner.textContent = '💔 Out of hearts! Try again tomorrow!';
      banner.setAttribute('role', 'status');
      card.prepend(banner);
    }
    SELECTORS.srLive.textContent = 'Out of hearts. Results shown.';
  }

  // Switch view
  showView('results');
}

/** Update progress UI */
function updateProgress() {
  const total = STATE.allTerms.length || 1;
  const current = Math.min(STATE.index + 1, total);
  const pct = Math.round((current / total) * 100);
  SELECTORS.progressBar.style.width = `${pct}%`;
  SELECTORS.progressBar.setAttribute("aria-valuenow", String(pct));
  SELECTORS.statQ.textContent = `${current}/${total}`;
}

/** Update stats numbers and elapsed time */
function updateStatsUI() {
  SELECTORS.statScore.textContent = String(STATE.score);
  SELECTORS.statStreak.textContent = String(STATE.streak);
  updateElapsed();
}

/** Timer display */
function updateElapsed() {
  const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
  SELECTORS.statTime.textContent = formatTime(elapsed);
}

/** Show feedback and hint if wrong */
function showFeedback(correct, term) {
  STATE.lastAnswerCorrect = correct;
  SELECTORS.feedback.textContent = correct ? "Correct!" : `Incorrect. Answer: ${term.en}`;
  SELECTORS.feedback.className = "feedback " + (correct ? "ok" : "bad");
  const hearts = Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5);
  SELECTORS.srLive.textContent = `${SELECTORS.feedback.textContent}. Hearts remaining: ${hearts}.`;
  if (!correct && term.hint) {
    SELECTORS.hintText.textContent = term.hint;
    SELECTORS.hintArea.hidden = false;
  }
}

/** Normalize answer string for comparison */
function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Check answer against term.en and synonyms (case-insensitive, hyphen/space equivalent)
 * @param {string} input
 * @param {Term} term
 */
function checkAnswer(input, term) {
  const n = normalizeAnswer(input);
  const candidates = [term.en, ...(term.synonyms || [])].map(normalizeAnswer);
  return candidates.includes(n);
}

/**
 * Pick N distractor terms (same level), excluding the given term.
 * @param {Term[]} terms
 * @param {Term} correct
 * @param {number} n
 * @returns {Term[]}
 */
function pickDistractors(terms, correct, n = 3) {
  const pool = terms.filter(
    (t) => normalizeAnswer(t.en) !== normalizeAnswer(correct.en) && normalizeAnswer(t.ko) !== normalizeAnswer(correct.ko)
  );
  // Prefer terms with different starting letters to reduce trivial clues
  const shuffled = shuffle(pool);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/** In-place shuffle and return new array */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** mm:ss format */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Save persistent state */
function saveState() {
  try {
    localStorage.setItem(
      `${APP_PREFIX}:state`,
      JSON.stringify({ lastMode: PERSIST.lastMode, perLevel: PERSIST.perLevel })
    );
  } catch {}
}

/** Load persistent state */
function loadState() {
  try {
    const raw = localStorage.getItem(`${APP_PREFIX}:state`);
    if (raw) {
      const parsed = JSON.parse(raw);
      PERSIST.lastMode = parsed.lastMode || MODE.MCQ;
      PERSIST.perLevel = parsed.perLevel || {};
    }
  } catch {}
}

/** Get per-level stats with defaults */
function getLevelStats(levelId) {
  const s = PERSIST.perLevel[levelId] || {
    bestAccuracy: 0,
    totalAttempts: 0,
    mistakes: [],
    lastSessionAt: "",
  };
  return s;
}

/** Change mode handler */
function onModeChange() {
  const newMode = SELECTORS.modeSelect.value;
  STATE.currentMode = newMode;
  PERSIST.lastMode = newMode;
  saveState();

  if (SELECTORS.views.quiz.hidden) return;
  // Restart current quiz with same remaining terms
  const remaining = STATE.allTerms.slice(STATE.index);
  const hasRemaining = remaining.length > 0 ? remaining : STATE.allTerms.slice();
  startQuiz(STATE.currentLevelId, newMode, hasRemaining);
}

/** Export CSV for a level */
function exportCSV(levelId) {
  const level = DATA.levelsById.get(levelId);
  if (!level) return;
  const header = "ko,en,hint,synonyms\n";
  const rows = level.terms.map((t) => {
    const syn = (t.synonyms || []).join("|");
    return csvEscape(t.ko) + "," + csvEscape(t.en) + "," + csvEscape(t.hint || "") + "," + csvEscape(syn);
  });
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${level.id}-terms.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSV exported.", "ok");
}

/** CSV field escaper */
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Open import modal for a level */
function openImportModal(levelId) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p>Import CSV with header: <code>ko,en,hint,synonyms</code>. Synonyms separated by <code>|</code>.</p>
    <div style="display:flex;gap:8px;align-items:center;margin:8px 0;">
      <label><input type="radio" name="impMode" value="append" checked> Append</label>
      <label><input type="radio" name="impMode" value="replace"> Replace</label>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button id="modalChooseFile" class="primary">Choose CSV</button>
      <span id="modalFileName" style="color:var(--muted)">No file chosen</span>
    </div>
    <div id="modalErrors" style="margin-top:10px;color:var(--danger)"></div>
  `;
  let chosenFile = null;
  const chooseBtn = body.querySelector("#modalChooseFile");
  const fileName = body.querySelector("#modalFileName");
  const errorBox = body.querySelector("#modalErrors");
  chooseBtn.addEventListener("click", () => {
    SELECTORS.fileInput.value = "";
    SELECTORS.fileInput.click();
    // File is handled in onFileChosen; we store it temporarily
    SELECTORS.fileInput.onchange = () => {
      chosenFile = SELECTORS.fileInput.files?.[0] || null;
      fileName.textContent = chosenFile ? chosenFile.name : "No file chosen";
      errorBox.textContent = "";
    };
  });

  openModal({
    title: "Import CSV",
    body,
    actions: [
      { label: "Cancel", className: "secondary", onClick: () => openModal(null) },
      {
        label: "Import",
        className: "primary",
        onClick: async () => {
          if (!chosenFile) {
            errorBox.textContent = "Please choose a CSV file.";
            return;
          }
          const mode = /** @type {HTMLInputElement} */ (body.querySelector('input[name="impMode"]:checked')).value;
          const text = await chosenFile.text();
          const { ok, data, errors } = parseCSV(text);
          if (!ok) {
            errorBox.innerHTML = `<ul>${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
            return;
          }
          // Validate & build terms
          const result = buildTermsFromCSV(data);
          if (!result.ok) {
            errorBox.innerHTML = `<ul>${result.errors.map((e) => `<li>${e}</li>`).join("")}</ul>`;
            return;
          }
          applyImport(levelId, result.terms, mode === "replace");
          openModal(null);
          toast(`Imported ${result.terms.length} terms (${mode}).`, "ok");
          // Refresh views if needed
          if (SELECTORS.views.levels.hidden) {
            // Update current quiz level terms only for future quizzes
            SELECTORS.breadcrumb.textContent = `${DATA.levelsById.get(STATE.currentLevelId)?.name} • ${modeLabel(STATE.currentMode)}`;
          } else {
            renderLevelSelect();
          }
        },
      },
    ],
  });
}

/** Handle simple toolbar Import button (when a level is active) */
function onFileChosen() {
  // Handled via modal's file picker; no-op here
}

/** Apply imported terms to data and persist override */
function applyImport(levelId, newTerms, replace) {
  const level = DATA.levelsById.get(levelId);
  if (!level) return;

  let terms = level.terms.slice();
  if (replace) {
    terms = dedupeByKo(newTerms);
  } else {
    const map = new Map(terms.map((t) => [normalizeAnswer(t.ko), t]));
    for (const t of newTerms) {
      map.set(normalizeAnswer(t.ko), t);
    }
    terms = Array.from(map.values());
  }
  level.terms = terms;
  // Persist overrides
  const overrides = PERSIST.dataOverrides || {};
  overrides[levelId] = terms;
  PERSIST.dataOverrides = overrides;
  try {
    localStorage.setItem(`${APP_PREFIX}:overrides`, JSON.stringify(overrides));
  } catch {}
}

/** Build terms from parsed CSV rows */
function buildTermsFromCSV(rows) {
  /** @type {Term[]} */
  const terms = [];
  /** @type {string[]} */
  const errors = [];

  // Header lookup
  const header = rows[0] || {};
  const cols = {
    ko: findHeaderIndex(rows[0], ["ko", "KO", "Ko"]),
    en: findHeaderIndex(rows[0], ["en", "EN", "En"]),
    hint: findHeaderIndex(rows[0], ["hint", "HINT", "Hint"]),
    synonyms: findHeaderIndex(rows[0], ["synonyms", "Synonyms", "SYNONYMS"]),
  };
  if (cols.ko < 0 || cols.en < 0) {
    return { ok: false, errors: ["Header must include at least ko,en."] };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const ko = (row[cols.ko] || "").trim();
    const en = (row[cols.en] || "").trim();
    const hint = cols.hint >= 0 ? String(row[cols.hint] || "").trim() : "";
    const synonymsRaw = cols.synonyms >= 0 ? String(row[cols.synonyms] || "").trim() : "";
    if (!ko || !en) {
      errors.push(`Row ${i + 1}: missing ko or en`);
      continue;
    }
    const synonyms = synonymsRaw ? synonymsRaw.split("|").map((s) => s.trim()).filter(Boolean) : [];
    terms.push({ ko, en, hint, synonyms });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, terms };
}

function findHeaderIndex(headerRow, candidates) {
  if (!Array.isArray(headerRow)) return -1;
  for (let i = 0; i < headerRow.length; i++) {
    if (candidates.includes(String(headerRow[i]).trim())) return i;
  }
  return -1;
}

/** CSV parser supporting quotes and commas */
function parseCSV(text) {
  const rows = [];
  const errors = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        // ignore
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  // Last field
  if (field.length > 0 || inQuotes || row.length > 0) {
    if (inQuotes) {
      errors.push("Unclosed quote at end of file.");
    }
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return { ok: false, errors: ["Empty CSV"] };
  return { ok: true, data: rows, errors };
}

/** Open/close modal */
function openModal(config) {
  if (!config) {
    SELECTORS.modal.hidden = true;
    SELECTORS.modalTitle.textContent = "";
    SELECTORS.modalBody.innerHTML = "";
    SELECTORS.modalActions.innerHTML = "";
    return;
  }
  SELECTORS.modalTitle.textContent = config.title || "";
  SELECTORS.modalBody.innerHTML = "";
  if (config.body instanceof Node) {
    SELECTORS.modalBody.append(config.body);
  } else if (typeof config.body === "string") {
    SELECTORS.modalBody.innerHTML = config.body;
  }
  SELECTORS.modalActions.innerHTML = "";
  for (const act of config.actions || []) {
    const btn = button(act.label, act.className || "secondary", (ev) => act.onClick?.(ev));
    SELECTORS.modalActions.append(btn);
  }
  SELECTORS.modal.hidden = false;
}

/** Toast notification */
function toast(message, type = "ok", timeout = 2500) {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  SELECTORS.toasts.append(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s ease";
    setTimeout(() => t.remove(), 400);
  }, timeout);
}

/** Reset progress (confirm modal) */
function onResetProgress() {
  openModal({
    title: "Reset progress",
    body: `<p>This clears saved stats and overrides for this app only.</p>`,
    actions: [
      { label: "Cancel", className: "secondary", onClick: () => openModal(null) },
      {
        label: "Reset",
        className: "danger",
        onClick: () => {
          // Stop any running quiz timer and prevent further answers
          if (STATE.elapsedTimer) { clearInterval(STATE.elapsedTimer); STATE.elapsedTimer = null; }
          STATE.ended = true; STATE.allowAnswer = false;

          // Collect keys first to avoid index issues during removal
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(APP_PREFIX)) keysToRemove.push(key);
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          // Reset persisted structure and UI controls
          PERSIST = { lastMode: MODE.MCQ, perLevel: {}, dataOverrides: {} };
          if (SELECTORS.modeSelect) SELECTORS.modeSelect.value = MODE.MCQ;

          // Immediately reset HUD (xp/hearts/streak) in UI
          updateHUD({ xp: 0, hearts: 5, streak: 0 });

          // Reload data to discard overrides and return to home
          loadData().then(() => {
            openModal(null);
            toast("Progress reset.", "ok");
            renderLevelSelect();
          });
        },
      },
    ],
  });
}

/** Global keyboard shortcuts */
function onGlobalKeyDown(e) {
  const k = e.key.toLowerCase();
  // Mode cycle
  if (k === "m") {
    e.preventDefault();
    const order = [MODE.MCQ, MODE.TYPING, MODE.FLASH];
    const idx = order.indexOf(STATE.currentMode);
    const next = order[(idx + 1) % order.length];
    SELECTORS.modeSelect.value = next;
    onModeChange();
    return;
  }

  if (!SELECTORS.views.quiz.hidden) {
    if (STATE.currentMode === MODE.MCQ) {
      if (k >= "1" && k <= "4") {
        const idx = Number(k) - 1;
        const btn = SELECTORS.mcqOptions.querySelector(`[data-index="${idx}"]`);
        if (btn) btn.click();
      } else if (k === "enter") {
        // Next
        if (!SELECTORS.btnNext.hidden) SELECTORS.btnNext.click();
      }
    } else if (STATE.currentMode === MODE.TYPING) {
      if (k === "enter") {
        if (STATE.allowAnswer) handleTypingSubmit();
        else SELECTORS.btnNext.click();
      }
    } else if (STATE.currentMode === MODE.FLASH) {
      if (k === "f") {
        flipFlash();
      }
    }
  }

  if (!SELECTORS.views.results.hidden) {
    if (k === "r") {
      SELECTORS.btnRetryMissed.click();
    }
  }
}

/** Helpers */

function maybeEndOnHearts() {
  const hearts = Number(localStorage.getItem(`${APP_PREFIX}:hearts`) || 5);
  if (hearts <= 0 && !STATE.ended) {
    SELECTORS.srLive.textContent = 'Out of hearts. Ending quiz.';
    endQuiz('out-of-hearts');
  }
}

function triggerConfetti() {
  // Grand confetti burst inside the question card
  const host = SELECTORS.questionCard;
  if (!host) return;
  const container = document.createElement('div');
  container.className = 'confetti';
  const colors = ['#22c55e', '#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#eab308'];
  const emojis = ['🎉', '⭐'];
  const total = 32; // bigger burst
  let finished = 0;

  for (let i = 0; i < total; i++) {
    const piece = document.createElement('span');
    piece.className = 'piece';

    // Randomize shape: dot, ribbon, triangle, emoji
    const r = Math.random();
    if (r < 0.2) {
      // Emoji
      piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      piece.style.fontSize = `${14 + Math.floor(Math.random() * 14)}px`;
    } else if (r < 0.55) {
      // Ribbon (rectangle)
      piece.classList.add('ribbon');
      const w = 6 + Math.floor(Math.random() * 6);
      const h = 10 + Math.floor(Math.random() * 12);
      piece.style.width = `${w}px`;
      piece.style.height = `${h}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = `${Math.random() < 0.4 ? 2 : 0}px`;
      piece.style.display = 'inline-block';
    } else if (r < 0.8) {
      // Triangle
      piece.classList.add('tri');
      const size = 8 + Math.floor(Math.random() * 10);
      piece.style.setProperty('--tri', `${size}px`);
      piece.style.borderLeft = `${Math.floor(size/2)}px solid transparent`;
      piece.style.borderRight = `${Math.floor(size/2)}px solid transparent`;
      piece.style.borderBottom = `${size}px solid ${colors[Math.floor(Math.random() * colors.length)]}`;
    } else {
      // Dot (circle)
      piece.classList.add('dot');
      const size = 6 + Math.floor(Math.random() * 8);
      piece.style.width = `${size}px`;
      piece.style.height = `${size}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = '50%';
      piece.style.display = 'inline-block';
    }

    // Motion variables
    const dx = Math.round(Math.random() * 240 - 120); // -120..120px
    const dy = Math.round(100 + Math.random() * 160); // 100..260px
    const rot = Math.round(Math.random() * 900 - 450); // -450..450deg
    const dx2 = Math.round(dx * (0.45 + Math.random() * 0.15));
    const dy2 = Math.round(dy * (0.55 + Math.random() * 0.15));
    const rotMid = Math.round(rot * 0.5);

    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.setProperty('--dx2', `${dx2}px`);
    piece.style.setProperty('--dy2', `${dy2}px`);
    piece.style.setProperty('--rot', `${rot}deg`);
    piece.style.setProperty('--rotMid', `${rotMid}deg`);

    // Random position origin near the top-center of the card
    piece.style.left = `${50 + (Math.random() * 30 - 15)}%`;
    piece.style.top = `${15 + Math.random() * 25}%`;

    // Duration & delay (two-wave burst)
    const dur = 900 + Math.floor(Math.random() * 450); // 900–1350ms
    piece.style.animationDuration = `${dur}ms`;
    if (i >= total / 2) piece.style.animationDelay = `${60 + Math.floor(Math.random() * 120)}ms`;

    piece.addEventListener('animationend', () => {
      finished++;
      piece.remove();
      if (finished >= total) container.remove();
    });

    container.appendChild(piece);
  }

  host.appendChild(container);
}

function showView(name) {
  SELECTORS.views.levels.hidden = name !== "levels";
  SELECTORS.views.quiz.hidden = name !== "quiz";
  SELECTORS.views.results.hidden = name !== "results";
}

function byId(id) {
  return /** @type {HTMLElement} */ (document.getElementById(id));
}
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}
function button(label, className, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  if (className) b.className = className;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
function modeLabel(m) {
  if (m === MODE.MCQ) return "Multiple Choice";
  if (m === MODE.TYPING) return "Typing";
  return "Flashcards";
}
function dedupeByKo(terms) {
  const map = new Map();
  for (const t of terms) map.set(normalizeAnswer(t.ko), t);
  return Array.from(map.values());
}

/* ------------------------
   Embedded seed fallback
-------------------------*/
/** @type {DataModel} */
const SEED_DATA = {
  levels: [
    {
      id: "ms-1-1",
      name: "중학교 1학년 1학기",
      description: "정수·유리수·좌표·통계 기초",
      terms: [
        { ko: "정수", en: "integer", hint: "음수, 0, 양수의 집합", synonyms: [] },
        { ko: "유리수", en: "rational number", hint: "분수로 표현 가능", synonyms: [] },
        { ko: "무리수", en: "irrational number", hint: "분수로 표현 불가", synonyms: [] },
        { ko: "실수", en: "real number", hint: "유리수와 무리수", synonyms: [] },
        { ko: "자연수", en: "natural number", hint: "1,2,3,…", synonyms: [] },
        { ko: "소수(소수점)", en: "decimal", hint: "십진 소수", synonyms: [] },
        { ko: "소수(소수)", en: "prime number", hint: "1과 자기 자신만 약수", synonyms: ["prime"] },
        { ko: "합성수", en: "composite number", hint: "약수가 3개 이상", synonyms: [] },
        { ko: "약수", en: "divisor", hint: "나누어 떨어지게 하는 수", synonyms: ["factor"] },
        { ko: "배수", en: "multiple", hint: "곱으로 만들 수 있는 수", synonyms: [] },
        { ko: "최대공약수", en: "greatest common divisor", hint: "공약수 중 가장 큰 수", synonyms: ["gcd", "greatest common factor", "gcf"] },
        { ko: "최소공배수", en: "least common multiple", hint: "공배수 중 가장 작은 수", synonyms: ["lcm"] },
        { ko: "절댓값", en: "absolute value", hint: "|x|, 원점부터의 거리", synonyms: ["modulus"] },
        { ko: "수직선", en: "number line", hint: "실수의 위치 표현", synonyms: [] },
        { ko: "좌표평면", en: "coordinate plane", hint: "x축, y축으로 이루어진 평면", synonyms: ["cartesian plane"] },
        { ko: "원점", en: "origin", hint: "(0,0)", synonyms: [] },
        { ko: "x축", en: "x-axis", hint: "가로축", synonyms: [] },
        { ko: "y축", en: "y-axis", hint: "세로축", synonyms: [] },
        { ko: "사분면", en: "quadrant", hint: "좌표평면의 네 구역", synonyms: [] },
        { ko: "좌표", en: "coordinate", hint: "(x, y) 순서쌍", synonyms: [] },
        { ko: "순서쌍", en: "ordered pair", hint: "(x, y)", synonyms: [] },
        { ko: "변수", en: "variable", hint: "값이 변하는 문자", synonyms: [] },
        { ko: "식", en: "expression", hint: "수와 문자로 이루어진 것", synonyms: [] },
        { ko: "방정식", en: "equation", hint: "등호가 있는 참/거짓 판단", synonyms: [] },
        { ko: "부등식", en: "inequality", hint: "<, > 포함", synonyms: [] },
        { ko: "평균", en: "mean", hint: "산술평균", synonyms: ["average", "arithmetic mean"] },
        { ko: "중앙값", en: "median", hint: "중간 위치의 값", synonyms: [] },
        { ko: "최빈값", en: "mode", hint: "가장 자주 나타나는 값", synonyms: [] },
        { ko: "범위(통계)", en: "range", hint: "최댓값-최솟값", synonyms: [] },
        { ko: "그래프", en: "graph", hint: "점과 선으로 표현", synonyms: [] },
        { ko: "막대그래프", en: "bar graph", hint: "막대 높이로 비교", synonyms: ["bar chart"] },
        { ko: "선그래프", en: "line graph", hint: "선으로 변화 표현", synonyms: [] },
        { ko: "원그래프", en: "pie chart", hint: "원으로 비율 표현", synonyms: ["circle graph"] },
        { ko: "히스토그램", en: "histogram", hint: "구간별 도수 막대", synonyms: [] },
        { ko: "점도표", en: "dot plot", hint: "점으로 도수 표현", synonyms: [] },
        { ko: "제곱근", en: "square root", hint: "√x", synonyms: [] },
        { ko: "세제곱근", en: "cube root", hint: "∛x", synonyms: [] },
        { ko: "지수", en: "exponent", hint: "a^n에서 n", synonyms: [] },
        { ko: "밑", en: "base", hint: "a^n에서 a", synonyms: [] },
        { ko: "거듭제곱", en: "power", hint: "a^n", synonyms: [] },
        { ko: "역수", en: "reciprocal", hint: "1/x", synonyms: [] },
        { ko: "좌표평면 거리", en: "distance", hint: "두 점 사이 길이", synonyms: ["distance between two points"] },
        { ko: "개수세기", en: "counting", hint: "경우의 수 기초", synonyms: [] },
      ],
    },
    {
      id: "hs-1-1",
      name: "고등학교 1학년 1학기",
      description: "함수·수열·미분 기초",
      terms: [
        { ko: "함수", en: "function", hint: "입력→출력 대응", synonyms: [] },
        { ko: "정의역", en: "domain", hint: "입력 가능한 값의 집합", synonyms: [] },
        { ko: "치역", en: "range", hint: "나오는 값의 집합", synonyms: ["image"] },
        { ko: "역함수", en: "inverse function", hint: "f(x)=y ↔ f^{-1}(y)=x", synonyms: [] },
        { ko: "합성함수", en: "composite function", hint: "(f∘g)(x)=f(g(x))", synonyms: ["composition"] },
        { ko: "일차함수", en: "linear function", hint: "y=mx+b", synonyms: [] },
        { ko: "이차함수", en: "quadratic function", hint: "y=ax^2+bx+c", synonyms: [] },
        { ko: "지수함수", en: "exponential function", hint: "y=a^x (a>0, a≠1)", synonyms: [] },
        { ko: "로그함수", en: "logarithmic function", hint: "y=log_a x", synonyms: ["log function"] },
        { ko: "밑(로그)", en: "base", hint: "log_a x의 a", synonyms: [] },
        { ko: "밑변환", en: "change of base", hint: "log_a b = log_c b / log_c a", synonyms: [] },
        { ko: "극한", en: "limit", hint: "x→a에서의 값", synonyms: [] },
        { ko: "연속", en: "continuity", hint: "끊어짐 없음", synonyms: [] },
        { ko: "미분계수", en: "derivative at a point", hint: "순간 변화율", synonyms: ["instantaneous rate of change"] },
        { ko: "도함수", en: "derivative", hint: "f'(x)", synonyms: [] },
        { ko: "접선", en: "tangent line", hint: "한 점에서 만나는 직선", synonyms: [] },
        { ko: "기울기", en: "slope", hint: "변화율", synonyms: ["gradient"] },
        { ko: "증가함수", en: "increasing function", hint: "x↑ → f(x)↑", synonyms: [] },
        { ko: "감소함수", en: "decreasing function", hint: "x↑ → f(x)↓", synonyms: [] },
        { ko: "극대", en: "local maximum", hint: "주변보다 큰 값", synonyms: ["maximum"] },
        { ko: "극소", en: "local minimum", hint: "주변보다 작은 값", synonyms: ["minimum"] },
        { ko: "임계점", en: "critical point", hint: "f'(x)=0 또는 미분불가", synonyms: [] },
        { ko: "수열", en: "sequence", hint: "규칙 있는 수의 나열", synonyms: [] },
        { ko: "등차수열", en: "arithmetic sequence", hint: "차이가 일정", synonyms: [] },
        { ko: "등비수열", en: "geometric sequence", hint: "비가 일정", synonyms: [] },
        { ko: "귀납적 정의", en: "recursive definition", hint: "앞 항으로 다음 항 정의", synonyms: ["recurrence"] },
        { ko: "합", en: "series", hint: "수열의 합", synonyms: [] },
        { ko: "시그마 표기", en: "sigma notation", hint: "Σ", synonyms: ["summation"] },
        { ko: "팩토리얼", en: "factorial", hint: "n!", synonyms: [] },
        { ko: "순열", en: "permutation", hint: "서로 다른 배열", synonyms: [] },
        { ko: "조합", en: "combination", hint: "순서 없이 선택", synonyms: [] },
        { ko: "이항정리", en: "binomial theorem", hint: "(a+b)^n 전개", synonyms: [] },
        { ko: "절편", en: "intercept", hint: "축과 만나는 점", synonyms: [] },
        { ko: "점근선", en: "asymptote", hint: "가까워지지만 만나지 않음", synonyms: [] },
        { ko: "평행이동", en: "translation", hint: "그래프 이동", synonyms: ["shift"] },
        { ko: "대칭이동", en: "reflection", hint: "축에 대한 대칭", synonyms: [] },
        { ko: "변곡점", en: "inflection point", hint: "오목/볼록 바뀌는 점", synonyms: [] },
        { ko: "증감표", en: "monotonicity table", hint: "증가/감소 구간", synonyms: ["sign chart"] },
        { ko: "함수값", en: "function value", hint: "f(x)", synonyms: ["value of function"] },
      ],
    },
  ],
};