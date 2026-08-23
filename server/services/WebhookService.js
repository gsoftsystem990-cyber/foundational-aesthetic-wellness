"use strict";

var db = require("../db");
var ids = require("../lib/ids");
var AuditService = require("./AuditService");
var NotificationService = require("./NotificationService");

function WebhookService(membershipService, paymentService) {
  this.memberships = membershipService;
  this.payments = paymentService;
}

WebhookService.prototype.seen = function (eventId) {
  var row = db.prepare("SELECT event_id FROM processed_events WHERE event_id = ?").get(eventId);
  return Boolean(row);
};

WebhookService.prototype.markSeen = function (eventId, eventType) {
  db.prepare(
    "INSERT OR IGNORE INTO processed_events (event_id, event_type, processed_at) VALUES (?, ?, ?)"
  ).run(eventId, eventType, ids.nowIso());
};

WebhookService.prototype.handle = async function (event) {
  if (this.seen(event.id)) return { duplicate: true };
  this.markSeen(event.id, event.type);

  switch (event.type) {
    case "checkout.session.completed":
      await this.onCheckoutCompleted(event.data.object);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await this.onInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      await this.onInvoiceFailed(event.data.object);
      break;
    case "customer.subscription.updated":
      await this.onSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await this.onSubscriptionDeleted(event.data.object);
      break;
    case "charge.refunded":
      await this.onRefund(event.data.object);
      break;
    default:
      break;
  }
  return { ok: true };
};

WebhookService.prototype.findMembership = function (obj) {
  var sessionId = obj.id && String(obj.id).indexOf("cs_") === 0 ? obj.id : obj.checkout_session;
  if (sessionId) {
    var bySession = this.memberships.getByCheckoutSession(sessionId);
    if (bySession) return bySession;
  }
  var subId = obj.subscription || obj.id;
  if (subId && String(subId).indexOf("sub_") === 0) {
    var bySub = this.memberships.getBySubscription(subId);
    if (bySub) return bySub;
  }
  if (obj.metadata && obj.metadata.patient_id) {
    var rows = this.memberships.list();
    return rows.find(function (row) {
      return row.patient_id === obj.metadata.patient_id && row.status === "pending";
    }) || null;
  }
  return null;
};

WebhookService.prototype.onCheckoutCompleted = async function (session) {
  if (session.mode !== "subscription") return;
  if (session.payment_status !== "paid" && session.status !== "complete") return;

  var membership = this.memberships.getByCheckoutSession(session.id);
  if (!membership) return;

  var subscription = session.subscription
    ? await this.payments.retrieveSubscription(session.subscription)
    : null;
  var start = ids.nowIso();
  var renewal = subscription ? this.payments.periodEnd(subscription) : null;
  var updated = this.memberships.updateFromStripe(membership.membership_id, {
    status: "active",
    start_date: start,
    renewal_date: renewal,
    stripe_customer_id: session.customer || null,
    stripe_subscription_id: session.subscription || null
  });
  AuditService.write("stripe", "membership_activated", membership.membership_id, "checkout.session.completed");
  await NotificationService.activated(updated);
};

WebhookService.prototype.onInvoicePaid = async function (invoice) {
  var subId = invoice.subscription;
  if (!subId) return;
  var membership = this.memberships.getBySubscription(subId);
  if (!membership) return;
  var periodEnd = invoice.lines && invoice.lines.data && invoice.lines.data[0]
    ? ids.isoFromUnix(invoice.lines.data[0].period && invoice.lines.data[0].period.end)
    : null;
  this.memberships.updateFromStripe(membership.membership_id, {
    status: "active",
    renewal_date: periodEnd || membership.renewal_date,
    stripe_customer_id: invoice.customer || membership.stripe_customer_id
  });
  AuditService.write("stripe", "membership_renewed", membership.membership_id, "invoice.paid");
};

WebhookService.prototype.onInvoiceFailed = async function (invoice) {
  var membership = this.memberships.getBySubscription(invoice.subscription);
  if (!membership) return;
  var updated = this.memberships.updateFromStripe(membership.membership_id, {
    status: "payment_failed"
  });
  AuditService.write("stripe", "payment_failed", membership.membership_id, "invoice.payment_failed");
  await NotificationService.paymentFailed(updated);
};

WebhookService.prototype.onSubscriptionUpdated = async function (subscription) {
  var membership = this.memberships.getBySubscription(subscription.id);
  if (!membership) return;
  var mapped = ids.mapSubscriptionStatus(subscription.status);
  if (!mapped) return;
  this.memberships.updateFromStripe(membership.membership_id, {
    status: mapped,
    renewal_date: this.payments.periodEnd(subscription),
    stripe_customer_id: subscription.customer || membership.stripe_customer_id
  });
  AuditService.write("stripe", "subscription_updated", membership.membership_id, mapped);
};

WebhookService.prototype.onSubscriptionDeleted = async function (subscription) {
  var membership = this.memberships.getBySubscription(subscription.id);
  if (!membership) return;
  var updated = this.memberships.updateFromStripe(membership.membership_id, {
    status: "cancelled"
  });
  AuditService.write("stripe", "membership_cancelled", membership.membership_id, "subscription.deleted");
  await NotificationService.cancelled(updated);
};

WebhookService.prototype.onRefund = async function (charge) {
  var membership = null;
  if (charge.customer) {
    var all = this.memberships.list();
    membership = all.find(function (row) {
      return row.stripe_customer_id === charge.customer && row.status === "active";
    }) || null;
  }
  if (!membership) return;
  this.memberships.updateFromStripe(membership.membership_id, { status: "cancelled" });
  AuditService.write("stripe", "refund_received", membership.membership_id, "charge.refunded");
};

module.exports = WebhookService;
