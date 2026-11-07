# Privacy Policy for LapDraw

**Last Updated:** November 2026

LapDraw ("the Extension") is designed with a strict **local-first, privacy-by-design** philosophy.

### 1. No Data Collection or Telemetry
LapDraw does not collect, record, transmit, or sell any personal data, usage metrics, technical logs, or browsing history. Zero analytics libraries or remote telemetry tracking scripts are included.

### 2. Local Execution Only
All drawing computations, trackpad stabilization filters, shape recognition, and diagram generation algorithms execute 100% locally on your computer inside your browser.

### 3. Local Storage Usage
Any preferences, custom keyboard shortcuts, or canvas whiteboard states saved by the extension are stored strictly in your browser's local storage (`chrome.storage.local` / `localStorage`). This data never leaves your device and can be cleared at any time by clearing your browser data or uninstalling the extension.

### 4. Permissions Usage
- `activeTab`: Used solely to inject the transparent drawing overlay onto the web page you are actively viewing when you explicitly toggle drawing mode (<kbd>Alt+Shift+D</kbd>).
- `storage`: Used solely to save your local canvas strokes and keybinding preferences.
- `tabs`: Used solely to open and focus the infinite canvas whiteboard in a new tab (<kbd>Alt+Shift+C</kbd>).
- `<all_urls>` / host permissions: Required to allow the drawing canvas overlay to be displayed across web pages you choose to annotate. No page content is ever read, transmitted, or recorded.

### 5. Contact
For questions regarding this policy or the extension, visit:
https://github.com/SachinyadavAug20/lapdraw
