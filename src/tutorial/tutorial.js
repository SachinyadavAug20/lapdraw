// LapDraw Developer Tutorial & Interactive Lab scripts

(() => {
  // Navigation: Open Canvas
  const openCanvasBtn = document.getElementById("openCanvasBtn");
  if (openCanvasBtn) {
    openCanvasBtn.addEventListener("click", () => {
      window.location.href = "../newtab/newtab.html";
    });
  }

  // Active nav link highlight on scroll
  const sections = document.querySelectorAll(".lesson-card");
  const navLinks = document.querySelectorAll(".nav-link");
  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach((sec) => {
      const top = sec.offsetTop - 80;
      if (window.scrollY >= top) current = sec.getAttribute("id");
    });
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  });

  // ==========================================
  // Lesson 1: QuickShape Interactive Sandbox
  // ==========================================
  const qsCanvas = document.getElementById("quickshapeCanvas");
  const qsCtx = qsCanvas.getContext("2d");
  const qsStatus = document.getElementById("qsStatus");
  let qsTool = "pen";
  let qsDrawing = false;
  let qsCurrent = null;
  let qsStrokes = [];
  let qsHoldTimer = null;
  let qsHoldAnchor = null;

  function resizeQsCanvas() {
    const rect = qsCanvas.getBoundingClientRect();
    qsCanvas.width = rect.width;
    qsCanvas.height = 240;
    redrawQs();
  }
  window.addEventListener("resize", resizeQsCanvas);
  setTimeout(resizeQsCanvas, 50);

  function redrawQs() {
    qsCtx.clearRect(0, 0, qsCanvas.width, qsCanvas.height);
    for (const s of qsStrokes) renderQsStroke(s, qsCtx);
    if (qsCurrent) renderQsStroke(qsCurrent, qsCtx);
  }

  function renderQsStroke(stroke, c) {
    c.save();
    c.strokeStyle = stroke.color || "#ff5c50";
    c.lineWidth = stroke.size || 3;
    c.lineCap = "round";
    c.lineJoin = "round";

    if (stroke.tool === "rect") {
      c.strokeRect(
        Math.min(stroke.x1, stroke.x2),
        Math.min(stroke.y1, stroke.y2),
        Math.abs(stroke.x2 - stroke.x1),
        Math.abs(stroke.y2 - stroke.y1)
      );
    } else if (stroke.tool === "line") {
      c.beginPath();
      c.moveTo(stroke.x1, stroke.y1);
      c.lineTo(stroke.x2, stroke.y2);
      c.stroke();
    } else if (stroke.tool === "ellipse") {
      const rx = Math.abs(stroke.x2 - stroke.x1) / 2;
      const ry = Math.abs(stroke.y2 - stroke.y1) / 2;
      const cx = (stroke.x1 + stroke.x2) / 2;
      const cy = (stroke.y1 + stroke.y2) / 2;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      c.stroke();
    } else if (stroke.tool === "arrow") {
      c.beginPath();
      c.moveTo(stroke.x1, stroke.y1);
      c.lineTo(stroke.x2, stroke.y2);
      c.stroke();
      const ang = Math.atan2(stroke.y2 - stroke.y1, stroke.x2 - stroke.x1);
      const head = 12;
      c.beginPath();
      c.moveTo(stroke.x2, stroke.y2);
      c.lineTo(stroke.x2 - head * Math.cos(ang - Math.PI / 6), stroke.y2 - head * Math.sin(ang - Math.PI / 6));
      c.lineTo(stroke.x2 - head * Math.cos(ang + Math.PI / 6), stroke.y2 - head * Math.sin(ang + Math.PI / 6));
      c.closePath();
      c.fillStyle = stroke.color;
      c.fill();
    } else if (stroke.points && stroke.points.length) {
      c.beginPath();
      const pts = stroke.points;
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const midX = (pts[i - 1].x + pts[i].x) / 2;
        const midY = (pts[i - 1].y + pts[i].y) / 2;
        c.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
        if (i === pts.length - 1) c.lineTo(pts[i].x, pts[i].y);
      }
      c.stroke();
    }
    c.restore();
  }

  function triggerQsQuickShape() {
    if (!qsCurrent || qsCurrent.tool !== "pen" || qsCurrent.isSnapped) return;
    if (!qsCurrent.points || qsCurrent.points.length < 5) return;
    if (typeof LapDrawIntelligence !== "undefined") {
      const shape = LapDrawIntelligence.recognizeShape(qsCurrent.points);
      if (shape) {
        qsCurrent = {
          tool: shape.type,
          color: "#ff5c50",
          size: 3,
          x1: shape.x1,
          y1: shape.y1,
          x2: shape.x2,
          y2: shape.y2,
          isSnapped: true
        };
        redrawQs();
        qsStatus.textContent = `✦ QuickShape: ${shape.type.toUpperCase()} SNAPPED!`;
        qsStatus.style.color = "#74c69d";
      }
    }
  }

  qsCanvas.addEventListener("pointerdown", (e) => {
    const r = qsCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    qsDrawing = true;
    qsCurrent = {
      tool: qsTool,
      color: qsTool === "eraser" ? "#090b0e" : "#ff5c50",
      size: qsTool === "eraser" ? 14 : 3,
      points: [{ x, y }],
      isSnapped: false
    };
    qsHoldAnchor = { x, y };
    clearTimeout(qsHoldTimer);
    if (qsTool === "pen") {
      qsHoldTimer = setTimeout(triggerQsQuickShape, 450);
      qsStatus.textContent = "Hold still to snap…";
      qsStatus.style.color = "#ffb547";
    }
    redrawQs();
  });

  qsCanvas.addEventListener("pointermove", (e) => {
    if (!qsDrawing || !qsCurrent) return;
    const r = qsCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (qsHoldAnchor && Math.hypot(x - qsHoldAnchor.x, y - qsHoldAnchor.y) > 8) {
      qsHoldAnchor = { x, y };
      clearTimeout(qsHoldTimer);
      if (qsCurrent.tool === "pen" && !qsCurrent.isSnapped) {
        qsHoldTimer = setTimeout(triggerQsQuickShape, 450);
      }
    }

    if (!qsCurrent.isSnapped) {
      qsCurrent.points.push({ x, y });
    }
    redrawQs();
  });

  const endQs = () => {
    clearTimeout(qsHoldTimer);
    if (!qsDrawing || !qsCurrent) return;
    qsDrawing = false;
    if (qsCurrent.isSnapped) {
      qsStrokes.push(qsCurrent);
    } else if (qsCurrent.points && qsCurrent.points.length > 2) {
      if (typeof LapDrawIntelligence !== "undefined") {
        qsCurrent.points = LapDrawIntelligence.stripFishhook(qsCurrent.points);
        qsCurrent.points = LapDrawIntelligence.smoothPoints(qsCurrent.points, 0.25);
      }
      qsStrokes.push(qsCurrent);
      qsStatus.textContent = "Stroke committed (Streamline smoothed)";
      qsStatus.style.color = "#64a8ff";
    }
    qsCurrent = null;
    redrawQs();
  };
  qsCanvas.addEventListener("pointerup", endQs);
  qsCanvas.addEventListener("pointerleave", endQs);

  document.getElementById("qsPenBtn").onclick = () => {
    qsTool = "pen";
    document.getElementById("qsPenBtn").classList.add("active");
    document.getElementById("qsEraserBtn").classList.remove("active");
  };
  document.getElementById("qsEraserBtn").onclick = () => {
    qsTool = "eraser";
    document.getElementById("qsEraserBtn").classList.add("active");
    document.getElementById("qsPenBtn").classList.remove("active");
  };
  document.getElementById("qsClearBtn").onclick = () => {
    qsStrokes = [];
    qsCurrent = null;
    redrawQs();
    qsStatus.textContent = "Canvas cleared. Draw and hold still.";
    qsStatus.style.color = "#ffb547";
  };

  // ==========================================
  // Lesson 2: GitHub PR Review Sandbox
  // ==========================================
  const prCanvas = document.getElementById("prReviewCanvas");
  const prCtx = prCanvas.getContext("2d");
  const diffWrapper = document.getElementById("diffCodeWrapper");
  let prTool = "highlighter";
  let prDrawing = false;
  let prStrokes = [];
  let prCurrent = null;

  function resizePrCanvas() {
    prCanvas.width = diffWrapper.clientWidth;
    prCanvas.height = diffWrapper.clientHeight;
    redrawPr();
  }
  window.addEventListener("resize", resizePrCanvas);
  setTimeout(resizePrCanvas, 50);

  function redrawPr() {
    prCtx.clearRect(0, 0, prCanvas.width, prCanvas.height);
    for (const s of prStrokes) renderPrStroke(s, prCtx);
    if (prCurrent) renderPrStroke(prCurrent, prCtx);
  }

  function renderPrStroke(stroke, c) {
    c.save();
    if (stroke.tool === "highlighter") {
      c.globalAlpha = 0.38;
      c.strokeStyle = "#ffd60a";
      c.lineWidth = 18;
      c.lineCap = "square";
      c.lineJoin = "bevel";
      if (stroke.points && stroke.points.length) {
        c.beginPath();
        c.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) c.lineTo(stroke.points[i].x, stroke.points[i].y);
        c.stroke();
      }
    } else if (stroke.tool === "spotlight") {
      const x = Math.min(stroke.x1, stroke.x2);
      const y = Math.min(stroke.y1, stroke.y2);
      const w = Math.abs(stroke.x2 - stroke.x1);
      const h = Math.abs(stroke.y2 - stroke.y1);
      if (w > 4 && h > 4) {
        c.fillStyle = "rgba(10, 14, 18, 0.65)";
        c.fillRect(0, 0, prCanvas.width, y);
        c.fillRect(0, y + h, prCanvas.width, prCanvas.height - (y + h));
        c.fillRect(0, y, x, h);
        c.fillRect(x + w, y, prCanvas.width - (x + w), h);
        c.strokeStyle = "#64a8ff";
        c.lineWidth = 2;
        c.strokeRect(x, y, w, h);
        c.fillStyle = "#64a8ff";
        c.fillRect(x, Math.max(0, y - 18), 58, 18);
        c.fillStyle = "#0e1114";
        c.font = 'bold 9.5px "JetBrains Mono", monospace';
        c.textBaseline = "middle";
        c.fillText("● FOCUS", x + 5, Math.max(9, y - 9));
      }
    } else if (stroke.tool === "stamp") {
      const col = stroke.stampType === "BUG" ? "#ff4757" : "#2ed573";
      c.fillStyle = "rgba(14, 18, 24, 0.96)";
      c.fillRect(stroke.x, stroke.y, 160, 24);
      c.strokeStyle = col;
      c.lineWidth = 1.5;
      c.strokeRect(stroke.x, stroke.y, 160, 24);
      c.fillStyle = col;
      c.fillRect(stroke.x, stroke.y, 4, 24);
      c.font = 'bold 10px "JetBrains Mono", monospace';
      c.textBaseline = "middle";
      c.fillText(`✖ [${stroke.stampType}] ${stroke.text || "Check bounds"}`, stroke.x + 8, stroke.y + 12);
    } else if (stroke.tool === "pen") {
      c.strokeStyle = "#ff5c50";
      c.lineWidth = 3;
      c.lineCap = "round";
      if (stroke.points && stroke.points.length) {
        c.beginPath();
        c.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) c.lineTo(stroke.points[i].x, stroke.points[i].y);
        c.stroke();
      }
    }
    c.restore();
  }

  prCanvas.addEventListener("pointerdown", (e) => {
    const r = prCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (prTool === "stamp") {
      prStrokes.push({ tool: "stamp", stampType: "BUG", text: "Validate claims", x, y });
      redrawPr();
      updatePrMarkdown();
      return;
    }
    prDrawing = true;
    if (prTool === "spotlight") {
      prCurrent = { tool: "spotlight", x1: x, y1: y, x2: x, y2: y };
    } else {
      prCurrent = { tool: prTool, points: [{ x, y }] };
    }
    redrawPr();
  });

  prCanvas.addEventListener("pointermove", (e) => {
    if (!prDrawing || !prCurrent) return;
    const r = prCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (prCurrent.tool === "spotlight") {
      prCurrent.x2 = x;
      prCurrent.y2 = y;
    } else {
      prCurrent.points.push({ x, y });
    }
    redrawPr();
  });

  const endPr = () => {
    if (!prDrawing || !prCurrent) return;
    prDrawing = false;
    prStrokes.push(prCurrent);
    prCurrent = null;
    redrawPr();
    updatePrMarkdown();
  };
  prCanvas.addEventListener("pointerup", endPr);
  prCanvas.addEventListener("pointerleave", endPr);

  const prTools = {
    prToolHl: "highlighter",
    prToolStamp: "stamp",
    prToolSpot: "spotlight",
    prToolPen: "pen"
  };
  for (const [id, t] of Object.entries(prTools)) {
    document.getElementById(id).onclick = () => {
      prTool = t;
      Object.keys(prTools).forEach((k) => document.getElementById(k).classList.remove("active"));
      document.getElementById(id).classList.add("active");
    };
  }
  document.getElementById("prToolClear").onclick = () => {
    prStrokes = [];
    redrawPr();
    updatePrMarkdown();
  };

  function updatePrMarkdown() {
    const bugs = prStrokes.filter((s) => s.tool === "stamp").length;
    const hls = prStrokes.filter((s) => s.tool === "highlighter").length;
    let md = `### 🔍 LapDraw Code Review\n`;
    md += `> **Target**: \`internal/auth/jwt_validator.go\`\n`;
    md += `> *(Annotated screenshot copied to clipboard — press Ctrl+V to paste into GitHub comment)*\n\n`;
    md += `#### 📌 Review Callouts:\n`;
    if (bugs > 0) {
      md += `- ✖ **[BUG]**: Line 42: Validate claims pointer before type assertion to avoid nil panic\n`;
    }
    if (hls > 0) {
      md += `- 🟡 **[HIGHLIGHT]**: Line 41: Claims expiration verification requires strict validation\n`;
    }
    if (bugs === 0 && hls === 0) {
      md += `- Visual markup annotations attached above.\n`;
    }
    md += `\n---\n*Reviewed with LapDraw*`;
    document.getElementById("prMarkdownOutput").textContent = md;
  }

  document.getElementById("prCopyGhBtn").onclick = () => {
    const txt = document.getElementById("prMarkdownOutput").textContent;
    navigator.clipboard.writeText(txt).then(() => {
      const st = document.getElementById("prCopyStatus");
      st.textContent = "✔ Markdown copied to clipboard!";
      st.style.color = "#74c69d";
      setTimeout(() => {
        st.textContent = "Click 'Copy for GitHub PR' above";
        st.style.color = "";
      }, 2500);
    });
  };

  // ==========================================
  // Lesson 3: Simulated Documentation Notes
  // ==========================================
  const simNotesArea = document.getElementById("simNotesArea");
  const simNotesStatus = document.getElementById("simNotesStatus");
  let simSaveTimer = null;
  simNotesArea.addEventListener("input", () => {
    simNotesStatus.textContent = "Saving…";
    clearTimeout(simSaveTimer);
    simSaveTimer = setTimeout(() => {
      simNotesStatus.textContent = "Saved";
    }, 300);
  });

  document.querySelectorAll(".sim-tag-btn").forEach((btn) => {
    btn.onclick = () => {
      const tag = btn.dataset.insert;
      const s = simNotesArea.selectionStart || simNotesArea.value.length;
      simNotesArea.value = simNotesArea.value.slice(0, s) + tag + simNotesArea.value.slice(s);
      simNotesArea.selectionStart = simNotesArea.selectionEnd = s + tag.length;
      simNotesArea.focus();
    };
  });

  document.getElementById("simCopyBtn").onclick = () => {
    navigator.clipboard.writeText(simNotesArea.value).then(() => {
      simNotesStatus.textContent = "Copied to clipboard!";
      setTimeout(() => (simNotesStatus.textContent = "Saved"), 2000);
    });
  };

  document.getElementById("simExportBtn").onclick = () => {
    const blob = new Blob([simNotesArea.value], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `LapDraw-Raft-Consensus-Notes-${Date.now()}.md`;
    a.click();
  };

  document.getElementById("simSnapBtn").onclick = () => {
    simNotesArea.value += `\n\n### 📸 Snapshot (${new Date().toLocaleTimeString()}):\n> [Leader Election Flow Chart captured]\n`;
    simNotesStatus.textContent = "Snapshot added";
  };

  // ==========================================
  // Lesson 4: Sequence Diagram Presets
  // ==========================================
  const SEQ_PRESETS = {
    jwt: `participant Client
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
end`,
    stripe: `participant Buyer
participant ShopFrontend
participant BackendAPI
participant StripeAPI
participant WebhookWorker

Buyer -> ShopFrontend: Click "Pay $49"
ShopFrontend -> BackendAPI: POST /api/checkout-session
BackendAPI -> StripeAPI: create_session(items, customer)
StripeAPI --> BackendAPI: session_id + checkout_url
BackendAPI --> ShopFrontend: redirect to Stripe Hosted
Buyer -> StripeAPI: Enter card credentials & submit
StripeAPI -> WebhookWorker: POST /webhooks/stripe (payment_intent.succeeded)
WebhookWorker -> BackendAPI: fulfill_order(order_id)
BackendAPI --> WebhookWorker: 200 OK (Processed)`,
    ws: `participant Browser
participant LoadBalancer
participant RealtimeHub
participant RedisPubSub

Browser -> LoadBalancer: GET /ws (Upgrade: websocket)
LoadBalancer -> RealtimeHub: Upgrade connection
RealtimeHub --> Browser: 101 Switching Protocols
Browser -> RealtimeHub: SUBSCRIBE {"channel": "btc-usd"}
RealtimeHub -> RedisPubSub: SUBSCRIBE btc-usd
loop Every 250ms Price Tick
  RedisPubSub -> RealtimeHub: PUBLISH btc-usd { price: 92450.00 }
  RealtimeHub -> Browser: FRAME { price: 92450.00 }
end`,
    cache: `participant AppService
participant RedisCache
participant PostgreSQL

AppService -> RedisCache: GET user:1001
alt Cache Hit
  RedisCache --> AppService: CachedUserProfileJSON
else Cache Miss
  RedisCache --> AppService: (nil)
  AppService -> PostgreSQL: SELECT * FROM profiles WHERE id = 1001
  PostgreSQL --> AppService: RowData
  AppService -> RedisCache: SETEX user:1001 3600 RowDataJSON
end
AppService --> AppService: Return profile to caller`
  };

  const seqCodeDisplay = document.getElementById("seqCodeDisplay");
  document.querySelectorAll(".seq-tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".seq-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const key = tab.dataset.seq;
      seqCodeDisplay.textContent = SEQ_PRESETS[key] || "";
    };
  });

  document.getElementById("copyMermaidSeqBtn").onclick = () => {
    const raw = seqCodeDisplay.textContent.trim();
    const mermaid = `sequenceDiagram\n  autonumber\n  ${raw.replace(/\n/g, "\n  ")}`;
    navigator.clipboard.writeText(mermaid).then(() => alert("Copied Mermaid.js sequence diagram to clipboard!"));
  };

  document.getElementById("copyReactSeqBtn").onclick = () => {
    const raw = seqCodeDisplay.textContent.trim();
    const tsx = `import React from 'react';\n\nexport const ArchitectureSequenceDiagram: React.FC = () => {\n  return (\n    <div className="sequence-flow font-mono p-4 bg-slate-900 text-slate-100 rounded-lg">\n      <pre>{${JSON.stringify(raw)}}</pre>\n    </div>\n  );\n};`;
    navigator.clipboard.writeText(tsx).then(() => alert("Copied React TSX sequence diagram component to clipboard!"));
  };

  // ==========================================
  // Lesson 6: Live Architecture DSL Compiler
  // ==========================================
  const dslTextarea = document.getElementById("dslTextarea");
  const dslCanvas = document.getElementById("dslPreviewCanvas");
  const dslCtx = dslCanvas.getContext("2d");

  function renderDslToCanvas() {
    const text = dslTextarea.value;
    const lines = text.split("\n");
    dslCtx.clearRect(0, 0, dslCanvas.width, dslCanvas.height);

    const participants = [];
    const messages = [];
    let altFrame = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("participant ")) {
        participants.push(line.replace("participant ", "").trim());
      } else if (line.includes("->") || line.includes("-->")) {
        const isDashed = line.includes("-->");
        const sep = isDashed ? "-->" : "->";
        const parts = line.split(sep);
        const from = parts[0].trim();
        const right = parts[1].trim();
        const colIdx = right.indexOf(":");
        const to = colIdx !== -1 ? right.slice(0, colIdx).trim() : right;
        const msg = colIdx !== -1 ? right.slice(colIdx + 1).trim() : "";
        messages.push({ from, to, msg, dashed: isDashed });
      } else if (line.startsWith("alt ")) {
        altFrame = { label: line.slice(4).trim(), startIdx: messages.length };
      }
    }

    if (participants.length === 0) return;

    const startX = 40;
    const spacing = (dslCanvas.width - 80) / Math.max(1, participants.length - 1);
    const boxW = 80;
    const boxH = 28;
    const pCoords = {};

    // 1. Lifeline boxes & dashed lines
    participants.forEach((name, i) => {
      const x = startX + i * spacing;
      pCoords[name] = x;

      // Lifeline vertical dashed
      dslCtx.save();
      dslCtx.strokeStyle = "#242a31";
      dslCtx.setLineDash([4, 4]);
      dslCtx.beginPath();
      dslCtx.moveTo(x, boxH + 16);
      dslCtx.lineTo(x, dslCanvas.height - 20);
      dslCtx.stroke();
      dslCtx.restore();

      // Top box
      dslCtx.save();
      dslCtx.fillStyle = "#161c24";
      dslCtx.fillRect(x - boxW / 2, 10, boxW, boxH);
      dslCtx.strokeStyle = "#ff5c50";
      dslCtx.lineWidth = 1.5;
      dslCtx.strokeRect(x - boxW / 2, 10, boxW, boxH);

      dslCtx.fillStyle = "#fff";
      dslCtx.font = '10px "JetBrains Mono", monospace';
      dslCtx.textAlign = "center";
      dslCtx.textBaseline = "middle";
      dslCtx.fillText(name, x, 10 + boxH / 2);
      dslCtx.restore();
    });

    // 2. Message arrows
    const msgStartY = 64;
    const msgSpacing = 36;
    messages.forEach((m, idx) => {
      const y = msgStartY + idx * msgSpacing;
      const x1 = pCoords[m.from];
      const x2 = pCoords[m.to];
      if (x1 === undefined || x2 === undefined) return;

      dslCtx.save();
      dslCtx.strokeStyle = m.dashed ? "#64a8ff" : "#ff5c50";
      dslCtx.lineWidth = 1.5;
      if (m.dashed) dslCtx.setLineDash([4, 3]);

      dslCtx.beginPath();
      dslCtx.moveTo(x1, y);
      dslCtx.lineTo(x2, y);
      dslCtx.stroke();

      // Arrow head
      const dir = x2 > x1 ? 1 : -1;
      dslCtx.setLineDash([]);
      dslCtx.fillStyle = m.dashed ? "#64a8ff" : "#ff5c50";
      dslCtx.beginPath();
      dslCtx.moveTo(x2, y);
      dslCtx.lineTo(x2 - dir * 8, y - 4);
      dslCtx.lineTo(x2 - dir * 8, y + 4);
      dslCtx.closePath();
      dslCtx.fill();

      // Label
      dslCtx.fillStyle = "#ccd4dc";
      dslCtx.font = '9.5px "JetBrains Mono", monospace';
      dslCtx.textAlign = "center";
      dslCtx.textBaseline = "bottom";
      dslCtx.fillText(m.msg, (x1 + x2) / 2, y - 2);
      dslCtx.restore();
    });

    // 3. Alt Frame
    if (altFrame) {
      dslCtx.save();
      dslCtx.strokeStyle = "#ffb547";
      dslCtx.lineWidth = 1;
      dslCtx.setLineDash([3, 3]);
      const frameY = msgStartY + altFrame.startIdx * msgSpacing - 14;
      const frameH = messages.length * msgSpacing - altFrame.startIdx * msgSpacing + 20;
      dslCtx.strokeRect(16, frameY, dslCanvas.width - 32, frameH);

      dslCtx.fillStyle = "#ffb547";
      dslCtx.fillRect(16, frameY, 44, 15);
      dslCtx.fillStyle = "#0e1114";
      dslCtx.font = 'bold 8.5px "JetBrains Mono", monospace';
      dslCtx.textAlign = "left";
      dslCtx.fillText("alt: " + altFrame.label, 20, frameY + 11);
      dslCtx.restore();
    }
  }

  document.getElementById("renderDslBtn").onclick = renderDslToCanvas;
  dslTextarea.addEventListener("input", renderDslToCanvas);
  setTimeout(renderDslToCanvas, 80);
})();
