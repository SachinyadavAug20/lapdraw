# LapDraw — Store Publishing Guide
### Publishing to the Google Chrome Web Store & Mozilla Firefox Add-ons (AMO)

This guide walks you through the complete process of publishing **LapDraw** to both the **Chrome Web Store** and **Firefox Add-ons (AMO)**, including required assets, permission justifications, privacy disclosures, and review tips.

---

## 1. Distribution Packages & Verification

Before submitting, run the automated build script:

```bash
npm run build
```

This compiles icons and packages two store-ready ZIP archives in `dist/`:
- **Chrome**: `dist/lapdraw-chrome-v0.4.0.zip` (Manifest V3)
- **Firefox**: `dist/lapdraw-firefox-v0.4.0.zip` (Manifest V2)

### Required Store Assets Checklist

| Asset | Dimensions | Format | Notes |
| --- | --- | --- | --- |
| **Store Icon** | 128 × 128 px | PNG | Located at `src/icons/icon128.png` |
| **Screenshot 1** | 1280 × 800 px (or 640 × 400) | PNG/JPEG | New Tab Infinite Canvas & Developer HUD |
| **Screenshot 2** | 1280 × 800 px | PNG/JPEG | On-Page Annotation Overlay over GitHub/Docs |
| **Screenshot 3** | 1280 × 800 px | PNG/JPEG | Developer Diagram Builder (DB Schema / Sequence / UML) |
| **Small Promo Tile** (Chrome) | 440 × 280 px | PNG/JPEG | Dark terminal background with LapDraw logo & tagline |
| **Marquee Promo Tile** (Optional) | 1400 × 560 px | PNG/JPEG | For featured banner placement |
| **Privacy Policy URL** | Hosted Web Link | Markdown / HTML | Hosted on GitHub Pages or a public repository file |

---

## 2. Chrome Web Store Publishing Guide

### Step 1: Create a Developer Account
1. Visit the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
3. Pay the **one-time $5 USD registration fee**.
4. Enable **Two-Factor Authentication (2FA)** on your Google account (mandatory for Chrome Web Store developers).

### Step 2: Upload the Extension Package
1. In the Developer Dashboard, click **"New Item"** (top right).
2. Drag and drop `dist/lapdraw-chrome-v0.4.0.zip` (or browse to select it).
3. The dashboard will validate your `manifest.json`.

### Step 3: Fill Out Store Listing Metadata
- **Product Name**: `LapDraw — Trackpad Drawing & Developer Diagrams`
- **Summary** (Max 132 chars):
  `Draw on any website with your laptop trackpad or create architecture diagrams, DB schemas, and sequence flows on an infinite canvas.`
- **Detailed Description**:
  ```markdown
  LapDraw is a developer-first drawing and diagramming extension designed specifically for laptop trackpads. Standard drawing tools require a stylus or mouse — drawing with your finger on a trackpad usually produces wobbly lines, jitter, and accidental hooks.

  LapDraw includes an on-device Intelligence Engine:
  • QuickShape (Hold-to-Snap): Draw rough lines, boxes, circles, diamonds, cylinders, or arrows and hold still for 450ms to snap into crisp vector geometry.
  • Friction Stabilizer: Exponential moving average filter removes trackpad static friction stutter.
  • Fishhook Trimmer: Eliminates release hooks when lifting your finger.
  • Developer Diagram Builder: Generate Database Schemas, Sequence Diagrams with lifelines, UML Classes, and Architecture nodes.
  • Zero-Dependency Exports: One-click Copy SVG markup, Copy React TSX component, Copy Mermaid.js code, and PDF/PNG export.
  • 100% Local & Private: Runs entirely inside your browser with zero remote servers or telemetry.
  ```
- **Category**: `Productivity` (Secondary: `Developer Tools`)
- **Language**: English

### Step 4: Upload Graphic Assets
- **Store Icon**: Upload `src/icons/icon128.png`.
- **Screenshots**: Upload at least 1 (recommend 3–5) 1280 × 800 screenshots demonstrating:
  1. The infinite canvas whiteboard tab with developer HUD.
  2. Drawing on top of a live web page with the overlay toolbar.
  3. Generating a database ER schema or sequence diagram and copying Mermaid.js / React TSX code.
- **Small Promo Tile**: Upload a 440 × 280 image (dark background, coral accent).

### Step 5: Privacy & Permission Justification (Crucial for Approval)
Google reviewers inspect your permission justifications closely under the **Single Purpose Policy**:

1. **Single Purpose Description**:
   `LapDraw is a trackpad-optimized drawing and diagramming tool that allows users to annotate web pages and create diagrams on an infinite canvas whiteboard.`

