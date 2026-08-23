"use strict";

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[0-9+().\s-]{7,20}$/;
var NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,59}$/;
var CARD_LIKE_RE = /\b(?:\d[ -]*?){13,19}\b/;
var CVC_KEYS = ["card", "cvc", "cvv", "pan", "ccnum", "cardnumber", "exp_month", "exp_year", "expiry"];

var PLANS = {
  adult: "adult",
  child: "child"
};

function str(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function looksLikeCardData(payload) {
  var keys = Object.keys(payload || {});
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i].toLowerCase().replace(/[_-]/g, "");
    if (CVC_KEYS.indexOf(key) !== -1) return true;
  }
  var blob = JSON.stringify(payload);
  return CARD_LIKE_RE.test(blob);
}

function parseDob(value) {
  var raw = str(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  var d = new Date(raw + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  var year = d.getUTCFullYear();
  var now = new Date().getUTCFullYear();
  if (year < 1900 || year > now) return null;
  return raw;
}

function validateEnrollment(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request." };
  }
  if (looksLikeCardData(body)) {
    return { error: "Card details are not accepted on this form. Pay on Stripe Checkout only." };
  }
  if (str(body.company_website, 200)) {
    return { error: "Unable to process this request." };
  }

  var firstName = str(body.firstName, 60);
  var lastName = str(body.lastName, 60);
  var email = str(body.email, 120).toLowerCase();
  var phone = str(body.phone, 20);
  var dob = parseDob(body.dob);
  var existingPatient = str(body.existingPatient, 20);
  var plan = str(body.plan, 20).toLowerCase();
  var family = str(body.family, 400);
  var notes = str(body.notes, 500);

  if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
    return { error: "Please enter a valid first and last name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!PHONE_RE.test(phone)) {
    return { error: "Please enter a valid phone number." };
  }
  if (!dob) {
    return { error: "Please enter a valid date of birth." };
  }
  if (existingPatient !== "yes" && existingPatient !== "no") {
    return { error: "Please tell us if you are an existing patient." };
  }
  if (!PLANS[plan]) {
    return { error: "Please choose a membership plan." };
  }

  return {
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      dob: dob,
      existingPatient: existingPatient,
      plan: plan,
      family: family,
      notes: notes
    }
  };
}

module.exports = {
  validateEnrollment: validateEnrollment,
  looksLikeCardData: looksLikeCardData
};
