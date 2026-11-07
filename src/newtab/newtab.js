// LapDraw infinite canvas — new tab drawing page.
// World-space model: strokes stored in world coords; view = pan offset + zoom.
// Trackpad UX: two-finger scroll pans, pinch / Ctrl+scroll zooms, click-drag draws.
// Intelligence: QuickShape (hold still to snap), Smart Assist, and Diagramming Studio.

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const colorEl = document.getElementById("color");
const sizeEl = document.getElementById("size");
const zoomEl = document.getElementById("zoom");
const cheatsheet = document.getElementById("cheatsheet");
const hud = document.querySelector(".hud");
const THEMES = {
  omarchy: {
    id: "omarchy",
    name: "Omarchy Rice",
    bg: "#0e1114",
    surface: "#14181d",
    border: "#242a31",
    text: "#ccd4dc",
    muted: "#77828e",
    accent: "#ff5c50",
    accentContrast: "#0e1114",
    palette: ["#ff5c50", "#ffb547", "#ffd60a", "#74c69d", "#64a8ff", "#b48ce8", "#e6e9ee", "#77828e"]
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    bg: "#282a36",
    surface: "#21222c",
    border: "#44475a",
    text: "#f8f8f2",
    muted: "#6272a4",
    accent: "#bd93f9",
    accentContrast: "#282a36",
    palette: ["#bd93f9", "#ff79c6", "#8be9fd", "#50fa7b", "#f1fa8c", "#ffb86c", "#f8f8f2", "#6272a4"]
  },
  catppuccin: {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    bg: "#1e1e2e",
    surface: "#181825",
    border: "#313244",
    text: "#cdd6f4",
    muted: "#6c7086",
    accent: "#cba6f7",
    accentContrast: "#1e1e2e",
    palette: ["#cba6f7", "#f38ba8", "#fab387", "#f9e2af", "#a6e3a1", "#89b4fa", "#cdd6f4", "#6c7086"]
  },
  tokyo: {
    id: "tokyo",
    name: "Tokyo Night",
    bg: "#1a1b26",
    surface: "#16161e",
    border: "#292e42",
    text: "#c0caf5",
    muted: "#565f89",
    accent: "#7aa2f7",
    accentContrast: "#1a1b26",
    palette: ["#7aa2f7", "#bb9af7", "#7dcfff", "#9ece6a", "#e0af68", "#f7768e", "#c0caf5", "#565f89"]
  },
  nord: {
    id: "nord",
    name: "Nord Frost",
    bg: "#2e3440",
    surface: "#242933",
    border: "#3b4252",
    text: "#eceff4",
    muted: "#7b88a1",
    accent: "#88c0d0",
    accentContrast: "#2e3440",
    palette: ["#88c0d0", "#81a1c1", "#5e81ac", "#a3be8c", "#ebcb8b", "#d08770", "#bf616a", "#eceff4"]
  },
  monokai: {
    id: "monokai",
    name: "Monokai Pro",
    bg: "#2d2a2e",
    surface: "#221f22",
    border: "#403e41",
    text: "#fcfcfa",
    muted: "#727072",
    accent: "#ffd866",
    accentContrast: "#2d2a2e",
    palette: ["#ffd866", "#fc9867", "#ff6188", "#ab9df2", "#78dce8", "#a9dc76", "#fcfcfa", "#727072"]
  },
  paper: {
    id: "paper",
    name: "Paper Light",
    bg: "#f6f8fa",
    surface: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#656d76",
    accent: "#0969da",
    accentContrast: "#ffffff",
    palette: ["#0969da", "#1a7f37", "#9a6700", "#cf222e", "#8250df", "#24292f", "#57606a", "#8c959f"]
  },
  matrix: {
    id: "matrix",
    name: "Matrix Cyber",
    bg: "#080c0e",
    surface: "#05080a",
    border: "#14291e",
    text: "#c9f7db",
    muted: "#2e6648",
    accent: "#00ff88",
    accentContrast: "#080c0e",
    palette: ["#00ff88", "#00e5ff", "#39ff14", "#ffee00", "#ff007f", "#00b4d8", "#c9f7db", "#2e6648"]
  }
};

let activeTheme = THEMES.omarchy;
var BG = activeTheme.bg;
const GRID = 32;
const STORE = "lapdraw:canvas";
const PREFS_STORE = "lapdraw:prefs";

let view = { x: 0, y: 0, z: 1 }; // world -> screen: s = w * z + (x, y)
let settings = { color: "#ff5c50", size: 4, tool: "pen" };
let strokes = []; // shapes, freehand, text, and diagram tables
let redoStack = [];
let current = null;
let last = null;
let panning = null;
let spaceHeld = false;

// Trackpad intelligence & diagramming state
let smartAssist = true; // Auto-straightens lines & beautifies shapes
let gridSnap = false;   // Snaps shape coordinates to 16px grid
let lineDashed = false; // Toggles dashed lines (lifelines, async arrows, interfaces)
let holdTimer = null;
let holdAnchor = null;
let activeTextInput = null;

const dpr = () => window.devicePixelRatio || 1;

const w2sX = (x) => x * view.z + view.x;
const w2sY = (y) => y * view.z + view.y;
const s2wX = (x) => (x - view.x) / view.z;
const s2wY = (y) => (y - view.y) / view.z;

const isShape = (tool) =>
  tool === "line" ||
  tool === "rect" ||
  tool === "ellipse" ||
  tool === "arrow" ||
  tool === "diamond" ||
  tool === "cylinder" ||
  tool === "frame" ||
  tool === "activation" ||
  tool === "uml-rel";

function resize() {
  canvas.width = Math.round(window.innerWidth * dpr());
  canvas.height = Math.round(window.innerHeight * dpr());
  redraw();
}

function syncGrid() {
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
  syncMinimap();
}

