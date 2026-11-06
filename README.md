<p align="center">
  <img src="src/icons/icon128.png" width="96" alt="LapDraw logo" />
</p>

<h1 align="center">LAPDRAW</h1>

<p align="center"><b>Draw on any website with your laptop trackpad — no mouse, no pen, no mess.</b></p>

<p align="center">
  <i>On-Page Annotation • Infinite Canvas • Trackpad-First UX • PDF / SVG / PNG Export</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-%23E34F26.svg?style=flat&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Chrome-4285F4?style=flat&logo=googlechrome&logoColor=white" alt="Chrome" />
  <img src="https://img.shields.io/badge/Firefox-FF7139?style=flat&logo=firefox&logoColor=white" alt="Firefox" />
  <img src="https://img.shields.io/badge/Dependencies-Zero-33CC77" alt="Zero dependencies" />
</p>

<p align="center">
  <a href="#-license"><img alt="License" src="https://img.shields.io/badge/License-MIT-FF5C50?style=flat-square"></a>
</p>

---

## Overview

**LAPDRAW** is a browser extension for **every laptop user whose trackpad failed them in a meeting**. Trackpads are small, jittery, and every drawing tool assumes you own a mouse or a stylus — so nobody draws. LapDraw flips that: it turns the hardware you already have into a low-lag, smoothed, stylus-like pen that works **on top of any website** and in a **distraction-free infinite canvas** tab.

It ships as a **zero-dependency**, fully local extension (MV3 for Chrome, MV2 for Firefox). Nothing leaves your machine — no accounts, no servers, no telemetry.

<p align="center">
  <i>Vanilla JS • Pointer Events • Canvas 2D • WebExtension APIs • Zero Build Tools</i>
</p>

## Highlights

- ✍️ **Draw on any page** — overlay canvas above any website, click-drag to annotate
- 🗺 **Infinite canvas** — new-tab whiteboard with pan, zoom, grid, auto-save
- 🧯 **Trackpad assist** — midpoint stroke smoothing, scroll-pans, pinch-zooms, Space+drag
- ▦ **Shape tools** — freehand, line, rectangle, ellipse (Shift-constrained)
- 📦 **Export suite** — PNG, JPG, SVG (vector), PDF, clipboard copy, `.lapboard` project files
- ⌨️ **Configurable shortcuts** — remap every canvas key in the options page
- 🎓 **Built-in tutorial** — guided first-run tips + in-app cheat sheet
- 🌓 **Omarchy rice** — dark terminal theme, mono type, coral accents

## Install

### Chrome
```bash
npm run build
```
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `dist/chrome`

### Firefox
1. `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Choose any file inside `dist/firefox`

## Usage

| Input | Action |
| --- | --- |
| Click-drag (trackpad / mouse / pen) | Draw |
| Right-click in draw mode | Exit drawing mode |
| Two-finger scroll | Pan (canvas) |
| Pinch / Ctrl+scroll | Zoom (canvas) |

### Global shortcuts

| Keys | Action |
| --- | --- |
| `Alt+Shift+D` | Toggle drawing on current page |
| `Alt+Shift+E` | Pen ↔ eraser |
| `Alt+Shift+Z` | Undo last stroke |
| `Alt+Shift+C` | Open infinite canvas |

*All four are standard WebExtension commands — remap them at `chrome://extensions/shortcuts`. Every canvas-level key (pen, shapes, undo, zoom, save…) is remappable in LapDraw's own options page.*

### Layered shortcuts

| Context | Keys |
| --- | --- |
| **Page overlay** | `Esc` exit · `P` pen · `E` eraser · `U`/`Z` undo → `R` redo · `X` clear · `S` save · `[` `]` size |
| **Infinite canvas** | `Space`+drag pan · arrow keys pan · `+`/`−` zoom · `0` fit · `Ctrl+1` reset zoom · `Tab` zen · `?` cheat sheet |

Shape tools (`L` line, `R`* rect on canvas per keymap) use click-drag; hold **Shift** to constrain angles/shapes.

## Architecture

```
src/
├── manifest.chrome.json     # Chrome MV3 — service worker
├── manifest.firefox.json    # Firefox MV2 — background page
├── background.js            # commands, captureVisibleTab, canvas tab
├── content/
│   ├── content.js           # on-page overlay engine (strokes, export, keys)
│   └── overlay.css
├── popup/                   # quick controls + status
├── newtab/                  # infinite canvas (world-space pan/zoom)
│   ├── newtab.js            # tools, history, exporters, tutorial
│   └── newtab.html/css
└── options/                 # shortcut remapping + preferences
```

- Strokes live in **CSS px** on pages (viewport-anchored) and **world coords** in the canvas (pan/zoom-safe)
- Stroke smoothing: incremental **midpoint quadratic curves** — hardware-jitter disappears
- **PDF export** is rendered in-page (JPEG XObject wrapped in a hand-rolled PDF writer) — no libraries
- **SVG export** keeps every stroke as true vector paths
- `.lapboard` files are plain JSON — portable, diffable, safe

## Why it matters

Remote classes, code reviews, design critiques — someone says "can you just mark it?" and the laptop user goes silent. LapDraw makes annotating a live page a two-finger gesture, and gives the whiteboard free in the same icon.

## Roadmap

- [ ] Stroke recognition → snap arrows/rects/circles
- [ ] Per-domain persistent annotations (replay on revisit)
- [ ] Multi-board gallery in the canvas tab
- [ ] Trackpad "lazy-brush" stabilizer mode (adjustable assist level)

## Contributing

PRs welcome — vanilla JS only, no build pipeline, no frameworks. Keep the rice consistent (`doc/` shows the palette).

## License

MIT © 2026 — see [LICENSE](LICENSE).
