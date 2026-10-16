(function () {
  "use strict";

  // Demo forms: nothing is sent anywhere, the page just shows a confirmation.
  document.querySelectorAll("form[data-demo]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const card = form.closest(".card");
      const ref = card.querySelector("[data-ref]");
      if (ref) ref.textContent = ref.dataset.ref + "-" + Math.floor(1000 + Math.random() * 9000);
      card.classList.add("sent");
      window.LogoFX && window.LogoFX.refresh();
    });
  });
  document.querySelectorAll("[data-again]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      card.querySelector("form").reset();
      card.classList.remove("sent");
      window.LogoFX && window.LogoFX.refresh();
    })
  );

  // Time-off: dates can't be in the past, end >= start, and show the number of weekdays
  const start = document.getElementById("start");
  const end = document.getElementById("end");
  const out = document.getElementById("days");
  if (start && end && out) {
    const today = new Date().toISOString().slice(0, 10);
    start.min = today;
    end.min = today;
    const update = () => {
      if (start.value) end.min = start.value;
      if (!start.value || !end.value || end.value < start.value) { out.textContent = "–"; return; }
      let n = 0;
      for (let d = new Date(start.value + "T00:00"); d <= new Date(end.value + "T00:00"); d.setDate(d.getDate() + 1)) {
        if (d.getDay() % 6 !== 0) n++;
      }
      out.textContent = n + (n === 1 ? " working day" : " working days");
    };
    start.addEventListener("change", update);
    end.addEventListener("change", update);
  }
})();
