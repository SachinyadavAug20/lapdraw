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
      const windowId = sender.tab ? sender.tab.windowId : chrome.windows.W_ID_CURRENT;
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        const err = chrome.runtime.lastError;
        if (err) sendResponse({ error: err.message });
        else sendResponse({ dataUrl });
      });
      return true;
    }
    case "lapdraw:open-canvas": {
      chrome.tabs.create({ url: chrome.runtime.getURL("newtab/newtab.html") });
      sendResponse({ ok: true });
      return false;
    }
    default:
      return false;
  }
});

// Keyboard shortcut (Alt+Shift+D by default) to toggle drawing mode
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-draw") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "lapdraw:toggle" });
  } catch {
    // Content script not present (e.g. chrome:// pages) — nothing to toggle
  }
});
