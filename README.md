<p align="center">
  <img src="src/icons/icon128.png" width="96" alt="LapDraw logo" />
</p>

<h1 align="center">LAPDRAW</h1>

<p align="center"><b>Draw on any website with your laptop trackpad — no mouse, no pen, no mess.</b></p>

<p align="center">
  <i>On-Page Annotation • Infinite Canvas • Trackpad Intelligence • SVG / React / PDF / PNG Export</i>
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

**LAPDRAW** is a browser extension engineered for **developers and laptop users whose trackpad makes freehand drawing painful**. Standard drawing apps assume a precision mouse or Apple Pencil — trying to draw with a finger on a laptop trackpad leads to jagged lines, warped boxes, jittery handwriting, and accidental clicks.

LapDraw provides an **Intelligence Engine** designed specifically for laptop trackpad physics:
1. **QuickShape & Smart Assist**: Draw a rough line, box, circle, or arrow and hold still for 450ms — it snaps into a clean vector shape!
2. **Streamline Stabilizer**: Eliminates high-frequency friction stutter so freehand handwriting is smooth.
3. **Fishhook Eliminator**: Strips accidental release hooks when lifting your finger.
4. **Developer-First Tools & Exports**: Monospace text labels, directional arrows, grid snapping, and instant clipboard export as clean `<svg>` markup or React (`.tsx`) components.

It ships as a **zero-dependency**, local WebExtension (MV3 for Chrome, MV2 for Firefox). No servers, no accounts, no telemetry.

<p align="center">
  <i>Vanilla JS • Pointer Events • Canvas 2D • WebExtension APIs • Zero Build Dependencies</i>
</p>

## Highlights

- ✍️ **Draw on Any Website** — overlay canvas above any page for code reviews, bug reports, and demos
- 🔍 **GitHub PR Review Mode & Badges** — translucent highlighter (`HL`), diff line spotlight (`SPOT`), review stamps (`[LGTM]`, `[BUG]`, `[SECURITY]`, `[NIT]`, `[REQ CHANGES]`, `[PERF]`, `[QUESTION]`), and 1-click "Copy for GitHub PR"
- 📖 **Persistent Docs & PDF Notebook** — floating notebook panel (`NOTES`) auto-saved per URL in `chrome.storage.local` with 1-click Markdown export for Obsidian, Notion, and Logseq
- 🎓 **Interactive In-App Developer Lab & Tutorial** — hands-on interactive playground (`tutorial/tutorial.html`) with live sandboxes for QuickShape, GitHub code diffs, and live DSL compiling
- 🗺 **Infinite Canvas** — new-tab whiteboard with pan, zoom, grid, and local auto-save
- 🧠 **QuickShape Intelligence** — hold still for 450ms at the end of a stroke to snap lines, boxes, circles, diamonds, cylinders, and arrows
- 🧯 **Trackpad Streamline Stabilizer** — exponential moving-average filter removes friction stutter
- 🎣 **Fishhook Trimmer** — removes directional hook artifacts when lifting your finger
- 🎨 **8 Developer Themes (THM)** — Omarchy Rice, Dracula, Catppuccin Mocha, Tokyo Night, Nord Frost, Monokai Pro, Paper Light, Matrix Cyber with dynamic HUD palettes
- ☩ **Radar Minimap Navigation** — real-time overview minimap showing whole-canvas content, camera viewport frustum, and click/drag-to-pan
- ⚡ **Advanced Sequence Diagram Studio**:
  - **Execution Specification / Lifeline Activations**: vertical execution bars on processing lifelines
  - **Combined Decision Frames**: `alt / else` conditional branches, `loop` iterations, `opt` optional branches
  - **Self-Call Message Loops**: native 3-segment orthogonal loopbacks
- 🏛 **UML Class Diagram Studio & Connectors**:
  - **Stereotypes**: `«service»`, `«interface»`, `«entity»`, `«abstract»`, `«repository»`, `«controller»`, `«enum»`
  - **Visibility Indicators**: colored `+` public, `-` private, `#` protected, `~` package members
  - **Relationship Connectors**: Inheritance (`<|--`), Realization (`<|..`), Composition (`*--`), Aggregation (`o--`), Dependency (`..>`), Association (`-->`)
