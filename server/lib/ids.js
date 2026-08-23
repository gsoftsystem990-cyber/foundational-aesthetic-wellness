"use strict";

var crypto = require("crypto");

function newId(prefix) {
  return prefix + "_" + crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function isoFromUnix(seconds) {
  if (!seconds) return null;
  return new Date(Number(seconds) * 1000).toISOString();
}

function safeEqual(a, b) {
  var left = Buffer.from(String(a || ""), "utf8");
  var right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function mapSubscriptionStatus(stripeStatus) {
  switch (String(stripeStatus || "")) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "payment_failed";
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
}

module.exports = {
  newId: newId,
  nowIso: nowIso,
  normalizePhone: normalizePhone,
  normalizeName: normalizeName,
  isoFromUnix: isoFromUnix,
  safeEqual: safeEqual,
  mapSubscriptionStatus: mapSubscriptionStatus
};