function paint(stroke) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? BG : stroke.color;
  const width = Math.max(0.5, stroke.size * (stroke.tool === "eraser" ? 3 : 1) * view.z);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.dashed) {
    ctx.setLineDash([8 * view.z, 5 * view.z]);
  } else {
    ctx.setLineDash([]);
  }

  // 1. Text Tool / Developer Code Card
  if (stroke.tool === "text") {
    const rawFs = stroke.fontSize || Math.max(12, (stroke.size || 4) * 3);
    const fontSize = Math.max(9, rawFs * view.z);
    const sx = w2sX(stroke.x);
    const sy = w2sY(stroke.y);
    const lines = (stroke.text || "").split("\n");
    const lh = fontSize * 1.4;

    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    ctx.textBaseline = "top";

    let maxW = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    }
    const padX = stroke.card ? 10 * view.z : 0;
    const padY = stroke.card ? 8 * view.z : 0;
    const badgeH = stroke.badge ? 18 * view.z : 0;
    const totalW = maxW + padX * 2;
    const totalH = lines.length * lh + padY * 2 + badgeH;

    if (stroke.card) {
      // Draw dark terminal code card background
      ctx.fillStyle = "rgba(14, 18, 24, 0.94)";
      ctx.fillRect(sx, sy, totalW, totalH);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, 1.5 * view.z);
      ctx.strokeRect(sx, sy, totalW, totalH);

      // Colored top accent stripe
      ctx.fillStyle = stroke.color;
      ctx.fillRect(sx, sy, totalW, 2 * view.z);
    }

    let startTextY = sy + padY;
    if (stroke.badge) {
      const bFs = Math.max(8, 10 * view.z);
      ctx.font = `600 ${bFs}px "JetBrains Mono", monospace`;
      const bText = `[${stroke.badge.toUpperCase()}]`;
      const bw = ctx.measureText(bText).width + 8 * view.z;
      ctx.fillStyle = stroke.color;
      ctx.fillRect(sx + padX, sy + padY, bw, 15 * view.z);
      ctx.fillStyle = "#0e1114";
      ctx.fillText(bText, sx + padX + 4 * view.z, sy + padY + 2 * view.z);
      startTextY += 18 * view.z;
    }

    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    ctx.fillStyle = stroke.tool === "eraser" ? BG : stroke.color;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], sx + padX, startTextY + i * lh);
    }
    ctx.restore();
    return;
  }

  // 2. Database Table / UML Class Card
  if (stroke.tool === "table") {
    const sx = w2sX(stroke.x);
    const sy = w2sY(stroke.y);
    const sw = (stroke.w || 220) * view.z;
    const hasStereotype = Boolean(stroke.stereotype);
    const headerH = (hasStereotype ? 36 : 28) * view.z;
    const rowH = 22 * view.z;
    const rows = stroke.rows || [];
    const totalH = headerH + Math.max(1, rows.length) * rowH;

    // Card background & border
    ctx.fillStyle = activeTheme.surface;
    ctx.fillRect(sx, sy, sw, totalH);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, (stroke.size || 2) * view.z);
    ctx.strokeRect(sx, sy, sw, totalH);

    // Header tint based on type or stereotype
    let tint = "rgba(100, 168, 255, 0.16)";
    if (stroke.stereotype === "interface") tint = "rgba(100, 200, 255, 0.18)";
    else if (stroke.stereotype === "service") tint = "rgba(180, 140, 232, 0.18)";
    else if (stroke.stereotype === "entity") tint = "rgba(116, 198, 157, 0.18)";
    else if (stroke.stereotype === "abstract") tint = "rgba(255, 181, 71, 0.18)";
    else if (stroke.stereotype === "controller") tint = "rgba(255, 92, 80, 0.18)";
    else if (stroke.type === "uml") tint = "rgba(180, 140, 232, 0.16)";

    ctx.fillStyle = tint;
    ctx.fillRect(sx, sy, sw, headerH);
    ctx.beginPath();
    ctx.moveTo(sx, sy + headerH);
    ctx.lineTo(sx + sw, sy + headerH);
    ctx.stroke();

    // Header title & stereotype
    if (hasStereotype) {
      const stFs = Math.max(8, 9.5 * view.z);
      ctx.font = `italic 500 ${stFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      ctx.fillStyle = stroke.color;
      ctx.fillText(`«${stroke.stereotype}»`, sx + 8 * view.z, sy + 11 * view.z);

      const titleFs = Math.max(10, 12 * view.z);
      ctx.font = `600 ${titleFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      ctx.fillText(stroke.title || "Class", sx + 8 * view.z, sy + 25 * view.z);
    } else {
      const titleFs = Math.max(10, 12 * view.z);
      ctx.font = `600 ${titleFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      ctx.fillStyle = stroke.color;
      const prefix = stroke.type === "uml" ? "«class» " : "🗄 ";
      ctx.fillText(prefix + (stroke.title || "Table"), sx + 8 * view.z, sy + headerH * 0.68);
    }

    // Rows
    const rowFs = Math.max(9, 11 * view.z);
    ctx.font = `400 ${rowFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowY = sy + headerH + (i + 0.72) * rowH;
      if (row.startsWith("---")) {
        ctx.strokeStyle = activeTheme.border;
        ctx.lineWidth = Math.max(0.5, 1 * view.z);
        ctx.beginPath();
        ctx.moveTo(sx, sy + headerH + i * rowH + 6 * view.z);
        ctx.lineTo(sx + sw, sy + headerH + i * rowH + 6 * view.z);
        ctx.stroke();
        continue;
      }
      if (row.startsWith("+")) ctx.fillStyle = "#74c69d";
      else if (row.startsWith("-")) ctx.fillStyle = "#ff5c50";
      else if (row.startsWith("#")) ctx.fillStyle = "#ffb547";
      else if (row.startsWith("~")) ctx.fillStyle = "#64a8ff";
      else ctx.fillStyle = activeTheme.text;
      ctx.fillText(row, sx + 10 * view.z, rowY);
    }
    ctx.restore();
    return;
  }

  // 3. Sequence Lifeline Activation Bar
  if (stroke.tool === "activation") {
    const sx = w2sX(stroke.x);
    const sy = w2sY(stroke.y);
    const sw = (stroke.w || 14) * view.z;
    const sh = (stroke.h || 60) * view.z;
    ctx.fillStyle = stroke.color + "33";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, (stroke.size || 1.5) * view.z);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.restore();
    return;
  }

  // 4. Combined Fragment Frame (alt / loop / opt / par)
  if (stroke.tool === "frame") {
    const x1 = w2sX(stroke.x1);
    const y1 = w2sY(stroke.y1);
    const x2 = w2sX(stroke.x2);
    const y2 = w2sY(stroke.y2);
    const fx = Math.min(x1, x2);
    const fy = Math.min(y1, y2);
    const fw = Math.abs(x2 - x1);
    const fh = Math.abs(y2 - y1);

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, (stroke.size || 1.5) * view.z);
    ctx.strokeRect(fx, fy, fw, fh);

    const tag = stroke.tag || "alt";
    const tabFs = Math.max(9, 10.5 * view.z);
    ctx.font = `600 ${tabFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    const tagW = ctx.measureText(tag).width;
    const tabW = tagW + 16 * view.z;
    const tabH = 18 * view.z;
    const notch = 6 * view.z;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + tabW, fy);
    ctx.lineTo(fx + tabW + notch, fy + tabH * 0.5);
    ctx.lineTo(fx + tabW, fy + tabH);
    ctx.lineTo(fx, fy + tabH);
    ctx.closePath();
    ctx.fillStyle = stroke.color + "22";
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = stroke.color;
    ctx.fillText(tag, fx + 6 * view.z, fy + 13 * view.z);

    if (stroke.guard) {
      const guardFs = Math.max(9, 10.5 * view.z);
      ctx.font = `italic 500 ${guardFs}px "JetBrains Mono", monospace`;
      ctx.fillStyle = activeTheme.text;
      ctx.fillText(`[${stroke.guard}]`, fx + tabW + notch + 8 * view.z, fy + 13 * view.z);
    }

    if (stroke.dividerY) {
      const divY = w2sY(stroke.dividerY);
      ctx.beginPath();
      ctx.setLineDash([6 * view.z, 4 * view.z]);
      ctx.moveTo(fx, divY);
      ctx.lineTo(fx + fw, divY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (stroke.elseGuard) {
        const guardFs = Math.max(9, 10.5 * view.z);
        ctx.font = `italic 500 ${guardFs}px "JetBrains Mono", monospace`;
        ctx.fillStyle = activeTheme.text;
        ctx.fillText(`[${stroke.elseGuard}]`, fx + 10 * view.z, divY + 14 * view.z);
      }
    }
    ctx.restore();
    return;
  }

  // 5. UML Relationship Connector
  if (stroke.tool === "uml-rel") {
    const x1 = w2sX(stroke.x1);
    const y1 = w2sY(stroke.y1);
    const x2 = w2sX(stroke.x2);
    const y2 = w2sY(stroke.y2);
    const relType = stroke.relType || "association";
    const isDashed = relType === "realization" || relType === "dependency";

    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = Math.max(1, (stroke.size || 1.8) * view.z);

    if (isDashed) ctx.setLineDash([8 * view.z, 5 * view.z]);
    else ctx.setLineDash([]);

    const ang = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(10, 14 * view.z);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (relType === "inheritance" || relType === "realization") {
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(ang - Math.PI / 6), y2 - headLen * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(ang + Math.PI / 6), y2 - headLen * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = activeTheme.bg;
      ctx.fill();
      ctx.stroke();
    } else if (relType === "composition") {
      const dLen = headLen * 0.9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dLen * Math.cos(ang - Math.PI / 6), y1 + dLen * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x1 + dLen * 1.73 * Math.cos(ang), y1 + dLen * 1.73 * Math.sin(ang));
      ctx.lineTo(x1 + dLen * Math.cos(ang + Math.PI / 6), y1 + dLen * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = stroke.color;
      ctx.fill();
      ctx.stroke();
    } else if (relType === "aggregation") {
      const dLen = headLen * 0.9;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dLen * Math.cos(ang - Math.PI / 6), y1 + dLen * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x1 + dLen * 1.73 * Math.cos(ang), y1 + dLen * 1.73 * Math.sin(ang));
      ctx.lineTo(x1 + dLen * Math.cos(ang + Math.PI / 6), y1 + dLen * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = activeTheme.bg;
      ctx.fill();
      ctx.stroke();
    } else if (relType === "dependency" || relType === "association") {
      ctx.beginPath();
      ctx.moveTo(x2 - headLen * Math.cos(ang - Math.PI / 6), y2 - headLen * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(ang + Math.PI / 6), y2 - headLen * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
    }

    if (stroke.label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const fs = Math.max(9, 10.5 * view.z);
      ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
      const textW = ctx.measureText(stroke.label).width;
      ctx.fillStyle = activeTheme.panelBg || "rgba(14, 18, 24, 0.9)";
      ctx.fillRect(mx - textW / 2 - 4 * view.z, my - 8 * view.z, textW + 8 * view.z, 16 * view.z);
      ctx.strokeStyle = activeTheme.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - textW / 2 - 4 * view.z, my - 8 * view.z, textW + 8 * view.z, 16 * view.z);
      ctx.fillStyle = activeTheme.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stroke.label, mx, my);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    return;
  }

  // 6. Vector Shapes
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
    } else if (stroke.tool === "diamond") {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.moveTo(mx, y1);
      ctx.lineTo(x2, my);
      ctx.lineTo(mx, y2);
      ctx.lineTo(x1, my);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.tool === "cylinder") {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.min(18, Math.abs(y2 - y1) * 0.18) * view.z;
      const cx = (x1 + x2) / 2;
      ctx.ellipse(cx, y1 + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1 + ry);
      ctx.lineTo(x1, y2 - ry);
      ctx.moveTo(x2, y1 + ry);
      ctx.lineTo(x2, y2 - ry);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, y2 - ry, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // 4. Freehand Paths
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
      (n, st) => n + (st.points ? st.points.length : st.tool === "table" ? (st.rows?.length || 1) : 2),
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
  const sbDash = document.getElementById("sb-dash");
  if (sbDash) {
    sbDash.textContent = lineDashed ? "LINE: DASHED" : "LINE: SOLID";
    sbDash.classList.toggle("on", lineDashed);
  }
}

function persist() {
  chrome.storage.local.set({ [STORE]: { strokes, view } });
  statusbar(true);
}

function load() {
  chrome.storage.local.get([STORE, PREFS_STORE, "lapdraw:theme"], (store) => {
    const data = store[STORE];
    if (data && Array.isArray(data.strokes)) {
      strokes = data.strokes;
      if (data.view) view = data.view;
    }
    const prefs = store[PREFS_STORE];
    if (prefs) {
      if (typeof prefs.smartAssist === "boolean") smartAssist = prefs.smartAssist;
      if (typeof prefs.gridSnap === "boolean") gridSnap = prefs.gridSnap;
      if (typeof prefs.lineDashed === "boolean") lineDashed = prefs.lineDashed;
    }
    const savedTheme = store["lapdraw:theme"] || localStorage.getItem("lapdraw:theme") || "omarchy";
    applyTheme(savedTheme, false);
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
  const dashBtn = document.getElementById("toggleDash");
  if (dashBtn) dashBtn.classList.toggle("toggle-on", lineDashed);
  statusbar(true);
}

function toggleSmartAssist() {
  smartAssist = !smartAssist;
  chrome.storage.local.set({ [PREFS_STORE]: { smartAssist, gridSnap, lineDashed } });
  syncToggles();
  toast(smartAssist ? "Smart Shape Assist ON" : "Smart Assist OFF (Freehand)");
}

function toggleGridSnap() {
  gridSnap = !gridSnap;
  chrome.storage.local.set({ [PREFS_STORE]: { smartAssist, gridSnap, lineDashed } });
  syncToggles();
  toast(gridSnap ? "Grid Snap ON (16px)" : "Grid Snap OFF");
}

function toggleLineDash() {
  lineDashed = !lineDashed;
  chrome.storage.local.set({ [PREFS_STORE]: { smartAssist, gridSnap, lineDashed } });
  syncToggles();
  toast(lineDashed ? "Line Style: DASHED" : "Line Style: SOLID");
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

let activeTextEditor = null;

function hitTestText(wx, wy) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (s.tool !== "text") continue;
    const fs = s.fontSize || Math.max(12, (s.size || 4) * 3);
    const lines = (s.text || "").split("\n");
    const maxLen = Math.max(1, ...lines.map((l) => l.length));
    const padX = s.card ? 10 : 0;
    const padY = s.card ? 8 : 0;
    const badgeH = s.badge ? 18 : 0;
    const w = maxLen * fs * 0.65 + padX * 2;
    const h = lines.length * fs * 1.4 + padY * 2 + badgeH;
    if (wx >= s.x - 4 && wx <= s.x + w + 8 && wy >= s.y - 4 && wy <= s.y + h + 8) {
      return { stroke: s, index: i };
    }
  }
  return null;
}

function commitActiveText() {
  if (!activeTextEditor) return;
  const { el, worldX, worldY, getData } = activeTextEditor;
  const data = getData();
  const trimmed = data.text.trim();
  if (trimmed) {
    strokes.push({
      tool: "text",
      color: data.color,
      fontSize: data.fontSize,
      size: Math.max(1, Math.round(data.fontSize / 3)),
      card: data.card,
      badge: data.badge || null,
      x: worldX,
      y: worldY,
      text: data.text
    });
    redraw();
    persist();
    toast(data.card ? "Saved code card" : "Saved text note");
  }
  el.remove();
  activeTextEditor = null;
}

function cancelActiveText(restoreStroke = null) {
  if (!activeTextEditor) return;
  const { el } = activeTextEditor;
  if (restoreStroke) {
    strokes.push(restoreStroke);
    redraw();
    persist();
  }
  el.remove();
  activeTextEditor = null;
}

function handleTextClick(e) {
  const wx = s2wX(e.clientX);
  const wy = s2wY(e.clientY);

  if (activeTextEditor) {
    commitActiveText();
  }

  // Check if clicked an existing text stroke to edit it
  const hit = hitTestText(wx, wy);
  if (hit) {
    const oldStroke = strokes.splice(hit.index, 1)[0];
    redraw();
    persist();
    spawnTextEditor(e.clientX, e.clientY, oldStroke.x, oldStroke.y, oldStroke);
    return;
  }

  const placeX = snapCoord(wx);
  const placeY = snapCoord(wy);
  spawnTextEditor(e.clientX, e.clientY, placeX, placeY, null);
}

function spawnTextEditor(screenX, screenY, worldX, worldY, initialData = null) {
  if (activeTextEditor) commitActiveText();

  const container = document.createElement("div");
  container.className = "canvas-text-editor";

  // Prevent clicks inside editor from propagating to canvas
  container.addEventListener("pointerdown", (e) => e.stopPropagation());
  container.addEventListener("mousedown", (e) => e.stopPropagation());
  container.addEventListener("click", (e) => e.stopPropagation());

  // Viewport clamping
  const editorW = 320;
  const editorH = 170;
  const left = Math.min(window.innerWidth - editorW - 16, Math.max(16, screenX - 10));
  const top = Math.min(window.innerHeight - editorH - 16, Math.max(16, screenY - 24));
  container.style.left = `${left}px`;
  container.style.top = `${top}px`;

  // State
  let curFontSize = initialData?.fontSize || (settings.size <= 2 ? 14 : settings.size <= 4 ? 18 : settings.size <= 8 ? 24 : 30);
  let isCard = initialData ? !!initialData.card : false;
  let curBadge = initialData?.badge || "";
  let curColor = initialData?.color || settings.color;

  // 1. Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "text-editor-toolbar";

  // Size pills
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "text-editor-group";
  const SIZES = [
    { label: "SM", val: 12 },
    { label: "MD", val: 16 },
    { label: "LG", val: 22 },
    { label: "XL", val: 30 }
  ];
  const sizeBtns = SIZES.map(({ label, val }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-editor-chip" + (Math.abs(curFontSize - val) <= 2 ? " active" : "");
    b.textContent = label;
    b.title = `${val}px font`;
    b.onclick = () => {
      curFontSize = val;
      sizeBtns.forEach((btn) => btn.classList.remove("active"));
      b.classList.add("active");
      area.style.fontSize = `${Math.min(18, Math.max(11, val))}px`;
    };
    sizeGroup.appendChild(b);
    return b;
  });

  // Code Card Toggle
  const cardBtn = document.createElement("button");
  cardBtn.type = "button";
  cardBtn.className = "text-editor-chip" + (isCard ? " active" : "");
  cardBtn.textContent = "{ CODE }";
  cardBtn.title = "Format as dark terminal code card";
  cardBtn.onclick = () => {
    isCard = !isCard;
    cardBtn.classList.toggle("active", isCard);
  };

  // Badge Selector
  const badgeSelect = document.createElement("select");
  badgeSelect.className = "text-editor-select";
  badgeSelect.title = "Developer callout tag";
  const BADGES = ["TAG", "TODO", "FIXME", "NOTE", "API", "DB", "WARN", "BUG"];
  for (const bg of BADGES) {
    const opt = document.createElement("option");
    opt.value = bg === "TAG" ? "" : bg;
    opt.textContent = bg;
    if ((initialData?.badge || "").toUpperCase() === bg) opt.selected = true;
    badgeSelect.appendChild(opt);
  }
  badgeSelect.onchange = () => {
    curBadge = badgeSelect.value;
  };

  toolbar.appendChild(sizeGroup);
  toolbar.appendChild(cardBtn);
  toolbar.appendChild(badgeSelect);
  container.appendChild(toolbar);

  // 2. Textarea
  const area = document.createElement("textarea");
  area.className = "text-editor-area";
  area.placeholder = "Type note, code snippet, or markdown…\nShift+Enter: newline\nTab: indent\nEnter: save";
  area.value = initialData?.text || "";
  area.style.fontSize = `${Math.min(18, Math.max(11, curFontSize))}px`;
  area.style.color = curColor;

  const autoGrow = () => {
    area.style.height = "auto";
    area.style.height = Math.max(56, Math.min(220, area.scrollHeight + 4)) + "px";
  };
  area.addEventListener("input", autoGrow);

  // Tab key indent & Enter commit
  area.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = area.selectionStart;
      const end = area.selectionEnd;
      area.value = area.value.substring(0, s) + "  " + area.value.substring(end);
      area.selectionStart = area.selectionEnd = s + 2;
      autoGrow();
    } else if (e.key === "Enter") {
      if (e.ctrlKey || e.metaKey || (!e.shiftKey && !area.value.includes("\n"))) {
        e.preventDefault();
        commitActiveText();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelActiveText(initialData);
    }
  });

  container.appendChild(area);

  // 3. Footer
  const footer = document.createElement("div");
  footer.className = "text-editor-footer";

  const hint = document.createElement("span");
  hint.className = "text-editor-hint";
  hint.textContent = "↵ save · ⇧↵ line · ⇥ indent";
  footer.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "text-editor-actions";

  if (initialData) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "text-editor-btn del";
    delBtn.textContent = "DEL";
    delBtn.title = "Delete this text block";
    delBtn.onclick = () => {
      cancelActiveText(null);
      toast("Deleted text");
    };
    actions.appendChild(delBtn);
  }

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "text-editor-btn";
  cancelBtn.textContent = "ESC";
  cancelBtn.onclick = () => cancelActiveText(initialData);
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "text-editor-btn save";
  saveBtn.textContent = "SAVE";
  saveBtn.onclick = () => commitActiveText();
  actions.appendChild(saveBtn);

  footer.appendChild(actions);
  container.appendChild(footer);

  document.body.appendChild(container);
  autoGrow();

  setTimeout(() => {
    area.focus();
    if (initialData) {
      area.setSelectionRange(area.value.length, area.value.length);
    }
  }, 10);

  activeTextEditor = {
    el: container,
    worldX,
    worldY,
    getData: () => ({
      text: area.value,
      fontSize: curFontSize,
      card: isCard,
      badge: curBadge,
      color: curColor
    })
  };
}

function snapCoord(val) {
  return gridSnap && typeof LapDrawIntelligence !== "undefined"
    ? LapDrawIntelligence.snapToGridCoord(val)
    : val;
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2 || e.button === 1 || (spaceHeld && e.button === 0)) {
    startPan(e);
    return;
  }
  if (e.button !== 0) return;

  if (settings.tool === "text") {
    handleTextClick(e);
    return;
  }

  canvas.setPointerCapture(e.pointerId);

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
        shift: e.shiftKey,
        dashed: lineDashed
      }
    : {
        tool,
        color: settings.color,
        size: Number(sizeEl.value),
        points: [{ x: startWx, y: startWy }],
        isSnapped: false,
        dashed: lineDashed
      };

  last = null;
  holdAnchor = { x: e.clientX, y: e.clientY, time: Date.now() };

  clearTimeout(holdTimer);
  if (tool === "pen") {
    holdTimer = setTimeout(() => {
      triggerQuickShape();
    }, 450);
  }

  paintLive(e.clientX, e.clientY);
});

function constrainShape(s) {
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
        shift: false,
        dashed: lineDashed
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
  if (!current) {
    if (settings.tool === "text" && !panning) {
      const hit = hitTestText(s2wX(e.clientX), s2wY(e.clientY));
      canvas.style.cursor = hit ? "pointer" : "text";
    }
    return;
  }

  const curWx = snapCoord(s2wX(e.clientX));
  const curWy = snapCoord(s2wY(e.clientY));

  if (current.isSnapped || isShape(current.tool)) {
    current.x2 = curWx;
    current.y2 = curWy;
    current.shift = e.shiftKey;
    constrainShape(current);
    redraw();
    return;
  }

  if (holdAnchor) {
    const dist = Math.hypot(e.clientX - holdAnchor.x, e.clientY - holdAnchor.y);
    if (dist > 9) {
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

  if (current.points && current.points.length) {
    if (typeof LapDrawIntelligence !== "undefined") {
      current.points = LapDrawIntelligence.stripFishhook(current.points);
    }

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
          y2: recognized.y2,
          dashed: lineDashed
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

function normDelta(e) {
  const mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  return { dx: e.deltaX * mul, dy: e.deltaY * mul };
}

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
  if (current.dashed) ctx.setLineDash([8 * view.z, 5 * view.z]);

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
document.getElementById("toggleDash").addEventListener("click", toggleLineDash);

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
      "copy-mermaid": copyMermaidCode,
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

const openDocsBtn = document.getElementById("openDocsTab");
if (openDocsBtn) {
  openDocsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("docs/docs.html") });
  });
}
const openFullTutBtn = document.getElementById("openFullTutorial");
if (openFullTutBtn) {
  openFullTutBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tutorial/tutorial.html") });
  });
}

// ----- Developer Diagram Builder Modal -----
const diagModal = document.getElementById("diagModal");
const openDiagBtn = document.getElementById("openDiagModal");
const closeDiagBtn = document.getElementById("closeDiagModal");

function toggleDiagModal(show) {
  const next = typeof show === "boolean" ? show : diagModal.classList.contains("hidden");
  diagModal.classList.toggle("hidden", !next);
}

openDiagBtn.addEventListener("click", () => toggleDiagModal(true));
closeDiagBtn.addEventListener("click", () => toggleDiagModal(false));

diagModal.addEventListener("click", (e) => {
  if (e.target === diagModal) toggleDiagModal(false);
});

// Modal Tabs
document.querySelectorAll(".diag-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".diag-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".diag-pane").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const pane = document.getElementById(`pane-${tab.dataset.tab}`);
    if (pane) pane.classList.add("active");
  })
);


// Presets for DB, Sequence, UML & DSL
const PRESETS = {
  users: [
    "id: uuid [PK]",
    "email: varchar(255) [UNIQUE]",
    "password_hash: text",
    "role: varchar [DEFAULT 'member']",
    "created_at: timestamp"
  ],
  orders: [
    "id: uuid [PK]",
    "user_id: uuid [FK -> users.id]",
    "amount: numeric(10,2)",
    "status: varchar(32) [INDEX]",
    "created_at: timestamp"
  ],
  products: [
    "id: uuid [PK]",
    "sku: varchar(64) [UNIQUE]",
    "title: varchar(255)",
    "price: numeric(10,2)",
    "stock: int [DEFAULT 0]"
  ],
  sessions: [
    "id: varchar(128) [PK]",
    "user_id: uuid [FK]",
    "ip_address: inet",
    "expires_at: timestamp"
  ]
};

const SEQ_PRESETS = {
  auth: {
    actors: "Client, Gateway, AuthService, Database",
    messages: `Client -> Gateway: POST /login {email, pass}
