/* ============================================================
   alpha-web · App logic
   Knowledge web · Lessons with layered hints · Review · Quick Check
   ============================================================ */
(function () {
"use strict";

const A = window.ALPHA;
const SVGNS = "http://www.w3.org/2000/svg";
const STORE_KEY = "alphaweb-v1";

/* ---------- Fog of war ----------
   When true, a topic stays hidden ("???") until its prerequisites are
   completed. When false, the entire web is visible and every topic is
   immediately explorable and testable.
   A future per-user profile can flip this on per learner. */
const FOG_ENABLED = false;

/* ---------- State ---------- */
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* start fresh */ }
  return { xp: 0, topics: {}, intro: false };
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

function tstate(id) {
  if (!state.topics[id]) state.topics[id] = { solved: [] };
  return state.topics[id];
}
const topicById = {};
A.topics.forEach(t => topicById[t.id] = t);
const frontierById = {};
A.frontier.forEach(f => frontierById[f.id] = f);

/* Successor map (playable topics only) */
const ALLNODES = A.topics.concat(A.frontier);

const successors = {};
A.topics.forEach(t => successors[t.id] = []);
A.topics.forEach(t => t.requires.forEach(r => { if (successors[r]) successors[r].push(t.id); }));

/* ---------- Status logic ---------- */
function solvedCount(id) { return (state.topics[id] && state.topics[id].solved || []).length; }
function isSolved(id, i) { return (state.topics[id] && state.topics[id].solved || []).includes(i); }
function isDone(id) {
  const t = topicById[id];
  return t ? solvedCount(id) >= t.exercises.length : false;
}
function isGold(id) {
  return isDone(id) && successors[id].every(isDone);
}
/* mystery → discovered → ready → progress → done → gold */
function status(t) {
  if (isDone(t.id)) return isGold(t.id) ? "gold" : "done";
  if (solvedCount(t.id) > 0) return "progress";
  if (!FOG_ENABLED) return "ready";           // fog lifted: everything explorable & testable
  const reqs = t.requires;
  if (reqs.length === 0 || reqs.every(isDone)) return "ready";
  if (reqs.some(isDone)) return "discovered";
  return "mystery";
}
function frontierStatus(f) {
  if (!FOG_ENABLED) return "frontier-visible";
  return f.requires.every(isDone) ? "frontier-visible" : "mystery";
}

/* ---------- Header ---------- */
function updateHeader() {
  document.getElementById("xp-value").textContent = state.xp;
  document.getElementById("done-value").textContent = A.topics.filter(t => isDone(t.id)).length;
  document.getElementById("total-value").textContent = A.topics.length;
}

/* ============================================================
   KNOWLEDGE WEB (SVG)
   ============================================================ */
const svg = document.getElementById("graph");
let view = { x: 0, y: 0, s: 0.85 };
let world = null;
let focusedArea = null;

function fitHome() {
  const r = svg.getBoundingClientRect();
  view.s = Math.min(1, Math.max(0.55, r.width / 1600));
  view.x = r.width / 2;
  view.y = r.height / 2;
  applyView();
}
function applyView() {
  if (world) world.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.s})`);
}

function el(name, attrs, parent) {
  const e = document.createElementNS(SVGNS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function edgePath(a, b) {
  /* Self-routing: try several bow strengths on both sides and keep
     the curve that stays furthest away from all other bubbles. */
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let best = { cx: mx, cy: my }, bestScore = -1;
  [Math.min(30, len * 0.2), Math.min(90, len * 0.12), Math.min(170, len * 0.17)].forEach(off => {
    [1, -1].forEach(side => {
      const cx = mx - dy / len * off * side, cy = my + dx / len * off * side;
      let clear = 1e9;
      for (let t = 0.07; t <= 0.94; t += 0.058) {
        const u = 1 - t;
        const px = u * u * a.x + 2 * u * t * cx + t * t * b.x;
        const py = u * u * a.y + 2 * u * t * cy + t * t * b.y;
        for (const n of ALLNODES) {
          if (n === a || n === b) continue;
          const d = Math.hypot(n.x - px, n.y - py);
          if (d < clear) clear = d;
        }
      }
      const score = Math.min(clear, 130) - off * 0.05; /* prefer gentle bows */
      if (score > bestScore) { bestScore = score; best = { cx, cy }; }
    });
  });
  return `M ${a.x} ${a.y} Q ${best.cx} ${best.cy} ${b.x} ${b.y}`;
}

function renderGraph() {
  svg.innerHTML = "";
  world = el("g", {}, svg);

  /* Edges */
  /* Grade rings: the centre (α) is the beginning, each ring one grade higher */
  const ringGroup = el("g", {}, world);
  const byGrade = {};
  A.topics.forEach(t => {
    const d = Math.hypot(t.x, t.y);
    if (d < 50) return;
    (byGrade[t.klasse] = byGrade[t.klasse] || []).push(d);
  });
  Object.keys(byGrade).sort((a, b) => a - b).forEach(g => {
    const rs = byGrade[g];
    const r = rs.reduce((s, v) => s + v, 0) / rs.length;
    el("circle", { r, fill: "none", stroke: "#243158", "stroke-width": 1.5, "stroke-dasharray": "3 14" }, ringGroup);
    el("text", { y: -r + 22, "text-anchor": "middle", fill: "#42528a", "font-size": "16", "font-weight": "700", "letter-spacing": "3" }, ringGroup).textContent = "GRADE " + g;
  });
  el("circle", { r: 3080, fill: "none", stroke: "#1d294f", "stroke-width": 1.5, "stroke-dasharray": "2 18" }, ringGroup);
  el("text", { y: -3058, "text-anchor": "middle", fill: "#374675", "font-size": "16", "font-weight": "700", "letter-spacing": "3" }, ringGroup).textContent = "RESEARCH FRONTIER · THE WEB NEVER ENDS";

  /* Subject territory labels (faint, behind the web) */
  var _labelGroup = el("g", {}, world);
  var _byArea = {};
  A.topics.forEach(function (t) { if (Math.hypot(t.x, t.y) < 50) return; (_byArea[t.area] = _byArea[t.area] || []).push(t); });
  Object.keys(_byArea).forEach(function (area) {
    var ts = _byArea[area], cx = 0, cy = 0;
    ts.forEach(function (t) { cx += t.x; cy += t.y; });
    cx = cx / ts.length; cy = cy / ts.length;
    var _sp = 0; ts.forEach(function (t) { _sp += Math.hypot(t.x - cx, t.y - cy); }); _sp = _sp / ts.length;
    var _fs = Math.max(46, Math.min(122, Math.round(_sp * 0.15)));
    var tx = el("text", { x: Math.round(cx), y: Math.round(cy), "text-anchor": "middle", fill: A.areas[area].color, opacity: 0.14, "font-size": _fs, "font-weight": 800, "letter-spacing": 3, class: "subj-territory" }, _labelGroup);
    tx.textContent = A.areas[area].name.toUpperCase();
  });

  const edges = el("g", {}, world);
  const allNodes = A.topics.concat(A.frontier);
  const nodeById = id => topicById[id] || frontierById[id];
  allNodes.forEach(t => {
    t.requires.forEach(r => {
      const from = nodeById(r); if (!from) return;
      const isFrontier = !!frontierById[t.id];
      const st = isFrontier ? frontierStatus(t) : status(t);
      let cls = "edge";
      if (st === "mystery") cls += " edge-hidden";
      else if (!isFrontier && isGold(r) && isGold(t.id)) cls += " edge-gold";
      else if (isDone(r)) cls += " edge-done";
      el("path", { d: edgePath(from, t), class: cls }, edges);
    });
  });

  /* Topic bubbles */
  A.topics.forEach(t => drawNode(t, status(t), false));
  A.frontier.forEach(f => drawNode(f, frontierStatus(f), true));
  applyView();
}

function drawNode(t, st, isFrontier) {
  const color = A.areas[t.area].color;
  const mystery = st === "mystery";
  const R = mystery ? 22 : 34;
  const g = el("g", { class: `node ${st}${isFrontier ? " frontier" : ""}`, "data-id": t.id, "data-area": t.area, transform: `translate(${t.x},${t.y})` }, world);

  /* Pulsing halo for ready topics */
  if (st === "ready" && FOG_ENABLED) el("circle", { r: R + 12, fill: "none", stroke: color, "stroke-width": 3, class: "halo", opacity: 0.35 }, g);

  /* Progress ring */
  if (st === "progress") {
    const pct = Math.round(100 * solvedCount(t.id) / t.exercises.length);
    el("circle", { r: R + 7, fill: "none", stroke: "#2a3663", "stroke-width": 5 }, g);
    el("circle", {
      r: R + 7, fill: "none", stroke: color, "stroke-width": 5, pathLength: 100,
      "stroke-dasharray": `${pct} ${100 - pct}`, "stroke-linecap": "round",
      transform: "rotate(-90)"
    }, g);
  }

  /* Core */
  let fill = "#252f58", stroke = "#39466f";
  if (st === "ready") { fill = "#2b3763"; stroke = color; }
  if (st === "progress") { fill = "#2b3763"; stroke = color; }
  if (st === "done") { fill = color; stroke = color; }
  if (st === "gold") { fill = "var(--gold)"; stroke = "var(--gold-deep)"; }
  if (st === "frontier-visible") { fill = "rgba(34,211,238,.07)"; stroke = color; }
  el("circle", { r: R, fill, stroke, "stroke-width": 3, class: "core" }, g);

  /* Symbol in the core */
  if (st === "done") el("text", { class: "check", y: 6 }, g).textContent = "✓";
  if (st === "gold") el("text", { class: "check", y: 7, "font-size": "18" }, g).textContent = "★";
  if (mystery) el("text", { y: 6, "text-anchor": "middle", fill: "#5b689a", "font-size": "15", "font-weight": "800" }, g).textContent = "?";
  if (st === "frontier-visible") el("text", { y: 6, "text-anchor": "middle", fill: color, "font-size": "16" }, g).textContent = "🔭";
  if (t.id === "zahlen1" && !isDone("zahlen1")) el("text", { y: 7, "text-anchor": "middle", fill: "#ffd166", "font-size": "20", "font-weight": "800" }, g).textContent = "α";

  /* Label */
  const label = mystery ? "???" : t.title;
  const words = wrapLabel(label, 16);
  words.forEach((line, i) => {
    el("text", { class: "nlabel", y: R + 18 + i * 15 }, g).textContent = line;
  });
  if (!mystery) {
    const sub = isFrontier ? "Research frontier" : `Grade ${t.klasse} · ${A.areas[t.area].name}`;
    el("text", { class: "nsub", y: R + 18 + words.length * 15 }, g).textContent = sub;
  }

  g.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (dragDist > 6) return;
    showPanel(t.id);
  });
}

function wrapLabel(text, max) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/* Pan & zoom.
   Important: NO pointer capture here – capturing retargets the
   browser's click events to the <svg> itself and the bubbles would
   never receive their click. Move/up listeners live on window instead. */
let dragging = false, dragDist = 0, last = null;
svg.addEventListener("pointerdown", e => {
  dragging = true; dragDist = 0; last = { x: e.clientX, y: e.clientY };
  svg.classList.add("dragging");
});
window.addEventListener("pointermove", e => {
  if (!dragging) return;
  const dx = e.clientX - last.x, dy = e.clientY - last.y;
  dragDist += Math.abs(dx) + Math.abs(dy);
  view.x += dx; view.y += dy;
  last = { x: e.clientX, y: e.clientY };
  applyView();
});
window.addEventListener("pointerup", () => { dragging = false; svg.classList.remove("dragging"); });
svg.addEventListener("click", e => {
  /* click on empty space closes the panel */
  if (dragDist <= 6 && (e.target === svg || e.target === world)) hidePanel();
});
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(e.clientX, e.clientY, f);
}, { passive: false });
function zoomAt(cx, cy, f) {
  const ns = Math.min(2.5, Math.max(0.08, view.s * f));
  const r = svg.getBoundingClientRect();
  const px = cx - r.left, py = cy - r.top;
  view.x = px - (px - view.x) * (ns / view.s);
  view.y = py - (py - view.y) * (ns / view.s);
  view.s = ns;
  applyView();
}
document.getElementById("zoom-in").onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2 + r.left, r.height / 2 + r.top, 1.25); };
document.getElementById("zoom-out").onclick = () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2 + r.left, r.height / 2 + r.top, 0.8); };
document.getElementById("zoom-home").onclick = fitHome;
window.addEventListener("resize", applyView);

/* ============================================================
   TOPIC PANEL
   ============================================================ */
const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
document.getElementById("panel-close").onclick = hidePanel;
function hidePanel() { panel.classList.add("hidden"); }

function statusText(st) {
  return {
    mystery: "Unknown territory",
    discovered: "Discovered – not ready yet",
    ready: "Ready to explore!",
    progress: "In progress",
    done: "Completed ✓",
    gold: "GOLDEN ★ – mastered along with everything built on it",
    "frontier-visible": "Research frontier – the web keeps growing here"
  }[st] || "";
}

function showPanel(id) {
  const t = topicById[id] || frontierById[id];
  const isFrontier = !!frontierById[id];
  const st = isFrontier ? frontierStatus(t) : status(t);
  const color = A.areas[t.area].color;
  let html = "";

  if (st === "mystery") {
    html = `<div class="panel-kicker" style="color:${color}">???</div>
      <h2>Unknown territory</h2>
      <p class="panel-desc">This knowledge is still hidden. Explore the regions nearby first – then the fog will lift.</p>`;
  } else if (isFrontier) {
    html = `<div class="panel-kicker" style="color:${color}">${A.areas[t.area].name}</div>
      <h2>${t.title}</h2>
      <div class="panel-teaser">${t.teaser}</div>
      <p class="panel-desc">This is where the map ends – for now! alpha-web has a beginning but no end: the web can keep growing in this direction.</p>`;
  } else {
    const sc = solvedCount(id), total = t.exercises.length;
    const pct = Math.round(100 * sc / total);
    html = `<div class="panel-kicker" style="color:${color}">${A.areas[t.area].name} · Grade ${t.klasse}</div>
      <h2>${t.title}</h2>
      <div class="panel-teaser">${t.teaser}</div>
      <p class="panel-desc">${t.desc}</p>
      <p class="panel-status"><b style="color:${st === "gold" ? "var(--gold)" : color}">${statusText(st)}</b></p>`;

    if (t.requires.length) {
      html += `<p class="panel-status">Builds on:</p>`;
      t.requires.forEach(r => {
        const rt = topicById[r];
        const ok = isDone(r);
        html += `<div class="panel-req">${ok ? '<span class="ok">✓</span>' : '<span class="missing">○</span>'} ${rt.title}</div>`;
      });
    }
    if (st !== "discovered") {
      html += `<div class="progressbar"><div style="width:${pct}%; background:${color}"></div></div>
        <p class="panel-status">${sc} / ${total} discoveries</p>`;
    }

    if (st === "ready") html += `<button class="btn btn-primary btn-block" id="panel-go">🔍 Explore</button>`;
    else if (st === "progress") html += `<button class="btn btn-primary btn-block" id="panel-go">Keep exploring (${sc}/${total})</button>`;
    else if (st === "done" || st === "gold") html += `<button class="btn btn-ghost btn-block" id="panel-go">↻ Practise again</button>`;
    else html += `<p class="panel-desc">Finish the missing foundations first – then you can continue your research here.</p>`;
  }

  panelBody.innerHTML = html;
  panel.classList.remove("hidden");
  const go = document.getElementById("panel-go");
  if (go) go.onclick = () => { hidePanel(); startLearn(id); };
}

/* ============================================================
   LESSON (learn, review, quick check)
   ============================================================ */
const lessonEl = document.getElementById("lesson");
const qText = document.getElementById("q-text");
const qAnswers = document.getElementById("q-answers");
const hintArea = document.getElementById("hint-area");
const feedback = document.getElementById("feedback");
const btnHint = document.getElementById("btn-hint");
const btnSubmit = document.getElementById("btn-submit");
const btnNext = document.getElementById("btn-next");
const dotsEl = document.getElementById("lesson-dots");
const lessonTitle = document.getElementById("lesson-title");

let session = null;

const praise = ["Strong! 💪", "Exactly! ✨", "You saw through it! 🔍", "Correct! 🎯", "Nicely solved! 🧠", "Discovery made! 🚀"];
const retry = ["Almost! Think again – or grab a hint.", "Not quite. A hint might help!", "Close. Try once more!", "Not yet – but wrong turns are part of research!"];

function startLearn(topicId) {
  const t = topicById[topicId];
  const queue = [];
  const repeat = isDone(topicId);
  t.exercises.forEach((ex, i) => { if (repeat || !isSolved(topicId, i)) queue.push({ topicId, exIndex: i }); });
  if (!queue.length) return;
  session = { mode: repeat ? "repeat" : "learn", queue, pos: 0, correctCount: 0 };
  lessonTitle.textContent = t.title;
  openLesson();
}

function startReview() {
  const pool = [];
  A.topics.forEach(t => {
    if (focusedArea && t.area !== focusedArea) return;
    const ts = state.topics[t.id];
    if (!ts) return;
    (ts.solved || []).forEach(i => pool.push({ topicId: t.id, exIndex: i }));
  });
  if (!pool.length) {
    showModal(`<h2>Nothing to review yet</h2><p>Explore your first topic – then you can refresh your knowledge here with random samples.</p>`,
      [{ label: "Got it", primary: true }]);
    return;
  }
  shuffle(pool);
  session = { mode: "review", queue: pool.slice(0, 10), pos: 0, correctCount: 0 };
  lessonTitle.textContent = "Review · random sample" + (focusedArea ? " · " + A.areas[focusedArea].name : "");
  openLesson();
}

function startCheck() {
  const ready = A.topics.filter(t => !isDone(t.id) && (!focusedArea || t.area === focusedArea) && (!FOG_ENABLED || t.requires.length === 0 || t.requires.every(isDone)));
  if (!ready.length) {
    showModal(`<h2>Nothing to check</h2><p>${focusedArea ? "Every " + A.areas[focusedArea].name + " topic is already completed" : "Every reachable topic is already completed"} – onwards through the web!</p>`, [{ label: "OK", primary: true }]);
    return;
  }
  session = { mode: "check", queue: ready.map(t => ({ topicId: t.id, exIndex: rand(t.exercises.length) })), pos: 0, correctCount: 0, checkPassed: [], checkFailed: new Set() };
  lessonTitle.textContent = "Quick Check · show what you know" + (focusedArea ? " · " + A.areas[focusedArea].name : "");
  openLesson();
}

function openLesson() {
  lessonEl.classList.remove("hidden");
  renderQuestion();
}
function closeLesson() {
  lessonEl.classList.add("hidden");
  session = null;
  refresh();
}
document.getElementById("lesson-quit").onclick = () => {
  if (session && session.mode === "check") finishCheck(true);
  else closeLesson();
};

function currentEx() {
  const item = session.queue[session.pos];
  return { item, t: topicById[item.topicId], ex: topicById[item.topicId].exercises[item.exIndex] };
}

function renderDots() {
  dotsEl.innerHTML = "";
  const n = session.queue.length;
  const show = Math.min(n, 14);
  for (let i = 0; i < show; i++) {
    const d = document.createElement("span");
    d.className = "dot" + (i < session.pos ? " done" : i === session.pos ? " now" : "");
    dotsEl.appendChild(d);
  }
  if (n > show) {
    const more = document.createElement("span");
    more.style.cssText = "color:var(--muted);font-size:11px;align-self:center;";
    more.textContent = `+${n - show}`;
    dotsEl.appendChild(more);
  }
}

function renderQuestion() {
  const { t, ex } = currentEx();
  session.hintIdx = 0;
  session.answered = false;
  if (session.mode === "check" || session.mode === "review") lessonTitle.textContent = (session.mode === "check" ? "Quick Check · " : "Review · ") + t.title;
  renderDots();
  hintArea.innerHTML = "";
  feedback.className = "hidden";
  feedback.innerHTML = "";
  btnNext.classList.add("hidden");
  btnSubmit.classList.remove("hidden");
  btnSubmit.disabled = true;
  btnHint.textContent = "💡 Show a hint";
  btnHint.style.boxShadow = "";
  btnHint.disabled = !ex.hints || !ex.hints.length;

  qText.innerHTML = ex.q;
  qAnswers.innerHTML = "";

  if (ex.type === "choice") {
    const order = ex.choices.map((_, i) => i);
    shuffle(order);
    session.choiceMap = order;
    session.selected = null;
    order.forEach((orig) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = ex.choices[orig];
      b.dataset.orig = orig;
      b.onclick = () => {
        if (session.answered) return;
        qAnswers.querySelectorAll(".choice").forEach(c => c.classList.remove("sel"));
        b.classList.add("sel");
        session.selected = orig;
        btnSubmit.disabled = false;
      };
      qAnswers.appendChild(b);
    });
  } else {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;";
    const inp = document.createElement("input");
    inp.id = "num-input";
    inp.autocomplete = "off";
    inp.placeholder = ex.type === "number" ? "Your number …" : "Your answer …";
    inp.oninput = () => { btnSubmit.disabled = inp.value.trim() === ""; };
    inp.onkeydown = e => {
      if (e.key === "Enter") {
        if (!btnNext.classList.contains("hidden")) btnNext.click();
        else if (!btnSubmit.disabled && !session.answered) submit();
      }
    };
    wrap.appendChild(inp);
    if (ex.unit) {
      const u = document.createElement("span");
      u.className = "unit-suffix"; u.textContent = ex.unit;
      wrap.appendChild(u);
    }
    qAnswers.appendChild(wrap);
    setTimeout(() => inp.focus(), 60);
  }
}

btnHint.onclick = () => {
  const { ex } = currentEx();
  if (!ex.hints || session.hintIdx >= ex.hints.length) return;
  const h = document.createElement("div");
  h.className = "hint";
  h.innerHTML = `<b>Hint ${session.hintIdx + 1}:</b> ${ex.hints[session.hintIdx]}`;
  hintArea.appendChild(h);
  session.hintIdx++;
  if (session.hintIdx >= ex.hints.length) {
    btnHint.disabled = true;
    btnHint.textContent = "All hints shown";
  } else {
    btnHint.textContent = `💡 One more hint (${ex.hints.length - session.hintIdx})`;
  }
};

function normNum(s) {
  return parseFloat(String(s).trim().replace(/\s/g, "").replace(",", "."));
}
function normText(s) {
  return String(s).toLowerCase().replace(/\s/g, "");
}
function checkAnswer(ex) {
  if (ex.type === "choice") return session.selected === ex.answer;
  const inp = document.getElementById("num-input");
  if (!inp) return false;
  if (ex.type === "number") {
    const v = normNum(inp.value);
    if (isNaN(v)) return false;
    return Math.abs(v - ex.answer) <= (ex.tol != null ? ex.tol : 0.001);
  }
  const val = normText(inp.value);
  const ok = [ex.answer].concat(ex.alt || []).map(normText);
  return ok.includes(val);
}

btnSubmit.onclick = submit;
function submit() {
  if (!session || session.answered) return;
  const { item, t, ex } = currentEx();
  const correct = checkAnswer(ex);

  if (!correct) {
    /* Wrong: don't reveal – let them think, offer hints */
    feedback.className = "bad";
    feedback.innerHTML = `<div class="fb-head">${retry[rand(retry.length)]}</div>`;
    document.getElementById("lesson-card").classList.remove("shake");
    void document.getElementById("lesson-card").offsetWidth;
    document.getElementById("lesson-card").classList.add("shake");
    if (ex.hints && session.hintIdx < ex.hints.length) btnHint.style.boxShadow = "0 0 14px rgba(255,209,102,.8)";
    if (ex.type === "choice" && session.selected != null) {
      qAnswers.querySelectorAll(".choice").forEach(c => {
        if (+c.dataset.orig === session.selected) { c.classList.add("wrong"); c.classList.remove("sel"); }
      });
      session.selected = null;
      btnSubmit.disabled = true;
    }
    if (session.mode === "check") {
      /* In the Quick Check the first attempt counts */
      session.checkFailed.add(item.topicId);
      session.answered = true;
      feedback.innerHTML = `<div class="fb-head">Not sure yet – no problem!</div>
        <div>"${t.title}" stays open for you to explore. That's exactly what the web is for.</div>`;
      btnSubmit.classList.add("hidden");
      btnNext.classList.remove("hidden");
      btnNext.focus();
    }
    return;
  }

  /* Correct! */
  session.answered = true;
  session.correctCount++;
  if (ex.type === "choice") {
    qAnswers.querySelectorAll(".choice").forEach(c => {
      if (+c.dataset.orig === ex.answer) c.classList.add("right");
    });
  }
  let gained = 0;
  if (session.mode === "learn" && !isSolved(item.topicId, item.exIndex)) {
    tstate(item.topicId).solved.push(item.exIndex);
    gained = 10;
  } else if (session.mode === "review" || session.mode === "repeat") {
    gained = 5;
  } else if (session.mode === "check") {
    session.checkPassed.push(item.topicId);
    gained = 5;
  }
  state.xp += gained;
  save(); updateHeader();

  feedback.className = "good";
  feedback.innerHTML = `<div class="fb-head">${praise[rand(praise.length)]} <span style="float:right;color:var(--gold)">+${gained} XP</span></div>
    ${ex.why ? `<div class="why">${ex.why}</div>` : ""}`;
  btnSubmit.classList.add("hidden");
  btnNext.classList.remove("hidden");
  btnNext.focus();
}

