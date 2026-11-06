// LapDraw popup — controls shared settings + per-page drawing mode

const $ = (sel) => document.querySelector(sel);
const STATUS_KEY = "lapdraw:settings";

let tab = null;

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const store = await chrome.storage.local.get(STATUS_KEY);
  const settings = store[STATUS_KEY] || { color: "#ff5c5c", size: 4, tool: "pen" };
  $("#color").value = settings.color;
  $("#size").value = settings.size;
  $("#sizeVal").textContent = settings.size;
  syncToolChips(settings.tool);

  // Ask the page for live state (drawing may already be on)
  let state = null;
  try {
    state = await chrome.tabs.sendMessage(tab.id, { type: "lapdraw:get-state" });
  } catch {
    state = null; // content script not on this page (chrome://, PDFs, ...)
  }
  setStatus(state && state.enabled);
  if (state) {
    $("#color").value = state.color;
    $("#size").value = state.size;
    $("#sizeVal").textContent = state.size;
    syncToolChips(state.tool);
  } else {
    document.body.classList.add("nodraw");
  }
}

function setStatus(on) {
  const badge = $("#status");
  const btn = $("#toggle");
  badge.textContent = on ? "drawing" : "off";
  badge.classList.toggle("on", !!on);
  btn.textContent = on ? "Stop drawing (Esc)" : "Draw on this page";
}

function syncToolChips(tool) {
  document.querySelectorAll("[data-tool]").forEach((c) =>
    c.classList.toggle("active", c.dataset.tool === tool)
  );
}

function sendToTab(payload) {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, payload, () => void chrome.runtime.lastError);
}

function saveSettings(patch) {
  chrome.storage.local.get(STATUS_KEY, (store) => {
    const next = { ...(store[STATUS_KEY] || {}), ...patch };
    chrome.storage.local.set({ [STATUS_KEY]: next });
  });
}

// Toggle drawing mode on the page
$("#toggle").addEventListener("click", async () => {
  if (!tab) return;
  let state = null;
  try {
    state = await chrome.tabs.sendMessage(tab.id, { type: "lapdraw:get-state" });
  } catch {
    alert("LapDraw can't draw on browser pages (chrome://, add-ons, PDFs). Open a normal website and try again.");
    return;
  }
  sendToTab({ type: state && state.enabled ? "lapdraw:disable" : "lapdraw:enable" });
  setStatus(!(state && state.enabled));
  window.close();
});

document.querySelectorAll("[data-tool]").forEach((chip) =>
  chip.addEventListener("click", () => {
    const tool = chip.dataset.tool;
    syncToolChips(tool);
    saveSettings({ tool });
    sendToTab({ type: "lapdraw:tool", tool });
  })
);

$("#color").addEventListener("input", (e) => {
  saveSettings({ color: e.target.value });
  sendToTab({ type: "lapdraw:color", color: e.target.value });
});

$("#size").addEventListener("input", (e) => {
  const size = Number(e.target.value);
  $("#sizeVal").textContent = size;
  saveSettings({ size });
  sendToTab({ type: "lapdraw:size", size });
});

document.querySelectorAll("[data-act]").forEach((chip) =>
  chip.addEventListener("click", async () => {
    const act = chip.dataset.act;
    if (act === "save" && tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "lapdraw:save" });
      } catch {
        void chrome.runtime.lastError;
      }
      window.close();
      return;
    }
    sendToTab({ type: act === "undo" ? "lapdraw:undo" : "lapdraw:clear" });
  })
);

$("#openCanvas").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
  window.close();
});

$("#openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

init();