Gateway -> AuthService: ValidateCredentials()
AuthService -> Database: SELECT user WHERE email
Database --> AuthService: user record
AuthService -> AuthService: VerifyPasswordHash(hash)
alt valid credentials
AuthService --> Gateway: 200 OK (JWT token)
Gateway --> Client: Set-Cookie: session_jwt
else invalid password
AuthService --> Gateway: 401 Unauthorized
Gateway --> Client: 401 Invalid Credentials
end`
  },
  payment: {
    actors: "Customer, CheckoutAPI, StripeAPI, OrderDB",
    messages: `Customer -> CheckoutAPI: POST /checkout {cart_id}
CheckoutAPI -> StripeAPI: CreatePaymentIntent(amount)
StripeAPI --> CheckoutAPI: 200 OK (intent_id)
CheckoutAPI -> OrderDB: INSERT INTO orders (user_id, status)
OrderDB --> CheckoutAPI: order_id: 9481
CheckoutAPI --> Customer: 200 Order Confirmed #{order_id}`
  },
  ws: {
    actors: "Client, LoadBalancer, WSGateway, RedisPubSub",
    messages: `Client -> LoadBalancer: GET /chat/ws (Upgrade)
LoadBalancer -> WSGateway: Connection: Upgrade
WSGateway --> Client: 101 Switching Protocols
Client -> WSGateway: WS_SEND {room: "dev", msg: "Hello"}
WSGateway -> RedisPubSub: PUBLISH chat.dev {msg}
RedisPubSub --> WSGateway: MESSAGE {msg: "Hey!"}
WSGateway --> Client: WS_FRAME {msg: "Hey!"}`
  },
  cache: {
    actors: "APIHandler, RedisCache, PostgreSQL",
    messages: `APIHandler -> RedisCache: GET user:1001
alt cache hit
RedisCache --> APIHandler: cached_json {id: 1001}
else cache miss
RedisCache --> APIHandler: nil
APIHandler -> PostgreSQL: SELECT * FROM users WHERE id = 1001
PostgreSQL --> APIHandler: user_row
APIHandler -> RedisCache: SETEX user:1001 3600 json
end`
  }
};

