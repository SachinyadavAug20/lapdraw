// LapDraw options — remap canvas + overlay keys, stored in chrome.storage.local
// under "lapdraw:keymap" = { canvas: {combo: action}, overlay: {combo: action} }.

const STORE = "lapdraw:keymap";
const $ = (sel) => document.querySelector(sel);

const CANVAS_DEFAULTS = {
  pen: "p",
  eraser: "e",
  line: "l",
  rect: "r",
  ellipse: "o",
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

const OVERLAY_DEFAULTS = {
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

const LABELS = {
  pen: "Pen / freehand",
  eraser: "Eraser",
  line: "Line tool",
  rect: "Rectangle tool",
  ellipse: "Ellipse tool",
  sizeup: "Stroke size +",
  sizedown: "Stroke size −",
  zoomin: "Zoom in",
  zoomout: "Zoom out",
  fit: "Fit all content",
  resetzoom: "Reset zoom 100%",
  undo: "Undo",
  redo: "Redo",
  clear: "Clear canvas",
  save: "Export PNG",
  zen: "Hide toolbar (zen)",
  help: "Cheat sheet",
  cancel: "Cancel / close panels",
  panup: "Pan up",
  pandown: "Pan down",
  panleft: "Pan left",
  panright: "Pan right",
  exit: "Turn drawing off"
};

// mirror of the runtime combo builder (newtab.js / content.js)
function comboFromEvent(e) {
  if (e.key === "Escape") return null; // Esc clears a binding instead of re-binding
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  if (["Color", "Range", "Checkbox"].includes(e.target.type)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key === " " ? "space" : e.key.toLowerCase());
  return parts.join("+");
}

// normalize default strings into single combos
function splitCombos(str) {
  return str.split(",").map((s) => s.trim());
}

async function load() {
  const store = await chrome.storage.local.get(STORE);
  const user = store[STORE] || {};
  return {
    canvas: { ...CANVAS_DEFAULTS, ...(user.canvas ? stripToCombos(user.canvas, CANVAS_DEFAULTS) : {}) },
    overlay: { ...OVERLAY_DEFAULTS, ...(user.overlay ? stripToCombos(user.overlay, OVERLAY_DEFAULTS) : {}) }
  };
}

// user keymap stores combo->action; invert back to action->combos for editing
function stripToCombos(map, defaults) {
  const out = {};
  for (const [combo, action] of Object.entries(map)) {
    out[action] = out[action] ? `${out[action]},${combo}` : combo;
  }
  return out;
}

function invert(section) {
  const map = {};
  for (const [action, combos] of Object.entries(section)) {
    for (const combo of splitCombos(combos)) map[combo] = action;
  }
  return map;
}

async function save(model) {
  await chrome.storage.local.set({
    [STORE]: { canvas: invert(model.canvas), overlay: invert(model.overlay) }
  });
  const el = $("#saved");
  el.textContent = "saved ✓";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1500);
}

let model;
let listeningBtn = null;

async function init() {
  model = await load();
  render("canvas", $("#canvasRows"));
  render("overlay", $("#overlayRows"));
}

function render(section, root) {
  root.innerHTML = "";
  for (const [action, combos] of Object.entries(model[section])) {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("label");
    label.textContent = LABELS[action] || action;
    const btn = document.createElement("button");
    btn.className = "keybtn";
    if (model[section][action] !== defaultsFor(section)[action]) btn.classList.add("custom");
    btn.textContent = combos.replaceAll(",", " · ");
    btn.dataset.section = section;
    btn.dataset.action = action;
    btn.addEventListener("click", () => startListening(btn));
    row.appendChild(label);
    row.appendChild(btn);
    root.appendChild(row);
  }
}

function defaultsFor(section) {
  return section === "canvas" ? CANVAS_DEFAULTS : OVERLAY_DEFAULTS;
}

function startListening(btn) {
  if (listeningBtn) listeningBtn.classList.remove("listening");
  listeningBtn = btn;
  btn.classList.add("listening");
  btn.textContent = "press keys…";
  const { section, action } = btn.dataset;

  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("keydown", onKey, true);
    btn.classList.remove("listening");
    listeningBtn = null;
    if (e.key === "Escape" || e.key === "Backspace") {
      btn.textContent = defaultsFor(section)[action];
      model[section][action] = btn.textContent;
      save(model).then(() => render(section, btn.closest(".rows")));
      return;
    }
    const combo = comboFromEvent(e);
    if (!combo) {
      btn.textContent = model[section][action].replaceAll(",", " · ");
      return;
    }
    model[section][action] = combo;
    btn.textContent = combo.toUpperCase();
    save(model).then(() => render(section, btn.closest(".rows")));
  };
  window.addEventListener("keydown", onKey, true);
}

$("#reset")?.addEventListener("click", async () => {
  await chrome.storage.local.remove(STORE);
  location.reload();
});

init();