btnNext.onclick = () => {
  if (!session) return;
  session.pos++;
  if (session.mode === "check") {
    /* unlock passed topics immediately so successors join the queue */
    applyCheckPasses();
    extendCheckQueue();
  }
  if (session.pos >= session.queue.length) return finishSession();
  renderQuestion();
};

/* ---- Quick-Check mechanics ---- */
function applyCheckPasses() {
  session.checkPassed.forEach(id => {
    const t = topicById[id];
    const ts = tstate(id);
    ts.solved = t.exercises.map((_, i) => i);
    ts.viaCheck = true;
  });
  session.checkPassed = [];
  save();
}
function extendCheckQueue() {
  const queued = new Set(session.queue.map(q => q.topicId));
  A.topics.forEach(t => {
    if (isDone(t.id) || queued.has(t.id) || session.checkFailed.has(t.id)) return;
    const ok = t.requires.length === 0 || t.requires.every(r => isDone(r));
    if (ok && !t.requires.some(r => session.checkFailed.has(r))) {
      session.queue.push({ topicId: t.id, exIndex: rand(t.exercises.length) });
    }
  });
}
function finishCheck(aborted) {
  applyCheckPasses();
  const passed = A.topics.filter(t => state.topics[t.id] && state.topics[t.id].viaCheck && isDone(t.id)).length;
  const doneNow = A.topics.filter(t => isDone(t.id)).length;
  lessonEl.classList.add("hidden");
  session = null;
  refresh();
  showModal(`<div class="big">⚡</div><h2>Quick Check ${aborted ? "ended" : "finished"}!</h2>
    <p><b>${doneNow}</b> topics are now marked as explored.</p>
    <p>Everything else is waiting in the web – pick whatever excites you most!</p>`,
    [{ label: "To the knowledge web", primary: true }]);
  if (passed > 0) confetti();
}

