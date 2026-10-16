/*
 * Background "code burst": a full-screen grid of random characters that stays hidden
 * until, every few seconds, a burst starts at a random point on the screen. A wave of
 * scrambling characters spreads out from that point and fades away.
 * The layer sits under every section and ignores the mouse.
 */
(function () {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let CELL_W = 10, CELL_H = 19, FONT_PX = 14;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = () => CHARS[(Math.random() * CHARS.length) | 0];
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");

  const canvas = document.createElement("canvas");
  canvas.className = "code-bg";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: "-1", pointerEvents: "none" });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let cols = 0, rows = 0, chars = [], weight = [], dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    FONT_PX = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;   // grows with the page type
    CELL_W = Math.round(FONT_PX * 0.72);
    CELL_H = Math.round(FONT_PX * 1.35);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    cols = Math.ceil(innerWidth / CELL_W);
    rows = Math.ceil(innerHeight / CELL_H);
    chars = Array.from({ length: cols * rows }, pick);
    weight = Float32Array.from({ length: cols * rows }, () => rand(0.25, 1)); // uneven brightness
  }
  addEventListener("resize", resize);
  resize();

  const bursts = [];
  let next = performance.now() / 1000 + rand(0.3, 1);

  // start in a visible part of the background (header, gaps, margins), not behind a section
  function origin() {
    let x = 0, y = 0;
    for (let i = 0; i < 15; i++) {
      x = rand(0, innerWidth); y = rand(0, innerHeight);
      const el = document.elementFromPoint(x, y);
      if (!el || !el.closest(".card, .modal")) break;
    }
    return [x, y];
  }

  function addBurst(now) {
    const [x, y] = origin();
    const big = Math.max(innerWidth, innerHeight);
    bursts.push({
      x, y,
      t0: now + rand(0, 0.35),          // small stagger so the drops don't land in lockstep
      speed: rand(520, 720),            // px per second
      maxR: big * rand(0.4, 0.6),
      life: rand(3, 3.8),
    });
  }
  // every 1–2.2 s, 2–3 bursts start at different points on the screen
  function spawn(now) {
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) addBurst(now);
    next = now + rand(1, 2.2);
  }

  function frame(ms) {
    const now = ms / 1000;
    if (now >= next) spawn(now);
    for (let i = bursts.length - 1; i >= 0; i--) if (now - bursts[i].t0 > bursts[i].life) bursts.splice(i, 1);
    if (bursts.length > 9) bursts.splice(0, bursts.length - 9);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (bursts.length) {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : darkMQ.matches;
      const rgb = dark ? "240,184,80" : "190,128,16";
      ctx.font = `${FONT_PX}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      ctx.textBaseline = "top";

      for (const b of bursts) {
        const age = now - b.t0;
        if (age < 0) continue;
        const R = Math.min(age * b.speed, b.maxR);
        const fade = Math.min(1, age / 0.25) * Math.max(0, 1 - age / b.life);
        const reach = R + 160;
        const c0 = Math.max(0, ((b.x - reach) / CELL_W) | 0), c1 = Math.min(cols - 1, ((b.x + reach) / CELL_W) | 0);
        const r0 = Math.max(0, ((b.y - reach) / CELL_H) | 0), r1 = Math.min(rows - 1, ((b.y + reach) / CELL_H) | 0);

        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const x = c * CELL_W, y = r * CELL_H;
            const d = Math.hypot(x + CELL_W / 2 - b.x, y + CELL_H / 2 - b.y);
            const front = Math.exp(-((d - R) * (d - R)) / (2 * 80 * 80));               // bright, wide wave front
            const trail = d < R ? 0.5 * Math.exp(-(R - d) / 280) : 0;                    // dimmer area behind it
            const edge = Math.max(0, 1 - d / (b.maxR + 140));                             // weaker far out
            const k = (front + trail) * edge * fade * weight[r * cols + c];
            if (k < 0.03) continue;
            const i = r * cols + c;
            if (front > 0.4 && Math.random() < 0.35) chars[i] = pick();                  // scramble on the front
            ctx.fillStyle = `rgba(${rgb},${Math.min(0.85, k).toFixed(3)})`;
            ctx.fillText(chars[i], x, y);
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // for testing from the console: CodeBG.burst(x, y)
  window.CodeBG = { burst: (x, y) => { const now = performance.now() / 1000; addBurst(now); const b = bursts[bursts.length - 1]; b.x = x; b.y = y; b.t0 = now; } };
})();
