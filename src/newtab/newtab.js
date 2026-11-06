// LapDraw infinite canvas — new tab drawing page.
// World-space model: strokes are stored in world coordinates; view = pan offset + zoom.
// Trackpad UX: two-finger scroll pans, pinch / Ctrl+scroll zooms, click-drag draws.

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const colorEl = document.getElementById("color");
const sizeEl = document.getElementById("size");
const zoomEl = document.getElementById("zoom");
const STORE = "lapdraw:canvas";

let view = { x: 0, y: 0, z: 1 }; // world -> screen: s = w * z + (x, y)
let settings = { color: "#ff5c5c", size: 4, tool: "pen" };
let strokes = []; // {tool, color, size, points:[{x,y}]}
let current = null;
let last = null;
let panning = null;
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

function redraw() {
  const r = dpr();
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const s of strokes) paint(s);
  if (current) paint(current);
  zoomEl.textContent = Math.round(view.z * 100) + "%";
}

function paint(stroke) {
  const isEraser = stroke.tool === "eraser";
  ctx.save();
  // "screen eraser": paint the background back over the stroke
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = isEraser ? "#101116" : stroke.color;
  ctx.lineWidth = Math.max(0.5, stroke.size * (isEraser ? 3 : 1) * view.z);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const pts = stroke.points;
  ctx.moveTo(w2sX(pts[0].x), w2sY(pts[0].y));
  if (pts.length === 1) {
    ctx.lineTo(w2sX(pts[0].x) + 0.01, w2sY(pts[0].y) + 0.01);
  }
  for (let i = 1; i < pts.length; i++) {
    const mx = w2sX((pts[i - 1].x + pts[i].x) / 2);
    const my = w2sY((pts[i - 1].y + pts[i].y) / 2);
    ctx.quadraticCurveTo(w2sX(pts[i - 1].x), w2sY(pts[i - 1].y), mx, my);
    if (i === pts.length - 1) ctx.lineTo(w2sX(pts[i].x), w2sY(pts[i].y));
  }
  ctx.stroke();
  ctx.restore();
}

function save() {
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

// ----- Pointer: draw / pan -----
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 1 || e.button === 2 || e.shiftKey) {
    panning = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    canvas.classList.add("panning");
    return;
  }
  if (e.button !== 0) return;
  current = {
    tool: settings.tool,
    color: settings.color,
    size: Number(sizeEl.value),
    points: [{ x: s2wX(e.clientX), y: s2wY(e.clientY) }]
  };
  last = null;
  paintLive(e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", (e) => {
  if (panning) {
    view.x = panning.vx + (e.clientX - panning.x);
    view.y = panning.vy + (e.clientY - panning.y);
    redraw();
    return;
  }
  if (!current) return;
  current.points.push({ x: s2wX(e.clientX), y: s2wY(e.clientY) });
  paintLive(e.clientX, e.clientY);
});

const endPointer = (e) => {
  if (panning) {
    panning = null;
    canvas.classList.remove("panning");
    return;
  }
  if (!current) return;
  strokes.push(current);
  current = null;
  last = null;
  save();
};

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ----- Trackpad wheel: two-finger scroll pans, pinch / Ctrl+scroll zooms -----
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAt(e.clientX, e.clientY, factor);
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      redraw();
    }
  },
  { passive: false }
);

function zoomAt(cx, cy, factor) {
  const nz = Math.min(8, Math.max(0.05, view.z * factor));
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
  const isEraser = current.tool === "eraser";
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = isEraser ? "#101116" : current.color;
  ctx.lineWidth = Math.max(0.5, current.size * (isEraser ? 3 : 1) * view.z);
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

// ----- Toolbar & keyboard -----
function exportPng() {
  const out = document.createElement("canvas");
  const r = dpr();
  out.width = Math.round(window.innerWidth * r);
  out.height = Math.round(window.innerHeight * r);
  const octx = out.getContext("2d");
  octx.fillStyle = "#101116";
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `lapdraw-canvas-${Date.now()}.png`;
  a.click();
}

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

document.getElementById("undo").addEventListener("click", () => {
  strokes.pop();
  redraw();
  save();
});

document.getElementById("clear").addEventListener("click", () => {
  if (confirm("Clear the whole canvas?")) {
    strokes = [];
    redraw();
    save();
  }
});

document.getElementById("save").addEventListener("click", exportPng);

document.getElementById("resetView").addEventListener("click", () => {
  if (!strokes.length) {
    view = { x: 0, y: 0, z: 1 };
    redraw();
    save();
    return;
  }
  // fit all strokes into the viewport
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes)
    for (const p of s.points) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  const pad = 60;
  const W = window.innerWidth - pad * 2;
  const H = window.innerHeight - pad * 2;
  const z = Math.min(8, Math.max(0.05, Math.min(W / Math.max(1, maxX - minX), H / Math.max(1, maxY - minY))));
  view = { z, x: pad + W / 2 - ((minX + maxX) / 2) * z, y: pad + H / 2 - ((minY + maxY) / 2) * z };
  redraw();
  save();
});

window.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  switch (e.key.toLowerCase()) {
    case "escape":
      if (current) {
        current = null;
        last = null;
        redraw();
      }
      break;
    case "p":
      settings.tool = "pen";
      syncTools();
      break;
    case "e":
      settings.tool = "eraser";
      syncTools();
      break;
    case "[":
      sizeEl.value = String(Math.max(1, Number(sizeEl.value) - 2));
      sizeEl.dispatchEvent(new Event("input"));
      break;
    case "]":
      sizeEl.value = String(Math.min(40, Number(sizeEl.value) + 2));
      sizeEl.dispatchEvent(new Event("input"));
      break;
    case "s":
      exportPng();
      break;
    case "0":
      view = { x: 0, y: 0, z: 1 };
      redraw();
      break;
    case "z":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        strokes.pop();
        redraw();
        save();
      }
      break;
  }
});

window.addEventListener("beforeunload", save);
window.addEventListener("resize", resize);
load();
