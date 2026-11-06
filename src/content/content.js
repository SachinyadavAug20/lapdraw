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
    <button class="lapdraw-btn" data-act="eraser" title="Eraser (E)">ERS</button>
    <button class="lapdraw-btn" data-act="line" title="Line (L)">LIN</button>
    <button class="lapdraw-btn" data-act="rect" title="Box / Rect (R)">BOX</button>
    <button class="lapdraw-btn" data-act="arrow" title="Arrow (A)">ARR</button>
    <button class="lapdraw-btn" data-act="text" title="Text (T)">TXT</button>
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
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" data-act="off" title="Turn off (Esc)">✕</button>
  `;

  const toastEl = document.createElement("div");
  toastEl.className = "lapdraw-overlay-toast";
  root.appendChild(canvas);
  root.appendChild(toolbar);
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

  const dpr = () => window.devicePixelRatio || 1;
  const isShape = (tool) => tool === "line" || tool === "rect" || tool === "ellipse" || tool === "arrow";

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
    if (canvas) canvas.style.cursor = settings.tool === "text" ? "text" : "crosshair";
    colorEl.value = settings.color;
    sizeEl.value = String(settings.size);
    toolbar.querySelectorAll("[data-act]").forEach((b) => {
      const act = b.dataset.act;
      if (["pen", "eraser", "line", "rect", "arrow", "text"].includes(act)) {
        b.classList.toggle("active", act === settings.tool);
      }
    });
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
    } else {
      if (activeTextInput) {
        activeTextInput.remove();
        activeTextInput = null;
      }
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

  // ----- Pointer Drawing Events -----
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    if (settings.tool === "text") {
      handleOverlayTextClick(e);
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    drawing = true;
    redoStack = [];
    const tool = settings.tool;

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

  function onAction(act) {
    switch (act) {
      case "pen":
      case "eraser":
      case "line":
      case "rect":
      case "arrow":
      case "text":
        settings.tool = act;
        chrome.storage.local.set({ "lapdraw:settings": settings });
        syncControls();
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
    eraser: "e",
    line: "l",
    rect: "r",
    arrow: "a",
    text: "t",
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
    eraser: () => onAction("eraser"),
    line: () => onAction("line"),
    rect: () => onAction("rect"),
    arrow: () => onAction("arrow"),
    text: () => onAction("text"),
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