/* ---- Finish a session ---- */
function finishSession() {
  const mode = session.mode;
  if (mode === "check") return finishCheck(false);

  if (mode === "review" || mode === "repeat") {
    const n = session.queue.length, c = session.correctCount;
    lessonEl.classList.add("hidden"); session = null; refresh();
    showModal(`<div class="big">↻</div><h2>Review done!</h2>
      <p><b>${c} of ${n}</b> correct – knowledge stays fresh when you use it.</p>`,
      [{ label: "Continue", primary: true }]);
    return;
  }

  /* Learn mode: topic finished? */
  const topicId = session.queue[0].topicId;
  const t = topicById[topicId];
  lessonEl.classList.add("hidden"); session = null;

  if (isDone(topicId)) {
    state.xp += 30; save();
    const newReady = successors[topicId]
      .map(id => topicById[id])
      .filter(x => !isDone(x.id) && x.requires.every(isDone));
    const frontierNew = A.frontier.filter(f => f.requires.every(isDone) && f.requires.includes(topicId));

    let html = `<div class="big">🎉</div><h2>"${t.title}" explored!</h2>
      <p>+30 bonus XP · This region now glows ${isGold(topicId) ? "<b style='color:var(--gold)'>golden ★</b>" : "in colour"} on your map.</p>`;
    if (isGold(topicId)) html += `<p style="color:var(--gold)">★ GOLDEN: You have mastered this knowledge!</p>`;

    if (newReady.length) {
      html += `<p><b>New regions discovered – where to next?</b></p><div class="nextlist">`;
      newReady.forEach(x => {
        html += `<button class="next-topic" data-goto="${x.id}">
          <span class="ndot" style="background:${A.areas[x.area].color}"></span>
          <span>${x.title}<small>${x.teaser}</small></span></button>`;
      });
      html += `</div>`;
    } else {
      html += `<p>Look at the map – somewhere a new region is always waiting.</p>`;
    }
    if (frontierNew.length) {
      html += `<p style="color:var(--muted);font-size:13.5px">🔭 Now visible at the research frontier: ${frontierNew.map(f => f.title).join(", ")}</p>`;
    }
    refresh();
    showModal(html, [{ label: "To the knowledge web", primary: false }]);
    document.querySelectorAll("[data-goto]").forEach(b => {
      b.onclick = () => { hideModal(); showPanel(b.dataset.goto); };
    });
    confetti();
  } else {
    refresh();
  }
}