const UML_PRESETS = {
  service: {
    name: "UserService",
    stereotype: "service",
    attrs: "- db: DatabasePool\n- cache: RedisClient\n- logger: Logger",
    methods: "+ register(dto: CreateUserDto): Promise<User>\n+ login(creds: Credentials): Promise<AuthToken>\n+ getProfile(userId: UUID): Promise<UserProfile>"
  },
  interface: {
    name: "IUserRepository",
    stereotype: "interface",
    attrs: "",
    methods: "+ findById(id: UUID): Promise<User | null>\n+ findByEmail(email: string): Promise<User | null>\n+ create(user: NewUser): Promise<User>\n+ delete(id: UUID): Promise<boolean>"
  },
  entity: {
    name: "UserEntity",
    stereotype: "entity",
    attrs: "+ id: UUID\n+ email: string\n+ passwordHash: string\n+ role: UserRole\n+ createdAt: Date",
    methods: "+ verifyPassword(plain: string): boolean\n+ toPublicDto(): UserPublicDto"
  },
  controller: {
    name: "AuthController",
    stereotype: "controller",
    attrs: "- userService: UserService\n- rateLimiter: RateLimiter",
    methods: "+ handleLogin(req: Request, res: Response): Promise<void>\n+ handleRegister(req: Request, res: Response): Promise<void>"
  }
};

const DSL_PRESETS = {
  seq: `sequence:
participant Client
participant Gateway
participant AuthService
participant Database

Client -> Gateway: POST /api/login
Gateway -> AuthService: Authenticate(credentials)
AuthService -> Database: SELECT * FROM users WHERE email
Database --> AuthService: user_record
alt valid password
AuthService --> Gateway: 200 OK + JWT Token
Gateway --> Client: 200 Set-Cookie: token
else invalid password
AuthService --> Gateway: 401 Unauthorized
Gateway --> Client: 401 Invalid Credentials
end`,

  uml: `class UserService <<service>> {
  - db: DatabasePool
  - cache: CacheClient
  + register(dto): User
  + authenticate(email, pass): Token
}

class IUserRepository <<interface>> {
  + findByEmail(email): User
  + save(user): void
}

class User <<entity>> {
  + id: UUID
  + email: string
  + role: string
}

UserService ..> IUserRepository : depends
UserService --> User : manages`,

  flow: `flow:
[Client App] -> [Cloudflare CDN] : HTTPS
[Cloudflare CDN] -> [API Gateway] : Proxy
[API Gateway] -> [Auth Service] : Validate Token
[Auth Service] -> [(Postgres DB)] : SQL Query
[API Gateway] -> [(Redis Cache)] : Cache Lookup`
};

// Preset button handlers
document.querySelectorAll(".preset-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.preset;
    document.getElementById("dbTableName").value = key;
    if (PRESETS[key]) {
      document.getElementById("dbColumns").value = PRESETS[key].join("\n");
    }
  })
);

document.querySelectorAll(".seq-preset-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.seqPreset;
    const p = SEQ_PRESETS[key];
    if (p) {
      document.getElementById("seqActors").value = p.actors;
      document.getElementById("seqMessages").value = p.messages;
    }
  })
);

document.querySelectorAll(".uml-preset-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.umlPreset;
    const p = UML_PRESETS[key];
    if (p) {
      document.getElementById("umlClassName").value = p.name;
      document.getElementById("umlStereotype").value = p.stereotype;
      document.getElementById("umlAttributes").value = p.attrs;
      document.getElementById("umlMethods").value = p.methods;
    }
  })
);

document.querySelectorAll(".dsl-preset-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    const key = btn.dataset.dslPreset;
    if (DSL_PRESETS[key]) {
      document.getElementById("dslInput").value = DSL_PRESETS[key];
    }
  })
);

// 1. Insert DB Table Card
document.getElementById("insertDbTable").addEventListener("click", () => {
  const title = document.getElementById("dbTableName").value.trim() || "table";
  const rows = document
    .getElementById("dbColumns")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const maxLen = Math.max(title.length + 4, ...rows.map((r) => r.length));
  const cardW = Math.max(220, maxLen * 9.5);
  const cx = s2wX(window.innerWidth / 2) - cardW / 2;
  const cy = s2wY(window.innerHeight / 2) - 80;

  strokes.push({
    tool: "table",
    color: "#64a8ff",
    size: 2,
    x: snapCoord(cx),
    y: snapCoord(cy),
    w: cardW,
    title,
    type: "db",
    rows
  });

  toggleDiagModal(false);
  redraw();
  persist();
  toast(`Inserted DB Table: ${title}`);
});

