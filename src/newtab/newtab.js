// LapDraw infinite canvas — new tab drawing page.
// World-space model: strokes stored in world coords; view = pan offset + zoom.
// Trackpad UX: two-finger scroll pans, pinch / Ctrl+scroll zooms, click-drag draws.

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

let view = { x: 0, y: 0, z: 1 }; // world -> screen: s = w * z + (x, y)
let settings = { color: "#ff5c5c", size: 4, tool: "pen" };
let strokes = []; // freehand: {tool:"pen"|"eraser", color, size, points:[{x,y}]} — shapes: {tool:"line"|"rect"|"ellipse", ..., x1,y1,x2,y2}
let redoStack = [];
let current = null;
let last = null;
let panning = null;
let spaceHeld = false;
const dpr = () => window.devicePixelRatio || 1;

const w2sX = (x) => x * view.z + view.x;
const w2sY = (y) => y * view.z + view.y;
const s2wX = (x) => (x - view.x) / view.z;
const s2wY = (y) => (y - view.y) / view.z;

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
  zoomEl.textContent = Math.round(view.z * 100) + "%";
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

  if (isShape(stroke.tool)) {
    const x1 = w2sX(stroke.x1);
    const y1 = w2sY(stroke.y1);
    const x2 = w2sX(stroke.x2);
    const y2 = w2sY(stroke.y2);
    ctx.beginPath();
    if (stroke.tool === "line") {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else if (stroke.tool === "rect") {
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (stroke.tool === "ellipse") {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    }
    if (stroke.tool === "line") ctx.stroke();
    ctx.restore();
    return;
  }

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
  ctx.restore();
}

const isShape = (tool) => tool === "line" || tool === "rect" || tool === "ellipse";

function persist() {
  chrome.storage.local.set({ [STORE]: { strokes, view } });
}

function load() {
  chrome.storage.local.get(STORE, (store) => {
    const data = store[STORE];
    if (data && Array.isArray(data.strokes)) {
      strokes = data.strokes;
      if (data.view) view = data.view;
    }
    resize();
  });
}

function syncTools() {
  colorEl.value = settings.color;
  sizeEl.value = String(settings.size);
  document.querySelectorAll("[data-tool]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === settings.tool)
  );
}

// ----- History -----
function undo() {
  const s = strokes.pop();
  if (s) {
    redoStack.push(s);
    redraw();
    chrome.storage.local.set({ [STORE]: { strokes, view } });
  }
}

function redo() {
  const s = redoStack.pop();
  if (s) {
    strokes.push(s);
    redraw();
    chrome.storage.local.set({ [STORE]: { strokes, view } });
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

// ----- Pointer: draw / pan -----
function startPan(e) {
  panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  canvas.classList.add("panning");
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 2 || e.button === 1 || (spaceHeld && e.button === 0)) {
    startPan(e);
    return;
  }
  if (e.button !== 0) return;
  redoStack = [];
  const tool = settings.tool;
  current = isShape(tool)
    ? {
        tool,
        color: settings.color,
        size: Number(sizeEl.value),
        x1: s2wX(e.clientX),
        y1: s2wY(e.clientY),
        x2: s2wX(e.clientX),
        y2: s2wY(e.clientY),
        shift: e.shiftKey
      }
    : {
        tool,
        color: settings.color,
        size: Number(sizeEl.value),
        points: [{ x: s2wX(e.clientX), y: s2wY(e.clientY) }]
      };
  last = null;
  paintLive(e.clientX, e.clientY);
});

function constrainShape(s) {
  // Shift = snap: 45° diagonals for lines, square/circle for rect/ellipse
  if (!s.shift) return;
  if (s.tool === "line") {
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

canvas.addEventListener("pointermove", (e) => {
  if (panning) {
    view.x = panning.vx + (e.clientX - panning.x);
    view.y = panning.vy + (e.clientY - panning.y);
    redraw();
    return;
  }
  if (!current) return;
  if (isShape(current.tool)) {
    current.x2 = s2wX(e.clientX);
    current.y2 = s2wY(e.clientY);
    constrainShape(current);
    redraw(); // whole redraw keeps shape preview clean
    return;
  }
  current.points.push({ x: s2wX(e.clientX), y: s2wY(e.clientY) });
  paintLive(e.clientX, e.clientY);
});

const endPointer = (e) => {
  if (panning) {
    panning = null;
    canvas.classList.remove("panning");
    persist();
    return;
  }
  if (!current) return;
  if (isShape(current.tool)) {
    // ignore taps smaller than a dot
    if (Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 2 / view.z) {
      current = null;
      redraw();
      return;
    }
  }
  strokes.push(current);
  current = null;
  last = null;
  redraw();
  persist();
};

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// normalize wheel deltas: Firefox reports deltaMode lines (≈16px per unit)
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
  const nz = Math.min(10, Math.max(0.05, view.z * factor));
  const k = nz / view.z;
  view.x = cx - (cx - view.x) * k;
  view.y = cy - (cy - view.y) * k;
  view.z = nz;
  redraw();
}

function paintLive(sx, sy) {
  if (!current) return;
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

// ----- Toolbar -----
document.querySelectorAll("[data-tool]").forEach((b) =>
  b.addEventListener("click", () => {
    settings.tool = b.dataset.tool;
    syncTools();
  })
);

colorEl.addEventListener("input", () => {
  settings.color = colorEl.value;
});

sizeEl.addEventListener("input", () => {
  settings.size = Number(sizeEl.value);
});

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
      "project-save": exportProject,
      "project-open": importProject
    }[b.dataset.x];
    if (act) act();
  })
);

