// LapDraw infinite canvas — new tab drawing page.
// World-space model: strokes stored in world coords; view = pan offset + zoom.
// Trackpad UX: two-finger scroll pans, pinch / Ctrl+scroll zooms, click-drag draws.
// Intelligence: QuickShape (hold still to snap), Smart Assist, and Streamline stabilizer.

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const colorEl = document.getElementById("color");
const sizeEl = document.getElementById("size");
const zoomEl = document.getElementById("zoom");
const cheatsheet = document.getElementById("cheatsheet");
const hud = document.querySelector(".hud");
const BG = "#0e1114";
const GRID = 32;
const STORE = "lapdraw:canvas";
const PREFS_STORE = "lapdraw:prefs";

let view = { x: 0, y: 0, z: 1 }; // world -> screen: s = w * z + (x, y)
let settings = { color: "#ff5c50", size: 4, tool: "pen" };
let strokes = []; // {tool:"pen"|"eraser", color, size, points:[{x,y}]} | {tool:"line"|"rect"|"ellipse"|"arrow", x1,y1,x2,y2} | {tool:"text", x, y, text}
let redoStack = [];
let current = null;
let last = null;
let panning = null;
let spaceHeld = false;

// Trackpad intelligence & assistance state
let smartAssist = true; // Auto-straightens lines & beautifies shapes
let gridSnap = false;   // Snaps shape coordinates to 16px grid
let holdTimer = null;
let holdAnchor = null;
let activeTextInput = null;

const dpr = () => window.devicePixelRatio || 1;

const w2sX = (x) => x * view.z + view.x;
const w2sY = (y) => y * view.z + view.y;
const s2wX = (x) => (x - view.x) / view.z;
const s2wY = (y) => (y - view.y) / view.z;

const isShape = (tool) => tool === "line" || tool === "rect" || tool === "ellipse" || tool === "arrow";

function resize() {
  canvas.width = Math.round(window.innerWidth * dpr());
  canvas.height = Math.round(window.innerHeight * dpr());
  redraw();
}

function syncGrid() {
  // make the page grid move with pan/zoom so the surface feels alive
  document.body.style.backgroundSize = `${GRID * view.z}px ${GRID * view.z}px`;
  document.body.style.backgroundPosition = `${view.x}px ${view.y}px`;
}

function redraw() {
  const r = dpr();
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const s of strokes) paint(s);
  if (current) paint(current);
  const zPct = Math.round(view.z * 100) + "%";
  zoomEl.textContent = zPct;
  const sbZoom = document.getElementById("sb-zoom");
  if (sbZoom) sbZoom.textContent = zPct;
  syncGrid();
}

