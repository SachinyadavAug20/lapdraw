# 🛠️ LapDraw Developer Guide: Real-World Workflows & Architecture Manual

> **LapDraw** is a laptop trackpad-first drawing, annotation, and system design suite engineered specifically for software developers, site reliability engineers, and technical architects who work on the go without a stylus or mouse.

---

## 📑 Table of Contents
1. [Core Philosophy & Trackpad Mechanics](#1-core-philosophy--trackpad-mechanics)
2. [Workflow 1: GitHub & GitLab Pull Request Code Reviews](#2-workflow-1-github--gitlab-pull-request-code-reviews)
3. [Workflow 2: Persistent Documentation & PDF Notebook](#3-workflow-2-persistent-documentation--pdf-notebook)
4. [Workflow 3: Microservice Architecture & UML Class Design](#4-workflow-3-microservice-architecture--uml-class-design)
5. [Workflow 4: Sequence Diagram Studio with Frames & Activations](#5-workflow-4-sequence-diagram-studio-with-frames--activations)
6. [Workflow 5: Live Markdown & DSL Compiler](#6-workflow-5-live-markdown--dsl-compiler)
7. [Workflow 6: Radar Minimap & Navigation](#7-workflow-6-radar-minimap--navigation)
8. [Workflow 7: Developer Themes & Customization](#8-workflow-7-developer-themes--customization)
9. [Workflow 8: Multi-Format Exporters (SVG, TSX, Mermaid, PDF)](#9-workflow-8-multi-format-exporters-svg-tsx-mermaid-pdf)
10. [Complete Keymap & Keystroke Reference](#10-complete-keymap--keystroke-reference)

---

## 1. Core Philosophy & Trackpad Mechanics

Traditional canvas drawing tools are designed for mice or iPad styluses. When used with laptop trackpads, they suffer from:
- **Jittery, jagged freehand strokes** caused by fingertip friction on glass/aluminum trackpads.
- **Accidental fishhook tails** created when lifting a finger at the end of a stroke.
- **Wobbly geometric shapes** (rectangles, diamonds, circles look uneven).

LapDraw eliminates trackpad limitations through three algorithmic systems:

### A. Sub-Pixel Streamline Smoothing (Catmull-Rom Quadratic Splines)
As you drag your finger on the trackpad, LapDraw computes quadratic Bezier control points mid-air across a 3-sample sliding window:
$$\text{mid}_x = \frac{x_{i-1} + x_i}{2}, \quad \text{mid}_y = \frac{y_{i-1} + y_i}{2}$$
This results in butter-smooth vector curves without the sluggish input latency of standard low-pass filters.

### B. Intelligent Fishhook Stripping
When lifting a finger from a trackpad, finger friction almost always hooks back slightly. LapDraw monitors the final 12% of the trajectory, identifies sudden angle reversals ($> 110^\circ$) within 4 pixels of the stroke termination, and trims them cleanly.

### C. QuickShape Hold-to-Snap
Draw any rough shape—straight line, rectangle, circle, ellipse, connector arrow, decision diamond, or database cylinder—and **hold still for 450ms** at the end. LapDraw calculates:
- Bounding box aspect ratios.
- Radial standard deviation $\sigma_r = \sqrt{\frac{1}{N}\sum(r_i - \bar{r})^2}$.
- Polygonal convexity and vertex turn counts.

It automatically snaps the rough freehand stroke into clean, crisp vector geometry.

---

## 2. Workflow 1: GitHub & GitLab Pull Request Code Reviews

Reviewing pull requests directly in the browser often requires pointing out subtle race conditions, nil pointers, or missing bounds checks that are hard to describe with text alone.

### Step-by-Step Code Review Workflow:
1. Navigate to any GitHub PR diff (e.g. `github.com/org/repo/pull/142/files`).
2. Press <kbd>Alt+Shift+D</kbd> (or click the LapDraw extension icon) to toggle drawing mode.
3. **Highlight Vulnerabilities with `HL`**:
   - Press <kbd>H</kbd> or click `HL`.
   - Drag across code lines (e.g., an unhandled error or missing JWT expiry). The highlighter renders with translucent alpha (`globalAlpha = 0.38`) and a flat cap, keeping code syntax crisp and legible underneath.
4. **Stamp Engineer Review Badges (`STAMP`)**:
   - Click `STAMP ▾` or press <kbd>K</kbd>.
   - Select a badge:
     - `[LGTM]` (#2ed573 green): "Looks good to me"
     - `[BUG]` (#ff4757 red): "Bug / crash detected"
     - `[SECURITY]` (#a55eea purple): "Security vulnerability / sanitization required"
     - `[NIT]` (#ffa502 yellow): "Nitpick / code style"
     - `[REQ CHANGES]` (#ff7f50 orange): "Changes requested"
     - `[PERF]` (#00d2d3 cyan): "O(N²) performance bottleneck"
     - `[QUESTION]` (#1e90ff blue): "Needs clarification"
   - Click anywhere on the diff line to place the stamp. An inline comment input opens immediately: type your callout (e.g., `Validate claims pointer before dereference`) and press <kbd>Enter</kbd>.
5. **Diff Spotlight (`SPOT`)**:
   - Press <kbd>F</kbd> or click `SPOT`.
   - Drag a rectangle around the critical 5 lines. LapDraw dims the rest of the webpage with a `0.65` scrim and highlights the spotlighted block with a glowing `[FOCUS]` border.
6. **1-Click "Copy for GitHub PR" (`GH-PR`)**:
   - Click `GH-PR` on the toolbar or press <kbd>G</kbd>.
   - LapDraw composites the webpage background + your highlights + review stamps into a single crisp PNG screenshot and copies it to your system clipboard (`ClipboardItem`).
   - Simultaneously, LapDraw compiles a ready-to-paste GitHub Markdown template:

```markdown
### 🔍 LapDraw Code Review
> **Review Target**: [internal/auth/jwt_validator.go](https://github.com/org/repo/pull/142)
> **Timestamp**: 2026-11-07 14:15
> *(Annotated screenshot copied to clipboard — press `Ctrl+V` to paste image directly into your PR comment)*

#### 📌 Review Callouts:
- ✖ **[BUG]** Line 42: Validate claims pointer before type assertion to avoid nil panic
- 🔒 **[SECURITY]** Line 39: Ensure keyFunc verifies expected signing algorithm (reject 'none')
- ✓ **[LGTM]** Line 46: Clean signature verification flow

---
*Generated with [LapDraw](https://github.com/SachinyadavAug20/lapdraw)*
```

7. Paste into your GitHub PR review comment with <kbd>Ctrl+V</kbd> to embed both the Markdown list and the screenshot.

---

## 3. Workflow 2: Persistent Documentation & PDF Notebook

When reading developer documentation (MDN, React.dev, Go docs, Kubernetes specs) or technical whitepapers / PDFs, notes usually get lost across tabs.

LapDraw includes a **URL-Scoped Notebook Panel (`NOTES`)**:
- Automatically keyed by page origin and pathname (`lapdraw:notes:<domain+path>`).
- If you read a page on `react.dev/reference/react/useEffect` today, take notes, close the browser, and return a month later, your notes are automatically restored!
- The `NOTES` toolbar button displays a dot indicator (`NOTES •`) whenever the current page has saved annotations.

### Notebook Features:
- **Floating Docked Drawer**: Press <kbd>N</kbd> or click `NOTES` to toggle the side notebook panel.
- **1-Click Semantic Tags**:
  - `+ [TODO]`: inserts `- [ ] [TODO] `
  - `+ [KEY]`: inserts `> 🔑 **[KEY POINT]**: `
  - `+ [API]`: inserts `### 🔌 API: `
  - `+ [BUG]`: inserts `- 🐞 **[BUG]**: `
- **📸 Snap & Embed**: Captures the current page with your drawings and inserts an annotated snapshot marker with timestamp into your notes.
- **📋 Copy Markdown**: Copies the formatted note with source URL and timestamp for pasting into Obsidian, Notion, Logseq, or Bear.
- **💾 Export .md**: Triggers a clean file download as `LapDraw-<PageTitle>-<timestamp>.md`.

---

## 4. Workflow 3: Microservice Architecture & UML Class Design

Open the infinite canvas (<kbd>Alt+Shift+C</kbd> or new tab) and press <kbd>D</kbd> to launch the **Developer Diagram Studio**.

### A. Database Relational Tables (ERD)
- Define table name, fields with data types (`id: UUID PK`, `user_id: UUID FK`, `email: VARCHAR(255)`, `created_at: TIMESTAMPTZ`).
- Auto-generates styled database cards with colored PK/FK key tags and grid alignments.

### B. UML Class Modeling
- **Stereotypes**: Choose from `«service»`, `«interface»`, `«entity»`, `«repository»`, `«controller»`, `«singleton»`, `«abstract»`.
- **Visibility Modifiers**:
  - `+` (Green) Public: `+ charge(amount: Decimal): boolean`
  - `-` (Red) Private: `- apiKey: string`
  - `#` (Yellow) Protected: `# retry(count: int): void`
  - `~` (Cyan) Package/Internal: `~ tokenCache: Map`
- **6 Relationship Connectors**:
  - `<|--` Inheritance / Generalization (Solid line + Hollow arrow)
  - `<|..` Realization / Implementation (Dashed line + Hollow arrow)
  - `*--` Composition (Solid line + Filled diamond)
  - `o--` Aggregation (Solid line + Hollow diamond)
  - `..>` Dependency (Dashed line + Open arrow)
  - `-->` Directed Association (Solid line + Open arrow)

---

## 5. Workflow 4: Sequence Diagram Studio with Frames & Activations

LapDraw creates sequence diagrams with full lifeline activations, self-call message loops, and combined fragments:

### Built-in 1-Click Presets:
1. **OAuth2 Authorization Code Flow with PKCE**:
   - Lifelines: *Client*, *Browser/User*, *AuthServer*, *BackendAPI*.
   - Includes activation bars and token exchange response arrows.
2. **E-Commerce Checkout & Stripe Webhooks**:
   - Lifelines: *Buyer*, *StoreFront*, *OrderAPI*, *StripePaymentGateway*, *WebhookWorker*.
   - Includes `alt Payment Successful` vs `else Card Declined` frames.
3. **WebSocket Handshake & Real-Time Pub/Sub**:
   - Lifelines: *Browser*, *LoadBalancer*, *Gateway*, *RedisPubSub*.
   - Includes `loop Every 1000ms Ping/Pong` heartbeat frame.
4. **Cache-Aside Architecture**:
   - Lifelines: *Application*, *RedisCache*, *PostgreSQLDatabase*.
   - Shows cache hit/miss divergence.

---

## 6. Workflow 5: Live Markdown & DSL Compiler

Prefer text over clicking? Use the **Live DSL Compiler** in the Diagram Studio (<kbd>D</kbd> → **Live DSL Compiler**):

```text
participant Client
participant Gateway
participant AuthService
participant Database

Client -> Gateway: POST /api/v1/auth/login
Gateway -> AuthService: ValidateCredentials(user, pass)
AuthService -> Database: SELECT * FROM users WHERE email = ?
Database --> AuthService: UserRecord
alt Valid Password
  AuthService --> Gateway: 200 OK + Signed JWT Token
  Gateway --> Client: 200 Set-Cookie: jwt=token
else Invalid Password
  AuthService --> Gateway: 401 Unauthorized
  Gateway --> Client: 401 Invalid Credentials
end
```

Click **⚡ Compile & Insert into Canvas** to generate interactive vector strokes on the infinite board.

---

## 7. Workflow 6: Radar Minimap & Navigation

When working on large system architecture topologies, LapDraw's **Radar Minimap** (in the bottom-right corner) provides situational awareness:
- Live radar representation of all strokes and diagram cards across the infinite coordinate space.
- Glowing camera frustum box showing your current visible viewport.
- **Click & Drag** anywhere on the radar to pan across the board at lightning speed.
- Press <kbd>☩</kbd> or <kbd>0</kbd> to fit all diagram contents to screen.

---

## 8. Workflow 7: Developer Themes & Customization

Switch themes on the fly by clicking **THM ▾** in the canvas HUD. Each theme changes canvas background, grid lines, vector strokes, and HUD accents:

| Theme | Background | Primary Color | Aesthetic |
|---|---|---|---|
| **Omarchy Rice** | `#0e1114` | Coral `#ff5c50` | Default dark terminal rice |
| **Dracula** | `#282a36` | Purple `#bd93f9` | Classic vampire purple & pink |
| **Catppuccin Mocha** | `#1e1e2e` | Lavender `#cba6f7` | Soothing pastel dark |
| **Tokyo Night** | `#1a1b26` | Cyan `#7dcfff` | Clean neon metropolis |
| **Nord Frost** | `#2e3440` | Arctic Ice `#88c0d0` | Nordic bluish elegance |
| **Monokai Pro** | `#2d2a2e` | Gold `#ffd866` | Vibrant code syntax |
| **Paper Light** | `#f6f8fa` | GitHub Blue `#0969da` | Light paper print mode |
| **Matrix Cyber** | `#080c0e` | Phosphor `#00ff88` | Green phosphor hacker terminal |

---

## 9. Workflow 8: Multi-Format Exporters (SVG, TSX, Mermaid, PDF)

Export your architecture designs without quality degradation:
- **Copy SVG (`<svg>`)**: Vector markup ready to paste into README.md or Figma.
- **Copy React Component (`.tsx`)**: Zero-dependency TSX component wrapping your vector paths in clean SVG JSX.
- **Copy Mermaid.js**: Formatted `sequenceDiagram` or `classDiagram` code.
- **Export PDF Document**: Vector PDF document generated with clean page bounds.
- **Save `.lapboard` Project**: Complete JSON state for saving, sharing, and reloading projects.

---

## 10. Complete Keymap & Keystroke Reference

| Shortcut | Context | Action |
|---|---|---|
| <kbd>Alt+Shift+D</kbd> | Global | Toggle on-page drawing overlay |
| <kbd>Alt+Shift+E</kbd> | Global | Switch between Pen and Eraser |
| <kbd>Alt+Shift+C</kbd> | Global | Open infinite canvas tab |
| <kbd>Alt+Shift+Z</kbd> | Global | Undo last stroke |
| <kbd>P</kbd> | Canvas / Overlay | Pen tool |
| <kbd>H</kbd> | Overlay | Highlighter tool |
| <kbd>E</kbd> | Canvas / Overlay | Eraser tool |
| <kbd>L</kbd> | Canvas / Overlay | Straight line tool |
| <kbd>R</kbd> | Canvas / Overlay | Box / Rectangle tool |
| <kbd>O</kbd> | Canvas | Ellipse / Circle tool |
| <kbd>A</kbd> | Canvas / Overlay | Connector arrow tool |
| <kbd>T</kbd> | Canvas / Overlay | Text note tool |
| <kbd>F</kbd> | Overlay | Diff Spotlight / Focus mode |
| <kbd>K</kbd> | Overlay | Code review stamps menu |
| <kbd>N</kbd> | Overlay | Documentation & PDF notes panel |
| <kbd>G</kbd> | Overlay | Copy for GitHub PR Review |
| <kbd>D</kbd> | Canvas | Open Developer Diagram Builder modal |
| <kbd>M</kbd> | Canvas / Overlay | Toggle Smart Shape Assist |
| <kbd>G</kbd> | Canvas | Toggle Grid Snap (16px) |
| <kbd>K</kbd> | Canvas | Toggle Dashed line style |
| <kbd>Tab</kbd> | Canvas | Zen mode (hide/show toolbar) |
| <kbd>0</kbd> | Canvas | Fit all content to screen |
| <kbd>Ctrl+1</kbd> | Canvas | Reset zoom to 100% |
| <kbd>Ctrl+Z</kbd> | Canvas / Overlay | Undo stroke |
| <kbd>Ctrl+Shift+Z</kbd> | Canvas / Overlay | Redo stroke |
| <kbd>Ctrl+Shift+X</kbd> | Canvas / Overlay | Clear canvas |
| <kbd>S</kbd> / <kbd>Ctrl+S</kbd> | Canvas / Overlay | Save PNG screenshot |
| <kbd>?</kbd> / <kbd>H</kbd> | Canvas | Open cheatsheet modal |
| <kbd>Esc</kbd> | Canvas / Overlay | Close modal / Exit drawing mode |

---

*LapDraw is open-source, zero-dependency, and built for high-performance laptop engineering.*