/* ============================================================
   MODAL & CONFETTI
   ============================================================ */
const modal = document.getElementById("modal");
const modalCard = document.getElementById("modal-card");
function showModal(html, buttons) {
  modalCard.innerHTML = html;
  (buttons || []).forEach(b => {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.primary ? "btn-primary" : "btn-ghost");
    btn.style.margin = "8px 6px 0";
    btn.textContent = b.label;
    btn.onclick = () => { hideModal(); if (b.action) b.action(); };
    modalCard.appendChild(btn);
  });
  modal.classList.remove("hidden");
}
function hideModal() { modal.classList.add("hidden"); }
modal.addEventListener("click", e => { if (e.target === modal) hideModal(); });

const confettiCanvas = document.getElementById("confetti");
function confetti() {
  const ctx = confettiCanvas.getContext("2d");
  confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight;
  const colors = ["#ffd166", "#4da3ff", "#3fd68f", "#b07cff", "#ff6b81", "#ffa94d"];
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.4,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    r: 3 + Math.random() * 5, c: colors[rand(colors.length)], a: Math.random() * Math.PI
  }));
  const t0 = performance.now();
  (function tick(now) {
    const dt = (now - t0) / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.a += 0.1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    });
    if (dt < 2.8) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ============================================================
   HELP / LEGEND / RESET
   ============================================================ */
