// LapDraw exporters — artwork-bound PNG/JPG/SVG/PDF/clipboard + .lapboard project files.
// Zero-dependency: the PDF writer is hand-rolled (single-page JPEG XObject).

// ---------- shared helpers ----------

function bounds() {
  // world-space bounds of all content (padded by half stroke width)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pad = (s) => (s.size || 4) * (s.tool === "eraser" ? 3 : 1);
  const grow = (x, y, r) => {
    minX = Math.min(minX, x - r); minY = Math.min(minY, y - r);
    maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r);
  };
  for (const s of strokes) {
    const r = pad(s) / 2;
    if (isShape(s.tool)) {
      grow(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), r);
      grow(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2), r);
    } else {
      for (const p of s.points) grow(p.x, p.y, r);
    }
  }
  if (minX === Infinity) return null; // nothing to export
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function renderArtwork(scale = 1) {
  // draws all content into a fresh canvas at `scale` px per world unit
  const b = bounds();
  const w = Math.round(b.w * scale) + 40;
  const h = Math.round(b.h * scale) + 40;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const c = out.getContext("2d");
  c.fillStyle = BG;
  c.fillRect(0, 0, w, h);
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const s of strokes) {
    c.save();
    c.strokeStyle = s.tool === "eraser" ? BG : s.color;
    c.lineWidth = Math.max(1, (s.size || 4) * (s.tool === "eraser" ? 3 : 1) * scale);
    c.beginPath();
    const ox = 20 - b.x * scale;
    const oy = 20 - b.y * scale;
    if (isShape(s.tool)) {
      const x1 = s.x1 * scale + ox, y1 = s.y1 * scale + oy;
      const x2 = s.x2 * scale + ox, y2 = s.y2 * scale + oy;
      if (s.tool === "line") {
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
      } else if (s.tool === "rect") {
        c.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (s.tool === "ellipse") {
        c.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      }
    } else {
      const pts = s.points;
      c.moveTo(pts[0].x * scale + ox, pts[0].y * scale + oy);
      if (pts.length === 1) c.lineTo(pts[0].x * scale + ox + 0.01, pts[0].y * scale + oy + 0.01);
      for (let i = 1; i < pts.length; i++) {
        const mx = ((pts[i - 1].x + pts[i].x) / 2) * scale + ox;
        const my = ((pts[i - 1].y + pts[i].y) / 2) * scale + oy;
        c.quadraticCurveTo(pts[i - 1].x * scale + ox, pts[i - 1].y * scale + oy, mx, my);
        if (i === pts.length - 1) c.lineTo(pts[i].x * scale + ox, pts[i].y * scale + oy);
      }
    }
    c.stroke();
    c.restore();
  }
  return out;
}

function thinkScale() {
  // pick a scale so the artwork lands around ~2000px on its longer side (cap 4x)
  const b = bounds();
  const long = Math.max(b.w, b.h);
  return Math.min(4, Math.max(0.25, 2000 / long));
}

function check() {
  if (!strokes.length) {
    toast("Canvas is empty — nothing to export");
    return false;
  }
  return true;
}

function download(name, blob) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- raster exports ----------

function exportPngArtwork() {
  if (!check()) return;
  renderArtwork(thinkScale()).toBlob((b) => download(`lapdraw-${stamp()}.png`, b), "image/png");
  toast("Exported PNG (artwork)");
}

function exportJpg() {
  if (!check()) return;
  renderArtwork(thinkScale()).toBlob((b) => download(`lapdraw-${stamp()}.jpg`, b), "image/jpeg", 0.92);
  toast("Exported JPG (artwork)");
}

async function exportViewportPng() {
  const out = document.createElement("canvas");
  const r = dpr();
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext("2d");
  octx.fillStyle = BG;
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  out.toBlob((b) => download(`lapdraw-viewport-${stamp()}.png`, b), "image/png");
  toast("Exported PNG (what you see)");
}

// ---------- SVG export (true vectors) ----------