- 📦 **1-Click Architecture Templates**:
  - OAuth2 PKCE Authorization Flow (Browser, SPA, Auth0 IdP, Resource API)
  - Event-Driven Pub/Sub Microservices (API Gateway, Order Service, Kafka Topic, Inventory Service, Postgres, Redis)
  - Clean / Hexagonal Architecture (Domain Entities, Use Cases, Adapters, Frameworks)
  - E-Commerce Relational ERD (Interconnected users, orders, order_items, payments)
  - Production REST Pipeline (Cloudflare CDN, Nginx, Rate Limiter, Go API, Redis, Postgres Cluster)
  - State Machine / Statechart (Draft, Review, Approved/Rejected, Published, Archived)
- ⚡ **Live Markdown / DSL Compiler** — type or paste PlantUML / Mermaid-compatible text to immediately compile into vector strokes on canvas
- 📦 **Developer Export Suite** — Copy SVG markup, Copy React component (`.tsx`), Copy Mermaid.js code (`mermaid`), Copy Markdown embed, PNG, JPG, PDF, `.lapboard` project JSON
- ⌨️ **Configurable Shortcuts** — remap every key in the options page
- 🌓 **Omarchy Rice & Monospace Fonts** — dark terminal aesthetic, JetBrains Mono font, vim-flavored statusbar
- 📚 **Comprehensive Guides**: [Developer Guide](docs/DEVELOPER_GUIDE.md) · [GitHub Reviews & Docs Notes](docs/GITHUB_AND_DOCS_NOTES.md)

---

## Trackpad Drawing Research: Problems & Engineering Solutions

Drawing with a finger on a flat trackpad differs fundamentally from using a stylus or mouse. LapDraw systematically solves the 6 core friction points of trackpad drawing:

### 1. Static Friction Stutter ("Stick-Slip" Effect)
- **The Problem**: Fingers experience micro-stiction against glass or plastic trackpads, causing small 1–4px rapid jumps and jagged, nervous lines.
- **LapDraw's Solution**: A real-time **exponential moving-average filter** and midpoint quadratic curve interpolation absorb micro-jitter without perceptible input lag.

### 2. Wobbly Geometric Shapes & Lines
- **The Problem**: Drawing a clean straight line or a square box freehand on a trackpad is nearly impossible without a physical straightedge.
- **LapDraw's Solution**:
  - **QuickShape (Hold-to-Snap)**: Draw any line, rectangle, ellipse, diamond, cylinder, or arrow and pause holding your finger still for 450ms. It instantly snaps into a clean vector shape! Dragging your finger adjusts the orientation and scale before releasing.
  - **Smart Assist (Auto-Beautify)**: When `SMART` mode is active, finishing a stroke automatically tests for linearity, circularity, rectangularity, diamonds, and cylinders, converting rough sketches into crisp vector shapes.

### 3. End-of-Stroke Finger Lift Fishhooks
- **The Problem**: When lifting a finger from a trackpad, the finger decelerates and rolls slightly, creating a sharp 2–6px hook artifact at the end of every stroke.
- **LapDraw's Solution**: A **directional hook detector** detects sharp angle reversals (>105°) occurring within the last 10px of a stroke and trims them on pointer release.

### 4. Accidental Tap Dots & Micro-Clicks
- **The Problem**: Tapping the trackpad or resting a thumb creates tiny 1–2px unintentional specks that clutter the canvas.
- **LapDraw's Solution**: Strokes shorter than 3px with a duration under 80ms are debounced and filtered out.

### 5. Physical Trackpad Boundary Runaway
- **The Problem**: Trackpads are physically bounded (typically 10cm × 7cm). Drawing a large diagram runs out of physical trackpad space.
- **LapDraw's Solution**: Native two-finger scroll panning, pinch-to-zoom, Spacebar+drag panning, and `FIT` (`0`) to center all artwork instantly.

### 6. Developer Diagramming Needs
- **The Problem**: Developers need to sketch architecture diagrams, database schemas, sequence flows, and explain system designs, then export directly into code or documentation.
- **LapDraw's Solution**:
  - In-app **Diagram Builder (`D`)** for Database Schemas, Sequence Diagrams, UML Classes, and Architecture Nodes
  - Connector arrow tool (`ARR`) and dashed line mode (`DASH` / `K`)
  - Decision diamonds and storage cylinder primitives
  - In-place monospace text tool (`TXT`) for labeling services and endpoints
  - Grid snap (`SNAP` / `G`) to align boxes and connectors to a 16px grid
  - One-click **Copy SVG code**, **Copy React component (.tsx)**, and **Copy Mermaid.js code** to paste straight into IDEs, Markdown, or GitHub PRs.

