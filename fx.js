/*
 * Logo effect for every [data-fx] section.
 *  - Idle (mouse elsewhere): every few seconds a single "water drop" lands on a random
 *    point and a calm ripple spreads out slowly; where the rings pass, the Marigold logo
 *    surfaces with a soft glow. Every section runs the same logic with its own random
 *    timing, speed and drop positions.
 *  - Hover: a soft, slowly breathing ring of light follows the cursor and gently lights up
 *    the logo around it, without getting in the way of the text.
 */
(function () {
  "use strict";

  const MAX_RIPPLES = 4;
  const RING_RADIUS = 46;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  const rand = (a, b) => a + Math.random() * (b - a);

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D uTex;
    uniform vec2  uRes;        // canvas size in CSS px
    uniform float uScale;      // device px per CSS px
    uniform vec4  uLogo;       // logo rect: x, y, w, h (CSS px, top-left origin)
    uniform vec4  uRip[${MAX_RIPPLES}];  // ripple: x, y, age (s), strength (0 = off)
    uniform float uTime, uHover, uDark, uLensR, uSpeed, uSeed;
    uniform vec2  uMouse;
    uniform vec3  uGlow;

    vec4 logoAt(vec2 p) {
      vec2 uv = (p - uLogo.xy) / uLogo.zw;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
      vec4 c = texture2D(uTex, uv);
      if (c.a < 0.003) return vec4(0.0);
      vec3 rgb = c.rgb / c.a;
      // in dark mode the black "M" becomes cream so it stays visible
      float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
      rgb = mix(rgb, vec3(0.95, 0.92, 0.86), uDark * (1.0 - smoothstep(0.2, 0.4, lum)));
      return vec4(rgb * c.a, c.a);
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, uRes.y * uScale - gl_FragCoord.y) / uScale;

      // ---------- idle: glowing water ripples ----------
      vec2 disp = vec2(0.0);
      float ring = 0.0, inner = 0.0, crest = 0.0;
      for (int i = 0; i < ${MAX_RIPPLES}; i++) {
        vec4 r = uRip[i];
        if (r.w <= 0.0) continue;
        vec2 d = p - r.xy;
        float dist = length(d) + 0.001;
        float x = dist - r.z * uSpeed;             // distance from the wave front
        float fade = r.w * exp(-r.z * 0.32) * smoothstep(0.0, 0.6, r.z);
        float env = exp(-x * x / 5000.0);
        float s = sin(x * 0.09) * env * fade;
        disp  += d / dist * s * 3.0;               // gentle refraction
        ring  += env * fade;
        crest += max(s, 0.0);
        inner += fade * smoothstep(10.0, -60.0, x) * exp(min(x, 0.0) / 200.0);
      }
      float caustic = 0.5 + 0.5 * sin(p.x * 0.031 + uTime * 0.8 + uSeed)
                                * sin(p.y * 0.027 - uTime * 0.6 + uSeed * 1.7);
      vec2 q = p + disp;
      vec4 L = logoAt(q);
      float a = clamp(ring * 0.7 + inner * 0.3 + caustic * 0.02, 0.0, 1.0);
      vec4 idle = L * a * 0.6;
      float halo = (logoAt(q + vec2(7.0, 0.0)).a + logoAt(q - vec2(7.0, 0.0)).a
                  + logoAt(q + vec2(0.0, 7.0)).a + logoAt(q - vec2(0.0, 7.0)).a) * 0.25;
      float g = clamp((crest * 1.0 + ring * 0.25) * halo, 0.0, 1.0) * 0.4;
      idle += vec4(uGlow * g, g) * (1.0 - idle.a);
      idle.rgb += vec3(pow(clamp(crest, 0.0, 1.0), 3.0) * L.a * 0.2);
      idle.rgb = min(idle.rgb, vec3(idle.a));

      // ---------- hover: glow ring around the cursor ----------
      float r = length(p - uMouse);
      float R = uLensR * (1.0 + 0.06 * sin(uTime * 2.0));          // slow "breathing"
      float spot = exp(-r * r / (2.0 * 70.0 * 70.0));               // soft light pool
      vec4 hov = logoAt(p) * (0.05 + 0.2 * spot);                   // logo lit near the cursor
      float wash = spot * 0.07;
      hov += vec4(uGlow * wash, wash) * (1.0 - hov.a);
      float rim = exp(-pow((r - R) / 1.4, 2.0)) * 0.5               // crisp ring
                + exp(-pow((r - R) / 9.0, 2.0)) * 0.14;             // its glow
      hov += vec4(uGlow * rim, rim) * (1.0 - hov.a);

      gl_FragColor = mix(idle, hov, uHover);
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  class LogoFX {
    constructor(host, img) {
      this.host = host;
      this.canvas = host.querySelector(":scope > canvas.fx");
      const gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) { this.dead = true; return; }
      this.gl = gl;

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.u = {};
      for (const n of ["uTex", "uRes", "uScale", "uLogo", "uRip", "uTime", "uHover", "uDark", "uLensR", "uSpeed", "uSeed", "uMouse", "uGlow"]) {
        this.u[n] = gl.getUniformLocation(prog, n);
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.u.uTex, 0);

      // per-section randomness: same logic, different personality
      this.speed = rand(55, 85);
      this.gapMin = rand(2.2, 3.5);
      this.gapMax = this.gapMin + rand(1.5, 3);
      this.seed = rand(0, 100);
      this.ripples = [];
      this.nextSpawn = performance.now() / 1000 + rand(0.3, 3);
      this.ripData = new Float32Array(MAX_RIPPLES * 4);

      this.hover = 0;
      this.hoverTarget = 0;
      this.mouse = { x: 0, y: 0 };
      this.mouseTarget = { x: 0, y: 0 };
      this.visible = true;
      this.w = 0; this.h = 0;

      this.bindPointer();
      new ResizeObserver(() => this.resize()).observe(host);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(host);
      this.resize();
    }

    bindPointer() {
      const host = this.host;
      const update = (e) => {
        // a nested section (e.g. 3A inside 03) owns the pointer while it is over it
        const own = e.target.closest("[data-fx]") === host;
        const target = own && e.pointerType !== "touch" ? 1 : 0;
        const r = this.canvas.getBoundingClientRect();
        this.mouseTarget.x = e.clientX - r.left;
        this.mouseTarget.y = e.clientY - r.top;
        if (target && this.hover < 0.05) { this.mouse.x = this.mouseTarget.x; this.mouse.y = this.mouseTarget.y; }
        this.hoverTarget = target;
      };
      host.addEventListener("pointermove", update);
      host.addEventListener("pointerover", update);
      host.addEventListener("pointerleave", () => { this.hoverTarget = 0; });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.w = rect.width; this.h = rect.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      this.canvas.width = Math.max(1, Math.round(this.w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.h * this.dpr));

      // logo is fitted into an optional area (data-fx-area) or the whole section
      let ax = 0, ay = 0, aw = this.w, ah = this.h;
      const sel = this.host.dataset.fxArea;
      const area = sel && this.host.querySelector(sel);
      if (area) {
        const r = area.getBoundingClientRect();
        ax = r.left - rect.left; ay = r.top - rect.top; aw = r.width; ah = r.height;
        ay = 0; ah = this.h;                         // use full height of the section
      }
      const s = Math.min(aw, ah) * 0.92;
      this.logo = [ax + (aw - s) / 2, ay + (ah - s) / 2, s, s];
    }

    spawn(now) {
      const [lx, ly, lw, lh] = this.logo;
      const inLogo = Math.random() < 0.7;
      this.ripples.push({
        x: inLogo ? lx + rand(0.1, 0.9) * lw : rand(0, this.w),
        y: inLogo ? ly + rand(0.1, 0.9) * lh : rand(0, this.h),
        t0: now,
        s: rand(0.7, 1),
      });
      if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
      const slow = reduceMotion.matches ? 3 : 1;
      this.nextSpawn = now + rand(this.gapMin, this.gapMax) * slow;
    }

    frame(now) {
      if (this.dead || !this.visible || this.w < 2 || this.h < 2) return;
      const gl = this.gl;

      if (now >= this.nextSpawn) this.spawn(now);
      this.ripples = this.ripples.filter((r) => now - r.t0 < 10);
      this.ripData.fill(0);
      this.ripples.forEach((r, i) => this.ripData.set([r.x, r.y, now - r.t0, r.s], i * 4));

      this.hover += (this.hoverTarget - this.hover) * 0.12;
      this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.35;
      this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.35;

      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === "dark"
        : darkMQ.matches;

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.u.uRes, this.w, this.h);
      gl.uniform1f(this.u.uScale, this.dpr);
      gl.uniform4f(this.u.uLogo, ...this.logo);
      gl.uniform4fv(this.u.uRip, this.ripData);
      gl.uniform1f(this.u.uTime, now);
      gl.uniform1f(this.u.uHover, this.hover);
      gl.uniform1f(this.u.uDark, dark ? 1 : 0);
      gl.uniform1f(this.u.uLensR, RING_RADIUS);
      gl.uniform1f(this.u.uSpeed, this.speed);
      gl.uniform1f(this.u.uSeed, this.seed);
      gl.uniform2f(this.u.uMouse, this.mouse.x, this.mouse.y);
      gl.uniform3f(this.u.uGlow, 0.95, 0.68, 0.22);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  const instances = [];
  function loop(ms) {
    const now = ms / 1000;
    for (const fx of instances) fx.frame(now);
    requestAnimationFrame(loop);
  }

  const img = new Image();
  img.onload = () => {
    document.querySelectorAll("[data-fx]").forEach((host) => {
      try { instances.push(new LogoFX(host, img)); } catch (err) { console.warn("Logo effect disabled:", err); }
    });
    requestAnimationFrame(loop);
  };
  img.src = window.LOGO_DATA;

  window.LogoFX = { instances, refresh: () => instances.forEach((fx) => fx.resize()) };
})();