2. **Permission Justifications**:
   - `activeTab`: *"Allows LapDraw to display the drawing canvas overlay directly on the currently active tab when invoked by the user via toolbar click or Alt+Shift+D."*
   - `storage`: *"Used to persist user settings, custom keybindings, and canvas vector strokes locally in browser storage without external servers."*
   - `tabs`: *"Used to open and focus the LapDraw infinite canvas whiteboard in a new tab when the user clicks 'New Tab' or presses Alt+Shift+C."*
   - `<all_urls>` / host permissions: *"Required solely to inject the transparent drawing overlay onto the web page the user desires to annotate when toggled."*

3. **Data Usage Declarations**:
   - Check **"No"** to: Personally Identifiable Information, Health info, Financial info, Authentication info, Personal communications, Location, Web history, User activity.
   - Certify:
     - *"I do not sell user data to third parties."*
     - *"I do not use or transfer user data for purposes unrelated to the item's single purpose."*
     - *"I do not use or transfer user data to determine creditworthiness or for lending purposes."*

4. **Privacy Policy Link**:
   Provide the public URL to your GitHub privacy policy (e.g., `https://github.com/SachinyadavAug20/lapdraw/blob/main/PRIVACY.md`).

### Step 6: Submit for Review
1. Click **"Submit for Review"**.
2. Select standard publishing (automatically publishes upon approval).
3. **Review Time**: Typically **1 to 3 business days**. You will receive an automated email once approved or if revisions are requested.

---

## 3. Firefox Add-ons (AMO) Publishing Guide

### Step 1: Create a Mozilla Add-ons Account
1. Visit the [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/).
2. Log in with your Firefox Account (or register for free).
3. Enable **Two-Factor Authentication (2FA)**.

### Step 2: Submit a New Add-on
1. Click **"Submit a New Add-on"**.
2. Accept the Firefox Add-on Distribution Agreement.
3. Choose Distribution Channel: Select **"On this site"** (so Mozilla hosts and lists your extension on `addons.mozilla.org`).

### Step 3: Upload the Add-on Package
1. Upload `dist/lapdraw-firefox-v0.4.0.zip`.
2. The AMO automated validator will inspect the manifest, permissions, and scripts.
   - Note: In `src/manifest.firefox.json`, `gecko.id` is already configured as `"lapdraw@sachin.dev"`.
3. **Source Code Question**:
   - The validator will ask: *"Does your extension contain minified, concatenated, or obfuscated source code?"*
   - Select: **"No"**.
   - Explanation: *"LapDraw is written entirely in unminified, plain vanilla JavaScript, HTML5 Canvas 2D, and CSS with zero external libraries or bundlers."* (This bypasses manual source code review delays!)

### Step 4: Describe the Add-on
- **Name**: `LapDraw — Trackpad Drawing`
- **Summary**: `Draw on any website with your laptop trackpad, or open an infinite canvas in a new tab. Built for people without a pen or mouse.`
- **Categories**: `Photos, Music & Notes` and `Web Development`.
- **Add-on Icon**: Upload `src/icons/icon128.png`.
- **Screenshots**: Upload your 1280 × 800 screenshots.
- **Support Email / Website**: Link to your GitHub repository.

### Step 5: Finish & Submit
1. Click **"Submit"**.
2. **Review Time**: Because LapDraw uses clean, zero-dependency unminified JavaScript with standard WebExtension APIs, Firefox reviews typically pass automated validation and are approved in **a few hours to 24 hours**.

---

## 4. Releasing Future Updates

When releasing version `0.5.0` or beyond:

1. Update the version in:
   - `package.json`
   - `src/manifest.chrome.json`
   - `src/manifest.firefox.json`
2. Run:
   ```bash
   npm run build
   ```
3. In Chrome Developer Dashboard: Click your extension → **"Upload new package"** → upload `dist/lapdraw-chrome-v0.x.x.zip` → submit.
4. In Firefox Add-ons Hub: Click your extension → **"Upload a New Version"** → upload `dist/lapdraw-firefox-v0.x.x.zip` → submit.

---

## 5. Common Rejection Pitfalls & How LapDraw Avoids Them

| Pitfall | Reason | How LapDraw Avoids It |
| --- | --- | --- |
| **Vague Permission Justification** | Rejecting extensions requesting `<all_urls>` without explanation | LapDraw explicitly states host permissions are used exclusively to mount user-triggered annotation overlays. |
| **Remote Code Execution** | Chrome MV3 prohibits `eval()` or fetching remote `.js` scripts | LapDraw is 100% self-contained with local scripts only. |
| **Missing Privacy Policy** | Required whenever extensions access web pages | Standalone privacy policy hosted publicly on GitHub. |
| **Bundled Obfuscation (AMO)** | Firefox rejects extensions using Webpack/minification without source code | LapDraw uses unminified, readable vanilla JavaScript. |
