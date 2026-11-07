// LapDraw content script — draws on the current page with the trackpad.
// Trackpad-first UX with QuickShape hold-to-snap, streamline smoothing, and diagramming tools.

(() => {
  const STATUS_KEY = "lapdraw:enabled";
  const PREFS_KEY = "lapdraw:prefs";
  const root = document.createElement("div");
  root.id = "lapdraw-root";

  const canvas = document.createElement("canvas");
  canvas.className = "lapdraw-canvas";

  const toolbar = document.createElement("div");
  toolbar.className = "lapdraw-toolbar";
  toolbar.innerHTML = `
    <button class="lapdraw-btn" data-act="pen" title="Pen (P)">PEN</button>
    <button class="lapdraw-btn" data-act="highlighter" title="Highlighter (H) — semitransparent for code / docs">HL</button>
    <button class="lapdraw-btn" data-act="eraser" title="Eraser (E)">ERS</button>
    <button class="lapdraw-btn" data-act="line" title="Line (L)">LIN</button>
    <button class="lapdraw-btn" data-act="rect" title="Box / Rect (R)">BOX</button>
    <button class="lapdraw-btn" data-act="arrow" title="Arrow (A)">ARR</button>
    <button class="lapdraw-btn" data-act="text" title="Text (T)">TXT</button>
    <button class="lapdraw-btn" data-act="spotlight" title="Diff Spotlight / Focus (F)">SPOT</button>
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" id="overlayStampBtn" data-act="stamp-toggle" title="Code Review Stamps (LGTM, BUG, SECURITY...)">STAMP ▾</button>
    <input class="lapdraw-color" type="color" value="#ff5c50" title="Color" />
    <input class="lapdraw-size" type="range" min="1" max="30" step="1" value="4" title="Stroke size ( [ / ] )" />
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" id="overlaySmart" data-act="smart" title="Smart Shape Assist (M)">SMART</button>
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" data-act="undo" title="Undo (U / Ctrl+Z)">↩</button>
    <button class="lapdraw-btn" data-act="redo" title="Redo (R / Ctrl+Shift+Z)">↪</button>
    <button class="lapdraw-btn" data-act="clear" title="Clear (X)">CLR</button>
    <button class="lapdraw-btn" data-act="save" title="Save PNG (S)">PNG</button>
    <button class="lapdraw-btn" data-act="copy" title="Copy PNG to Clipboard">COPY</button>
    <button class="lapdraw-btn" id="ghPrBtn" data-act="gh-pr" title="Copy for GitHub PR Review (Image + Markdown)">GH-PR</button>
    <button class="lapdraw-btn" id="notesBtn" data-act="notes" title="Doc & PDF Notes Notebook (N)">NOTES</button>
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" data-act="off" title="Turn off (Esc)">✕</button>
  `;

  const stampPopover = document.createElement("div");
  stampPopover.id = "lapdraw-stamp-popover";
  stampPopover.className = "lapdraw-stamp-popover hidden";
  stampPopover.innerHTML = `
    <div class="stamp-popover-title">CODE REVIEW STAMPS</div>
    <div class="stamp-popover-grid">
      <button class="stamp-choice-btn" data-stamp="LGTM" style="--c:#2ed573"><span class="stamp-icon">✓</span> LGTM</button>
      <button class="stamp-choice-btn" data-stamp="BUG" style="--c:#ff4757"><span class="stamp-icon">✖</span> BUG</button>
      <button class="stamp-choice-btn" data-stamp="SECURITY" style="--c:#a55eea"><span class="stamp-icon">🔒</span> SECURITY</button>
      <button class="stamp-choice-btn" data-stamp="NIT" style="--c:#ffa502"><span class="stamp-icon">✎</span> NIT</button>
      <button class="stamp-choice-btn" data-stamp="REQ" style="--c:#ff7f50"><span class="stamp-icon">⚠</span> REQ CHANGES</button>
      <button class="stamp-choice-btn" data-stamp="PERF" style="--c:#00d2d3"><span class="stamp-icon">⚡</span> PERF</button>
      <button class="stamp-choice-btn" data-stamp="QUESTION" style="--c:#1e90ff"><span class="stamp-icon">?</span> QUESTION</button>
    </div>
  `;

  const cleanUrlDisplay = (location.hostname || "local document") + (location.pathname.length > 24 ? location.pathname.slice(0, 24) + "…" : location.pathname);
  const notesPanel = document.createElement("div");
  notesPanel.id = "lapdraw-notes-panel";
  notesPanel.className = "lapdraw-notes-panel hidden";
  notesPanel.innerHTML = `
    <div class="lapdraw-notes-header">
      <div class="lapdraw-notes-title">
        <span class="lapdraw-notes-icon">📖</span>
        <span>DOCS &amp; PDF NOTEBOOK</span>
      </div>
      <button class="lapdraw-notes-close" id="notesCloseBtn" title="Close Notes">✕</button>
    </div>
    <div class="lapdraw-notes-meta">
      <span class="lapdraw-notes-url" id="notesUrlLabel"></span>
      <span class="lapdraw-notes-status" id="notesSaveStatus">Saved</span>
    </div>
    <div class="lapdraw-notes-tags">
      <button class="lapdraw-tag-btn" data-insert="- [ ] [TODO] ">+ [TODO]</button>
      <button class="lapdraw-tag-btn" data-insert="> 🔑 **[KEY POINT]**: ">+ [KEY]</button>
      <button class="lapdraw-tag-btn" data-insert="### 🔌 API: ">+ [API]</button>
      <button class="lapdraw-tag-btn" data-insert="- 🐞 **[BUG]**: ">+ [BUG]</button>
    </div>
    <textarea class="lapdraw-notes-area" id="notesArea" placeholder="Write persistent notes, technical findings, or architecture notes for this page or PDF. Auto-saved per URL into storage."></textarea>
    <div class="lapdraw-notes-foot">
      <button class="lapdraw-notes-action" id="notesSnapBtn" title="Embed screenshot of drawing into note">📸 Snap</button>
      <button class="lapdraw-notes-action" id="notesCopyBtn" title="Copy Markdown to Clipboard">📋 Copy MD</button>
      <button class="lapdraw-notes-action" id="notesExportBtn" title="Download Markdown file">💾 Export</button>
      <button class="lapdraw-notes-action del" id="notesClearBtn" title="Clear note for this page">CLR</button>
    </div>
  `;
  const notesUrlLabel = notesPanel.querySelector("#notesUrlLabel");
  if (notesUrlLabel) {
    notesUrlLabel.title = location.href;
    notesUrlLabel.textContent = cleanUrlDisplay;
  }

  const toastEl = document.createElement("div");
  toastEl.className = "lapdraw-overlay-toast";
  root.appendChild(canvas);
  root.appendChild(toolbar);
  root.appendChild(stampPopover);
  root.appendChild(notesPanel);
  root.appendChild(toastEl);
  document.documentElement.appendChild(root);

  const ctx = canvas.getContext("2d");
  const colorEl = toolbar.querySelector(".lapdraw-color");
  const sizeEl = toolbar.querySelector(".lapdraw-size");

  let enabled = sessionStorage.getItem(STATUS_KEY) === "1";
  let drawing = false;
  let current = null; // stroke being drawn
  let strokes = [];   // committed strokes
  let last = null;    // last drawn point
  let settings = { color: "#ff5c50", size: 4, tool: "pen" };
  let smartAssist = true;
  let redoStack = [];

  let holdTimer = null;
  let holdAnchor = null;
  let activeTextInput = null;

  const STAMP_CONFIG = {
    LGTM: { label: "LGTM", icon: "✓", color: "#2ed573", desc: "Looks good to me" },
    BUG: { label: "BUG", icon: "✖", color: "#ff4757", desc: "Bug detected" },
    SECURITY: { label: "SECURITY", icon: "🔒", color: "#a55eea", desc: "Security vulnerability" },
    NIT: { label: "NIT", icon: "✎", color: "#ffa502", desc: "Nitpick / code style" },
    REQ: { label: "REQ CHANGES", icon: "⚠", color: "#ff7f50", desc: "Changes requested" },
    PERF: { label: "PERF", icon: "⚡", color: "#00d2d3", desc: "Performance issue" },
    QUESTION: { label: "QUESTION", icon: "?", color: "#1e90ff", desc: "Needs clarification" }
  };
  let activeStampType = "LGTM";

  const getPageNoteKey = () => {
    return "lapdraw:notes:" + (location.protocol === "file:" ? location.href : location.origin + location.pathname);
  };

  let noteSaveTimer = null;
  function updateNotesBadge() {
    chrome.storage.local.get(getPageNoteKey(), (store) => {
      const saved = store[getPageNoteKey()];
      const notesBtn = toolbar.querySelector("#notesBtn");
      if (notesBtn) {
        if (saved && saved.trim()) {
          notesBtn.textContent = "NOTES •";
          notesBtn.classList.add("has-notes");
        } else {
          notesBtn.textContent = "NOTES";
          notesBtn.classList.remove("has-notes");
        }
      }
    });
  }

  function loadPageNote() {
    chrome.storage.local.get(getPageNoteKey(), (store) => {
      const area = notesPanel.querySelector("#notesArea");
      if (area) {
        area.value = store[getPageNoteKey()] || "";
      }
      updateNotesBadge();
    });
  }

  function savePageNote(text) {
    const status = notesPanel.querySelector("#notesSaveStatus");
    if (status) status.textContent = "Saving…";
    chrome.storage.local.set({ [getPageNoteKey()]: text }, () => {
      if (status) status.textContent = "Saved";
      updateNotesBadge();
    });
  }

  const dpr = () => window.devicePixelRatio || 1;
  const isShape = (tool) => tool === "line" || tool === "rect" || tool === "ellipse" || tool === "arrow" || tool === "spotlight";

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function syncControls() {
    if (activeOverlayEditor && settings.tool !== "text") {
      commitOverlayText();
    }
    if (canvas) {
      if (settings.tool === "text") canvas.style.cursor = "text";
      else if (settings.tool === "stamp") canvas.style.cursor = "copy";
      else canvas.style.cursor = "crosshair";
    }
    colorEl.value = settings.color;
    sizeEl.value = String(settings.size);
    toolbar.querySelectorAll("[data-act]").forEach((b) => {
      const act = b.dataset.act;
      if (["pen", "highlighter", "eraser", "line", "rect", "arrow", "text", "spotlight"].includes(act)) {
        b.classList.toggle("active", act === settings.tool);
      }
    });
    const stampBtn = toolbar.querySelector("#overlayStampBtn");
    if (stampBtn) {
      stampBtn.classList.toggle("active", settings.tool === "stamp");
      stampBtn.textContent = `STAMP: ${activeStampType} ▾`;
    }
    const smartBtn = toolbar.querySelector("#overlaySmart");
    if (smartBtn) smartBtn.classList.toggle("toggle-on", smartAssist);
  }

  function resizeCanvas() {
    const r = dpr();
    canvas.width = Math.round(window.innerWidth * r);
    canvas.height = Math.round(window.innerHeight * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    redraw();
  }

  function renderStrokeOn(stroke, c) {
    const isEraser = stroke.tool === "eraser";
    c.save();
    c.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    c.strokeStyle = isEraser ? "rgba(0,0,0,1)" : stroke.color;
    c.lineWidth = stroke.size * (isEraser ? 3 : 1);
    c.lineCap = "round";
    c.lineJoin = "round";

    if (stroke.tool === "highlighter") {
      c.save();
      c.globalAlpha = 0.38;
      c.strokeStyle = stroke.color;
      c.lineWidth = Math.max(16, stroke.size * 4);
      c.lineCap = "square";
      c.lineJoin = "bevel";
      if (stroke.points && stroke.points.length) {
        c.beginPath();
        const pts = stroke.points;
        c.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          c.lineTo(pts[i].x, pts[i].y);
        }
        c.stroke();
      }
      c.restore();
      return;
    }

    if (stroke.tool === "spotlight") {
      const x = Math.min(stroke.x1, stroke.x2);
      const y = Math.min(stroke.y1, stroke.y2);
      const w = Math.abs(stroke.x2 - stroke.x1);
      const h = Math.abs(stroke.y2 - stroke.y1);
      if (w > 4 && h > 4) {
        c.fillStyle = "rgba(10, 14, 18, 0.65)";
        c.fillRect(0, 0, window.innerWidth, y);
        c.fillRect(0, y + h, window.innerWidth, window.innerHeight - (y + h));
        c.fillRect(0, y, x, h);
        c.fillRect(x + w, y, window.innerWidth - (x + w), h);

        c.strokeStyle = stroke.color || "#64a8ff";
        c.lineWidth = 2;
        c.setLineDash([6, 4]);
        c.strokeRect(x, y, w, h);
        c.setLineDash([]);

        c.fillStyle = stroke.color || "#64a8ff";
        c.fillRect(x, Math.max(0, y - 22), 68, 22);
        c.fillStyle = "#0e1114";
        c.font = 'bold 10px "JetBrains Mono", monospace';
        c.textBaseline = "middle";
        c.fillText("● FOCUS", x + 6, Math.max(11, y - 11));
      }
      c.restore();
      return;
    }

    if (stroke.tool === "stamp") {
      const meta = STAMP_CONFIG[stroke.stampType] || STAMP_CONFIG.LGTM;
      const col = meta.color;
      const tag = `[${meta.label}]`;
      const note = stroke.text ? ` ${stroke.text}` : "";
      
      c.font = 'bold 11px "JetBrains Mono", monospace';
      const tagW = c.measureText(tag).width;
      c.font = '11px "JetBrains Mono", monospace';
      const noteW = stroke.text ? c.measureText(note).width : 0;
      const totalW = Math.max(90, tagW + noteW + 28);
      const totalH = 26;
      const sx = stroke.x;
      const sy = stroke.y;

      c.fillStyle = "rgba(14, 18, 24, 0.96)";
      c.fillRect(sx, sy, totalW, totalH);
      c.strokeStyle = col;
      c.lineWidth = 1.5;
      c.strokeRect(sx, sy, totalW, totalH);

      c.fillStyle = col;
      c.fillRect(sx, sy, 4, totalH);

      c.font = 'bold 11px "JetBrains Mono", monospace';
      c.fillStyle = col;
      c.textBaseline = "middle";
      c.fillText(`${meta.icon} ${tag}`, sx + 10, sy + totalH / 2);

      if (stroke.text) {
        c.font = '11px "JetBrains Mono", monospace';
        c.fillStyle = "#ccd4dc";
        c.fillText(note, sx + 10 + tagW + 14, sy + totalH / 2);
      }
      c.restore();
      return;
    }

    if (stroke.tool === "text") {
      const rawFs = stroke.fontSize || Math.max(12, stroke.size * 3);
      const sx = stroke.x;
      const sy = stroke.y;
      const lines = (stroke.text || "").split("\n");
      const lh = rawFs * 1.4;

      c.font = `${rawFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.textBaseline = "top";

      let maxW = 0;
      for (const line of lines) {
        const w = c.measureText(line).width;
        if (w > maxW) maxW = w;
      }
      const padX = stroke.card ? 10 : 0;
      const padY = stroke.card ? 8 : 0;
      const badgeH = stroke.badge ? 18 : 0;
      const totalW = maxW + padX * 2;
      const totalH = lines.length * lh + padY * 2 + badgeH;

      if (stroke.card) {
        c.fillStyle = "rgba(14, 18, 24, 0.94)";
        c.fillRect(sx, sy, totalW, totalH);
        c.strokeStyle = stroke.color;
        c.lineWidth = 1.5;
        c.strokeRect(sx, sy, totalW, totalH);
        c.fillStyle = stroke.color;
        c.fillRect(sx, sy, totalW, 2);
      }

      let startTextY = sy + padY;
      if (stroke.badge) {
        const bText = `[${stroke.badge.toUpperCase()}]`;
        c.font = `600 10px "JetBrains Mono", monospace`;
        const bw = c.measureText(bText).width + 8;
        c.fillStyle = stroke.color;
        c.fillRect(sx + padX, sy + padY, bw, 15);
        c.fillStyle = "#0e1114";
        c.fillText(bText, sx + padX + 4, sy + padY + 2);
        startTextY += 18;
      }

      c.font = `${rawFs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      c.fillStyle = isEraser ? "rgba(0,0,0,1)" : stroke.color;
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], sx + padX, startTextY + i * lh);
      }
      c.restore();
      return;
    }

    if (isShape(stroke.tool)) {
      c.beginPath();
      if (stroke.tool === "line") {
        c.moveTo(stroke.x1, stroke.y1);
        c.lineTo(stroke.x2, stroke.y2);
        c.stroke();
      } else if (stroke.tool === "arrow") {
        c.moveTo(stroke.x1, stroke.y1);
        c.lineTo(stroke.x2, stroke.y2);
        c.stroke();
        const ang = Math.atan2(stroke.y2 - stroke.y1, stroke.x2 - stroke.x1);
        const head = Math.max(8, stroke.size * 3);
        c.beginPath();
        c.moveTo(stroke.x2, stroke.y2);
        c.lineTo(stroke.x2 - head * Math.cos(ang - Math.PI / 6), stroke.y2 - head * Math.sin(ang - Math.PI / 6));
        c.lineTo(stroke.x2 - head * Math.cos(ang + Math.PI / 6), stroke.y2 - head * Math.sin(ang + Math.PI / 6));
        c.closePath();
        c.fillStyle = isEraser ? "rgba(0,0,0,1)" : stroke.color;
        c.fill();
      } else if (stroke.tool === "rect") {
        c.strokeRect(
          Math.min(stroke.x1, stroke.x2),
          Math.min(stroke.y1, stroke.y2),
          Math.abs(stroke.x2 - stroke.x1),
          Math.abs(stroke.y2 - stroke.y1)
        );
      }
      c.restore();
      return;
    }

    if (stroke.points && stroke.points.length) {
      c.beginPath();
      const pts = stroke.points;
      c.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) c.lineTo(pts[0].x + 0.01, pts[0].y + 0.01);
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2;
        const midY = (pts[i - 1].y + pts[i].y) / 2;
        c.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
        if (i === pts.length - 1) c.lineTo(pts[i].x, pts[i].y);
      }
      c.stroke();
    }
    c.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const s of strokes) renderStrokeOn(s, ctx);
    if (current) renderStrokeOn(current, ctx);
  }

  function setEnabled(on) {
    enabled = !!on;
    sessionStorage.setItem(STATUS_KEY, enabled ? "1" : "0");
    document.documentElement.classList.toggle("lapdraw-on", enabled);
    if (enabled) {
      resizeCanvas();
      syncControls();
      updateNotesBadge();
    } else {
      if (activeTextInput) {
        activeTextInput.remove();
        activeTextInput = null;
      }
      if (stampPopover) stampPopover.classList.add("hidden");
      if (notesPanel) notesPanel.classList.add("hidden");
    }
  }

  // Rich text editor for overlay
  let activeOverlayEditor = null;

  function hitTestOverlayText(x, y) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.tool !== "text") continue;
      const fs = s.fontSize || Math.max(12, s.size * 3);
      const lines = (s.text || "").split("\n");
      const maxLen = Math.max(1, ...lines.map((l) => l.length));
      const padX = s.card ? 10 : 0;
      const padY = s.card ? 8 : 0;
      const badgeH = s.badge ? 18 : 0;
      const w = maxLen * fs * 0.65 + padX * 2;
      const h = lines.length * fs * 1.4 + padY * 2 + badgeH;
      if (x >= s.x - 4 && x <= s.x + w + 8 && y >= s.y - 4 && y <= s.y + h + 8) {
        return { stroke: s, index: i };
      }
    }
    return null;
  }

  function commitOverlayText() {
    if (!activeOverlayEditor) return;
    const { el, x, y, getData } = activeOverlayEditor;
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
        x,
        y,
        text: data.text
      });
      redraw();
      toast(data.card ? "Saved code note" : "Saved note");
    }
    el.remove();
    activeOverlayEditor = null;
  }

  function cancelOverlayText(restoreStroke = null) {
    if (!activeOverlayEditor) return;
    const { el } = activeOverlayEditor;
    if (restoreStroke) {
      strokes.push(restoreStroke);
      redraw();
    }
    el.remove();
    activeOverlayEditor = null;
  }

  function handleOverlayTextClick(e) {
    if (activeOverlayEditor) commitOverlayText();

    const hit = hitTestOverlayText(e.clientX, e.clientY);
    if (hit) {
      const oldStroke = strokes.splice(hit.index, 1)[0];
      redraw();
      spawnOverlayTextEditor(oldStroke.x, oldStroke.y, oldStroke);
      return;
    }

    spawnOverlayTextEditor(e.clientX, e.clientY, null);
  }

  function spawnOverlayTextEditor(x, y, initialData = null) {
    if (activeOverlayEditor) commitOverlayText();

    const container = document.createElement("div");
    container.className = "lapdraw-text-editor";

    container.addEventListener("pointerdown", (e) => e.stopPropagation());
    container.addEventListener("mousedown", (e) => e.stopPropagation());
    container.addEventListener("click", (e) => e.stopPropagation());

    const editorW = 300;
    const editorH = 160;
    const left = Math.min(window.innerWidth - editorW - 16, Math.max(16, x - 8));
    const top = Math.min(window.innerHeight - editorH - 16, Math.max(16, y - 24));
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;

    let curFontSize = initialData?.fontSize || (settings.size <= 2 ? 14 : settings.size <= 4 ? 18 : 24);
    let isCard = initialData ? !!initialData.card : false;
    let curBadge = initialData?.badge || "";
    let curColor = initialData?.color || settings.color;

    // 1. Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "lapdraw-text-toolbar";

    const sizeGroup = document.createElement("div");
    sizeGroup.className = "lapdraw-text-group";
    const SIZES = [
      { label: "SM", val: 12 },
      { label: "MD", val: 16 },
      { label: "LG", val: 22 }
    ];
    const sizeBtns = SIZES.map(({ label, val }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lapdraw-text-chip" + (Math.abs(curFontSize - val) <= 2 ? " active" : "");
      b.textContent = label;
      b.onclick = () => {
        curFontSize = val;
        sizeBtns.forEach((btn) => btn.classList.remove("active"));
        b.classList.add("active");
        area.style.fontSize = `${Math.min(18, Math.max(11, val))}px`;
      };
      sizeGroup.appendChild(b);
      return b;
    });

    const cardBtn = document.createElement("button");
    cardBtn.type = "button";
    cardBtn.className = "lapdraw-text-chip" + (isCard ? " active" : "");
    cardBtn.textContent = "{ CODE }";
    cardBtn.onclick = () => {
      isCard = !isCard;
      cardBtn.classList.toggle("active", isCard);
    };

    const badgeSelect = document.createElement("select");
    badgeSelect.className = "lapdraw-text-select";
    const BADGES = ["TAG", "TODO", "BUG", "NOTE", "API"];
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
    area.className = "lapdraw-text-area";
    area.placeholder = "type note or code…\nShift+Enter: newline\nTab: indent\nEnter: save";
    area.value = initialData?.text || "";
    area.style.fontSize = `${Math.min(18, Math.max(11, curFontSize))}px`;
    area.style.color = curColor;

    const autoGrow = () => {
      area.style.height = "auto";
      area.style.height = Math.max(54, Math.min(200, area.scrollHeight + 4)) + "px";
    };
    area.addEventListener("input", autoGrow);

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
          commitOverlayText();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelOverlayText(initialData);
      }
    });

    container.appendChild(area);

    // 3. Footer
    const footer = document.createElement("div");
    footer.className = "lapdraw-text-footer";

    const hint = document.createElement("span");
    hint.className = "lapdraw-text-hint";
    hint.textContent = "↵ save · ⇧↵ line · ⇥ indent";
    footer.appendChild(hint);

    const actions = document.createElement("div");
    actions.className = "lapdraw-text-actions";

    if (initialData) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "lapdraw-text-btn del";
      delBtn.textContent = "DEL";
      delBtn.onclick = () => {
        cancelOverlayText(null);
        toast("Deleted note");
      };
      actions.appendChild(delBtn);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "lapdraw-text-btn";
    cancelBtn.textContent = "ESC";
    cancelBtn.onclick = () => cancelOverlayText(initialData);
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "lapdraw-text-btn save";
    saveBtn.textContent = "SAVE";
    saveBtn.onclick = () => commitOverlayText();
    actions.appendChild(saveBtn);

    footer.appendChild(actions);
    container.appendChild(footer);

    root.appendChild(container);
    autoGrow();

    setTimeout(() => {
      area.focus();
      if (initialData) {
        area.setSelectionRange(area.value.length, area.value.length);
      }
    }, 10);

    activeOverlayEditor = {
      el: container,
      x,
      y,
      getData: () => ({
        text: area.value,
        fontSize: curFontSize,
        card: isCard,
        badge: curBadge,
        color: curColor
      })
    };
  }

  function triggerOverlayQuickShape() {
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

  function hitTestOverlayStamp(x, y) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.tool !== "stamp") continue;
      const w = 120 + (s.text ? s.text.length * 8 : 0);
      if (x >= s.x - 4 && x <= s.x + w + 10 && y >= s.y - 4 && y <= s.y + 32) {
        return { stroke: s, index: i };
      }
    }
    return null;
  }

  function spawnStampCommentEditor(x, y, stamp) {
    const box = document.createElement("div");
    box.className = "lapdraw-stamp-comment-box";
    const left = Math.min(window.innerWidth - 300, Math.max(16, x));
    const top = Math.min(window.innerHeight - 80, Math.max(16, y + 30));
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.innerHTML = `
      <input type="text" class="stamp-comment-input" placeholder="Add review comment (Enter to save)…" />
      <div class="stamp-comment-actions">
        <button type="button" class="stamp-c-btn save">SAVE</button>
        <button type="button" class="stamp-c-btn del">DEL</button>
      </div>
    `;
    const input = box.querySelector(".stamp-comment-input");
    input.value = stamp.text || "";
    const save = () => {
      stamp.text = input.value.trim();
      if (!strokes.includes(stamp)) strokes.push(stamp);
      box.remove();
      redraw();
    };
    box.querySelector(".save").onclick = save;
    box.querySelector(".del").onclick = () => {
      const idx = strokes.indexOf(stamp);
      if (idx !== -1) strokes.splice(idx, 1);
      box.remove();
      redraw();
      toast("Removed stamp");
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (!strokes.includes(stamp)) strokes.push(stamp);
        box.remove();
        redraw();
      }
    };
    root.appendChild(box);
    setTimeout(() => input.focus(), 10);
  }

  // ----- Pointer Drawing Events -----
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    if (settings.tool === "stamp") {
      const hit = hitTestOverlayStamp(e.clientX, e.clientY);
      if (hit) {
        const old = strokes.splice(hit.index, 1)[0];
        redraw();
        spawnStampCommentEditor(old.x, old.y, old);
        return;
      }
      const newStamp = {
        tool: "stamp",
        stampType: activeStampType,
        x: e.clientX,
        y: e.clientY,
        text: ""
      };
      strokes.push(newStamp);
      redraw();
      toast(`Stamped ${activeStampType}`);
      spawnStampCommentEditor(e.clientX, e.clientY, newStamp);
      return;
    }

    if (settings.tool === "text") {
      handleOverlayTextClick(e);
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    drawing = true;
    redoStack = [];
    const tool = settings.tool;

    if (tool === "highlighter") {
      current = {
        tool: "highlighter",
        color: settings.color,
        size: settings.size,
        points: [{ x: e.clientX, y: e.clientY }]
      };
      last = null;
      drawLive(e.clientX, e.clientY);
      return;
    }

    current = isShape(tool)
      ? {
          tool,
          color: settings.color,
          size: settings.size,
          x1: e.clientX,
          y1: e.clientY,
          x2: e.clientX,
          y2: e.clientY,
          shift: e.shiftKey
        }
      : {
          tool,
          color: settings.color,
          size: settings.size,
          points: [{ x: e.clientX, y: e.clientY }],
          isSnapped: false
        };

    last = null;
    holdAnchor = { x: e.clientX, y: e.clientY, time: Date.now() };
    clearTimeout(holdTimer);
    if (tool === "pen") {
      holdTimer = setTimeout(triggerOverlayQuickShape, 440);
    }
    drawLive(e.clientX, e.clientY);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || !current) {
      if (settings.tool === "text") {
        const hit = hitTestOverlayText(e.clientX, e.clientY);
        canvas.style.cursor = hit ? "pointer" : "text";
      } else if (settings.tool === "stamp") {
        const hit = hitTestOverlayStamp(e.clientX, e.clientY);
        canvas.style.cursor = hit ? "pointer" : "copy";
      }
      return;
    }

    if (current.isSnapped || isShape(current.tool)) {
      current.x2 = e.clientX;
      current.y2 = e.clientY;
      current.shift = e.shiftKey;
      if (current.shift && (current.tool === "line" || current.tool === "arrow")) {
        const dx = current.x2 - current.x1;
        const dy = current.y2 - current.y1;
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        current.x2 = current.x1 + Math.cos(ang) * len;
        current.y2 = current.y1 + Math.sin(ang) * len;
      }
      redraw();
      return;
    }

    if (holdAnchor) {
      if (Math.hypot(e.clientX - holdAnchor.x, e.clientY - holdAnchor.y) > 9) {
        holdAnchor = { x: e.clientX, y: e.clientY, time: Date.now() };
        clearTimeout(holdTimer);
        if (current.tool === "pen") {
          holdTimer = setTimeout(triggerOverlayQuickShape, 440);
        }
      }
    }

    current.points.push({ x: e.clientX, y: e.clientY });
    drawLive(e.clientX, e.clientY);
  });

  const endStroke = () => {
    clearTimeout(holdTimer);
    holdAnchor = null;
    if (!drawing) return;
    drawing = false;
    if (!current) return;

    if (isShape(current.tool)) {
      if (Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 4) {
        current = null;
        redraw();
        return;
      }
      strokes.push(current);
      current = null;
      last = null;
      redraw();
      return;
    }

    if (current.points && current.points.length) {
      if (typeof LapDrawIntelligence !== "undefined") {
        current.points = LapDrawIntelligence.stripFishhook(current.points);
      }
      if (smartAssist && current.tool === "pen" && typeof LapDrawIntelligence !== "undefined") {
        const rec = LapDrawIntelligence.recognizeShape(current.points);
        if (rec) {
          current = {
            tool: rec.type,
            color: current.color,
            size: current.size,
            x1: rec.x1,
            y1: rec.y1,
            x2: rec.x2,
            y2: rec.y2
          };
          toast(`✦ Snapped to ${rec.type.toUpperCase()}`);
          strokes.push(current);
          current = null;
          last = null;
          redraw();
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
  };

  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setEnabled(false);
  });
  canvas.addEventListener("pointerleave", endStroke);

  function drawLive(x, y) {
    if (!current || !current.points) return;

    if (current.tool === "highlighter") {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = current.color;
      ctx.lineWidth = Math.max(16, current.size * 4);
      ctx.lineCap = "square";
      ctx.lineJoin = "bevel";
      ctx.beginPath();
      if (!last) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.01, y + 0.01);
        ctx.stroke();
        last = { x, y };
        ctx.restore();
        return;
      }
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      last = { x, y };
      return;
    }

    const isEraser = current.tool === "eraser";
    ctx.save();
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : current.color;
    ctx.lineWidth = current.size * (isEraser ? 3 : 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (!last) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01);
      ctx.stroke();
      last = { x, y, midx: x, midy: y };
      ctx.restore();
      return;
    }
    const midX = (last.x + x) / 2;
    const midY = (last.y + y) / 2;
    ctx.moveTo(last.midx, last.midy);
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    last = { x, y, midx: midX, midy: (last.y + y) / 2 };
  }

  // ----- Screenshot & Export Helpers -----
  async function compositeDrawingOnPage() {
    const res = await chrome.runtime.sendMessage({ type: "lapdraw:capture" });
    if (!res || res.error || !res.dataUrl) return null;
    const img = new Image();
    await new Promise((ok, bad) => {
      img.onload = ok;
      img.onerror = bad;
      img.src = res.dataUrl;
    });
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext("2d");
    octx.drawImage(img, 0, 0, out.width, out.height);
    octx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    for (const s of strokes) renderStrokeOn(s, octx);
    return out;
  }

  async function savePng() {
    toast("Saving PNG screenshot…");
    const out = await compositeDrawingOnPage();
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `lapdraw-${location.hostname.replace(/^www\./, "")}-${Date.now()}.png`;
    a.click();
    toast("Saved PNG");
  }

  async function copyPngToClipboard() {
    toast("Capturing screenshot…");
    const out = await compositeDrawingOnPage();
    if (!out) return;
    out.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast("Copied screenshot + annotations to clipboard");
      } catch {
        toast("Clipboard blocked by browser");
      }
    }, "image/png");
  }

  async function copyGitHubPrReview() {
    toast("Generating GitHub PR review…");
    const out = await compositeDrawingOnPage();
    if (!out) return;

    out.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } catch (e) {
          console.warn("Image clipboard blocked", e);
        }
      }
    }, "image/png");

    const stampsFound = [];
    for (const s of strokes) {
      if (s.tool === "stamp") {
        const meta = STAMP_CONFIG[s.stampType] || { label: s.stampType, icon: "•" };
        stampsFound.push(`- ${meta.icon} **[${meta.label}]** ${s.text ? `— ${s.text}` : ""}`);
      } else if (s.tool === "text" && s.badge) {
        stampsFound.push(`- 🏷️ **[${s.badge.toUpperCase()}]** ${s.text}`);
      }
    }

    const title = document.title || location.href;
    const now = new Date().toISOString().replace("T", " ").slice(0, 16);
    let md = `### 🔍 LapDraw Code Review\n`;
    md += `> **Review Target**: [${title}](${location.href})\n`;
    md += `> **Timestamp**: ${now}\n`;
    md += `> *(Annotated review screenshot copied to clipboard — press \`Ctrl+V\` to paste directly into your GitHub comment)*\n\n`;

    if (stampsFound.length > 0) {
      md += `#### 📌 Review Callouts:\n${stampsFound.join("\n")}\n\n`;
    } else {
      md += `#### 📌 Review Callouts:\n- Visual inspection annotations stamped on code diff.\n\n`;
    }
    md += `---\n*Generated with [LapDraw](https://github.com/SachinyadavAug20/lapdraw)*`;

    const notesArea = notesPanel.querySelector("#notesArea");
    if (notesArea) {
      notesArea.value = (notesArea.value ? notesArea.value + "\n\n" : "") + md;
      savePageNote(notesArea.value);
    }

    toast("✔ Screenshot copied! Paste with Ctrl+V on GitHub PR");
  }

  // Connect Notes Panel Events
  notesPanel.querySelector("#notesCloseBtn").onclick = () => {
    notesPanel.classList.add("hidden");
  };
  notesPanel.querySelector("#notesArea").oninput = (e) => {
    clearTimeout(noteSaveTimer);
    notesPanel.querySelector("#notesSaveStatus").textContent = "Typing…";
    noteSaveTimer = setTimeout(() => {
      savePageNote(e.target.value);
    }, 350);
  };
  notesPanel.querySelectorAll(".lapdraw-tag-btn").forEach((btn) => {
    btn.onclick = () => {
      const area = notesPanel.querySelector("#notesArea");
      const tag = btn.dataset.insert;
      const start = area.selectionStart || area.value.length;
      area.value = area.value.slice(0, start) + tag + area.value.slice(start);
      area.selectionStart = area.selectionEnd = start + tag.length;
      area.focus();
      savePageNote(area.value);
    };
  });
  notesPanel.querySelector("#notesSnapBtn").onclick = async () => {
    const now = new Date().toLocaleTimeString();
    const area = notesPanel.querySelector("#notesArea");
    area.value += `\n\n### 📸 Annotation Snapshot (${now})\n> *Visual annotations captured at ${now}.*\n`;
    savePageNote(area.value);
    toast("Added snapshot marker to notes");
  };
  notesPanel.querySelector("#notesCopyBtn").onclick = () => {
    const area = notesPanel.querySelector("#notesArea");
    const title = document.title || location.href;
    const md = `# Notes: ${title}\n> URL: ${location.href}\n> Saved: ${new Date().toLocaleString()}\n\n${area.value}\n`;
    navigator.clipboard.writeText(md).then(() => toast("Copied markdown notes to clipboard"));
  };
  notesPanel.querySelector("#notesExportBtn").onclick = () => {
    const area = notesPanel.querySelector("#notesArea");
    const title = (document.title || "notes").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const md = `# Notes: ${document.title || location.href}\n> URL: ${location.href}\n\n${area.value}\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LapDraw-${title}-${Date.now()}.md`;
    a.click();
    toast("Exported notes markdown");
  };
  notesPanel.querySelector("#notesClearBtn").onclick = () => {
    if (confirm("Clear all notes for this page?")) {
      notesPanel.querySelector("#notesArea").value = "";
      savePageNote("");
      toast("Cleared page notes");
    }
  };

  // Connect Stamp Popover Events
  stampPopover.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-stamp]");
    if (btn) {
      activeStampType = btn.dataset.stamp;
      settings.tool = "stamp";
      stampPopover.classList.add("hidden");
      syncControls();
      toast(`Selected ${activeStampType} stamp — click page to place`);
    }
  });

  function onAction(act) {
    switch (act) {
      case "pen":
      case "highlighter":
      case "eraser":
      case "line":
      case "rect":
      case "arrow":
      case "text":
      case "spotlight":
        settings.tool = act;
        stampPopover.classList.add("hidden");
        chrome.storage.local.set({ "lapdraw:settings": settings });
        syncControls();
        break;
      case "stamp-toggle":
        stampPopover.classList.toggle("hidden");
        break;
      case "gh-pr":
        copyGitHubPrReview();
        break;
      case "notes":
        notesPanel.classList.toggle("hidden");
        if (!notesPanel.classList.contains("hidden")) {
          loadPageNote();
        }
        break;
      case "smart":
        smartAssist = !smartAssist;
        chrome.storage.local.set({ [PREFS_KEY]: { smartAssist } });
        syncControls();
        toast(smartAssist ? "Smart Shape Assist ON" : "Smart Assist OFF");
        break;
      case "undo": {
        const s = strokes.pop();
        if (s) {
          redoStack.push(s);
          redraw();
        }
        break;
      }
      case "redo": {
        const s = redoStack.pop();
        if (s) {
          strokes.push(s);
          redraw();
        }
        break;
      }
      case "clear":
        redoStack.push(...strokes.reverse());
        strokes = [];
        redraw();
        break;
      case "save":
        savePng();
        break;
      case "copy":
        copyPngToClipboard();
        break;
      case "off":
        setEnabled(false);
        break;
    }
  }

  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (btn) onAction(btn.dataset.act);
  });

  colorEl.addEventListener("input", () => {
    settings.color = colorEl.value;
    chrome.storage.local.set({ "lapdraw:settings": settings });
    syncControls();
  });

  sizeEl.addEventListener("input", () => {
    settings.size = Number(sizeEl.value);
    chrome.storage.local.set({ "lapdraw:settings": settings });
    syncControls();
  });

  // Capture phase keys remappable via options
  const DEFAULT_OVERLAY_KEYS = {
    pen: "p",
    highlighter: "h",
    eraser: "e",
    line: "l",
    rect: "r",
    arrow: "a",
    text: "t",
    spotlight: "f",
    stamp: "k",
    notes: "n",
    ghpr: "g",
    smart: "m",
    undo: "u,z,ctrl+z",
    redo: "r,ctrl+shift+z,ctrl+y",
    clear: "x",
    save: "s,ctrl+s",
    copy: "c",
    sizedown: "[",
    sizeup: "]",
    exit: "escape"
  };
  let overlayBindings = {};

  function rebuildOverlayBindings() {
    const base = {};
    for (const [action, combos] of Object.entries(DEFAULT_OVERLAY_KEYS)) {
      for (const c of combos.split(",")) base[c.trim()] = action;
    }
    const apply = (user) => {
      overlayBindings = base;
      if (user) {
        overlayBindings = { ...base };
        for (const combo of Object.keys(user)) overlayBindings[combo] = user[combo];
      }
    };
    chrome.storage.local.get("lapdraw:keymap", (store) =>
      apply(store["lapdraw:keymap"] && store["lapdraw:keymap"].overlay)
    );
  }
  rebuildOverlayBindings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["lapdraw:keymap"]) rebuildOverlayBindings();
  });

  const overlayCombo = (e) => {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(e.key === " " ? "space" : e.key.toLowerCase());
    return parts.join("+");
  };

  const OVERLAY_ACTIONS = {
    pen: () => onAction("pen"),
    highlighter: () => onAction("highlighter"),
    eraser: () => onAction("eraser"),
    line: () => onAction("line"),
    rect: () => onAction("rect"),
    arrow: () => onAction("arrow"),
    text: () => onAction("text"),
    spotlight: () => onAction("spotlight"),
    stamp: () => onAction("stamp-toggle"),
    notes: () => onAction("notes"),
    ghpr: () => onAction("gh-pr"),
    smart: () => onAction("smart"),
    undo: () => onAction("undo"),
    redo: () => onAction("redo"),
    clear: () => onAction("clear"),
    save: () => onAction("save"),
    copy: () => onAction("copy"),
    sizedown: () => {
      sizeEl.value = String(Math.max(1, settings.size - 1));
      sizeEl.dispatchEvent(new Event("input"));
    },
    sizeup: () => {
      sizeEl.value = String(Math.min(30, settings.size + 1));
      sizeEl.dispatchEvent(new Event("input"));
    },
    exit: () => setEnabled(false)
  };

  window.addEventListener(
    "keydown",
    (e) => {
      if (!enabled) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const action = overlayBindings[overlayCombo(e)];
      if (action && OVERLAY_ACTIONS[action]) {
        e.preventDefault();
        e.stopPropagation();
        OVERLAY_ACTIONS[action]();
      }
    },
    true
  );

  // Runtime messaging
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case "lapdraw:toggle":
        setEnabled(!enabled);
        sendResponse({ enabled });
        break;
      case "lapdraw:enable":
        setEnabled(true);
        sendResponse({ enabled: true });
        break;
      case "lapdraw:disable":
        setEnabled(false);
        sendResponse({ enabled: false });
        break;
      case "lapdraw:get-state":
        sendResponse({ enabled, ...settings, smartAssist });
        break;
      case "lapdraw:set-settings":
        settings = { ...settings, ...msg.settings };
        syncControls();
        sendResponse({ ok: true });
        break;
      case "lapdraw:action":
        onAction(msg.action);
        sendResponse({ ok: true });
        break;
    }
    return true;
  });

  window.addEventListener("resize", () => {
    if (enabled) resizeCanvas();
  });

  // Load preferences
  chrome.storage.local.get(["lapdraw:settings", PREFS_KEY], (store) => {
    if (store["lapdraw:settings"]) {
      settings = { ...settings, ...store["lapdraw:settings"] };
    }
    if (store[PREFS_KEY] && typeof store[PREFS_KEY].smartAssist === "boolean") {
      smartAssist = store[PREFS_KEY].smartAssist;
    }
    syncControls();
  });

  if (enabled) setEnabled(true);
})();
