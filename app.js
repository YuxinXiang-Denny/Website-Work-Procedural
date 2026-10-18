(function () {
  "use strict";

  // Go syntax highlighting for the IF / ELSE blocks
  const GO_TOKENS = /("(?:[^"\\]|\\.)*")|(\/\/.*)|\b(if|else|goto|for|func|return|range|var|true|false|nil)\b|\b(Step\d+)\b|([A-Za-z_]\w*)(?=\()|([A-Za-z_]\w*)|([{}])|(&&|\|\||[()[\].,!=<>])/g;
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  document.querySelectorAll("pre.go code").forEach((code) => {
    const src = code.textContent;
    let out = "", last = 0;
    for (const m of src.matchAll(GO_TOKENS)) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? "str" : m[2] ? "com" : m[3] ? "kw" : m[4] ? "lbl" : m[5] ? "fn" : m[6] ? "id" : m[7] ? "br" : "op";
      out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    code.innerHTML = out + esc(src.slice(last));
  });

  // Steps / Flowchart switch on the two guide cards.
  // Each card also cross-fades on its own every 5–10 s, but never while the pointer is over it.
  const canHover = matchMedia("(hover: hover)").matches;
  document.querySelectorAll(".step-card").forEach((card) => {
    const buttons = card.querySelectorAll(".seg button");
    const show = (view) => {
      card.dataset.view = view;
      buttons.forEach((b) => b.setAttribute("aria-selected", b.dataset.show === view));
    };
    buttons.forEach((btn) => btn.addEventListener("click", () => show(btn.dataset.show)));

    if (!canHover) return;                       // touch screens: the reader controls it
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        show(card.dataset.view === "steps" ? "flow" : "steps");
        schedule();
      }, 5000 + Math.random() * 5000);
    };
    const pause = () => clearTimeout(timer);
    card.addEventListener("pointerenter", pause);
    card.addEventListener("pointerleave", schedule);
    card.addEventListener("focusin", pause);
    card.addEventListener("focusout", (e) => { if (!card.contains(e.relatedTarget)) schedule(); });
    if (!card.matches(":hover")) schedule();
  });

  // Full view: copy a section into the dialog
  const modal = document.querySelector(".modal");
  const content = modal.querySelector(".modal-content");

  document.querySelectorAll(".card .expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      content.replaceChildren(
        card.querySelector(".card-head").cloneNode(true),
        card.querySelector(".card-body").cloneNode(true)
      );
      content.querySelector(".expand").remove();
      content.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      bindJumps(content);
      modal.showModal();
      requestAnimationFrame(() => window.LogoFX && window.LogoFX.refresh());
    });
  });

  // YouTube: keep a handle on the small players so the large one can pick up where they stopped
  const players = {};
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (prevReady) prevReady();
    document.querySelectorAll("iframe[data-yt]").forEach((f) => { players[f.dataset.yt] = new YT.Player(f); });
  };
  if (window.YT && window.YT.Player) window.onYouTubeIframeAPIReady();

  document.querySelectorAll(".video-zoom").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.yt;
      const small = players[id];
      let start = 0;
      try { start = Math.floor(small.getCurrentTime() || 0); small.pauseVideo(); } catch (_) { /* API not ready yet */ }

      const head = document.createElement("div");
      head.className = "card-head";
      head.innerHTML = `<span class="sec-icon" aria-hidden="true"><svg><use href="icons.svg#guides"/></svg></span><h2></h2>`;
      head.querySelector("h2").textContent = btn.dataset.title;
      const frame = document.createElement("div");
      frame.className = "video-large";
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&start=${start}" title="${btn.dataset.title} video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      content.replaceChildren(head, frame);
      modal.classList.add("video-mode");
      modal.showModal();
      requestAnimationFrame(() => window.LogoFX && window.LogoFX.refresh());
    });
  });

  // closing the dialog removes its content, which also stops a playing video
  modal.addEventListener("close", () => { content.replaceChildren(); modal.classList.remove("video-mode"); });
  document.querySelectorAll(".card .expand").forEach((btn) => btn.addEventListener("click", () => modal.classList.remove("video-mode")));

  modal.querySelector(".modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

  // "Step-by-Step Guides" link: light up the whole guides area (03, 3A and 3B)
  function bindJumps(root) {
    root.querySelectorAll("a.jump").forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        if (modal.open) modal.close();
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        target.classList.remove("flash");
        void target.offsetWidth;                 // restart the animation on repeat clicks
        target.classList.add("flash");
      });
    });
  }
  bindJumps(document);
  document.querySelectorAll(".guides-group").forEach((g) =>
    g.addEventListener("animationend", (e) => { if (e.target === g) g.classList.remove("flash"); })
  );
})();
