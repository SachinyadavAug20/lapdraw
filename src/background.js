// LapDraw background (service worker on Chrome MV3, background page on Firefox MV2)

const DEFAULT_SETTINGS = {
  color: "#ff5c5c",
  size: 4,
  tool: "pen"
};

chrome.runtime.onInstalled.addListener(async () => {
  const store = await chrome.storage.local.get("lapdraw:settings");
  if (!store["lapdraw:settings"]) {
    await chrome.storage.local.set({ "lapdraw:settings": DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg && msg.type) {
    case "lapdraw:capture": {
      // Screenshot of the current viewport (used to compose page drawings for export)
      const windowId = sender.tab ? sender.tab.windowId : null;
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        const err = chrome.runtime.lastError;
        if (err) sendResponse({ error: err.message });
        else sendResponse({ dataUrl });
      });
      return true;
    }
    case "lapdraw:open-canvas": {
      openCanvas();
      sendResponse({ ok: true });
      return false;
    }
    default:
      return false;
  }
});

function openCanvas() {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActive(message, fallback) {
  const tab = await activeTab();
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // Content script not present (e.g. chrome:// pages)
    if (fallback) fallback();
  }
}

// Keyboard shortcuts (editable at chrome://extensions/shortcuts)
//   Alt+Shift+D  toggle drawing   Alt+Shift+E  pen <-> eraser
//   Alt+Shift+Z  undo stroke      Alt+Shift+C  open infinite canvas
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "toggle-draw":
      sendToActive({ type: "lapdraw:toggle" });
      break;
    case "toggle-eraser":
      sendToActive({ type: "lapdraw:toggle-eraser" });
      break;
    case "undo-stroke":
      sendToActive({ type: "lapdraw:undo" });
      break;
    case "open-canvas":
      openCanvas();
      break;
  }
});