// close export menu when clicking elsewhere
window.addEventListener("pointerdown", (e) => {
  const menu = document.getElementById("exportMenu");
  if (!menu.classList.contains("hidden") && !e.target.closest("#exportMenu, #exportBtn")) {
    menu.classList.add("hidden");
  }
});
document.getElementById("zen").addEventListener("click", () => hud.classList.toggle("zen"));
document.getElementById("help").addEventListener("click", () => cheatsheet.classList.toggle("hidden"));

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
    if (isShape(s.tool)) {
      expand(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2));
      expand(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
    } else {
      for (const p of s.points) expand(p.x, p.y);
    }
  }
  const pad = 60;
  const W = Math.max(100, window.innerWidth - pad * 2);
  const H = Math.max(100, window.innerHeight - pad * 2);
  const z = Math.min(10, Math.max(0.05, Math.min(W / Math.max(1, maxX - minX), H / Math.max(1, maxY - minY))));
  view = { z, x: pad + W / 2 - ((minX + maxX) / 2) * z, y: pad + H / 2 - ((minY + maxY) / 2) * z };
  redraw();
  persist();
}

// ----- Keyboard -----
window.addEventListener("keydown", (e) => {
  const t = e.target;
  const typing = t && (t.tagName === "INPUT" && t.type !== "color" && t.type !== "range" && t.type !== "checkbox" || t.tagName === "TEXTAREA");
  if (e.key === " " && !typing) {
    spaceHeld = true;
    e.preventDefault();
    return;
  }
  if (typing) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === "z" && !e.shiftKey) return undo(), e.preventDefault();
  if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) return redo(), e.preventDefault();
  if (mod && key === "s") return exportPngArtwork(), e.preventDefault();
  if (mod && e.shiftKey && key === "x") return clearAll(), e.preventDefault();
  if (mod && key === "1") return (view = { x: 0, y: 0, z: 1 }, redraw(), e.preventDefault());
  if (mod && (key === "0" || key === "=")) return fitContent(), e.preventDefault();

  switch (key) {
    case "p":
      settings.tool = "pen"; syncTools(); break;
    case "e":
      settings.tool = "eraser"; syncTools(); break;
    case "l":
      settings.tool = "line"; syncTools(); break;
    case "r":
      settings.tool = "rect"; syncTools(); break;
    case "o":
      settings.tool = "ellipse"; syncTools(); break;
    case "[":
      sizeEl.value = String(Math.max(1, Number(sizeEl.value) - 2));
      sizeEl.dispatchEvent(new Event("input")); break;
    case "]":
      sizeEl.value = String(Math.min(40, Number(sizeEl.value) + 2));
      sizeEl.dispatchEvent(new Event("input")); break;
    case "s":
      exportPngArtwork(); break;
    case "0":
      fitContent(); break;
    case "+":
    case "=":
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.15); break;
    case "-":
    case "_":
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.15); break;
    case "?":
    case "h":
      cheatsheet.classList.toggle("hidden"); break;
    case "tab":
      hud.classList.toggle("zen"); e.preventDefault(); break;
    case "escape":
      cheatsheet.classList.add("hidden");
      if (current) {
        current = null; last = null; redraw();
      }
      break;
    case "arrowleft": view.x += 60; redraw(); break;
    case "arrowright": view.x -= 60; redraw(); break;
    case "arrowup": view.y += 60; redraw(); break;
    case "arrowdown": view.y -= 60; redraw(); break;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === " ") spaceHeld = false;
});

window.addEventListener("blur", () => {
  spaceHeld = false;
});

window.addEventListener("resize", resize);
window.addEventListener("beforeunload", persist);
load();
