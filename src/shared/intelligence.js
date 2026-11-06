// LapDraw Intelligence Engine — Trackpad drawing assistance & smart shape recognition.
// Zero dependencies: lightweight geometric algorithms for jitter reduction,
// fishhook trimming, angle snapping, and shape beautification (lines, boxes, circles, arrows).

(() => {
  const DEG2RAD = Math.PI / 180;

  // ---------- 1. Jitter Reduction & Streamline Smoothing ----------

  // Exponential moving average filter for trackpad friction stutter
  function smoothPoints(points, factor = 0.35) {
    if (!points || points.length < 3) return points ? [...points] : [];
    const out = [{ ...points[0] }];
    for (let i = 1; i < points.length; i++) {
      const prev = out[i - 1];
      const cur = points[i];
      out.push({
        x: prev.x + (cur.x - prev.x) * (1 - factor),
        y: prev.y + (cur.y - prev.y) * (1 - factor)
      });
    }
    return out;
  }

  // Deduplicate micro-points caused by slow trackpad finger movement (< 1.5px step)
  function dedupePoints(points, minDistance = 1.5) {
    if (!points || points.length <= 2) return points ? [...points] : [];
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const last = out[out.length - 1];
      const cur = points[i];
      if (Math.hypot(cur.x - last.x, cur.y - last.y) >= minDistance) {
        out.push(cur);
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  // Remove accidental "fishhook" tail caused when lifting finger from trackpad
  function stripFishhook(points) {
    if (!points || points.length < 5) return points;
    const n = points.length;
    // Check the angle of the last 2-3 points against the general stroke direction
    const p0 = points[n - 4];
    const p1 = points[n - 2];
    const p2 = points[n - 1];
    const d1x = p1.x - p0.x, d1y = p1.y - p0.y;
    const d2x = p2.x - p1.x, d2y = p2.y - p1.y;
    const len1 = Math.hypot(d1x, d1y);
    const len2 = Math.hypot(d2x, d2y);
    if (len1 > 3 && len2 > 0.5 && len2 < 12) {
      const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
      // If dot < -0.3 (angle > 107° reversal hook) over a tiny tail distance
      if (dot < -0.3) {
        return points.slice(0, n - 2);
      }
    }
    return points;
  }

  // ---------- 2. Alignment & Snapping Helpers ----------

  function snapAngle(x1, y1, x2, y2, thresholdDeg = 8) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 5) return { x2, y2 };
    const ang = Math.atan2(dy, dx);
    const step = Math.PI / 4; // 45 degree steps
    const nearest = Math.round(ang / step) * step;
    const diff = Math.abs(ang - nearest);
    if (diff < thresholdDeg * DEG2RAD || Math.abs(diff - Math.PI * 2) < thresholdDeg * DEG2RAD) {
      return {
        x2: x1 + Math.cos(nearest) * len,
        y2: y1 + Math.sin(nearest) * len
      };
    }
    return { x2, y2 };
  }

  function snapToGridCoord(val, gridSize = 16) {
    return Math.round(val / gridSize) * gridSize;
  }

  // ---------- 3. Smart Shape Recognition ----------

  // Total arc length of points
  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return len;
  }

  // Bounding box of points
  function getBounds(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  // Detect if points form a straight line
  function detectLine(pts) {
    if (pts.length < 2) return null;
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const chord = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    if (chord < 15) return null; // too small

    const totalLen = pathLength(pts);
    const linearity = chord / totalLen;
    if (linearity < 0.88) return null; // too curvy

    // Check maximum perpendicular deviation from the chord line
    let maxDev = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const dev = Math.abs(
        (pEnd.y - pStart.y) * p.x - (pEnd.x - pStart.x) * p.y + pEnd.x * pStart.y - pEnd.y * pStart.x
      ) / chord;
      if (dev > maxDev) maxDev = dev;
    }

    if (maxDev > Math.max(14, chord * 0.16)) return null;

    // Angle snap to 0°, 45°, 90°, etc.
    const snapped = snapAngle(pStart.x, pStart.y, pEnd.x, pEnd.y, 9);
    return {
      type: "line",
      x1: pStart.x,
      y1: pStart.y,
      x2: snapped.x2,
      y2: snapped.y2
    };
  }

  // Detect if points form an arrow (shaft with a hook or arrowhead at the tip)
  function detectArrow(pts) {
    if (pts.length < 6) return null;
    const n = pts.length;
    // Check if main body is mostly straight and last 15-25% forms a barb
    const splitIdx = Math.floor(n * 0.75);
    const shaft = pts.slice(0, splitIdx);
    const tip = pts.slice(splitIdx);

    const lineCandidate = detectLine(shaft);
    if (!lineCandidate) return null;

    // Check if tip has sharp turn relative to shaft
    const shaftDx = shaft[shaft.length - 1].x - shaft[0].x;
    const shaftDy = shaft[shaft.length - 1].y - shaft[0].y;
    const tipDx = tip[tip.length - 1].x - tip[0].x;
    const tipDy = tip[tip.length - 1].y - tip[0].y;
    const shaftLen = Math.hypot(shaftDx, shaftDy);
    const tipLen = Math.hypot(tipDx, tipDy);

    if (shaftLen > 25 && tipLen > 4 && tipLen < shaftLen * 0.5) {
      const dot = (shaftDx * tipDx + shaftDy * tipDy) / (shaftLen * tipLen);
      // sharp turn backwards indicates arrowhead barb
      if (dot < 0.2) {
        return {
          type: "arrow",
          x1: lineCandidate.x1,
          y1: lineCandidate.y1,
          x2: lineCandidate.x2,
          y2: lineCandidate.y2
        };
      }
    }
    return null;
  }

  // Detect if points form a closed or nearly closed loop
  function isNearlyClosed(pts, bounds) {
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const gap = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const diag = Math.hypot(bounds.w, bounds.h);
    return gap < Math.max(24, diag * 0.28);
  }

  // Detect circle or ellipse
  function detectCircleOrEllipse(pts, bounds) {
    if (pts.length < 8) return null;
    if (bounds.w < 16 || bounds.h < 16) return null;
    if (!isNearlyClosed(pts, bounds)) return null;

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const rx = bounds.w / 2;
    const ry = bounds.h / 2;

    // Check normalized radial distance: ((x - cx)/rx)^2 + ((y - cy)/ry)^2 should be close to 1
    let sumNormDist = 0;
    let sumSqDiff = 0;
    for (const p of pts) {
      const nd = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
      sumNormDist += nd;
    }
    const meanNorm = sumNormDist / pts.length;
    if (Math.abs(meanNorm - 1) > 0.09) return null;

    for (const p of pts) {
      const nd = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
      sumSqDiff += (nd - meanNorm) * (nd - meanNorm);
    }
    const variance = sumSqDiff / pts.length;
    // In a circle, radial variance is < 0.009. In a box, it is >= 0.018.
    if (variance > 0.010) return null;

    // If aspect ratio is close to 1, make it a true circle
    const aspectRatio = bounds.w / bounds.h;
    if (aspectRatio > 0.80 && aspectRatio < 1.25) {
      const r = (bounds.w + bounds.h) / 4;
      return {
        type: "ellipse",
        x1: cx - r,
        y1: cy - r,
        x2: cx + r,
        y2: cy + r,
        isCircle: true
      };
    }

    return {
      type: "ellipse",
      x1: bounds.minX,
      y1: bounds.minY,
      x2: bounds.maxX,
      y2: bounds.maxY
    };
  }

  // Detect rectangle / box
  function detectBox(pts, bounds) {
    if (pts.length < 8) return null;
    if (bounds.w < 16 || bounds.h < 16) return null;
    if (!isNearlyClosed(pts, bounds)) return null;

    const perimeter = 2 * (bounds.w + bounds.h);
    const totalLen = pathLength(pts);
    const lenRatio = totalLen / perimeter;
    if (lenRatio < 0.72 || lenRatio > 1.35) return null;

    // Check distance of points to the 4 edges of the bounding box
    let sumEdgeDist = 0;
    for (const p of pts) {
      const distToEdge = Math.min(
        Math.abs(p.x - bounds.minX),
        Math.abs(p.x - bounds.maxX),
        Math.abs(p.y - bounds.minY),
        Math.abs(p.y - bounds.maxY)
      );
      sumEdgeDist += distToEdge;
    }
    const avgEdgeDist = sumEdgeDist / pts.length;
    const maxDim = Math.max(bounds.w, bounds.h);
    if (avgEdgeDist > Math.max(7, maxDim * 0.12)) return null;

    // Check corner count: must have points near corners (within 10% of min dimension)
    const cornerThreshold = Math.max(6, Math.min(bounds.w, bounds.h) * 0.12);
    let c1 = false, c2 = false, c3 = false, c4 = false;
    for (const p of pts) {
      if (Math.hypot(p.x - bounds.minX, p.y - bounds.minY) < cornerThreshold) c1 = true;
      if (Math.hypot(p.x - bounds.maxX, p.y - bounds.minY) < cornerThreshold) c2 = true;
      if (Math.hypot(p.x - bounds.minX, p.y - bounds.maxY) < cornerThreshold) c3 = true;
      if (Math.hypot(p.x - bounds.maxX, p.y - bounds.maxY) < cornerThreshold) c4 = true;
    }
    // At least 3 of 4 corners must be touched in a drawn box
    const cornersHit = [c1, c2, c3, c4].filter(Boolean).length;
    if (cornersHit < 3) return null;

    return {
      type: "rect",
      x1: bounds.minX,
      y1: bounds.minY,
      x2: bounds.maxX,
      y2: bounds.maxY
    };
  }

  // Master recognizer: returns recognized shape or null
  function recognizeShape(rawPoints) {
    if (!rawPoints || rawPoints.length < 3) return null;
    const pts = dedupePoints(stripFishhook(rawPoints));
    if (pts.length < 3) return null;

    // Check Arrow first
    const arrow = detectArrow(pts);
    if (arrow) return arrow;

    // Check Line
    const line = detectLine(pts);
    if (line) return line;

    // Check Closed Shapes
    const bounds = getBounds(pts);
    if (isNearlyClosed(pts, bounds)) {
      // Circle has very strict low radial variance
      const circle = detectCircleOrEllipse(pts, bounds);
      if (circle) return circle;

      const box = detectBox(pts, bounds);
      if (box) return box;
    }

    return null;
  }

  // Expose globally to window / self
  const LapDrawIntelligence = {
    smoothPoints,
    dedupePoints,
    stripFishhook,
    snapAngle,
    snapToGridCoord,
    recognizeShape
  };

  if (typeof window !== "undefined") {
    window.LapDrawIntelligence = LapDrawIntelligence;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.LapDrawIntelligence = LapDrawIntelligence;
  }
})();
