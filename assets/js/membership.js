(function () {
  var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;

  function apiBase() {
    var config = window.FAW_SITE_CONFIG || {};
    if (config.membershipApiUrl) return String(config.membershipApiUrl).replace(/\/$/, "");
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
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
      plan: val("mem-plan"),
      family: val("mem-family"),
      notes: val("mem-notes"),
      company_website: val("mem-hp")
    };
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

    var base = apiBase();
    if (!base) {
      setMsg("Secure checkout is not connected yet. Call 610.989.2224 to enroll, or start the payment server and set membershipApiUrl.", true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Opening secure checkout…";
    }
    setMsg("", false);

    try {
      var res = await fetch(base + "/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      var json = await res.json().catch(function () { return {}; });
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Unable to start checkout.");
      }
      if (json.url.indexOf("https://checkout.stripe.com/") !== 0) {
        throw new Error("Checkout URL was rejected for security.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setMsg(err.message || "Unable to start checkout.", true);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Continue to secure payment";
      }
    }
  }

  var form = document.getElementById("membershipForm");
  if (form) form.addEventListener("submit", onSubmit);
})();