const legend = document.getElementById("legend");
document.getElementById("btn-help").onclick = () => legend.classList.toggle("hidden");
document.getElementById("legend-close").onclick = () => legend.classList.add("hidden");

(function addReset() {
  const p = document.createElement("p");
  p.className = "leg-note";
  p.innerHTML = `<a href="#" id="reset-link" style="color:var(--bad)">Reset all progress</a>`;
  legend.appendChild(p);
  legend.addEventListener("click", e => {
    if (e.target.id === "reset-link") {
      e.preventDefault();
      showModal(`<h2>Really reset everything?</h2><p>All of your research progress will be lost.</p>`,
        [{ label: "Cancel", primary: true },
         { label: "Yes, start over", action: () => { state = { xp: 0, topics: {}, intro: true }; save(); refresh(); fitHome(); } }]);
    }
  });
})();

document.getElementById("btn-review").onclick = startReview;
document.getElementById("btn-check").onclick = () => {
  showModal(`<div class="big">⚡</div><h2>Quick Check${focusedArea ? " · " + A.areas[focusedArea].name : ""}</h2>
    <p>Already know things? Prove it! You get <b>one sample question</b> from every ${focusedArea ? A.areas[focusedArea].name : "reachable"} topic (first attempt counts).</p>
    <p>Correct → the topic counts as explored and opens new regions.<br>Wrong → no worries, the topic simply stays open for learning.</p>
    ${focusedArea ? "" : "<p style=color:var(--muted)>Tip: open the legend (?) and click a subject to check just that one.</p>"}
    <p>You can stop any time with × – your progress is kept.</p>`,
    [{ label: "Let's go!", primary: true, action: startCheck }, { label: "Maybe later" }]);
};

