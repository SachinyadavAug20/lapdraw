# 🎓 LapDraw In-App Interactive Developer Lab & Tutorial Guide

This guide walks you through the interactive developer lab available directly inside LapDraw (`tutorial/tutorial.html`). You can access it anytime by clicking **🎓 TUTORIAL** on the infinite canvas HUD or **🎓 GUIDE** in the popup menu.

---

## 🏛️ Laboratory Structure

The lab features 7 hands-on interactive modules designed to transition engineers from rough trackpad scribbles to professional system architecture and code review workflows:

```
src/tutorial/
├── tutorial.html       # Full interactive multi-lesson single page application
├── tutorial.css        # Omarchy rice dark mono styling & glassmorphic panels
└── tutorial.js         # Real-time sandboxes, Catmull-Rom math, and DSL compiler
```

---

## 🔬 Interactive Lessons Overview

### Lesson 01: Trackpad QuickShape & Streamline Stabilization
- **The Concept**: Why trackpad drawing stutters (static friction stick-slip effect, finger lift fishhook tails).
- **The Sandbox**: A real-time HTML5 2D canvas running LapDraw's `intelligence.js` engine.
- **Hands-on Task**:
  1. Click and drag with one finger on your trackpad to draw a wobbly circle or rectangular box.
  2. Hold your finger completely still at the end of the stroke for **450ms**.
  3. The status indicator will chime: `✦ QuickShape: RECTANGLE SNAPPED!` or `✦ QuickShape: CIRCLE SNAPPED!`.

### Lesson 02: GitHub PR Review Mode & Code Diff Auditing
- **The Concept**: Visual pull request reviews for race conditions, auth bypasses, and nil pointer panics.
- **The Sandbox**: A simulated GitHub Pull Request diff view showing `internal/auth/jwt_validator.go` with line numbers and green/red additions/deletions.
- **Hands-on Task**:
  1. Select the `HL` (Highlighter) tool and highlight line 42 (`claims := token.Claims.(*Claims)`).
  2. Click `STAMP: [BUG]` and click line 42 to place an engineer callout badge.
  3. Click `SPOT` (Spotlight) to drag a focus scrim over lines 41–44.
  4. Click **📋 Copy for GitHub PR** to generate the composite image and markdown snippet.

### Lesson 03: Persistent Documentation & PDF Notes
- **The Concept**: Auto-saving contextual notes scoped per URL into `chrome.storage.local`.
- **The Sandbox**: A split-screen simulation with a technical whitepaper (*Distributed Consensus · Raft Protocol*) on the left and LapDraw's dockable Notes Panel on the right.
- **Hands-on Task**:
  1. Click `+ [KEY]` to insert a key takeaway tag.
  2. Type your architecture notes into the editor; observe the status badge show `Saving…` then `Saved`.
  3. Click `📸 Snap` to attach a visual diagram snapshot marker.
  4. Click `💾 Export .md` to test downloading a clean Markdown document for Obsidian or Notion.

### Lesson 04: Sequence Diagram Studio with Activations & Frames
- **The Concept**: Generating industrial sequence diagrams with lifeline execution activations, self-call loops, and combined fragments (`alt`, `loop`, `opt`).
- **Interactive Presets**:
  - `JWT Authentication`: Token validation with valid/invalid password branches.
  - `Stripe Checkout & Webhooks`: Asynchronous payment intent processing with webhook fulfillment.
  - `WebSocket Handshake & Subscriptions`: 101 Switching Protocols with 250ms ticker loops.
  - `Cache-Aside Architecture`: Redis cache hit vs PostgreSQL database miss queries.
- **Hands-on Task**:
  - Switch between presets and click **Copy as Mermaid.js** or **Copy as React TSX**.

### Lesson 05: UML Class & Architecture Studio
- **The Concept**: Microservice component modeling with stereotypes (`«service»`, `«interface»`, `«entity»`) and relationship connectors.
- **The Reference Matrix**:
  - `«service» PaymentProcessor` with public (`+`), private (`-`), and protected (`#`) methods.
  - 6 Relationship connectors: `<|--` (Inheritance), `<|..` (Interface), `*--` (Composition), `o--` (Aggregation), `..>` (Dependency), `-->` (Directed Association).

### Lesson 06: Live Markdown & Architecture DSL Compiler
- **The Concept**: Real-time PlantUML/Mermaid-like text parsing directly into vector strokes.
- **The Sandbox**: A two-pane live compiler.
- **Hands-on Task**:
  1. Edit the text on the left pane:
     ```text
     participant Client
     participant LoadBalancer
     participant AppServer
     Client -> LoadBalancer: GET /dashboard
     LoadBalancer -> AppServer: forward_request
     AppServer --> Client: 200 OK
     ```
  2. Watch the right canvas render lifelines, dashed connection lines, and filled arrowheads dynamically!

### Lesson 07: Power Cheatsheet & Keyboard Maestro
- Complete keystroke table for global triggers, canvas navigation, diagram building, and options page customization.

---

## 🚀 How to Launch the Tutorial
- **Direct Link**: Navigate to `chrome-extension://<id>/tutorial/tutorial.html` or `moz-extension://<id>/tutorial/tutorial.html`.
- **From New Tab Canvas**: Click the **🎓 TUTORIAL** button in the top HUD or press <kbd>?</kbd> → **Open Full Interactive Lab & Docs**.
- **From Extension Popup**: Click the **🎓 GUIDE** button in the footer.