function exportSvg() {
  if (!check()) return;
  const b = bounds();
  const w = Math.max(1, Math.round(b.w));
  const h = Math.max(1, Math.round(b.h));
  const ox = -b.x;
  const oy = -b.y;
  const parts = [];
  for (const s of strokes) {
    if (s.tool === "eraser") {
      // approximate: opaque background stroke (SVG has no erase)
      parts.push(svgStroke(s, ox, oy, BG));
      continue;
    }
    if (isShape(s.tool)) {
      const attrs = `fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round"`;
      const x1 = s.x1 + ox, y1 = s.y1 + oy, x2 = s.x2 + ox, y2 = s.y2 + oy;
      if (s.tool === "line") {
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`);
      } else if (s.tool === "rect") {
        parts.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" ${attrs}/>`);
      } else {
        parts.push(`<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" ${attrs}/>`);
      }
      continue;
    }
    parts.push(svgStroke(s, ox, oy, s.color));
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${BG}"/>` +
    parts.join("\n") +
    `</svg>`;
  download(`lapdraw-${stamp()}.svg`, new Blob([svg], { type: "image/svg+xml" }));
  toast("Exported SVG (vector)");
}

function svgStroke(s, ox, oy, color) {
  const pts = s.points;
  let d = `M ${pt(pts[0].x + ox)} ${pt(pts[0].y + oy)}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = ((pts[i - 1].x + pts[i].x) / 2) + ox;
    const my = ((pts[i - 1].y + pts[i].y) / 2) + oy;
    d += ` Q ${pt(pts[i - 1].x + ox)} ${pt(pts[i - 1].y + oy)} ${pt(mx)} ${pt(my)}`;
    if (i === pts.length - 1) d += ` L ${pt(pts[i].x + ox)} ${pt(pts[i].y + oy)}`;
  }
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

const pt = (n) => Math.round(n * 100) / 100;

// ---------- PDF export (hand-rolled, single page artwork) ----------

async function exportPdf() {
  if (!check()) return;
  const scale = thinkScale();
  const art = renderArtwork(scale);
  const jpegBlob = await new Promise((ok) => art.toBlob(ok, "image/jpeg", 0.94));
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  toast("Assembling PDF…");

  // page size in points, so the PDF shows the artwork 1:1 at 72dpi of its own scale
  const W = art.width;
  const H = art.height;
  const objs = [];
  const placeholder = () => objs.push(null) && objs.length; // 1-based id
  const pagesId = placeholder();
  const contentId = placeholder();
  const imageId = placeholder();
  const catalogId = placeholder();

  objs[0] = `<< /Type /Pages /Kids [${pagesId} 0 R] /Count 1 >>`;
  objs[pagesId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> /ProcSet [/PDF /ImageC] >> >>`;
  objs[contentId - 1] = {
    dict: `<< /Length ${`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`.length} >>`,
    stream: `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
  };
  objs[imageId - 1] = {
    dict: `<< /Type /XObject /Subtype /Image /Filter /DCTDecode /Width ${art.width} /Height ${art.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${jpeg.length} >>`,
    stream: jpeg
  };
  objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  download(`lapdraw-${stamp()}.pdf`, buildPdf(objs));
  toast("Exported PDF");
}

function buildPdf(objs) {
  const chunks = ["%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n"];
  const offsets = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(chunks.reduce((n, c) => n + c.length, 0));
    const o = objs[i];
    if (typeof o === "string") {
      chunks.push(`${i + 1} 0 obj\n${o}\nendobj\n`);
    } else {
      const head = `${i + 1} 0 obj\n${o.dict}\nstream\n`;
      const bytes = typeof o.stream === "string" ? new TextEncoder().encode(o.stream) : o.stream;
      chunks.push(head, bytes, `\nendstream\nendobj\n`);
    }
  }
  const startxref = chunks.reduce((n, c) => n + c.length, 0);
  chunks.push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    chunks.push(String(off).padStart(10, "0") + " 00000 n \n");
  }
  chunks.push(`trailer\n<< /Size ${objs.length + 1} /Root ${objs.length} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

// ---------- clipboard ----------

async function copyImage() {
  if (!check()) return;
  try {
    const blob = await new Promise((ok) => renderArtwork(thinkScale()).toBlob(ok, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("Copied image to clipboard");
  } catch {
    toast("Clipboard blocked by the browser — use PNG export instead");
  }
}

// ---------- .lapboard project files ----------

function exportProject() {
  const data = { version: 1, app: "LapDraw", saved: new Date().toISOString(), strokes, view };
  download(`lapboard-${stamp()}.lapboard`, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  toast("Saved .lapboard project");
}

function importProject() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".lapboard,application/json,.json";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.strokes)) throw new Error("bad file");
        strokes = data.strokes;
        if (data.view) view = data.view;
        redoStack = [];
        redraw();
        persist();
        toast(`Loaded project — ${strokes.length} strokes`);
      } catch {
        toast("Could not read that .lapboard file");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ---------- tiny toast ----------
let toastTimer = null;
function toast(text) {
  let el = document.getElementById("lapdraw-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "lapdraw-toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}
