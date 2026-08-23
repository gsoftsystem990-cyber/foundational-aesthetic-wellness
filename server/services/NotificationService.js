"use strict";

var config = require("../config");

function safeFields(fields) {
  var out = {};
  Object.keys(fields || {}).forEach(function (key) {
    var lower = key.toLowerCase();
    if (/(card|cvc|cvv|pan|secret|password|token)/.test(lower)) return;
    out[key] = fields[key];
  });
  return out;
}

async function send(subject, fields) {
  if (!config.notifyEmail) return;
  var body = Object.assign({
    _subject: String(subject || "Membership update").slice(0, 120),
    _template: "table",
    _captcha: "false"
  }, safeFields(fields));
  try {
    await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(config.notifyEmail), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("notification_failed");
  }
}

function activated(membership) {
  return send("Membership activated", {
    type: "membership_activated",
    membership_id: membership.membership_id,
    plan: membership.membership_plan_id,
    status: membership.status,
    renewal_date: membership.renewal_date || "",
    note: "Match this membership to the patient chart in practice software. Do not email card data."
  });
}

function paymentFailed(membership) {
  return send("Membership payment failed", {
    type: "membership_payment_failed",
    membership_id: membership.membership_id,
    status: membership.status
  });
}

function cancelled(membership) {
  return send("Membership cancelled", {
    type: "membership_cancelled",
    membership_id: membership.membership_id,
    status: membership.status
  });
}

function upcomingRenewal(membership) {
  return send("Membership renewal upcoming", {
    type: "membership_renewal_upcoming",
    membership_id: membership.membership_id,
    renewal_date: membership.renewal_date || ""
  });
}

function expired(membership) {
  return send("Membership expired", {
    type: "membership_expired",
    membership_id: membership.membership_id
  });
}

module.exports = {
  send: send,
  activated: activated,
  paymentFailed: paymentFailed,
  cancelled: cancelled,
  upcomingRenewal: upcomingRenewal,
  expired: expired
};