// 2. Generate Sequence Diagram (with Activations, Frames & Self-calls)
document.getElementById("insertSeqDiagram").addEventListener("click", () => {
  const actors = document
    .getElementById("seqActors")
    .value.split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const rawLines = document
    .getElementById("seqMessages")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!actors.length) return;

  const enableActivations = Boolean(document.getElementById("seqEnableActivations")?.checked);
  const spacing = 190;
  const startX = s2wX(window.innerWidth / 2) - ((actors.length - 1) * spacing) / 2;
  const startY = s2wY(window.innerHeight / 2) - 180;
  const actorPositions = {};
  const boxW = 120;
  const boxH = 34;

  let currentY = startY + boxH + 45;
  const activeFrames = [];

  // Create Actor Boxes & Lifelines placeholder
  actors.forEach((name, i) => {
    const ax = snapCoord(startX + i * spacing);
    const ay = snapCoord(startY);
    actorPositions[name] = ax + boxW / 2;

    strokes.push({
      tool: "rect",
      color: "#b48ce8",
      size: 2,
      x1: ax,
      y1: ay,
      x2: ax + boxW,
      y2: ay + boxH
    });

    strokes.push({
      tool: "text",
      color: "#e6e9ee",
      size: 3,
      x: ax + 14,
      y: ay + 22,
      text: name
    });
  });

  // Parse lines: messages, self-calls, and frames
  rawLines.forEach((line) => {
    // Frame tags: alt, loop, opt, else, end
    const frameMatch = line.match(/^(alt|loop|opt)\s*(.*)$/i);
    if (frameMatch) {
      const tag = frameMatch[1].toLowerCase();
      const guard = frameMatch[2].replace(/^\[|\]$/g, "").trim();
      activeFrames.push({
        tag,
        guard,
        startY: currentY - 14,
        dividerY: null,
        elseGuard: ""
      });
      currentY += 26;
      return;
    }

    if (line.match(/^else\s*(.*)$/i)) {
      const elseMatch = line.match(/^else\s*(.*)$/i);
      const topFrame = activeFrames[activeFrames.length - 1];
      if (topFrame) {
        topFrame.dividerY = currentY;
        topFrame.elseGuard = elseMatch[1].replace(/^\[|\]$/g, "").trim() || "else";
        currentY += 26;
      }
      return;
    }

    if (line.toLowerCase() === "end") {
      const finished = activeFrames.pop();
      if (finished) {
        const minActorX = actorPositions[actors[0]] - 30;
        const maxActorX = actorPositions[actors[actors.length - 1]] + 30;
        strokes.push({
          tool: "frame",
          color: "#b48ce8",
          size: 1.5,
          x1: minActorX,
          y1: finished.startY,
          x2: maxActorX,
          y2: currentY + 14,
          tag: finished.tag,
          guard: finished.guard,
          dividerY: finished.dividerY,
          elseGuard: finished.elseGuard
        });
        currentY += 24;
      }
      return;
    }

    // Message Arrow: A -> B: msg or B --> A: return
    const msgMatch = line.match(/^([A-Za-z0-9_-]+)\s*(-+>)\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!msgMatch) return;
    const [, from, arrowType, to, msg] = msgMatch;
    const fromX = actorPositions[from];
    const toX = actorPositions[to];
    if (fromX === undefined || toX === undefined) return;

    const isReply = arrowType.includes("--");

    // Self-call loop
    if (from === to) {
      const loopW = 34;
      const loopH = 26;
      strokes.push({
        tool: "line",
        color: "#ffb547",
        size: 2,
        x1: fromX,
        y1: currentY,
        x2: fromX + loopW,
        y2: currentY
      });
      strokes.push({
        tool: "line",
        color: "#ffb547",
        size: 2,
        x1: fromX + loopW,
        y1: currentY,
        x2: fromX + loopW,
        y2: currentY + loopH
      });
      strokes.push({
        tool: "arrow",
        color: "#ffb547",
        size: 2,
        x1: fromX + loopW,
        y1: currentY + loopH,
        x2: fromX,
        y2: currentY + loopH
      });
      strokes.push({
        tool: "text",
        color: "#e6e9ee",
        size: 2.5,
        x: fromX + 8,
        y: currentY - 8,
        text: msg
      });
      currentY += loopH + 34;
      return;
    }

    // Regular Arrow
    strokes.push({
      tool: "arrow",
      color: isReply ? "#74c69d" : "#ffb547",
      size: 2,
      x1: fromX,
      y1: currentY,
      x2: toX,
      y2: currentY,
      dashed: isReply
    });

    // Activation specification bar
    if (enableActivations && !isReply) {
      strokes.push({
        tool: "activation",
        color: "#64a8ff",
        size: 1.5,
        x: toX - 7,
        y: currentY - 2,
        w: 14,
        h: 46
      });
    }

    // Arrow text label
    const labelX = Math.min(fromX, toX) + 12;
    strokes.push({
      tool: "text",
      color: "#e6e9ee",
      size: 2.5,
      x: labelX,
      y: currentY - 8,
      text: msg
    });

    currentY += 48;
  });

  // Close any unclosed frames
  while (activeFrames.length > 0) {
    const finished = activeFrames.pop();
    const minActorX = actorPositions[actors[0]] - 30;
    const maxActorX = actorPositions[actors[actors.length - 1]] + 30;
    strokes.push({
      tool: "frame",
      color: "#b48ce8",
      size: 1.5,
      x1: minActorX,
      y1: finished.startY,
      x2: maxActorX,
      y2: currentY + 10,
      tag: finished.tag,
      guard: finished.guard,
      dividerY: finished.dividerY,
      elseGuard: finished.elseGuard
    });
  }

  // Draw lifelines down to the final Y
  const totalSeqH = Math.max(260, currentY - startY + 40);
  actors.forEach((name) => {
    const lx = actorPositions[name];
    strokes.push({
      tool: "line",
      color: "#77828e",
      size: 1.5,
      x1: lx,
      y1: startY + boxH,
      x2: lx,
      y2: startY + totalSeqH,
      dashed: true
    });
  });

  toggleDiagModal(false);
  fitContent();
  redraw();
  persist();
  toast(`Generated Sequence Diagram (${actors.length} lifelines)`);
});

// 3. Insert UML Class (with Stereotypes)
document.getElementById("insertUmlClass").addEventListener("click", () => {
  const className = document.getElementById("umlClassName").value.trim() || "Class";
  const stereotype = document.getElementById("umlStereotype").value;
  const attrs = document
    .getElementById("umlAttributes")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const methods = document
    .getElementById("umlMethods")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = [...attrs];
  if (methods.length) {
    if (rows.length) rows.push("--- methods ---");
    rows.push(...methods);
  }

  const maxLen = Math.max(className.length + 8, ...rows.map((r) => r.length));
  const cardW = Math.max(220, maxLen * 9);
  const cx = s2wX(window.innerWidth / 2) - cardW / 2;
  const cy = s2wY(window.innerHeight / 2) - 80;

  strokes.push({
    tool: "table",
    color: stereotype === "entity" ? "#74c69d" : stereotype === "service" ? "#b48ce8" : stereotype === "interface" ? "#64a8ff" : "#ffb547",
    size: 2,
    x: snapCoord(cx),
    y: snapCoord(cy),
    w: cardW,
    title: className,
    stereotype,
    type: "uml",
    rows
  });

  toggleDiagModal(false);
  redraw();
  persist();
  toast(`Inserted UML Class: «${stereotype}» ${className}`);
});

// 3b. Connect UML Classes
document.getElementById("insertUmlRel").addEventListener("click", () => {
  const fromName = document.getElementById("umlRelFrom").value.trim().toLowerCase();
  const toName = document.getElementById("umlRelTo").value.trim().toLowerCase();
  const relType = document.getElementById("umlRelType").value;
  const label = document.getElementById("umlRelLabel").value.trim();

  // Find the matching class tables
  const fromClass = strokes.find(
    (s) => s.tool === "table" && (s.title || "").toLowerCase() === fromName
  );
  const toClass = strokes.find(
    (s) => s.tool === "table" && (s.title || "").toLowerCase() === toName
  );

  let x1, y1, x2, y2;
  if (fromClass && toClass) {
    const fromCenter = { x: fromClass.x + (fromClass.w || 220) / 2, y: fromClass.y + 40 };
    const toCenter = { x: toClass.x + (toClass.w || 220) / 2, y: toClass.y + 40 };

    if (Math.abs(fromCenter.x - toCenter.x) > Math.abs(fromCenter.y - toCenter.y)) {
      // Connect horizontally
      if (fromCenter.x < toCenter.x) {
        x1 = fromClass.x + (fromClass.w || 220);
        y1 = fromCenter.y;
        x2 = toClass.x;
        y2 = toCenter.y;
      } else {
        x1 = fromClass.x;
        y1 = fromCenter.y;
        x2 = toClass.x + (toClass.w || 220);
        y2 = toCenter.y;
      }
    } else {
      // Connect vertically
      if (fromCenter.y < toCenter.y) {
        x1 = fromCenter.x;
        y1 = fromClass.y + 80;
        x2 = toCenter.x;
        y2 = toClass.y;
      } else {
        x1 = fromCenter.x;
        y1 = fromClass.y;
        x2 = toCenter.x;
        y2 = toClass.y + 80;
      }
    }
  } else {
    // Default fallback line across screen
    x1 = s2wX(window.innerWidth / 2) - 140;
    y1 = s2wY(window.innerHeight / 2);
    x2 = s2wX(window.innerWidth / 2) + 140;
    y2 = s2wY(window.innerHeight / 2);
  }

  strokes.push({
    tool: "uml-rel",
    relType,
    color: "#b48ce8",
    size: 2,
    x1,
    y1,
    x2,
    y2,
    label
  });

  toggleDiagModal(false);
  redraw();
  persist();
  toast(`Connected: ${fromName} ${relType} ${toName}`);
});

