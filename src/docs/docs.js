// LapDraw Visual Documentation Interactive Scripts

(() => {
  // Navigation: Open Canvas
  const openCanvasBtn = document.getElementById("btnOpenCanvas");
  if (openCanvasBtn) {
    openCanvasBtn.addEventListener("click", () => {
      window.location.href = "../newtab/newtab.html";
    });
  }

  // Active pill tracking on scroll
  const sections = document.querySelectorAll(".visual-section");
  const pills = document.querySelectorAll(".pill");
  window.addEventListener("scroll", () => {
    let cur = "";
    sections.forEach((sec) => {
      if (window.scrollY >= sec.offsetTop - 120) cur = sec.getAttribute("id");
    });
    pills.forEach((p) => {
      p.classList.toggle("active", p.getAttribute("href") === `#${cur}`);
    });
  });

  // Interactive QuickShape Demo Pad
  const canvas = document.getElementById("qsDemoCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const status = document.getElementById("qsDemoStatus");
    const clearBtn = document.getElementById("qsClear");
    let drawing = false;
    let strokes = [];
    let current = null;
    let holdTimer = null;
    let holdAnchor = null;

    function resize() {
      canvas.width = canvas.parentElement.clientWidth - 24;
      canvas.height = 160;
      redraw();
    }
    window.addEventListener("resize", resize);
    setTimeout(resize, 40);

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of strokes) render(s);
      if (current) render(current);
    }

    function render(s) {
      ctx.save();
      ctx.strokeStyle = s.color || "#ff5c50";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.tool === "rect") {
        ctx.strokeRect(
          Math.min(s.x1, s.x2),
          Math.min(s.y1, s.y2),
          Math.abs(s.x2 - s.x1),
          Math.abs(s.y2 - s.y1)
        );
      } else if (s.tool === "ellipse") {
        const rx = Math.abs(s.x2 - s.x1) / 2;
        const ry = Math.abs(s.y2 - s.y1) / 2;
        const cx = (s.x1 + s.x2) / 2;
        const cy = (s.y1 + s.y2) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      } else if (s.points && s.points.length) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          const midX = (s.points[i - 1].x + s.points[i].x) / 2;
          const midY = (s.points[i - 1].y + s.points[i].y) / 2;
          ctx.quadraticCurveTo(s.points[i - 1].x, s.points[i - 1].y, midX, midY);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function triggerSnap() {
      if (!current || current.isSnapped || !current.points || current.points.length < 5) return;
      if (typeof LapDrawIntelligence !== "undefined") {
        const rec = LapDrawIntelligence.recognizeShape(current.points);
        if (rec) {
          current = {
            tool: rec.type,
            color: "#2ed573",
            x1: rec.x1,
            y1: rec.y1,
            x2: rec.x2,
            y2: rec.y2,
            isSnapped: true
          };
          redraw();
          status.textContent = `✨ QuickShape: ${rec.type.toUpperCase()} SNAPPED!`;
          status.style.color = "#2ed573";
        }
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      drawing = true;
      current = { tool: "pen", color: "#ff5c50", points: [{ x, y }], isSnapped: false };
      holdAnchor = { x, y };
      clearTimeout(holdTimer);
      holdTimer = setTimeout(triggerSnap, 450);
      status.textContent = "Hold still to snap…";
      status.style.color = "#ffa502";
      redraw();
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!drawing || !current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (holdAnchor && Math.hypot(x - holdAnchor.x, y - holdAnchor.y) > 8) {
        holdAnchor = { x, y };
        clearTimeout(holdTimer);
        if (!current.isSnapped) holdTimer = setTimeout(triggerSnap, 450);
      }

      if (!current.isSnapped) current.points.push({ x, y });
      redraw();
    });

    const end = () => {
      clearTimeout(holdTimer);
      if (!drawing || !current) return;
      drawing = false;
      if (current.isSnapped || (current.points && current.points.length > 2)) {
        strokes.push(current);
        status.textContent = "Stroke saved. Draw again!";
      }
      current = null;
      redraw();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);

    if (clearBtn) {
      clearBtn.onclick = () => {
        strokes = [];
        current = null;
        redraw();
        status.textContent = "Pad cleared. Draw and hold still.";
        status.style.color = "#ffa502";
      };
    }
  }

  // Theme card switcher preview
  const themeCards = document.querySelectorAll(".theme-card");
  themeCards.forEach((c) => {
    c.onclick = () => {
      themeCards.forEach((tc) => tc.classList.remove("active"));
      c.classList.add("active");
    };
  });
})();
