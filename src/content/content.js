// LapDraw content script — draws on the current page with the trackpad.
// Design notes for trackpad-first UX:
//  - Pointer events (works for trackpad click-drag, mouse, pen, touch)
//  - Strokes are stored in CSS pixels so they stay anchored while the page scrolls
//  - Midpoint quadratic smoothing for low-lag, "stylus-like" strokes with hardware mice

(() => {
  const STATUS_KEY = "lapdraw:enabled";
  const root = document.createElement("div");
  root.id = "lapdraw-root";

  const canvas = document.createElement("canvas");
  canvas.className = "lapdraw-canvas";

  const toolbar = document.createElement("div");
  toolbar.className = "lapdraw-toolbar";
  toolbar.innerHTML = `
    <button class="lapdraw-btn" data-act="pen" title="Pen">✏ Pen</button>
    <button class="lapdraw-btn" data-act="eraser" title="Eraser">🧽</button>
    <input class="lapdraw-color" type="color" value="#ff5c5c" title="Color" />
    <input class="lapdraw-size" type="range" min="1" max="30" step="1" value="4" title="Stroke size" />
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" data-act="undo" title="Undo (U / Ctrl+Z)">↩</button>
    <button class="lapdraw-btn" data-act="redo" title="Redo (R / Ctrl+Shift+Z)">↪</button>
    <button class="lapdraw-btn" data-act="clear" title="Clear (X)">Clear</button>
    <button class="lapdraw-btn" data-act="save" title="Save PNG (S)">💾 Save</button>
    <div class="lapdraw-sep"></div>
    <button class="lapdraw-btn" data-act="off" title="Turn off (Esc)">✕</button>
  `;

  root.appendChild(canvas);
  root.appendChild(toolbar);
  document.documentElement.appendChild(root);

  const ctx = canvas.getContext("2d");
  const colorEl = toolbar.querySelector(".lapdraw-color");
  const sizeEl = toolbar.querySelector(".lapdraw-size");

  let enabled = sessionStorage.getItem(STATUS_KEY) === "1";
  let drawing = false;
  let current = null; // stroke being drawn
  let strokes = []; // committed strokes: {tool, color, size, points:[{x,y}]}
  let last = null; // last drawn point {x,y,midx,midy}
  let settings = { color: "#ff5c5c", size: 4, tool: "pen" };

  const dpr = () => window.devicePixelRatio || 1;

  function syncControls() {
    colorEl.value = settings.color;
    sizeEl.value = String(settings.size);
    toolbar.querySelectorAll('[data-act="pen"],[data-act="eraser"]').forEach((b) =>
      b.classList.toggle("active", b.dataset.act === settings.tool)
    );
    root.style.setProperty("--lapdraw-color", settings.color);
  }

  function resizeCanvas() {
    const r = dpr();
    canvas.width = Math.round(window.innerWidth * r);
    canvas.height = Math.round(window.innerHeight * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    redraw();
  }

  function strokePath(stroke, from) {
    const isEraser = stroke.tool === "eraser";
    ctx.save();
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : stroke.color;
    ctx.lineWidth = stroke.size * (isEraser ? 3 : 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const pts = stroke.points;
    const start = from || 0;
    ctx.moveTo(pts[start].x, pts[start].y);
    if (pts.length === start + 1) {
      ctx.lineTo(pts[start].x + 0.01, pts[start].y + 0.01); // dots need a segment
    }
    for (let i = start + 1; i < pts.length; i++) {
      const midX = (pts[i - 1].x + pts[i].x) / 2;
      const midY = (pts[i - 1].y + pts[i].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
      if (i === pts.length - 1) ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    strokes.forEach((s) => strokePath(s));
  }

  function setEnabled(on) {
    enabled = !!on;
    sessionStorage.setItem(STATUS_KEY, enabled ? "1" : "0");
    document.documentElement.classList.toggle("lapdraw-on", enabled);
    if (enabled) {
      resizeCanvas();
      syncControls();
    }
  }

  function toggle() {
    setEnabled(!enabled);
  }

  // ----- Pointer handling -----
  function pos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled || e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    redoStack = [];
    current = {
      tool: settings.tool,
      color: settings.color,
      size: Number(sizeEl.value),
      points: [pos(e)]
    };
    last = null;
    ctx.save();
    ctx.globalCompositeOperation = current.tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = current.tool === "eraser" ? "rgba(0,0,0,1)" : current.color;
    ctx.beginPath();
    const r = (current.size * (current.tool === "eraser" ? 3 : 1)) / 2;
    ctx.arc(e.clientX, e.clientY, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const { x, y } = pos(e);
    current.points.push({ x, y });
    drawLive(x, y);
  });

  const endStroke = (e) => {
    if (!drawing) return;
    drawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}
    strokes.push(current);
    current = null;
    last = null;
  };

  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  // In drawing mode the user intends to draw, not scroll the page
  canvas.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setEnabled(false);
  });
  canvas.addEventListener("pointerleave", endStroke);

  function drawLive(x, y) {
    if (!current) return;
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

  // ----- Toolbar & keyboard -----
  async function savePng() {
    const res = await chrome.runtime.sendMessage({ type: "lapdraw:capture" });
    if (!res || res.error || !res.dataUrl) return;
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
    strokes.forEach((s) => {
      strokesEachOnCtx(s, octx);
    });
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `lapdraw-${location.hostname.replace(/^www\./, "")}-${Date.now()}.png`;
    a.click();
  }

  function strokesEachOnCtx(stroke, c) {
    const isEraser = stroke.tool === "eraser";
    c.save();
    c.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    c.strokeStyle = isEraser ? "rgba(0,0,0,1)" : stroke.color;
    c.lineWidth = stroke.size * (isEraser ? 3 : 1);
    c.lineCap = "round";
    c.lineJoin = "round";
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
    c.restore();
  }

  let redoStack = [];

  function onAction(act) {
    switch (act) {
      case "pen":
      case "eraser":
        settings.tool = act;
        chrome.storage.local.set({ "lapdraw:settings": settings });
        syncControls();
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
      case "off":
        setEnabled(false);
        break;
    }
  }

  toolbar.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) onAction(btn.dataset.act);
  });

  colorEl.addEventListener("input", () => {
    settings.color = colorEl.value;
    chrome.storage.local.set({ "lapdraw:settings": settings });
  });

  sizeEl.addEventListener("input", () => {
    settings.size = Number(sizeEl.value);
    chrome.storage.local.set({ "lapdraw:settings": settings });
  });

  // Capture phase + preventDefault so page scripts don't fight LapDraw keys.
  // Bindings are remappable from the options page ("lapdraw:keymap".overlay).
  const DEFAULT_OVERLAY_KEYS = {
    pen: "p",
    eraser: "e",
    undo: "u,z,ctrl+z",
    redo: "r,ctrl+shift+z,ctrl+y",
    clear: "x",
    save: "s,ctrl+s",
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
    eraser: () => onAction(settings.tool === "eraser" ? "pen" : "eraser"),
    undo: () => onAction("undo"),
    redo: () => onAction("redo"),
    clear: () => onAction("clear"),
    save: () => onAction("save"),
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

  window.addEventListener("resize", resizeCanvas);

  // ----- Messages from popup/background -----
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg && msg.type) {
      case "lapdraw:toggle":
        toggle();
        break;
      case "lapdraw:enable":
        setEnabled(true);
        break;
      case "lapdraw:disable":
        setEnabled(false);
        break;
      case "lapdraw:get-state":
        sendResponse({
          enabled,
          color: settings.color,
          size: settings.size,
          tool: settings.tool
        });
        return true;
      case "lapdraw:tool":
        settings.tool = msg.tool;
        syncControls();
        return false;
      case "lapdraw:color":
        settings.color = msg.color;
        syncControls();
        return false;
      case "lapdraw:size":
        settings.size = msg.size;
        sizeEl.value = String(msg.size);
        return false;
      case "lapdraw:undo":
        onAction("undo");
        return false;
      case "lapdraw:redo":
        onAction("redo");
        return false;
      case "lapdraw:toggle-eraser":
        onAction(settings.tool === "eraser" ? "pen" : "eraser");
        return false;
      case "lapdraw:clear":
        onAction("clear");
        return false;
      case "lapdraw:save":
        onAction("save");
        return false;
    }
    return false;
  });

  // Keep toolbar in sync when popup changes shared settings
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes["lapdraw:settings"]) return;
    settings = { ...settings, ...changes["lapdraw:settings"].newValue };
    syncControls();
  });

  // Restore persisted settings on load
  chrome.storage.local.get("lapdraw:settings", (store) => {
    if (store["lapdraw:settings"]) {
      settings = { ...settings, ...store["lapdraw:settings"] };
    }
    if (enabled) {
      document.documentElement.classList.add("lapdraw-on");
      resizeCanvas();
      syncControls();
    }
  });
})();