// 4. System Architecture Templates
document.querySelectorAll(".tpl-card").forEach((card) =>
  card.addEventListener("click", () => {
    const tplKey = card.dataset.tpl;
    insertArchTemplate(tplKey);
  })
);

function insertArchTemplate(key) {
  const cx = snapCoord(s2wX(window.innerWidth / 2));
  const cy = snapCoord(s2wY(window.innerHeight / 2));

  if (key === "oauth2") {
    // OAuth2 PKCE Flow with Alt Frame
    const actors = ["Browser", "SPA Client", "Auth0 IdP", "Resource API"];
    const spacing = 210;
    const sX = cx - (spacing * 3) / 2;
    const sY = cy - 180;
    const p = {};

    actors.forEach((act, i) => {
      const ax = sX + i * spacing;
      p[act] = ax;
      strokes.push({ tool: "rect", color: "#b48ce8", size: 2, x1: ax - 60, y1: sY, x2: ax + 60, y2: sY + 34 });
      strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: ax - 45, y: sY + 22, text: act });
      strokes.push({ tool: "line", color: "#77828e", size: 1.5, x1: ax, y1: sY + 34, x2: ax, y2: sY + 460, dashed: true });
    });

    const msgs = [
      { f: "Browser", t: "SPA Client", m: "1. Click Login", reply: false, y: sY + 70 },
      { f: "SPA Client", t: "Auth0 IdP", m: "2. GET /authorize (PKCE Challenge)", reply: false, y: sY + 110 },
      { f: "Auth0 IdP", t: "Browser", m: "3. 302 Redirect to Universal Login", reply: true, y: sY + 150 },
      { f: "Browser", t: "Auth0 IdP", m: "4. Submit Credentials + MFA", reply: false, y: sY + 190 },
      { f: "Auth0 IdP", t: "SPA Client", m: "5. 302 Redirect with Auth Code", reply: true, y: sY + 230 },
      { f: "SPA Client", t: "Auth0 IdP", m: "6. POST /oauth/token (Code + Verifier)", reply: false, y: sY + 270 },
      { f: "Auth0 IdP", t: "SPA Client", m: "7. 200 OK {access_token, id_token}", reply: true, y: sY + 310 },
      { f: "SPA Client", t: "Resource API", m: "8. GET /api/data (Bearer JWT)", reply: false, y: sY + 350 },
      { f: "Resource API", t: "SPA Client", m: "9. 200 OK JSON {profile_data}", reply: true, y: sY + 410 }
    ];

    msgs.forEach((msg) => {
      strokes.push({ tool: "arrow", color: msg.reply ? "#74c69d" : "#ffb547", size: 2, x1: p[msg.f], y1: msg.y, x2: p[msg.t], y2: msg.y, dashed: msg.reply });
      strokes.push({ tool: "text", color: "#e6e9ee", size: 2.5, x: Math.min(p[msg.f], p[msg.t]) + 14, y: msg.y - 8, text: msg.m });
    });

    // Activation bars
    strokes.push({ tool: "activation", color: "#64a8ff", size: 1.5, x: p["Auth0 IdP"] - 7, y: sY + 105, w: 14, h: 55 });
    strokes.push({ tool: "activation", color: "#64a8ff", size: 1.5, x: p["Auth0 IdP"] - 7, y: sY + 265, w: 14, h: 55 });
    strokes.push({ tool: "activation", color: "#64a8ff", size: 1.5, x: p["Resource API"] - 7, y: sY + 345, w: 14, h: 75 });

    // Alt frame
    strokes.push({
      tool: "frame",
      color: "#b48ce8",
      size: 1.5,
      x1: p["SPA Client"] - 25,
      y1: sY + 335,
      x2: p["Resource API"] + 35,
      y2: sY + 440,
      tag: "alt",
      guard: "valid JWT token"
    });
  } else if (key === "microservices") {
    // Event-Driven Pub/Sub Microservices
    strokes.push({ tool: "rect", color: "#64a8ff", size: 2, x1: cx - 340, y1: cy - 40, x2: cx - 200, y2: cy + 40 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx - 330, y: cy - 2, text: "API Gateway\n:4000" });

    strokes.push({ tool: "rect", color: "#74c69d", size: 2, x1: cx - 120, y1: cy - 40, x2: cx + 20, y2: cy + 40 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx - 110, y: cy - 2, text: "Order Service\n:5001" });

    strokes.push({ tool: "ellipse", color: "#ffb547", size: 2, x1: cx + 100, y1: cy - 45, x2: cx + 250, y2: cy + 45 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.8, x: cx + 115, y: cy - 2, text: "Kafka Topic\norder.created" });

    strokes.push({ tool: "rect", color: "#b48ce8", size: 2, x1: cx + 330, y1: cy - 120, x2: cx + 480, y2: cy - 50 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx + 340, y: cy - 90, text: "Inventory Svc\n:5002" });

    strokes.push({ tool: "rect", color: "#b48ce8", size: 2, x1: cx + 330, y1: cy - 30, x2: cx + 480, y2: cy + 40 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx + 340, y: cy, text: "Payment Svc\n:5003" });

    strokes.push({ tool: "rect", color: "#b48ce8", size: 2, x1: cx + 330, y1: cy + 60, x2: cx + 480, y2: cy + 130 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx + 340, y: cy + 90, text: "Notify Svc\n:5004" });

    strokes.push({ tool: "cylinder", color: "#64a8ff", size: 2, x1: cx - 120, y1: cy + 100, x2: cx + 20, y2: cy + 180 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: cx - 105, y: cy + 145, text: "PostgreSQL\norders_db" });

    // Connectors
    strokes.push({ tool: "arrow", color: "#64a8ff", size: 2, x1: cx - 200, y1: cy, x2: cx - 120, y2: cy });
    strokes.push({ tool: "arrow", color: "#74c69d", size: 2, x1: cx + 20, y1: cy, x2: cx + 100, y2: cy });
    strokes.push({ tool: "arrow", color: "#ffb547", size: 2, x1: cx + 250, y1: cy - 20, x2: cx + 330, y2: cy - 85 });
    strokes.push({ tool: "arrow", color: "#ffb547", size: 2, x1: cx + 250, y1: cy, x2: cx + 330, y2: cy + 5 });
    strokes.push({ tool: "arrow", color: "#ffb547", size: 2, x1: cx + 250, y1: cy + 20, x2: cx + 330, y2: cy + 95 });
    strokes.push({ tool: "arrow", color: "#64a8ff", size: 2, x1: cx - 50, y1: cy + 40, x2: cx - 50, y2: cy + 100 });
  } else if (key === "clean-arch") {
    // Clean / Hexagonal Architecture concentric rings
    strokes.push({ tool: "rect", color: "#ffb547", size: 2, x1: cx - 300, y1: cy - 200, x2: cx + 300, y2: cy + 200 });
    strokes.push({ tool: "text", color: "#ffb547", size: 3, x: cx - 280, y: cy - 180, text: "FRAMEWORKS & DRIVERS (Web, DB, UI, External APIs)" });

    strokes.push({ tool: "rect", color: "#b48ce8", size: 2, x1: cx - 220, y1: cy - 140, x2: cx + 220, y2: cy + 140 });
    strokes.push({ tool: "text", color: "#b48ce8", size: 3, x: cx - 200, y: cy - 120, text: "INTERFACE ADAPTERS (Controllers, Presenters, Gateways)" });

    strokes.push({ tool: "rect", color: "#64a8ff", size: 2, x1: cx - 150, y1: cy - 80, x2: cx + 150, y2: cy + 80 });
    strokes.push({ tool: "text", color: "#64a8ff", size: 3, x: cx - 130, y: cy - 60, text: "USE CASES (Application Business Rules)" });

    strokes.push({ tool: "rect", color: "#74c69d", size: 2, x1: cx - 80, y1: cy - 25, x2: cx + 80, y2: cy + 35 });
    strokes.push({ tool: "text", color: "#74c69d", size: 3.5, x: cx - 60, y: cy + 2, text: "ENTITIES\nDomain Models" });

    // Inward dependency inversion arrows
    strokes.push({ tool: "uml-rel", relType: "dependency", color: "#e6e9ee", size: 1.8, x1: cx + 260, y1: cy, x2: cx + 160, y2: cy, label: "depends in" });
    strokes.push({ tool: "uml-rel", relType: "dependency", color: "#e6e9ee", size: 1.8, x1: cx - 260, y1: cy, x2: cx - 160, y2: cy, label: "depends in" });
  } else if (key === "erd") {
    // E-Commerce Database Schema (ERD) with 4 linked tables
    strokes.push({
      tool: "table",
      color: "#64a8ff",
      size: 2,
      x: cx - 320,
      y: cy - 160,
      w: 260,
      title: "users",
      type: "db",
      rows: ["id: uuid [PK]", "email: varchar(255) [UNIQUE]", "password_hash: text", "role: varchar [DEFAULT 'member']", "created_at: timestamp"]
    });

    strokes.push({
      tool: "table",
      color: "#74c69d",
      size: 2,
      x: cx + 60,
      y: cy - 160,
      w: 260,
      title: "orders",
      type: "db",
      rows: ["id: uuid [PK]", "user_id: uuid [FK -> users.id]", "total_amount: numeric(10,2)", "status: varchar(32)", "created_at: timestamp"]
    });

    strokes.push({
      tool: "table",
      color: "#ffb547",
      size: 2,
      x: cx + 60,
      y: cy + 40,
      w: 260,
      title: "order_items",
      type: "db",
      rows: ["id: uuid [PK]", "order_id: uuid [FK -> orders.id]", "product_id: uuid [FK]", "quantity: int [DEFAULT 1]", "unit_price: numeric(10,2)"]
    });

    strokes.push({
      tool: "table",
      color: "#b48ce8",
      size: 2,
      x: cx - 320,
      y: cy + 40,
      w: 260,
      title: "payments",
      type: "db",
      rows: ["id: uuid [PK]", "order_id: uuid [FK -> orders.id]", "provider: varchar(32) [stripe]", "transaction_ref: varchar(128)", "amount: numeric(10,2)", "status: varchar(32)"]
    });

    // Foreign key relation connectors
    strokes.push({ tool: "uml-rel", relType: "association", color: "#64a8ff", size: 2, x1: cx - 60, y1: cy - 110, x2: cx + 60, y2: cy - 110, label: "1..*" });
    strokes.push({ tool: "uml-rel", relType: "composition", color: "#74c69d", size: 2, x1: cx + 190, y1: cy - 20, x2: cx + 190, y2: cy + 40, label: "1..*" });
    strokes.push({ tool: "uml-rel", relType: "association", color: "#b48ce8", size: 2, x1: cx + 60, y1: cy - 90, x2: cx - 60, y2: cy + 90, label: "1..1" });
  } else if (key === "rest-pipeline") {
    // Production REST Pipeline
    const stages = [
      { t: "rect", n: "Client App", c: "#64a8ff", w: 100 },
      { t: "diamond", n: "Cloudflare\nEdge CDN", c: "#ffb547", w: 110 },
      { t: "rect", n: "Nginx\nProxy", c: "#74c69d", w: 100 },
      { t: "rect", n: "Go API\nGateway", c: "#b48ce8", w: 110 },
      { t: "cylinder", n: "Redis\nCache", c: "#ff5c50", w: 100 },
      { t: "cylinder", n: "PostgreSQL\nPrimary", c: "#64a8ff", w: 110 }
    ];
    const spacing = 150;
    const startX = cx - (spacing * (stages.length - 1)) / 2;

    stages.forEach((st, i) => {
      const sx = startX + i * spacing;
      if (st.t === "rect") {
        strokes.push({ tool: "rect", color: st.c, size: 2, x1: sx - st.w / 2, y1: cy - 30, x2: sx + st.w / 2, y2: cy + 30 });
      } else if (st.t === "diamond") {
        strokes.push({ tool: "diamond", color: st.c, size: 2, x1: sx - st.w / 2, y1: cy - 35, x2: sx + st.w / 2, y2: cy + 35 });
      } else if (st.t === "cylinder") {
        strokes.push({ tool: "cylinder", color: st.c, size: 2, x1: sx - st.w / 2, y1: cy - 35, x2: sx + st.w / 2, y2: cy + 35 });
      }
      strokes.push({ tool: "text", color: "#e6e9ee", size: 2.8, x: sx - st.w / 2 + 10, y: cy - 5, text: st.n });

      if (i < stages.length - 1) {
        strokes.push({ tool: "arrow", color: "#77828e", size: 2, x1: sx + st.w / 2, y1: cy, x2: sx + spacing - stages[i + 1].w / 2, y2: cy });
      }
    });
  } else if (key === "state-machine") {
    // Statechart
    const states = [
      { name: "Draft", x: cx - 280, y: cy },
      { name: "In Review", x: cx - 100, y: cy },
      { name: "Approved", x: cx + 100, y: cy - 70 },
      { name: "Rejected", x: cx + 100, y: cy + 70 },
      { name: "Published", x: cx + 280, y: cy - 70 }
    ];

    states.forEach((s) => {
      strokes.push({ tool: "rect", color: "#64a8ff", size: 2, x1: s.x - 50, y1: s.y - 24, x2: s.x + 50, y2: s.y + 24 });
      strokes.push({ tool: "text", color: "#e6e9ee", size: 3, x: s.x - 30, y: s.y + 2, text: s.name });
    });

    strokes.push({ tool: "arrow", color: "#74c69d", size: 2, x1: cx - 230, y1: cy, x2: cx - 150, y2: cy });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.4, x: cx - 210, y: cy - 10, text: "submit()" });

    strokes.push({ tool: "arrow", color: "#74c69d", size: 2, x1: cx - 50, y1: cy - 10, x2: cx + 50, y2: cy - 60 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.4, x: cx - 35, y: cy - 45, text: "approve()" });

    strokes.push({ tool: "arrow", color: "#ff5c50", size: 2, x1: cx - 50, y1: cy + 10, x2: cx + 50, y2: cy + 60 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.4, x: cx - 35, y: cy + 45, text: "reject()" });

    strokes.push({ tool: "arrow", color: "#74c69d", size: 2, x1: cx + 150, y1: cy - 70, x2: cx + 230, y2: cy - 70 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.4, x: cx + 165, y: cy - 80, text: "publish()" });

    // Loopback arrow: Rejected -> Draft
    strokes.push({ tool: "arrow", color: "#ffb547", size: 2, x1: cx + 100, y1: cy + 94, x2: cx - 280, y2: cy + 24 });
    strokes.push({ tool: "text", color: "#e6e9ee", size: 2.4, x: cx - 120, y: cy + 90, text: "edit & revise()" });
  }

  toggleDiagModal(false);
  fitContent();
  redraw();
  persist();
  toast(`Loaded Template: ${key.toUpperCase()}`);
}