function paint(stroke) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? BG : stroke.color;
  const width = Math.max(0.5, stroke.size * (stroke.tool === "eraser" ? 3 : 1) * view.z);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "text") {
    const fontSize = Math.max(10, (stroke.size || 4) * 3 * view.z);
    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    ctx.fillStyle = stroke.tool === "eraser" ? BG : stroke.color;
    ctx.fillText(stroke.text || "", w2sX(stroke.x), w2sY(stroke.y));
    ctx.restore();
    return;
  }

  if (isShape(stroke.tool)) {
    const x1 = w2sX(stroke.x1);
    const y1 = w2sY(stroke.y1);
    const x2 = w2sX(stroke.x2);
    const y2 = w2sY(stroke.y2);
    ctx.beginPath();
    if (stroke.tool === "line") {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (stroke.tool === "arrow") {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(8, stroke.size * 3 * view.z);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = stroke.tool === "eraser" ? BG : stroke.color;
      ctx.fill();
    } else if (stroke.tool === "rect") {
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (stroke.tool === "ellipse") {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (stroke.points && stroke.points.length) {
    ctx.beginPath();
    const pts = stroke.points;
    ctx.moveTo(w2sX(pts[0].x), w2sY(pts[0].y));
    if (pts.length === 1) ctx.lineTo(w2sX(pts[0].x) + 0.01, w2sY(pts[0].y) + 0.01);
    for (let i = 1; i < pts.length; i++) {
      const mx = w2sX((pts[i - 1].x + pts[i].x) / 2);
      const my = w2sY((pts[i - 1].y + pts[i].y) / 2);
      ctx.quadraticCurveTo(w2sX(pts[i - 1].x), w2sY(pts[i - 1].y), mx, my);
      if (i === pts.length - 1) ctx.lineTo(w2sX(pts[i].x), w2sY(pts[i].y));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function statusbar(saved) {
  const s = document.getElementById("sb-strokes");
  if (s) {
    const pts = strokes.reduce(
      (n, st) => n + (st.points ? st.points.length : st.tool === "text" ? 1 : 2),
      0
    );
    s.textContent = `${strokes.length} strokes · ${pts} pts`;
  }
  const sv = document.getElementById("sb-saved");
  if (sv) {
    if (saved) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      sv.textContent = `saved ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      sv.classList.remove("saved-dirty");
    } else {
      sv.textContent = "unsaved…";
      sv.classList.add("saved-dirty");
    }
  }
  const sbSmart = document.getElementById("sb-smart");
  if (sbSmart) {
    sbSmart.textContent = smartAssist ? "✦ SMART: ON" : "SMART: OFF";
    sbSmart.classList.toggle("on", smartAssist);
  }
  const sbSnap = document.getElementById("sb-snap");
  if (sbSnap) {
    sbSnap.textContent = gridSnap ? "SNAP: ON" : "SNAP: OFF";
    sbSnap.classList.toggle("on", gridSnap);
  }
}

function persist() {
  chrome.storage.local.set({ [STORE]: { strokes, view } });
  statusbar(true);
}

function load() {
  chrome.storage.local.get([STORE, PREFS_STORE], (store) => {
    const data = store[STORE];
    if (data && Array.isArray(data.strokes)) {
      strokes = data.strokes;
      if (data.view) view = data.view;
    }
    const prefs = store[PREFS_STORE];
    if (prefs) {
      if (typeof prefs.smartAssist === "boolean") smartAssist = prefs.smartAssist;
      if (typeof prefs.gridSnap === "boolean") gridSnap = prefs.gridSnap;
    }
    syncToggles();
    syncTools();
    resize();
  });
}

function syncTools() {
  colorEl.value = settings.color;
  sizeEl.value = String(settings.size);
  document.querySelectorAll("[data-tool]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === settings.tool)
  );
  document.querySelectorAll(".dot").forEach((d) =>
    d.classList.toggle("active", d.dataset.color === settings.color)
  );
  const sbTool = document.getElementById("sb-tool");
  if (sbTool) sbTool.textContent = settings.tool;
  const sbSize = document.getElementById("sb-size");
  if (sbSize) sbSize.textContent = settings.size + "px";
  statusbar(true);
}

function syncToggles() {
  const smartBtn = document.getElementById("toggleSmart");
  if (smartBtn) smartBtn.classList.toggle("toggle-on", smartAssist);
  const snapBtn = document.getElementById("toggleSnap");
  if (snapBtn) snapBtn.classList.toggle("toggle-on", gridSnap);
  statusbar(true);
}

function toggleSmartAssist() {
  smartAssist = !smartAssist;
  chrome.storage.local.set({ [PREFS_STORE]: { smartAssist, gridSnap } });
  syncToggles();
  toast(smartAssist ? "Smart Shape Assist ON" : "Smart Assist OFF (Freehand)");
}

function toggleGridSnap() {
  gridSnap = !gridSnap;
  chrome.storage.local.set({ [PREFS_STORE]: { smartAssist, gridSnap } });
  syncToggles();
  toast(gridSnap ? "Grid Snap ON (16px)" : "Grid Snap OFF");
}

// ----- History -----
function undo() {
  window.tutDone && window.tutDone("undo");
  const s = strokes.pop();
  if (s) {
    redoStack.push(s);
    redraw();
    persist();
  }
}

function redo() {
  const s = redoStack.pop();
  if (s) {
    strokes.push(s);
    redraw();
    persist();
  }
}

function clearAll() {
  if (!strokes.length) return;
  if (!confirm("Clear the whole canvas? (Ctrl+Z will undo this)")) return;
  redoStack.push(...strokes.reverse());
  strokes = [];
  redraw();
  persist();
}

// ----- Pointer: draw / pan / text / QuickShape -----
function startPan(e) {
  panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  canvas.classList.add("panning");
}

function spawnTextInput(clientX, clientY) {
  if (activeTextInput) activeTextInput.remove();

  const input = document.createElement("input");
  input.type = "text";
  input.className = "canvas-text-input";
  input.placeholder = "type text… (Enter to save)";
  input.style.left = `${clientX}px`;
  input.style.top = `${clientY - 12}px`;
  input.style.color = settings.color;
  document.body.appendChild(input);
  input.focus();
  activeTextInput = input;

  const commit = () => {
    const txt = input.value.trim();
    if (txt) {
      const wx = gridSnap ? LapDrawIntelligence.snapToGridCoord(s2wX(clientX)) : s2wX(clientX);
      const wy = gridSnap ? LapDrawIntelligence.snapToGridCoord(s2wY(clientY)) : s2wY(clientY);
      strokes.push({
        tool: "text",
        color: settings.color,
        size: settings.size,
        x: wx,
        y: wy,
        text: txt
      });
      redraw();
      persist();
      toast("Added text label");
    }
    input.remove();
    activeTextInput = null;
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      input.remove();
      activeTextInput = null;
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(commit, 50);
  });
}

function snapCoord(val) {
  return gridSnap && typeof LapDrawIntelligence !== "undefined"
    ? LapDrawIntelligence.snapToGridCoord(val)
    : val;
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 2 || e.button === 1 || (spaceHeld && e.button === 0)) {
    startPan(e);
    return;
  }
  if (e.button !== 0) return;

  // Text tool: click to type text
  if (settings.tool === "text") {
    spawnTextInput(e.clientX, e.clientY);
    return;
  }

  redoStack = [];
  const tool = settings.tool;
  const startWx = snapCoord(s2wX(e.clientX));
  const startWy = snapCoord(s2wY(e.clientY));

  current = isShape(tool)
    ? {
        tool,
        color: settings.color,
        size: Number(sizeEl.value),
        x1: startWx,
        y1: startWy,
        x2: startWx,
        y2: startWy,
        shift: e.shiftKey
      }
    : {
        tool,
        color: settings.color,
        size: Number(sizeEl.value),
        points: [{ x: startWx, y: startWy }],
        isSnapped: false
      };

  last = null;
  holdAnchor = { x: e.clientX, y: e.clientY, time: Date.now() };

  // Setup QuickShape timer (hold still 450ms to snap into clean vector shape)
  clearTimeout(holdTimer);
  if (tool === "pen") {
    holdTimer = setTimeout(() => {
      triggerQuickShape();
    }, 450);
  }

  paintLive(e.clientX, e.clientY);
});

function constrainShape(s) {
  // Shift = snap: 45° diagonals for lines/arrows, square/circle for rect/ellipse
  if (!s.shift) return;
  if (s.tool === "line" || s.tool === "arrow") {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    s.x2 = s.x1 + Math.cos(ang) * len;
    s.y2 = s.y1 + Math.sin(ang) * len;
    return;
  }
  const w = Math.abs(s.x2 - s.x1);
  const h = Math.abs(s.y2 - s.y1);
  const size = Math.max(w, h);
  s.x2 = s.x1 + Math.sign(s.x2 - s.x1 || 1) * size;
  s.y2 = s.y1 + Math.sign(s.y2 - s.y1 || 1) * size;
}

function triggerQuickShape() {
  if (!current || current.tool !== "pen" || current.isSnapped) return;
  if (!current.points || current.points.length < 5) return;

  if (typeof LapDrawIntelligence !== "undefined") {
    const shape = LapDrawIntelligence.recognizeShape(current.points);
    if (shape) {
      current = {
        tool: shape.type,
        color: current.color,
        size: current.size,
        x1: shape.x1,
        y1: shape.y1,
        x2: shape.x2,
        y2: shape.y2,
        isSnapped: true,
        shift: false
      };
      redraw();
      toast(`✦ QuickShape: ${shape.type.toUpperCase()}`);
    }
  }
}

canvas.addEventListener("pointermove", (e) => {
  if (panning) {
    view.x = panning.vx + (e.clientX - panning.x);
    view.y = panning.vy + (e.clientY - panning.y);
    window.tutDone && window.tutDone("pan");
    redraw();
    return;
  }
  if (!current) return;

  const curWx = snapCoord(s2wX(e.clientX));
  const curWy = snapCoord(s2wY(e.clientY));

  // If stroke was already snapped to a shape via QuickShape, adjust its endpoint
  if (current.isSnapped || isShape(current.tool)) {
    current.x2 = curWx;
    current.y2 = curWy;
    current.shift = e.shiftKey;
    constrainShape(current);
    redraw();
    return;
  }

  // Freehand drawing: check hold movement to maintain QuickShape trigger
  if (holdAnchor) {
    const dist = Math.hypot(e.clientX - holdAnchor.x, e.clientY - holdAnchor.y);
    if (dist > 9) {
      // User moved significantly; reset hold timer
      holdAnchor = { x: e.clientX, y: e.clientY, time: Date.now() };
      clearTimeout(holdTimer);
      if (current.tool === "pen") {
        holdTimer = setTimeout(triggerQuickShape, 450);
      }
    }
  }

  current.points.push({ x: curWx, y: curWy });
  paintLive(e.clientX, e.clientY);
});

const endPointer = (e) => {
  clearTimeout(holdTimer);
  holdAnchor = null;

  if (panning) {
    panning = null;
    canvas.classList.remove("panning");
    persist();
    return;
  }
  if (!current) return;
  window.tutDone && window.tutDone("draw");

  // Shape tools / snapped shapes validation
  if (isShape(current.tool)) {
    if (Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 3 / view.z) {
      current = null;
      redraw();
      return;
    }
    strokes.push(current);
    current = null;
    last = null;
    redraw();
    persist();
    return;
  }

  // Freehand pen/eraser processing
  if (current.points && current.points.length) {
    // 1. Strip fishhook tail from finger lift
    if (typeof LapDrawIntelligence !== "undefined") {
      current.points = LapDrawIntelligence.stripFishhook(current.points);
    }

    // 2. Smart Assist: auto-beautify recognized shapes on release if enabled
    if (smartAssist && current.tool === "pen" && typeof LapDrawIntelligence !== "undefined") {
      const recognized = LapDrawIntelligence.recognizeShape(current.points);
      if (recognized) {
        current = {
          tool: recognized.type,
          color: current.color,
          size: current.size,
          x1: recognized.x1,
          y1: recognized.y1,
          x2: recognized.x2,
          y2: recognized.y2
        };
        toast(`✦ Snapped to ${recognized.type.toUpperCase()}`);
        strokes.push(current);
        current = null;
        last = null;
        redraw();
        persist();
        return;
      }
    }

    // 3. Smooth remaining freehand points
    if (typeof LapDrawIntelligence !== "undefined" && current.points.length > 3) {
      current.points = LapDrawIntelligence.smoothPoints(current.points, 0.25);
    }

    strokes.push(current);
  }

  current = null;
  last = null;
  redraw();
  persist();
};

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// normalize wheel deltas: Firefox reports deltaMode lines (~16px per unit)
function normDelta(e) {
  const mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  return { dx: e.deltaX * mul, dy: e.deltaY * mul };
}

// ----- Trackpad wheel: two-finger scroll pans, pinch / Ctrl+scroll zooms -----
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const { dx, dy } = normDelta(e);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.01));
    } else {
      view.x -= dx;
      view.y -= dy;
      redraw();
    }
  },
  { passive: false }
);

function zoomAt(cx, cy, factor) {
  window.tutDone && window.tutDone("zoom");
  const nz = Math.min(10, Math.max(0.05, view.z * factor));
  const k = nz / view.z;
  view.x = cx - (cx - view.x) * k;
  view.y = cy - (cy - view.y) * k;
  view.z = nz;
  redraw();
}

function paintLive(sx, sy) {
  if (!current || !current.points) return;
  const wx = s2wX(sx);
  const wy = s2wY(sy);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = current.tool === "eraser" ? BG : current.color;
  ctx.lineWidth = Math.max(0.5, current.size * (current.tool === "eraser" ? 3 : 1) * view.z);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (!last) {
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 0.01, sy + 0.01);
    last = { x: wx, y: wy, mx: sx, my: sy };
    ctx.stroke();
    ctx.restore();
    return;
  }
  const mx = (w2sX(last.x) + sx) / 2;
  const my = (w2sY(last.y) + sy) / 2;
  ctx.moveTo(last.mx, last.my);
  ctx.quadraticCurveTo(w2sX(last.x), w2sY(last.y), mx, my);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  ctx.restore();
  last = { x: wx, y: wy, mx, my };
}

// ----- Toolbar & Palette -----
document.querySelectorAll("[data-tool]").forEach((b) =>
  b.addEventListener("click", () => {
    setTool(b.dataset.tool);
  })
);

document.querySelectorAll(".dot").forEach((d) =>
  d.addEventListener("click", () => {
    settings.color = d.dataset.color;
    syncTools();
  })
);

colorEl.addEventListener("input", () => {
  settings.color = colorEl.value;
  syncTools();
});

sizeEl.addEventListener("input", () => {
  settings.size = Number(sizeEl.value);
  syncTools();
});

document.getElementById("toggleSmart").addEventListener("click", toggleSmartAssist);
document.getElementById("toggleSnap").addEventListener("click", toggleGridSnap);

document.getElementById("undo").addEventListener("click", () => undo());
document.getElementById("redo").addEventListener("click", () => redo());
document.getElementById("clear").addEventListener("click", () => clearAll());

document.getElementById("exportBtn").addEventListener("click", () =>
  document.getElementById("exportMenu").classList.toggle("hidden")
);

document.querySelectorAll("[data-x]").forEach((b) =>
  b.addEventListener("click", () => {
    document.getElementById("exportMenu").classList.add("hidden");
    const act = {
      png: exportPngArtwork,
      viewport: exportViewportPng,
      jpg: exportJpg,
      svg: exportSvg,
      pdf: exportPdf,
      copy: copyImage,
      "copy-svg": copySvgCode,
      "copy-react": copyReactComponent,
      "copy-md": copyMarkdownImage,
      "project-save": exportProject,
      "project-open": importProject
    }[b.dataset.x];
    if (act) {
      act();
      window.tutDone && window.tutDone("export");
    }
  })
);

// Close export menu when clicking elsewhere
window.addEventListener("pointerdown", (e) => {
  const menu = document.getElementById("exportMenu");
  if (!menu.classList.contains("hidden") && !e.target.closest("#exportMenu, #exportBtn")) {
    menu.classList.add("hidden");
  }
});

document.getElementById("zen").addEventListener("click", () => hud.classList.toggle("zen"));
document.getElementById("help").addEventListener("click", () => cheatsheet.classList.toggle("hidden"));
document.getElementById("fit").addEventListener("click", () => fitContent());
document.getElementById("replayTutorial").addEventListener("click", () => {
  cheatsheet.classList.add("hidden");
  window.lapdrawTutorial && window.lapdrawTutorial.start();
});

function fitContent() {
  if (!strokes.length) {
    view = { x: 0, y: 0, z: 1 };
    redraw();
    persist();
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const s of strokes) {
    if (s.tool === "text") {
      expand(s.x, s.y - 20);
      expand(s.x + (s.text || "").length * 12, s.y + 10);
    } else if (isShape(s.tool)) {
      expand(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2));
      expand(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
    } else if (s.points && s.points.length) {
      for (const p of s.points) expand(p.x, p.y);
    }
  }
  if (minX === Infinity) return;
  const pad = 60;
  const W = Math.max(100, window.innerWidth - pad * 2);
  const H = Math.max(100, window.innerHeight - pad * 2);
  const z = Math.min(10, Math.max(0.05, Math.min(W / Math.max(1, maxX - minX), H / Math.max(1, maxY - minY))));
  view = { z, x: pad + W / 2 - ((minX + maxX) / 2) * z, y: pad + H / 2 - ((minY + maxY) / 2) * z };
  redraw();
  persist();
}

// ----- Keyboard (registry-driven, remappable via the options page) -----
const CANVAS_ACTIONS = {
  pen: () => setTool("pen"),
  eraser: () => setTool("eraser"),
  line: () => setTool("line"),
  rect: () => setTool("rect"),
  ellipse: () => setTool("ellipse"),
  arrow: () => setTool("arrow"),
  text: () => setTool("text"),
  smart: () => toggleSmartAssist(),
  snap: () => toggleGridSnap(),
  sizeup: () => stepSize(+2),
  sizedown: () => stepSize(-2),
  zoomin: () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.15),
  zoomout: () => zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.15),
  fit: () => fitContent(),
  resetzoom: () => (view = { x: 0, y: 0, z: 1 }, redraw()),
  undo: () => undo(),
  redo: () => redo(),
  clear: () => clearAll(),
  save: () => exportPngArtwork(),
  zen: () => hud.classList.toggle("zen"),
  help: () => cheatsheet.classList.toggle("hidden"),
  cancel: () => {
    cheatsheet.classList.add("hidden");
    document.getElementById("exportMenu").classList.add("hidden");
    if (activeTextInput) {
      activeTextInput.remove();
      activeTextInput = null;
    }
    if (current) {
      current = null;
      last = null;
      redraw();
    }
  },
  panup: () => (view.y += 60, redraw()),
  pandown: () => (view.y -= 60, redraw()),
  panleft: () => (view.x += 60, redraw()),
  panright: () => (view.x -= 60, redraw())
};

function setTool(tool) {
  settings.tool = tool;
  syncTools();
  if (tool !== "pen") window.tutDone && window.tutDone("tools");
}

function stepSize(d) {
  sizeEl.value = String(Math.max(1, Math.min(40, Number(sizeEl.value) + d)));
  settings.size = Number(sizeEl.value);
  syncTools();
}

const KEYMAP_STORE = "lapdraw:keymap";
const DEFAULT_CANVAS_KEYS = {
  pen: "p",
  eraser: "e",
  line: "l",
  rect: "r",
  ellipse: "o",
  arrow: "a",
  text: "t",
  smart: "m",
  snap: "g",
  sizeup: "]",
  sizedown: "[",
  zoomin: "+",
  zoomout: "-",
  fit: "0",
  resetzoom: "ctrl+1",
  undo: "ctrl+z",
  redo: "ctrl+shift+z,ctrl+y",
  clear: "ctrl+shift+x",
  save: "s,ctrl+s",
  zen: "tab",
  help: "?",
  cancel: "escape",
  panup: "arrowup",
  pandown: "arrowdown",
  panleft: "arrowleft",
  panright: "arrowright"
};

let canvasBindings = {};

function comboOf(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key === " " ? "space" : e.key.toLowerCase());
  return parts.join("+");
}

function rebuildCanvasBindings() {
  canvasBindings = {};
  for (const [action, combos] of Object.entries(DEFAULT_CANVAS_KEYS)) {
    for (const c of combos.split(",")) canvasBindings[c.trim()] = action;
  }
  chrome.storage.local.get(KEYMAP_STORE, (store) => {
    const user = store[KEYMAP_STORE] && store[KEYMAP_STORE].canvas;
    if (user) {
      for (const combo of Object.keys(user)) canvasBindings[combo] = user[combo];
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEYMAP_STORE]) rebuildCanvasBindings();
});

window.addEventListener("keydown", (e) => {
  const t = e.target;
  const isTextField = t && ((t.tagName === "INPUT" && !["color", "range", "checkbox"].includes(t.type)) || t.tagName === "TEXTAREA");
  if (e.key === " " && !isTextField) {
    spaceHeld = true;
    e.preventDefault();
    return;
  }
  if (isTextField) return;
  const action = canvasBindings[comboOf(e)];
  if (action && CANVAS_ACTIONS[action]) {
    e.preventDefault();
    CANVAS_ACTIONS[action]();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === " ") spaceHeld = false;
});

window.addEventListener("blur", () => {
  spaceHeld = false;
});

window.addEventListener("resize", resize);

// Init
rebuildCanvasBindings();
load();