/* ============================================================
   START
   ============================================================ */
function refresh() { renderGraph(); updateHeader(); applyFocusStyles(); }

function rand(n) { return Math.floor(Math.random() * n); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

refresh();
fitHome();

if (!state.intro) {
  state.intro = true; save();
  showModal(`<div class="big">α</div><h2>Welcome to alpha-web!</h2>
    <p>All knowledge is connected. This web has a <b>beginning (α)</b> – but no end: it grows in every direction you choose to explore.</p>
    <p>Every bubble is open to explore — jump in anywhere. As you master a topic it lights up, and turns <b style="color:var(--gold)">golden ★</b> once everything built on it is mastered too.</p>
    <p>You decide where to go. Think for yourself – and whenever you're stuck: <b>hints are free.</b></p>`,
    [{ label: "I'll start at the beginning (α)", primary: true, action: () => showPanel("zahlen1") },
     { label: "I already know things – Quick Check!", action: () => document.getElementById("btn-check").onclick() }]);
  legend.classList.remove("hidden");
}

/* ---------- Find / search ---------- */
function pulseNode(t) {
  if (!world) return;
  const g = world.querySelector('[data-id="' + t.id + '"]');
  if (!g) return;
  const ping = el("circle", { r: 44, fill: "none", stroke: "#ffd166", "stroke-width": 4, class: "search-ping" }, g);
  setTimeout(function () { if (ping && ping.parentNode) ping.parentNode.removeChild(ping); }, 1700);
}
function focusNode(id) {
  const t = topicById[id] || frontierById[id];
  if (!t) return;
  const r = svg.getBoundingClientRect();
  view.s = 1.1;
  view.x = r.width / 2 - t.x * view.s;
  view.y = r.height / 2 - t.y * view.s;
  applyView();
  showPanel(id);
  pulseNode(t);
}
(function () {
  const input = document.getElementById("search-input");
  const box = document.getElementById("search-results");
  if (!input || !box) return;
  let matches = [], active = -1;
  function draw() {
    const q = input.value.trim().toLowerCase();
    if (!q) { box.classList.add("hidden"); box.innerHTML = ""; matches = []; return; }
    matches = ALLNODES.filter(t => t.title.toLowerCase().includes(q)).slice(0, 8);
    active = matches.length ? 0 : -1;
    if (!matches.length) { box.classList.remove("hidden"); box.innerHTML = '<div class="search-empty">No topic found</div>'; return; }
    box.innerHTML = matches.map((t, i) => {
      const color = A.areas[t.area].color;
      const sub = t.klasse ? ("Grade " + t.klasse) : "Frontier";
      return `<div class="search-row${i === active ? " active" : ""}" data-id="${t.id}"><span class="search-dot" style="background:${color}"></span><span class="search-title">${t.title}</span><span class="search-sub">${sub}</span></div>`;
    }).join("");
    box.classList.remove("hidden");
    Array.prototype.forEach.call(box.querySelectorAll(".search-row"), row => {
      row.onclick = () => pick(row.getAttribute("data-id"));
    });
  }
  function pick(id) { input.value = ""; box.classList.add("hidden"); box.innerHTML = ""; matches = []; focusNode(id); }
  function highlight() { Array.prototype.forEach.call(box.querySelectorAll(".search-row"), (r, i) => r.classList.toggle("active", i === active)); }
  input.addEventListener("input", draw);
  input.addEventListener("keydown", e => {
    if (!matches.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % matches.length; e.preventDefault(); highlight(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + matches.length) % matches.length; e.preventDefault(); highlight(); }
    else if (e.key === "Enter") { if (active >= 0) pick(matches[active].id); }
    else if (e.key === "Escape") { input.value = ""; box.classList.add("hidden"); matches = []; }
  });
  document.addEventListener("click", e => { if (!e.target.closest("#search-box")) box.classList.add("hidden"); });
})();

/* ---------- Subjects legend / spotlight filter ---------- */
function applyFocusStyles() {
  if (world) {
    world.querySelectorAll(".node").forEach(function (n) {
      const a = n.getAttribute("data-area");
      n.style.opacity = (!focusedArea || a === focusedArea) ? "" : "0.1";
    });
    world.querySelectorAll(".edge").forEach(function (e) {
      e.style.opacity = focusedArea ? "0.04" : "";
    });
  }
  document.querySelectorAll(".subj-row").forEach(function (r) {
    r.classList.toggle("active", r.getAttribute("data-area") === focusedArea);
  });
}
function setSubjectFocus(area) {
  focusedArea = (focusedArea === area) ? null : area;
  applyFocusStyles();
}
function buildSubjectsLegend() {
  const box = document.getElementById("legend-subjects");
  if (!box) return;
  let html = '<h3 class="subj-h3">Subjects <span class="subj-hint">(click to spotlight)</span></h3><div class="subj-grid">';
  Object.keys(A.areas).forEach(function (k) {
    const v = A.areas[k];
    html += '<div class="subj-row" data-area="' + k + '"><span class="subj-dot" style="background:' + v.color + '"></span>' + v.name + '</div>';
  });
  html += '</div>';
  box.innerHTML = html;
  box.querySelectorAll(".subj-row").forEach(function (r) {
    r.onclick = function () { setSubjectFocus(r.getAttribute("data-area")); };
  });
}
buildSubjectsLegend();

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener("keydown", function (e) {
  var tag = document.activeElement && document.activeElement.tagName;
  var typing = tag === "INPUT" || tag === "TEXTAREA";
  if (e.key === "/" && !typing) {
    var si = document.getElementById("search-input");
    if (si) { e.preventDefault(); si.focus(); }
  } else if (e.key === "Escape" && focusedArea) {
    setSubjectFocus(focusedArea);
  }
});


/* ---------- Random topic ---------- */
var _randBtn = document.getElementById("btn-random");
if (_randBtn) _randBtn.onclick = function () { var t = A.topics[Math.floor(Math.random() * A.topics.length)]; if (t) focusNode(t.id); };
})();
