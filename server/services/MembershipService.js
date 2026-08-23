"use strict";

var db = require("../db");
var ids = require("../lib/ids");

var STATUSES = ["pending", "active", "past_due", "cancelled", "expired", "payment_failed"];

function MembershipService() {}

MembershipService.prototype.createPending = function (patientId, planId, checkoutSessionId) {
  var now = ids.nowIso();
  var membershipId = ids.newId("mem");
  db.prepare(
    "INSERT INTO memberships (membership_id, patient_id, membership_plan_id, status, stripe_checkout_session_id, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)"
  ).run(membershipId, patientId, planId, checkoutSessionId, now, now);
  return this.getById(membershipId);
};

MembershipService.prototype.getById = function (membershipId) {
  return db.prepare("SELECT * FROM memberships WHERE membership_id = ?").get(membershipId);
};

MembershipService.prototype.getByCheckoutSession = function (sessionId) {
  return db.prepare("SELECT * FROM memberships WHERE stripe_checkout_session_id = ?").get(sessionId);
};

MembershipService.prototype.getBySubscription = function (subscriptionId) {
  return db.prepare("SELECT * FROM memberships WHERE stripe_subscription_id = ?").get(subscriptionId);
};

MembershipService.prototype.updateFromStripe = function (membershipId, fields) {
  var current = this.getById(membershipId);
  if (!current) return null;
  var next = {
    status: fields.status || current.status,
    start_date: fields.start_date != null ? fields.start_date : current.start_date,
    renewal_date: fields.renewal_date != null ? fields.renewal_date : current.renewal_date,
    stripe_customer_id: fields.stripe_customer_id || current.stripe_customer_id,
    stripe_subscription_id: fields.stripe_subscription_id || current.stripe_subscription_id,
    stripe_checkout_session_id: fields.stripe_checkout_session_id || current.stripe_checkout_session_id
  };
  db.prepare(
    "UPDATE memberships SET status = ?, start_date = ?, renewal_date = ?, stripe_customer_id = ?, stripe_subscription_id = ?, stripe_checkout_session_id = ?, updated_at = ? WHERE membership_id = ?"
  ).run(
    next.status,
    next.start_date,
    next.renewal_date,
    next.stripe_customer_id,
    next.stripe_subscription_id,
    next.stripe_checkout_session_id,
    ids.nowIso(),
    membershipId
  );
  return this.getById(membershipId);
};

MembershipService.prototype.list = function (status) {
  if (status && STATUSES.indexOf(status) !== -1) {
    return db.prepare(
      "SELECT m.*, p.external_patient_id, p.first_name, p.last_name FROM memberships m JOIN patients p ON p.patient_id = m.patient_id WHERE m.status = ? ORDER BY m.updated_at DESC"
    ).all(status);
  }
  return db.prepare(
    "SELECT m.*, p.external_patient_id, p.first_name, p.last_name FROM memberships m JOIN patients p ON p.patient_id = m.patient_id ORDER BY m.updated_at DESC"
  ).all();
};

MembershipService.prototype.dueForRenewalReminder = function (withinDays) {
  var until = new Date();
  until.setUTCDate(until.getUTCDate() + (withinDays || 14));
  return db.prepare(
    "SELECT * FROM memberships WHERE status = 'active' AND renewal_date IS NOT NULL AND renewal_date <= ?"
  ).all(until.toISOString());
};

MembershipService.prototype.markExpiredIfNeeded = function () {
  var now = ids.nowIso();
  db.prepare(
    "UPDATE memberships SET status = 'expired', updated_at = ? WHERE status IN ('past_due', 'payment_failed') AND renewal_date IS NOT NULL AND renewal_date < ?"
  ).run(now, now);
};

module.exports = MembershipService;
module.exports.STATUSES = STATUSES;