---

## Install

### Chrome / Chromium / Brave / Edge
```bash
npm run build
```
1. Navigate to `chrome://extensions` and enable **Developer mode** (top-right toggle).
2. Click **Load unpacked** and select `dist/chrome`.

### Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `manifest.json` inside `dist/firefox`.

---

## Usage & Shortcuts

| Input | Action |
| --- | --- |
| Click-drag (trackpad / mouse / pen) | Draw freehand |
| Hold still for 450ms at end of stroke | **QuickShape**: snap straight line, box, circle, or arrow |
| Two-finger scroll | Pan infinite canvas |
| Pinch / Ctrl+scroll | Zoom infinite canvas |

### Global Extension Shortcuts
Configure these anytime at `chrome://extensions/shortcuts`:

| Shortcut | Action |
| --- | --- |
| `Alt+Shift+D` | Toggle LapDraw drawing on the current web page |
| `Alt+Shift+E` | Switch pen ↔ eraser |
| `Alt+Shift+Z` | Undo last stroke |
| `Alt+Shift+C` | Open infinite canvas tab |

### Canvas & Overlay Shortcuts
Every key below can be remapped in LapDraw's **Options Page** (click LapDraw icon → ⚙ KEYS):

| Tool / Action | Key | Description |
| --- | --- | --- |
| `PEN` | `P` | Freehand drawing (with QuickShape hold-to-snap) |
| `ERS` | `E` | Eraser |
| `LIN` | `L` | Straight line tool (hold Shift for 45° angle snap) |
| `BOX` | `R` | Rectangle / box tool (hold Shift for square) |
| `OVL` | `O` | Ellipse / circle tool (hold Shift for circle) |
| `ARR` | `A` | Connector arrow with filled arrowhead |
| `TXT` | `T` | Monospace text label tool (click to type) |
| `DIAG` | `D` | Open Developer Diagram Builder (DB Schema, Sequence, UML, Arch) |
| `DASH` | `K` | Toggle Dashed connector / stroke mode |
| `SMART` | `M` | Toggle Smart Shape Assist on / off |
| `SNAP` | `G` | Toggle Grid Snap (16px grid alignment) |
| Size | `[` / `]` | Shrink / grow stroke width |
| History | `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| Quick Save | `S` or `Ctrl+S` | Export full artwork PNG |
| Clear | `Ctrl+Shift+X` (canvas) / `X` (page) | Clear all strokes |
| Zen Mode | `Tab` | Hide / show toolbar |
| Help | `?` or `H` | In-app cheat sheet & tutorial |

---

## Architecture

```
src/
├── manifest.chrome.json     # Chrome MV3 — service worker
├── manifest.firefox.json    # Firefox MV2 — background page
├── background.js            # tab capture, command router, canvas opener
├── shared/
│   └── intelligence.js      # Trackpad stabilizer, fishhook trimmer, shape recognizer
├── content/
│   ├── content.js           # On-page overlay engine (tools, QuickShape, capture)
│   └── overlay.css          # Overlay toolbar and text annotations styling
├── newtab/                  # Infinite Canvas
│   ├── newtab.html          # Monospace text-first Omarchy HUD & statusbar
│   ├── newtab.css           # Rice theme, statusbar tags, text input styles
│   ├── newtab.js            # Pan/zoom math, tools, history, keymap registry
│   ├── exporters.js         # Vector SVG, React TSX, PDF writer, clipboard, project JSON
│   └── tutorial.js          # Interactive 7-step guided tour
├── options/                 # Keymap remapping interface
│   ├── options.html
│   ├── options.css
│   └── options.js
└── popup/                   # Extension popup status and shortcuts reference
```

- **Coordinates**: On-page overlay uses viewport-anchored CSS pixels. Infinite canvas uses world-space coordinates with seamless pan/zoom transformation.
- **Intelligence Engine**: Fast, deterministic geometric analysis running under 2ms per stroke without heavy machine learning models.
- **PDF Export**: Hand-rolled single-page PDF generator wrapping high-res JPEG XObject with verified xref byte offsets. Zero external libraries.
- **SVG Export**: Pure vector paths, lines, rectangles, ellipses, and text elements.
- **Project Files**: Portable, diffable `.lapboard` JSON files storing complete vector strokes and view offsets.

---

## License

MIT © 2026 Sachin — see [LICENSE](LICENSE).
