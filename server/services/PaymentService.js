"use strict";

var Stripe = require("stripe");
var config = require("../config");
var ids = require("../lib/ids");

function PaymentService() {
  this.stripe = config.stripe.configured
    ? new Stripe(config.stripe.secretKey, { apiVersion: "2024-11-20.acacia" })
    : null;
}

PaymentService.prototype.isReady = function () {
  return Boolean(this.stripe && config.publicSiteUrl);
};

PaymentService.prototype.priceForPlan = function (plan) {
  if (plan === "child") return config.stripe.priceChild;
  return config.stripe.priceAdult;
};

PaymentService.prototype.createSubscriptionCheckout = async function (enrollment, patientId) {
  if (!this.isReady()) {
    var err = new Error("unavailable");
    err.code = "PAYMENT_UNAVAILABLE";
    throw err;
  }
  var price = this.priceForPlan(enrollment.plan);
  if (!price || price.indexOf("price_") !== 0) {
    var err2 = new Error("unavailable");
    err2.code = "PAYMENT_UNAVAILABLE";
    throw err2;
  }

  var metadata = {
    patient_id: patientId,
    plan: enrollment.plan,
    existing_patient: enrollment.existingPatient
  };

  var session = await this.stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: enrollment.email,
    client_reference_id: patientId.slice(0, 200),
    line_items: [{ price: price, quantity: 1 }],
    success_url: config.publicSiteUrl + "/pages/membership-success.html",
    cancel_url: config.publicSiteUrl + "/pages/membership-cancel.html",
    billing_address_collection: "required",
    metadata: metadata,
    subscription_data: {
      metadata: metadata
    }
  });

  if (!session.url || session.url.indexOf("https://checkout.stripe.com/") !== 0) {
    throw new Error("invalid_checkout_url");
  }
  return session;
};

PaymentService.prototype.verifyWebhook = function (rawBody, signature) {
  return this.stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
};

PaymentService.prototype.retrieveSubscription = async function (subscriptionId) {
  return this.stripe.subscriptions.retrieve(subscriptionId);
};

PaymentService.prototype.periodEnd = function (subscription) {
  return ids.isoFromUnix(subscription.current_period_end);
};

module.exports = PaymentService;
