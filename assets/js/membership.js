(function () {
  var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;
  var UNAVAILABLE = "Online payment is currently unavailable.";

  function apiBase() {
    var config = window.FAW_SITE_CONFIG || {};
    if (config.membershipApiUrl) return String(config.membershipApiUrl).replace(/\/$/, "");
    // Local previews: localhost server or opening HTML via file://
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:") {
      return "http://localhost:4242";
    }
    return "";
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setMsg(text, isError) {
    var el = document.getElementById("membershipMsg");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.className = "membership-msg" + (isError ? " membership-msg--error" : "");
  }

  function payload() {
    return {
      firstName: val("mem-fn"),
      lastName: val("mem-ln"),
      email: val("mem-em"),
      phone: val("mem-ph"),
      dob: val("mem-dob"),
      existingPatient: val("mem-existing"),
      patientChartId: val("mem-chart"),
      plan: val("mem-plan"),
      family: val("mem-family"),
      notes: val("mem-notes"),
      company_website: val("mem-hp")
    };
  }

  async function paymentReady() {
    var base = apiBase();
    if (!base) return { ok: false, mode: "unavailable" };
    try {
      var res = await fetch(base + "/public-status", { headers: { Accept: "application/json" } });
      var json = await res.json().catch(function () { return {}; });
      return { ok: Boolean(json.paymentAvailable), mode: json.mode || "unavailable" };
    } catch (err) {
      return { ok: false, mode: "unavailable" };
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    var btn = document.getElementById("membershipSubmit");
    var data = payload();
    var blob = JSON.stringify(data);

    if (CARD_LIKE.test(blob)) {
      setMsg("Do not enter card numbers here. You will pay on Stripe’s secure page.", true);
      return;
    }
    if (!data.firstName || !data.lastName || !data.email || !data.phone || !data.dob || !data.existingPatient || !data.plan) {
      setMsg("Please complete all required fields.", true);
      return;
    }

    var status = await paymentReady();
    if (!status.ok) {
      setMsg(UNAVAILABLE, true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Opening secure checkout…";
    }
    setMsg("", false);

    try {
      var res = await fetch(apiBase() + "/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      var json = await res.json().catch(function () { return {}; });
      if (res.status === 503) throw new Error(UNAVAILABLE);
      if (!res.ok || !json.url) {
        throw new Error(json.error || UNAVAILABLE);
      }
      if (json.url.indexOf("https://checkout.stripe.com/") !== 0) {
        throw new Error(UNAVAILABLE);
      }
      window.location.assign(json.url);
    } catch (err) {
      setMsg(err.message || UNAVAILABLE, true);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Continue to secure payment";
      }
    }
  }

  async function init() {
    var form = document.getElementById("membershipForm");
    if (form) form.addEventListener("submit", onSubmit);
    var status = await paymentReady();
    var note = document.getElementById("membershipDevNote");
    if (note && !status.ok) {
      note.hidden = false;
      note.textContent = "Development: Stripe test keys are not configured on the payment server yet. " + UNAVAILABLE;
    }
  }

  init();
})();
