# LapDraw ✍️

**Draw on any website with your laptop trackpad — no mouse, no pen needed.**

Laptop trackpads are rubbish for drawing: too small, no pressure, and every app assumes you have a mouse or a stylus. LapDraw fixes that for the browser:

- **Draw on any page** — an overlay canvas sits on top of the current website. Click-drag on your trackpad draws with low-lag, smoothed strokes.
- **Trackpad-native input** — pointer-events based, works with trackpad click-drag, touch, mouse, and pen.
- **Infinite canvas** — open a distraction-free new tab with pan/zoom, auto-save, and PNG export.
- **Zero network activity** — everything stays on your machine.

## Install (dev)

```bash
npm run build
```

### Chrome
1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `dist/chrome`

### Firefox
1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Pick any file inside `dist/firefox`

## Usage

| Input | Action |
| --- | --- |
| Click-drag (trackpad/mouse/pen) | Draw |
| Right-click in draw mode | Turn LapDraw off |
| Toolbars | Pen / Eraser / Color / Size / Undo / Clear / Save PNG |

On-page shortcuts: `Alt+Shift+D` toggle · `Esc` exit · `P` pen · `E` eraser · `U`/`Z` undo · `X` clear · `S` save · `[` `]` trim stroke size.

Infinite canvas: two-finger scroll pans, pinch or `Ctrl+scroll` zooms, `0` resets view, `S` saves PNG. Drawings auto-save per machine via `chrome.storage.local`.

## Architecture

```
src/
├── manifest.chrome.json    # Chrome MV3 (service worker)
├── manifest.firefox.json   # Firefox MV2 (background page)
├── background.js           # messaging, screenshot capture, open canvas, shortcut
├── content/
│   ├── content.js          # on-page overlay: strokes, smoothing, toolbar, export
│   └── overlay.css
├── popup/                  # toolbar popup (toggle, tool, color, size, actions)
└── newtab/                 # infinite canvas (pan/zoom, persistence, PNG export)
```

- Strokes are stored in **CSS px** on page (viewport-anchored) and **world coords** in the canvas (pan/zoom-safe).
- Strokes are smoothed with midpoint quadratic curves so hardware-trackpad jitter disappears.
- **Save PNG** composites a `captureVisibleTab` screenshot with the overlay canvas, so you get *page + your drawing* in one image.

## Roadmap ideas

- Stroke shape recognition (arrow/rect/circle snapping)
- Text tool, highlighter, spot annotations with auto-dismiss
- Per-domain "remember drawings" and replay
- Simple gesture undo (two-finger double tap)