// 5. Markdown / DSL Compiler
document.getElementById("compileDsl").addEventListener("click", () => {
  const dslText = document.getElementById("dslInput").value.trim();
  if (!dslText) return;

  const lines = dslText.split("\n").map((l) => l.trim()).filter(Boolean);
  const cx = snapCoord(s2wX(window.innerWidth / 2));
  const cy = snapCoord(s2wY(window.innerHeight / 2));

  let isSequence = dslText.includes("sequence:") || lines.some((l) => l.startsWith("participant "));
  let isUml = dslText.includes("class ") || lines.some((l) => l.includes("<|--") || l.includes("..>"));

  if (isSequence) {
    // Parse participant list and messages
    const participants = [];
    const msgs = [];
    lines.forEach((line) => {
      if (line.startsWith("participant ")) {
        const p = line.replace("participant ", "").trim();
        if (p && !participants.includes(p)) participants.push(p);
      } else if (line.includes("->") || line.includes("-->")) {
        msgs.push(line);
      }
    });

    if (participants.length) {
      document.getElementById("seqActors").value = participants.join(", ");
    }
    if (msgs.length) {
      document.getElementById("seqMessages").value = msgs.join("\n");
    }
    document.getElementById("insertSeqDiagram").click();
    return;
  }

  if (isUml) {
    // Parse UML classes & relations
    let classRegex = /class\s+([A-Za-z0-9_]+)(?:\s*<<([A-Za-z0-9_]+)>>)?\s*\{([^}]*)\}/g;
    let match;
    let offsetX = -180;
    while ((match = classRegex.exec(dslText)) !== null) {
      const name = match[1];
      const stereotype = match[2] || "class";
      const body = match[3]
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      strokes.push({
        tool: "table",
        color: stereotype === "interface" ? "#64a8ff" : stereotype === "service" ? "#b48ce8" : "#74c69d",
        size: 2,
        x: cx + offsetX,
        y: cy - 60,
        w: 240,
        title: name,
        stereotype,
        type: "uml",
        rows: body
      });
      offsetX += 280;
    }

    // Parse relationship lines
    lines.forEach((line) => {
      const relMatch = line.match(/([A-Za-z0-9_]+)\s*(<\|--|<\|\.\.|\*--|o--|\.\.>|-->)\s*([A-Za-z0-9_]+)(?:\s*:\s*(.+))?/);
      if (relMatch) {
        const [, f, op, t, lbl] = relMatch;
        let relType = "association";
        if (op === "<|--") relType = "inheritance";
        else if (op === "<|..") relType = "realization";
        else if (op === "*--") relType = "composition";
        else if (op === "o--") relType = "aggregation";
        else if (op === "..>") relType = "dependency";

        document.getElementById("umlRelFrom").value = f;
        document.getElementById("umlRelTo").value = t;
        document.getElementById("umlRelType").value = relType;
        document.getElementById("umlRelLabel").value = lbl || "";
        document.getElementById("insertUmlRel").click();
      }
    });

    toggleDiagModal(false);
    fitContent();
    redraw();
    persist();
    toast("Compiled UML Class Diagram from DSL");
    return;
  }

  // Fallback: simple architecture flow
  lines.forEach((line, idx) => {
    const nodeMatch = line.match(/\[([^\]]+)\]/g);
    if (nodeMatch) {
      nodeMatch.forEach((n, nidx) => {
        const cleanName = n.replace(/^\[|\]$/g, "");
        strokes.push({
          tool: "rect",
          color: "#64a8ff",
          size: 2,
          x1: cx - 200 + nidx * 160,
          y1: cy - 40 + idx * 70,
          x2: cx - 80 + nidx * 160,
          y2: cy + 10 + idx * 70
        });
        strokes.push({
          tool: "text",
          color: "#e6e9ee",
          size: 3,
          x: cx - 190 + nidx * 160,
          y: cy - 20 + idx * 70,
          text: cleanName
        });
      });
    }
  });

  toggleDiagModal(false);
  fitContent();
  redraw();
  persist();
  toast("Compiled Flow Nodes from DSL");
});

// 6. Insert Architecture Node
document.getElementById("insertArchNode").addEventListener("click", () => {
  const shapeType = document.getElementById("archNodeType").value;
  const label = document.getElementById("archNodeLabel").value.trim() || "service";
  const cx = s2wX(window.innerWidth / 2);
  const cy = s2wY(window.innerHeight / 2);
  const w = Math.max(120, label.length * 11);
  const h = 60;

  strokes.push({
    tool: shapeType,
    color: shapeType === "cylinder" ? "#64a8ff" : shapeType === "diamond" ? "#ffb547" : "#74c69d",
    size: 2,
    x1: snapCoord(cx - w / 2),
    y1: snapCoord(cy - h / 2),
    x2: snapCoord(cx + w / 2),
    y2: snapCoord(cy + h / 2)
  });

  strokes.push({
    tool: "text",
    color: "#e6e9ee",
    size: 3,
    x: cx - (label.length * 7.5) / 2,
    y: cy + 4,
    text: label
  });

  toggleDiagModal(false);
  redraw();
  persist();
  toast(`Inserted ${shapeType}: ${label}`);
});

