# 📖 GitHub PR Reviews, Documentation Notes & PDF Annotations Guide

This manual covers LapDraw's on-page developer suite: **GitHub PR Review Mode**, **Translucent Highlighting**, **Review Stamp Badging**, and the **Persistent Documentation & PDF Notebook**.

---

## 1. 🔍 GitHub PR Review Mode

Traditional GitHub PR reviews rely on plain text comments. For complex code changes—such as race conditions, state machine bugs, memory leaks, or architecture misalignments—annotating code visually accelerates reviews and eliminates misunderstandings.

### Activating on Any GitHub PR
1. Open any pull request diff: `https://github.com/owner/repo/pull/123/files`.
2. Press <kbd>Alt+Shift+D</kbd> (or click the LapDraw extension icon).
3. The LapDraw terminal toolbar appears at the bottom of the screen.

### Review Tools:

#### A. Highlighter (`HL` / Key: `H`)
- Select `HL` or press <kbd>H</kbd>.
- Drag across code lines.
- Text, syntax highlighting, and line numbers remain 100% visible beneath the translucent highlight band.
- Perfect for calling attention to multi-line conditional blocks, nested promises, or vulnerable regexes.

#### B. Review Stamps (`STAMP` / Key: `K`)
Click `STAMP ▾` or press <kbd>K</kbd> to open the engineer badge menu:
- `✓ [LGTM]` (#2ed573): Approves the implementation or clean pattern.
- `✖ [BUG]` (#ff4757): Flags crashes, nil pointer dereferences, or unhandled exceptions.
- `🔒 [SECURITY]` (#a55eea): Highlights injection risks, missing auth checks, or insecure hashing.
- `✎ [NIT]` (#ffa502): Suggests naming improvements, lint formatting, or comments.
- `⚠ [REQ CHANGES]` (#ff7f50): Marks architectural blockers that must be resolved before merge.
- `⚡ [PERF]` (#00d2d3): Pinpoints $O(N^2)$ loops, missing database indexes, or heavy allocations.
- `? [QUESTION]` (#1e90ff): Requests architectural rationale from the author.

**Placing and Commenting:**
- Click anywhere on a diff line to place the stamp.
- An inline comment box pops up: type a brief rationale (e.g. `Need bounds check: len(items) > 0`) and press <kbd>Enter</kbd>.
- To edit an existing stamp, click it anytime.

#### C. Diff Spotlight (`SPOT` / Key: `F`)
- Click `SPOT` or press <kbd>F</kbd>.
- Drag a rectangle over the lines of interest.
- LapDraw dims the entire page background with a 65% dark scrim and punches a crystal-clear hole with a glowing `● FOCUS` header around the selected code.

#### D. 1-Click "Copy for GitHub PR" (`GH-PR` / Key: `G`)
- Click `GH-PR` or press <kbd>G</kbd>.
- **Clipboard Image**: LapDraw composites the web diff + your highlights + review stamps into a clean PNG and copies it to your clipboard.
- **GitHub PR Markdown**: It also generates a structured markdown summary and copies it to your notebook:

```markdown
### 🔍 LapDraw Code Review
> **Review Target**: [pkg/server/router.go](https://github.com/owner/repo/pull/123)
> **Timestamp**: 2026-11-07 14:20
> *(Annotated review screenshot copied to clipboard — press `Ctrl+V` to paste directly into your GitHub comment)*

#### 📌 Review Callouts:
- ✖ **[BUG]** Line 58: Unhandled error from `json.Unmarshal`
- 🔒 **[SECURITY]** Line 64: Direct parameter injection into SQL query
- ✓ **[LGTM]** Line 80: Clean middleware chaining pattern

---
*Generated with [LapDraw](https://github.com/SachinyadavAug20/lapdraw)*
```

- Navigate to the GitHub review comment box, press <kbd>Ctrl+V</kbd> to paste the image, and paste the markdown callout text.

---

## 2. 📚 Persistent Documentation & PDF Notebook

When studying API references, standard specifications, or reading PDFs, taking notes directly in context is critical.

### How Per-URL Storage Works
LapDraw automatically scopes notes to each page:
- **Web Pages**: Keyed by `origin + pathname` (e.g. `https://kubernetes.io/docs/concepts/services-networking/service/`).
- **Local PDFs**: Keyed by `file:///path/to/document.pdf`.
- **Browser State**: Auto-saved to `chrome.storage.local` with 300ms debouncing as you type.
- **Visual Indicator**: The `NOTES` button on the overlay toolbar displays a dot indicator (`NOTES •`) whenever notes exist for the current page.

### Features of the Notebook Panel:

1. **Opening the Notebook**:
   - Press <kbd>N</kbd> or click `NOTES` on the toolbar.
   - A floating glassmorphic sidebar appears docked on the right side of the screen.

2. **Semantic Tag Shortcuts**:
   - Click `+ [TODO]` → Inserts `- [ ] [TODO] ` at cursor.
   - Click `+ [KEY]` → Inserts `> 🔑 **[KEY POINT]**: ` at cursor.
   - Click `+ [API]` → Inserts `### 🔌 API: ` at cursor.
   - Click `+ [BUG]` → Inserts `- 🐞 **[BUG]**: ` at cursor.

3. **📸 Snap & Embed**:
   - Click `📸 Snap` in the notes panel.
   - LapDraw saves a timestamped snapshot marker into your note document:
     ```markdown
     ### 📸 Annotation Snapshot (14:22:10)
     > *Visual annotations captured at 14:22:10.*
     ```

4. **📋 Copy Markdown (For Obsidian / Notion / Logseq)**:
   - Click `📋 Copy MD`.
   - Copies the full document with frontmatter metadata:
     ```markdown
     # Notes: React 19 Server Components
     > URL: https://react.dev/reference/rsc/server-components
     > Saved: 11/7/2026, 2:25:00 PM

     - [ ] [TODO] Migrate data loaders to async Server Components
     > 🔑 **[KEY POINT]**: Server Components execute only on the server and emit RSC payload
     ```
   - Paste directly into an Obsidian vault `.md` note or a Notion page.

5. **💾 Export `.md` File**:
   - Click `💾 Export`.
   - Downloads a standalone Markdown file named `LapDraw-<PageSlug>-<timestamp>.md`.

---

## 3. 🎯 Pro Tips for Daily Developer Flow

- **Zen Mode**: Press <kbd>Tab</kbd> on the infinite canvas to collapse all HUD bars for an uncluttered presentation mode.
- **Trackpad Gestures**:
  - Two-finger drag: pans the canvas in any direction.
  - Pinch-to-zoom: zooms into intricate diagram sub-systems.
- **Quick Undo / Redo**:
  - <kbd>Ctrl+Z</kbd> / <kbd>U</kbd>: undo last stroke.
  - <kbd>Ctrl+Shift+Z</kbd> / <kbd>R</kbd>: redo stroke.
- **Fast Screenshot**: Press <kbd>S</kbd> to immediately trigger a PNG download of your current annotations.

---

*LapDraw: Zero tracking, local-first storage, built for developers.*
