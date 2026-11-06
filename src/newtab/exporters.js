// LapDraw exporters — artwork-bound PNG/JPG/SVG/PDF/clipboard + .lapboard project files.
// Developer exports: Copy SVG code, Copy React TSX component, Copy Markdown image.
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
    if (s.tool === "text") {
      const fs = s.fontSize || Math.max(12, (s.size || 4) * 3);
      const lines = (s.text || "").split("\n");
      const maxLen = Math.max(1, ...lines.map((l) => l.length));
      const padX = s.card ? 10 : 0;
      const padY = s.card ? 8 : 0;
      const badgeH = s.badge ? 18 : 0;
      const tw = maxLen * fs * 0.65 + padX * 2;
      const th = lines.length * fs * 1.4 + padY * 2 + badgeH;
      grow(s.x, s.y, r);
      grow(s.x + tw, s.y + th, r);
    } else if (s.tool === "table") {
      const sw = s.w || 220;
      const headerH = 28;
      const rowH = 22;
      const rows = s.rows || [];
      const totalH = headerH + Math.max(1, rows.length) * rowH;
      grow(s.x, s.y, r);
      grow(s.x + sw, s.y + totalH, r);
    } else if (isShape(s.tool)) {
      grow(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), r);
      grow(Math.max(s.x1, s.x2), Math.max(s.y1, s.y2), r);
    } else if (s.points && s.points.length) {
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
    const ox = 20 - b.x * scale;
    const oy = 20 - b.y * scale;

    if (s.dashed) {
      c.setLineDash([8 * scale, 5 * scale]);
    } else {
      c.setLineDash([]);
    }

    if (s.tool === "text") {
      const rawFs = s.fontSize || Math.max(12, (s.size || 4) * 3);
      const fontSize = Math.max(9, rawFs * scale);
      const sx = s.x * scale + ox;
      const sy = s.y * scale + oy;
      const lines = (s.text || "").split("\n");
      const lh = fontSize * 1.4;

      c.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.textBaseline = "top";

      let maxW = 0;
      for (const line of lines) {
        const w = c.measureText(line).width;
        if (w > maxW) maxW = w;
      }
      const padX = s.card ? 10 * scale : 0;
      const padY = s.card ? 8 * scale : 0;
      const badgeH = s.badge ? 18 * scale : 0;
      const totalW = maxW + padX * 2;
      const totalH = lines.length * lh + padY * 2 + badgeH;

      if (s.card) {
        c.fillStyle = "rgba(14, 18, 24, 0.94)";
        c.fillRect(sx, sy, totalW, totalH);
        c.strokeStyle = s.color;
        c.lineWidth = Math.max(1, 1.5 * scale);
        c.strokeRect(sx, sy, totalW, totalH);
        c.fillStyle = s.color;
        c.fillRect(sx, sy, totalW, 2 * scale);
      }

      let startTextY = sy + padY;
      if (s.badge) {
        const bFs = Math.max(8, 10 * scale);
        c.font = `600 ${bFs}px "JetBrains Mono", monospace`;
        const bText = `[${s.badge.toUpperCase()}]`;
        const bw = c.measureText(bText).width + 8 * scale;
        c.fillStyle = s.color;
        c.fillRect(sx + padX, sy + padY, bw, 15 * scale);
        c.fillStyle = "#0e1114";
        c.fillText(bText, sx + padX + 4 * scale, sy + padY + 2 * scale);
        startTextY += 18 * scale;
      }

      c.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.fillStyle = s.color;
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], sx + padX, startTextY + i * lh);
      }
      c.restore();
      continue;
    }

    if (s.tool === "table") {
      const sx = s.x * scale + ox;
      const sy = s.y * scale + oy;
      const sw = (s.w || 220) * scale;
      const headerH = 28 * scale;
      const rowH = 22 * scale;
      const rows = s.rows || [];
      const totalH = headerH + Math.max(1, rows.length) * rowH;

      c.fillStyle = "rgba(18, 22, 28, 0.95)";
      c.fillRect(sx, sy, sw, totalH);
      c.strokeStyle = s.color;
      c.lineWidth = Math.max(1, (s.size || 2) * scale);
      c.strokeRect(sx, sy, sw, totalH);

      c.fillStyle =
        s.type === "uml" ? "rgba(180, 140, 232, 0.16)" : "rgba(100, 168, 255, 0.16)";
      c.fillRect(sx, sy, sw, headerH);
      c.beginPath();
      c.moveTo(sx, sy + headerH);
      c.lineTo(sx + sw, sy + headerH);
      c.stroke();

      const titleFs = Math.max(10, 12 * scale);
      c.font = `600 ${titleFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.fillStyle = s.color;
      const prefix = s.type === "uml" ? "«class» " : "🗄 ";
      c.fillText(prefix + (s.title || "Table"), sx + 8 * scale, sy + headerH * 0.68);

      const rowFs = Math.max(9, 11 * scale);
      c.font = `400 ${rowFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.fillStyle = "#ccd4dc";
      for (let i = 0; i < rows.length; i++) {
        const rowY = sy + headerH + (i + 0.72) * rowH;
        c.fillText(rows[i], sx + 10 * scale, rowY);
      }
      c.restore();
      continue;
    }

    c.beginPath();
    if (isShape(s.tool)) {
      const x1 = s.x1 * scale + ox, y1 = s.y1 * scale + oy;
      const x2 = s.x2 * scale + ox, y2 = s.y2 * scale + oy;
      if (s.tool === "line") {
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      } else if (s.tool === "arrow") {
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const head = Math.max(8, (s.size || 4) * 3 * scale);
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
        c.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
        c.closePath();
        c.fillStyle = s.color;
        c.fill();
      } else if (s.tool === "rect") {
        c.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (s.tool === "ellipse") {
        c.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (s.tool === "diamond") {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        c.moveTo(mx, y1);
        c.lineTo(x2, my);
        c.lineTo(mx, y2);
        c.lineTo(x1, my);
        c.closePath();
        c.stroke();
      } else if (s.tool === "cylinder") {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.min(18, Math.abs(y2 - y1) * 0.18) * scale;
        const cx = (x1 + x2) / 2;
        c.ellipse(cx, y1 + ry, rx, ry, 0, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.moveTo(x1, y1 + ry);
        c.lineTo(x1, y2 - ry);
        c.moveTo(x2, y1 + ry);
        c.lineTo(x2, y2 - ry);
        c.stroke();
        c.beginPath();
        c.ellipse(cx, y2 - ry, rx, ry, 0, 0, Math.PI);
        c.stroke();
      }
    } else if (s.points && s.points.length) {
      const pts = s.points;
      c.moveTo(pts[0].x * scale + ox, pts[0].y * scale + oy);
      if (pts.length === 1) c.lineTo(pts[0].x * scale + ox + 0.01, pts[0].y * scale + oy + 0.01);
      for (let i = 1; i < pts.length; i++) {
        const mx = ((pts[i - 1].x + pts[i].x) / 2) * scale + ox;
        const my = ((pts[i - 1].y + pts[i].y) / 2) * scale + oy;
        c.quadraticCurveTo(pts[i - 1].x * scale + ox, pts[i - 1].y * scale + oy, mx, my);
        if (i === pts.length - 1) c.lineTo(pts[i].x * scale + ox, pts[i].y * scale + oy);
      }
      c.stroke();
    }
    c.restore();
  }
  return out;
}

function thinkScale() {
  const b = bounds();
  if (!b) return 1;
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
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext("2d");
  octx.fillStyle = BG;
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  out.toBlob((b) => download(`lapdraw-viewport-${stamp()}.png`, b), "image/png");
  toast("Exported PNG (what you see)");
}

// ---------- SVG generation & export (true vectors) ----------

function buildSvgData() {
  const b = bounds();
  if (!b) return null;
  const w = Math.max(1, Math.round(b.w)) + 40;
  const h = Math.max(1, Math.round(b.h)) + 40;
  const ox = 20 - b.x;
  const oy = 20 - b.y;
  const parts = [];

  for (const s of strokes) {
    if (s.tool === "eraser") {
      parts.push(svgStroke(s, ox, oy, BG));
      continue;
    }
    if (s.tool === "text") {
      const rawFs = s.fontSize || Math.max(12, (s.size || 4) * 3);
      const lines = (s.text || "").split("\n");
      const lh = rawFs * 1.4;
      const sx = pt(s.x + ox);
      const sy = pt(s.y + oy);
      const maxLen = Math.max(1, ...lines.map((l) => l.length));
      const estW = pt(maxLen * rawFs * 0.65);
      const padX = s.card ? 10 : 0;
      const padY = s.card ? 8 : 0;
      const badgeH = s.badge ? 18 : 0;
      const totalW = pt(estW + padX * 2);
      const totalH = pt(lines.length * lh + padY * 2 + badgeH);

      let textGroup = `<g class="dev-text">`;
      if (s.card) {
        textGroup += `<rect x="${sx}" y="${sy}" width="${totalW}" height="${totalH}" fill="#0e1218" stroke="${s.color}" stroke-width="1.5" rx="3"/>`;
        textGroup += `<rect x="${sx}" y="${sy}" width="${totalW}" height="2" fill="${s.color}"/>`;
      }
      let curY = sy + padY;
      if (s.badge) {
        const bText = `[${s.badge.toUpperCase()}]`;
        const bw = bText.length * 7 + 8;
        textGroup += `<rect x="${sx + padX}" y="${curY}" width="${bw}" height="14" fill="${s.color}" rx="2"/>`;
        textGroup += `<text x="${sx + padX + 4}" y="${curY + 11}" fill="#0e1114" font-family="JetBrains Mono, monospace" font-size="9" font-weight="600">${bText}</text>`;
        curY += 18;
      }
      for (let i = 0; i < lines.length; i++) {
        const escaped = lines[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const lineY = pt(curY + (i + 0.85) * lh);
        textGroup += `<text x="${sx + padX}" y="${lineY}" fill="${s.color}" font-family="JetBrains Mono, monospace" font-size="${rawFs}">${escaped}</text>`;
      }
      textGroup += `</g>`;
      parts.push(textGroup);
      continue;
    }
    if (s.tool === "table") {
      const sx = pt(s.x + ox);
      const sy = pt(s.y + oy);
      const sw = pt(s.w || 220);
      const headerH = 28;
      const rowH = 22;
      const rows = s.rows || [];
      const totalH = headerH + Math.max(1, rows.length) * rowH;
      const title = (s.title || "Table").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const prefix = s.type === "uml" ? "«class» " : "🗄 ";
      const headerFill = s.type === "uml" ? "rgba(180, 140, 232, 0.16)" : "rgba(100, 168, 255, 0.16)";

      let tableSvg =
        `<g class="dev-table">` +
        `<rect x="${sx}" y="${sy}" width="${sw}" height="${totalH}" fill="#12161c" stroke="${s.color}" stroke-width="${s.size || 2}" rx="4"/>` +
        `<rect x="${sx}" y="${sy}" width="${sw}" height="${headerH}" fill="${headerFill}" rx="4"/>` +
        `<line x1="${sx}" y1="${sy + headerH}" x2="${sx + sw}" y2="${sy + headerH}" stroke="${s.color}" stroke-width="${s.size || 2}"/>` +
        `<text x="${sx + 8}" y="${sy + 18}" fill="${s.color}" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600">${prefix}${title}</text>`;
      for (let i = 0; i < rows.length; i++) {
        const escapedRow = (rows[i] || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const ry = sy + headerH + 16 + i * rowH;
        tableSvg += `<text x="${sx + 10}" y="${ry}" fill="#ccd4dc" font-family="JetBrains Mono, monospace" font-size="11">${escapedRow}</text>`;
      }
      tableSvg += `</g>`;
      parts.push(tableSvg);
      continue;
    }
    if (isShape(s.tool)) {
      const dash = s.dashed ? ` stroke-dasharray="8,5"` : "";
      const attrs = `fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"${dash}`;
      const x1 = pt(s.x1 + ox), y1 = pt(s.y1 + oy), x2 = pt(s.x2 + ox), y2 = pt(s.y2 + oy);
      if (s.tool === "line") {
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`);
      } else if (s.tool === "arrow") {
        const ang = Math.atan2((s.y2 + oy) - (s.y1 + oy), (s.x2 + ox) - (s.x1 + ox));
        const head = Math.max(8, (s.size || 4) * 3);
        const p1x = pt(s.x2 + ox - head * Math.cos(ang - Math.PI / 6));
        const p1y = pt(s.y2 + oy - head * Math.sin(ang - Math.PI / 6));
        const p2x = pt(s.x2 + ox - head * Math.cos(ang + Math.PI / 6));
        const p2y = pt(s.y2 + oy - head * Math.sin(ang + Math.PI / 6));
        parts.push(
          `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/><polygon points="${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}" fill="${s.color}"/></g>`
        );
      } else if (s.tool === "rect") {
        parts.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" ${attrs}/>`);
      } else if (s.tool === "ellipse") {
        parts.push(`<ellipse cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" rx="${Math.abs(x2 - x1) / 2}" ry="${Math.abs(y2 - y1) / 2}" ${attrs}/>`);
      } else if (s.tool === "diamond") {
        const mx = pt((s.x1 + s.x2) / 2 + ox);
        const my = pt((s.y1 + s.y2) / 2 + oy);
        parts.push(`<polygon points="${mx},${y1} ${x2},${my} ${mx},${y2} ${x1},${my}" ${attrs}/>`);
      } else if (s.tool === "cylinder") {
        const rx = pt(Math.abs(s.x2 - s.x1) / 2);
        const ry = pt(Math.min(18, Math.abs(s.y2 - s.y1) * 0.18));
        const cx = pt((s.x1 + s.x2) / 2 + ox);
        const topY = pt(Math.min(s.y1, s.y2) + ry + oy);
        const botY = pt(Math.max(s.y1, s.y2) - ry + oy);
        const leftX = pt(Math.min(s.x1, s.x2) + ox);
        const rightX = pt(Math.max(s.x1, s.x2) + ox);
        parts.push(
          `<g><ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" ${attrs}/><line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${botY}" ${attrs}/><line x1="${rightX}" y1="${topY}" x2="${rightX}" y2="${botY}" ${attrs}/><path d="M ${leftX} ${botY} A ${rx} ${ry} 0 0 0 ${rightX} ${botY}" ${attrs}/></g>`
        );
      }
      continue;
    }
    if (s.points && s.points.length) {
      parts.push(svgStroke(s, ox, oy, s.color));
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
    `  <rect width="${w}" height="${h}" fill="${BG}"/>\n  ` +
    parts.join("\n  ") +
    `\n</svg>`;

  return { svg, w, h, parts };
}

function exportSvg() {
  if (!check()) return;
  const data = buildSvgData();
  if (!data) return;
  download(`lapdraw-${stamp()}.svg`, new Blob([data.svg], { type: "image/svg+xml" }));
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
  const dash = s.dashed ? ` stroke-dasharray="8,5"` : "";
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`
  );
}

const pt = (n) => Math.round(n * 100) / 100;

// ---------- Developer Exports: Copy SVG / React Component / Mermaid / Markdown ----------

async function copyMermaidCode() {
  if (!check()) return;
  const mermaid = generateMermaid();
  try {
    await navigator.clipboard.writeText(mermaid);
    toast("Copied Mermaid.js code to clipboard");
  } catch {
    toast("Clipboard blocked by browser");
  }
}

function generateMermaid() {
  const tables = strokes.filter((s) => s.tool === "table");
  const umlTables = tables.filter((s) => s.type === "uml");
  const dbTables = tables.filter((s) => s.type === "db" || !s.type);
  const textStrokes = strokes.filter((s) => s.tool === "text");
  const arrows = strokes.filter((s) => s.tool === "arrow");
  const lifelines = strokes.filter((s) => s.tool === "line" && s.dashed && Math.abs(s.x1 - s.x2) < 4);

  // 1. Sequence Diagram detection
  if (lifelines.length >= 2 && arrows.some((a) => Math.abs(a.y1 - a.y2) < 15)) {
    const actors = [];
    for (const line of lifelines) {
      const topX = (line.x1 + line.x2) / 2;
      const topY = Math.min(line.y1, line.y2);
      const label = textStrokes.find(
        (t) => Math.abs(t.x - topX) < 90 && Math.abs(t.y - topY) < 70
      );
      if (label && !actors.some((a) => a.name === label.text)) {
        actors.push({ name: label.text, x: topX });
      }
    }
    actors.sort((a, b) => a.x - b.x);

    if (actors.length >= 2) {
      const lines = ["sequenceDiagram", "  autonumber"];
      for (const a of actors) {
        lines.push(`  participant ${safeMermaidId(a.name)} as ${a.name}`);
      }

      const hArrows = arrows
        .filter((a) => Math.abs(a.y1 - a.y2) < 18)
        .sort((a, b) => a.y1 - b.y1);

      for (const arr of hArrows) {
        const fromActor = actors.reduce((closest, cur) =>
          Math.abs(cur.x - arr.x1) < Math.abs(closest.x - arr.x1) ? cur : closest
        );
        const toActor = actors.reduce((closest, cur) =>
          Math.abs(cur.x - arr.x2) < Math.abs(closest.x - arr.x2) ? cur : closest
        );
        if (fromActor && toActor && fromActor !== toActor) {
          const msgText = textStrokes.find(
            (t) =>
              Math.abs(t.y - arr.y1) < 28 &&
              t.x >= Math.min(arr.x1, arr.x2) - 40 &&
              t.x <= Math.max(arr.x1, arr.x2) + 40
          );
          const msg = msgText ? msgText.text : "call()";
          const op = arr.dashed ? "-->>" : "->>";
          lines.push(`  ${safeMermaidId(fromActor.name)}${op}${safeMermaidId(toActor.name)}: ${msg}`);
        }
      }
      return lines.join("\n");
    }
  }

  // 2. UML Class Diagram
  if (umlTables.length > 0) {
    const lines = ["classDiagram"];
    for (const t of umlTables) {
      const name = safeMermaidId(t.title || "Class");
      lines.push(`  class ${name} {`);
      const rows = t.rows || [];
      for (const row of rows) {
        if (row.includes("---")) continue;
        lines.push(`    ${row}`);
      }
      lines.push(`  }`);
    }
    return lines.join("\n");
  }

  // 3. ER Diagram (Database Tables)
  if (dbTables.length > 0) {
    const lines = ["erDiagram"];
    for (const t of dbTables) {
      const name = safeMermaidId(t.title || "Table").toUpperCase();
      lines.push(`  ${name} {`);
      const rows = t.rows || [];
      for (const row of rows) {
        const parts = row.split(/\s+/);
        if (parts.length >= 2) {
          const colName = parts[0];
          const colType = parts[1].toLowerCase();
          const isPk = row.toUpperCase().includes("PRIMARY") || row.toUpperCase().includes("PK");
          const isFk = row.toUpperCase().includes("FOREIGN") || row.toUpperCase().includes("FK");
          const tag = isPk ? "PK" : isFk ? "FK" : "";
          lines.push(`    ${colType} ${colName} ${tag}`.trimEnd());
        } else {
          lines.push(`    string ${row}`);
        }
      }
      lines.push(`  }`);
    }
    return lines.join("\n");
  }

  // 4. Flowchart for Rectangles, Diamonds, Cylinders and Arrows
  const nodes = [];
  const nodeShapes = strokes.filter(
    (s) => s.tool === "rect" || s.tool === "diamond" || s.tool === "cylinder"
  );
  if (nodeShapes.length > 0) {
    const lines = ["flowchart TD"];
    nodeShapes.forEach((s, idx) => {
      const id = `node${idx + 1}`;
      const cx = (s.x1 + s.x2) / 2;
      const cy = (s.y1 + s.y2) / 2;
      const label = textStrokes.find(
        (t) =>
          t.x >= Math.min(s.x1, s.x2) - 15 &&
          t.x <= Math.max(s.x1, s.x2) + 15 &&
          t.y >= Math.min(s.y1, s.y2) - 15 &&
          t.y <= Math.max(s.y1, s.y2) + 15
      );
      const text = label ? label.text : `Step ${idx + 1}`;
      if (s.tool === "diamond") {
        lines.push(`  ${id}{"${text}"}`);
      } else if (s.tool === "cylinder") {
        lines.push(`  ${id}[("${text}")]`);
      } else {
        lines.push(`  ${id}["${text}"]`);
      }
      nodes.push({ id, cx, cy, shape: s });
    });

    for (const arr of arrows) {
      const fromNode = nodes.reduce((best, n) => {
        const d = Math.hypot(n.cx - arr.x1, n.cy - arr.y1);
        return !best || d < best.d ? { node: n, d } : best;
      }, null);
      const toNode = nodes.reduce((best, n) => {
        const d = Math.hypot(n.cx - arr.x2, n.cy - arr.y2);
        return !best || d < best.d ? { node: n, d } : best;
      }, null);

      if (fromNode && toNode && fromNode.node.id !== toNode.node.id) {
        const link = arr.dashed ? "-.->" : "-->";
        lines.push(`  ${fromNode.node.id} ${link} ${toNode.node.id}`);
      }
    }
    return lines.join("\n");
  }

  // 5. Fallback: text nodes
  if (textStrokes.length > 0) {
    const lines = ["flowchart TD"];
    textStrokes.forEach((t, i) => {
      lines.push(`  t${i + 1}["${t.text.replace(/"/g, "'")}"]`);
    });
    return lines.join("\n");
  }

  return "%% LapDraw Diagram\nflowchart TD\n  Start --> End\n";
}

function safeMermaidId(str) {
  return (str || "Node").replace(/[^a-zA-Z0-9_]/g, "_").replace(/^([0-9])/, "_$1");
}

async function copySvgCode() {
  if (!check()) return;
  const data = buildSvgData();
  if (!data) return;
  try {
    await navigator.clipboard.writeText(data.svg);
    toast("Copied SVG markup to clipboard <svg>");
  } catch {
    toast("Clipboard blocked by browser — use SVG export");
  }
}

async function copyReactComponent() {
  if (!check()) return;
  const data = buildSvgData();
  if (!data) return;
  const tsx = `import React from "react";

export function LapDrawDiagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 ${data.w} ${data.h}"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="${data.w}" height="${data.h}" fill="${BG}" />
      ${data.parts.join("\n      ")}
    </svg>
  );
}
`;
  try {
    await navigator.clipboard.writeText(tsx);
    toast("Copied React component (.tsx) to clipboard");
  } catch {
    toast("Clipboard blocked by browser");
  }
}

async function copyMarkdownImage() {
  if (!check()) return;
  const data = buildSvgData();
  if (!data) return;
  const md = `![LapDraw Diagram](data:image/svg+xml;utf8,${encodeURIComponent(data.svg)})`;
  try {
    await navigator.clipboard.writeText(md);
    toast("Copied Markdown embed ![]() to clipboard");
  } catch {
    toast("Clipboard blocked by browser");
  }
}

// ---------- PDF export (hand-rolled, single page artwork) ----------

async function exportPdf() {
  if (!check()) return;
  const scale = thinkScale();
  const art = renderArtwork(scale);
  const jpegBlob = await new Promise((ok) => art.toBlob(ok, "image/jpeg", 0.94));
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  toast("Assembling PDF…");

  const W = art.width;
  const H = art.height;
  const objs = [];
  const placeholder = () => objs.push(null) && objs.length;
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
  const chunks = [new TextEncoder().encode("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n")];
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

// ---------- clipboard image ----------

async function copyImage() {
  if (!check()) return;
  try {
    const blob = await new Promise((ok) => renderArtwork(thinkScale()).toBlob(ok, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    toast("Copied PNG image to clipboard");
  } catch {
    toast("Clipboard blocked by browser — use PNG export instead");
  }
}

// ---------- .lapboard project files ----------

function exportProject() {
  const data = { version: 2, app: "LapDraw", saved: new Date().toISOString(), strokes, view };
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
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
