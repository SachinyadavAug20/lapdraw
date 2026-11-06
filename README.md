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
| Two-finger scroll | Pan (canvas page) |
| Pinch or Ctrl+scroll | Zoom (canvas page) |
| Toolbars | Pen / Eraser / Color / Size / Undo / Redo / Clear / Save PNG |

### Global shortcuts (change them at chrome://extensions/shortcuts)

| Keys | Action |
| --- | --- |
| `Alt+Shift+D` | Toggle drawing on the current page |
| `Alt+Shift+E` | Switch pen ↔ eraser |
| `Alt+Shift+Z` | Undo the last stroke |
| `Alt+Shift+C` | Open the infinite canvas |

### While drawing on a page

| Keys | Action |
| --- | --- |
| `Esc` | Exit drawing mode (right-click also works) |
| `P` / `E` | Pen / eraser |
| `U` / `Z` | Undo — `R`, `Ctrl+Z`, `Ctrl+Y` redo |
| `X` | Clear all strokes |
| `S` / `Ctrl+S` | Save page + drawing as PNG |
| `[` / `]` | Shrink / grow stroke |

### Infinite canvas

| Keys | Action |
| --- | --- |
| Space+drag, Shift+drag, middle-drag | Pan |
| Two-finger scroll / arrow keys | Pan |
| Pinch or Ctrl+scroll, `+` / `−` | Zoom |
| `0` or `Ctrl+0` | Fit all content |
| `Ctrl+1` | Reset zoom to 100% |
| `P` / `E` | Pen / eraser |
| `[` / `]` | Stroke size |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | Undo / redo |
| `S` / `Ctrl+S` | Save PNG |
| `Tab` | Hide/show toolbar (zen mode) |
| `?` or `H` | In-app cheat sheet |

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
