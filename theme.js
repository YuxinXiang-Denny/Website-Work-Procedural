/*
 * Light / dark mode switch. Dark is the default; the reader's choice is remembered in
 * this browser. (The page's <head> applies the saved theme before first paint.)
 */
(function () {
  "use strict";
  const root = document.documentElement;

  function render() {
    const dark = root.dataset.theme !== "light";
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute("aria-checked", dark);
      btn.querySelector(".tt-label").textContent = dark ? "Dark" : "Light";
      btn.querySelector(".tt-knob").textContent = dark ? "☾" : "☀";
      btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    });
  }

  document.querySelectorAll(".theme-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch (_) { /* storage blocked: still switches */ }
        render();
      };
      // cross-fade the whole page where the browser supports it, otherwise switch instantly
      if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.startViewTransition(apply);
      } else {
        apply();
      }
    })
  );
  render();
})();