// Radar / Minimap Implementation
function syncMinimap() {
  const mCanvas = document.getElementById("minimapCanvas");
  if (!mCanvas) return;
  const mctx = mCanvas.getContext("2d");
  const mw = mCanvas.width;
  const mh = mCanvas.height;

  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = activeTheme.surface;
  mctx.fillRect(0, 0, mw, mh);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };

  const vx1 = s2wX(0);
  const vy1 = s2wY(0);
  const vx2 = s2wX(window.innerWidth);
  const vy2 = s2wY(window.innerHeight);
  expand(vx1, vy1);
  expand(vx2, vy2);

  for (const s of strokes) {
    if (s.x !== undefined && s.y !== undefined) {
      expand(s.x, s.y);
      if (s.w) expand(s.x + s.w, s.y + (s.h || 60));
    }
    if (s.x1 !== undefined && s.y1 !== undefined) {
      expand(s.x1, s.y1);
      expand(s.x2, s.y2);
    }
    if (s.points) {
      for (const p of s.points) expand(p.x, p.y);
    }
  }

  const spanX = Math.max(400, maxX - minX);
  const spanY = Math.max(300, maxY - minY);
  const padX = spanX * 0.15;
  const padY = spanY * 0.15;
  const bX = minX - padX;
  const bY = minY - padY;
  const bW = spanX + padX * 2;
  const bH = spanY + padY * 2;

  const mScale = Math.min((mw - 8) / bW, (mh - 8) / bH);
  const mOffX = (mw - bW * mScale) / 2;
  const mOffY = (mh - bH * mScale) / 2;

  const w2mX = (wx) => mOffX + (wx - bX) * mScale;
  const w2mY = (wy) => mOffY + (wy - bY) * mScale;

  for (const s of strokes) {
    mctx.strokeStyle = s.tool === "eraser" ? activeTheme.surface : s.color;
    mctx.fillStyle = s.color;
    mctx.lineWidth = Math.max(0.8, (s.size || 2) * mScale);

    if (s.tool === "table" || s.tool === "activation") {
      const sx = w2mX(s.x);
      const sy = w2mY(s.y);
      const sw = Math.max(4, (s.w || 220) * mScale);
      const sh = Math.max(3, (s.h || 80) * mScale);
      mctx.fillRect(sx, sy, sw, sh);
    } else if (s.tool === "frame" || s.tool === "rect") {
      const rx = w2mX(Math.min(s.x1, s.x2));
      const ry = w2mY(Math.min(s.y1, s.y2));
      const rw = Math.max(3, Math.abs(s.x2 - s.x1) * mScale);
      const rh = Math.max(3, Math.abs(s.y2 - s.y1) * mScale);
      mctx.strokeRect(rx, ry, rw, rh);
    } else if (s.tool === "line" || s.tool === "arrow" || s.tool === "uml-rel") {
      mctx.beginPath();
      mctx.moveTo(w2mX(s.x1), w2mY(s.y1));
      mctx.lineTo(w2mX(s.x2), w2mY(s.y2));
      mctx.stroke();
    } else if (s.points && s.points.length > 1) {
      mctx.beginPath();
      mctx.moveTo(w2mX(s.points[0].x), w2mY(s.points[0].y));
      for (let i = 1; i < s.points.length; i++) {
        mctx.lineTo(w2mX(s.points[i].x), w2mY(s.points[i].y));
      }
      mctx.stroke();
    }
  }

  // Draw camera frustum
  const cvx1 = w2mX(vx1);
  const cvy1 = w2mY(vy1);
  const cvx2 = w2mX(vx2);
  const cvy2 = w2mY(vy2);
  const cvw = Math.max(4, cvx2 - cvx1);
  const cvh = Math.max(4, cvy2 - cvy1);

  mctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  mctx.fillRect(cvx1, cvy1, cvw, cvh);
  mctx.strokeStyle = activeTheme.accent;
  mctx.lineWidth = 1.2;
  mctx.strokeRect(cvx1, cvy1, cvw, cvh);

  mCanvas._radar = { bX, bY, mScale, mOffX, mOffY };
}

function setupMinimapInteraction() {
  const mCanvas = document.getElementById("minimapCanvas");
  if (!mCanvas) return;

  let isNavigating = false;

  const handleMinimapPan = (e) => {
    if (!mCanvas._radar) return;
    const rect = mCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { bX, bY, mScale, mOffX, mOffY } = mCanvas._radar;
    const targetWx = bX + (mx - mOffX) / mScale;
    const targetWy = bY + (my - mOffY) / mScale;

    view.x = window.innerWidth / 2 - targetWx * view.z;
    view.y = window.innerHeight / 2 - targetWy * view.z;
    redraw();
    persist();
  };

  mCanvas.addEventListener("pointerdown", (e) => {
    isNavigating = true;
    mCanvas.setPointerCapture(e.pointerId);
    handleMinimapPan(e);
  });
  mCanvas.addEventListener("pointermove", (e) => {
    if (isNavigating) handleMinimapPan(e);
  });
  const stopNav = (e) => {
    if (isNavigating) {
      isNavigating = false;
      try { mCanvas.releasePointerCapture(e.pointerId); } catch {}
    }
  };
  mCanvas.addEventListener("pointerup", stopNav);
  mCanvas.addEventListener("pointercancel", stopNav);

  const toggleBtn = document.getElementById("minimapToggleBtn");
  const container = document.getElementById("minimapContainer");
  if (toggleBtn && container) {
    toggleBtn.addEventListener("click", () => {
      container.classList.toggle("minimized");
      toggleBtn.textContent = container.classList.contains("minimized") ? "+" : "−";
    });
  }

  const hudToggle = document.getElementById("toggleMinimap");
  if (hudToggle && container) {
    hudToggle.addEventListener("click", () => {
      container.classList.toggle("minimized");
    });
  }
}

// Theme System Management
function applyTheme(themeId, shouldSave = true) {
  const t = THEMES[themeId] || THEMES.omarchy;
  activeTheme = t;
  BG = t.bg;
  document.body.dataset.theme = t.id;
  const sbTheme = document.getElementById("sb-theme");
  if (sbTheme) sbTheme.textContent = `THM: ${t.id.toUpperCase()}`;
  const themeLabel = document.getElementById("themeLabel");
  if (themeLabel) themeLabel.textContent = t.id.slice(0, 4).toUpperCase();

  const dots = document.querySelectorAll(".palette .dot");
  if (dots && dots.length) {
    dots.forEach((dot, idx) => {
      if (t.palette[idx]) {
        dot.dataset.color = t.palette[idx];
        dot.style.setProperty("--c", t.palette[idx]);
      }
    });
  }

  document.querySelectorAll("#themeMenu .theme-opt").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeId === t.id);
  });

  if (shouldSave) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ "lapdraw:theme": t.id });
    }
    localStorage.setItem("lapdraw:theme", t.id);
  }

  redraw();
}

function setupThemeMenu() {
  const themeBtn = document.getElementById("themeBtn");
  const themeMenu = document.getElementById("themeMenu");
  if (!themeBtn || !themeMenu) return;

  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themeMenu.classList.toggle("hidden");
  });

  themeMenu.querySelectorAll(".theme-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.themeId;
      applyTheme(tid, true);
      themeMenu.classList.add("hidden");
      toast(`Theme: ${THEMES[tid]?.name || tid}`);
    });
  });

  document.addEventListener("click", (e) => {
    if (!themeMenu.contains(e.target) && e.target !== themeBtn) {
      themeMenu.classList.add("hidden");
    }
  });
}

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
      const fs = s.fontSize || Math.max(12, (s.size || 4) * 3);
      const lines = (s.text || "").split("\n");
      const maxLen = Math.max(1, ...lines.map((l) => l.length));
      const padX = s.card ? 10 : 0;
      const padY = s.card ? 8 : 0;
      const badgeH = s.badge ? 18 : 0;
      const w = maxLen * fs * 0.65 + padX * 2;
      const h = lines.length * fs * 1.4 + padY * 2 + badgeH;
      expand(s.x, s.y);
      expand(s.x + w, s.y + h);
    } else if (s.tool === "activation") {
      expand(s.x, s.y);
      expand(s.x + (s.w || 14), s.y + (s.h || 60));
    } else if (s.tool === "table") {
      const headerH = s.stereotype ? 36 : 28;
      expand(s.x, s.y);
      expand(s.x + (s.w || 220), s.y + headerH + (s.rows?.length || 1) * 22);
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

// ----- Keyboard (registry-driven) -----
const CANVAS_ACTIONS = {
  pen: () => setTool("pen"),
  eraser: () => setTool("eraser"),
  line: () => setTool("line"),
  rect: () => setTool("rect"),
  ellipse: () => setTool("ellipse"),
  arrow: () => setTool("arrow"),
  text: () => setTool("text"),
  diag: () => toggleDiagModal(true),
  smart: () => toggleSmartAssist(),
  snap: () => toggleGridSnap(),
  dash: () => toggleLineDash(),
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
    toggleDiagModal(false);
    if (activeTextEditor) {
      cancelActiveText();
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
  if (activeTextEditor && tool !== "text") {
    commitActiveText();
  }
  settings.tool = tool;
  syncTools();
  if (canvas) canvas.style.cursor = tool === "text" ? "text" : "crosshair";
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
  diag: "d",
  smart: "m",
  snap: "g",
  dash: "k",
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
  const isTextField =
    t &&
    ((t.tagName === "INPUT" && !["color", "range", "checkbox"].includes(t.type)) ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT");
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
setupThemeMenu();
setupMinimapInteraction();
load();

window.LapDrawTheme = {
  THEMES,
  applyTheme,
  getActiveTheme: () => activeTheme,
  getThemeBg: () => activeTheme.bg
};
