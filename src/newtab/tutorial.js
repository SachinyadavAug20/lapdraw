// LapDraw tutorial — guided first-run on the infinite canvas.
// Steps auto-complete as the user actually performs them; Next/Skip always available.

const TUT_STORE = "lapdraw:tutorial-done";

const STEPS = [
  {
    id: "draw",
    title: "Draw",
    body: "Click-drag anywhere on the grid with your trackpad — strokes smooth themselves mid-air. Try it now: this step ticks itself."
  },
  {
    id: "pan",
    title: "Pan",
    body: "Two-finger scroll moves the board. Space+drag, Shift+drag or arrow keys work too."
  },
  {
    id: "zoom",
    title: "Zoom",
    body: "Pinch on the trackpad, or Ctrl/Cmd + scroll. + / − keys zoom around the center; 0 fits your content."
  },
  {
    id: "tools",
    title: "Shapes & QuickShape",
    body: "Pick PEN, ERS, LIN, BOX, OVL, ARR, TXT. Draw any rough line or box and hold still for 450ms — QuickShape snaps it clean!"
  },
  {
    id: "undo",
    title: "History & Toggles",
    body: "Ctrl+Z undoes, Ctrl+Shift+Z redoes. M toggles Smart Assist, G toggles Grid Snap."
  },
  {
    id: "export",
    title: "Developer Export",
    body: "EXP ▾ → Copy SVG markup, Copy React TSX component, Copy image, PDF, or save .lapboard project files."
  },
  {
    id: "keys",
    title: "Your keys",
    body: "Every shortcut is configurable: LapDraw icon → ⚙ Options. This tour lives at ? → Replay tutorial."
  }
];

let idx = 0;
let card = null;
let active = false;
const done = new Set();

// called from anywhere: window.tutDone("draw")
window.tutDone = (id) => {
  if (!active) return;
  if (id === STEPS[idx]?.id) {
    setTimeout(() => {
      if (idx + 1 < STEPS.length) show(idx + 1);
      else finish();
    }, 450);
  }
};

function show(i) {
  idx = i;
  const s = STEPS[i];
  build();
  card.querySelector(".tut-title").textContent = s.title;
  card.querySelector(".tut-body").textContent = s.body;
  card.querySelector(".tut-step").textContent = `${i + 1}/${STEPS.length}`;
}

function build() {
  if (card) {
    card.style.display = "flex";
    return;
  }
  card = document.createElement("div");
  card.id = "lapdraw-tutorial";
  card.innerHTML = `
    <div class="tut-glyph">⌨️</div>
    <div class="tut-main">
      <div class="tut-title"></div>
      <div class="tut-body"></div>
    </div>
    <div class="tut-nav">
      <span class="tut-step"></span>
      <button class="tut-next">Next ▸</button>
      <button class="tut-skip">Skip</button>
    </div>
  `;
  document.body.appendChild(card);
  card.querySelector(".tut-next").addEventListener("click", () => {
    idx + 1 < STEPS.length ? show(idx + 1) : finish();
  });
  card.querySelector(".tut-skip").addEventListener("click", finish);
}

function finish() {
  active = false;
  if (card) card.style.display = "none";
  chrome.storage.local.set({ [TUT_STORE]: true });
  if (typeof toast === "function") toast("You're set — ? shows shortcuts anytime");
}

function start() {
  idx = 0;
  active = true;
  done.clear();
  show(0);
}

window.lapdrawTutorial = { start };

// auto-run on first visit
chrome.storage.local.get(TUT_STORE, (store) => {
  if (!store[TUT_STORE]) start();
});
