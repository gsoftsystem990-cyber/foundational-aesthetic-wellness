"use strict";

require("dotenv").config();

function env(name, fallback) {
  var value = process.env[name];
  if (value == null || String(value).trim() === "") return fallback;
  return String(value).trim();
}

function csv(name) {
  return env(name, "")
    .split(",")
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

var NODE_ENV = env("NODE_ENV", "development");
var stripeSecret = env("STRIPE_SECRET_KEY", "");
var stripeWebhook = env("STRIPE_WEBHOOK_SECRET", "");
var priceAdult = env("STRIPE_PRICE_ADULT", "") || env("STRIPE_PRICE_ID", "");
var priceChild = env("STRIPE_PRICE_CHILD", "") || env("STRIPE_PRICE_ID", "");
var stripeConfigured = Boolean(
  stripeSecret &&
  stripeSecret.indexOf("sk_") === 0 &&
  stripeSecret.indexOf("replace") === -1 &&
  stripeWebhook &&
  stripeWebhook.indexOf("whsec_") === 0 &&
  stripeWebhook.indexOf("replace") === -1 &&
  priceAdult &&
  priceAdult.indexOf("price_") === 0 &&
  priceAdult.indexOf("replace") === -1
);

var config = {
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === "production",
  port: Number(env("PORT", "4242")),
  publicSiteUrl: env("PUBLIC_SITE_URL", "").replace(/\/$/, ""),
  allowedOrigins: csv("ALLOWED_ORIGINS"),
  notifyEmail: env("NOTIFY_EMAIL", ""),
  sessionSecret: env("SESSION_SECRET", ""),
  adminUsername: env("ADMIN_USERNAME", ""),
  adminPassword: env("ADMIN_PASSWORD", ""),
  cronSecret: env("CRON_SECRET", ""),
  patientAdapter: env("PATIENT_ADAPTER", "local"),
  patientApiUrl: env("PATIENT_API_URL", "").replace(/\/$/, ""),
  patientApiKey: env("PATIENT_API_KEY", ""),
  whatsapp: {
    token: env("WHATSAPP_TOKEN", ""),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID", ""),
    apiVersion: env("WHATSAPP_API_VERSION", "v21.0"),
    defaultCountry: env("WHATSAPP_DEFAULT_COUNTRY", "1")
  },
  stripe: {
    secretKey: stripeSecret,
    publishableKey: env("STRIPE_PUBLISHABLE_KEY", ""),
    webhookSecret: stripeWebhook,
    priceAdult: priceAdult,
    priceChild: priceChild,
    configured: stripeConfigured,
    mode: stripeSecret.indexOf("sk_live_") === 0 ? "live" : (stripeSecret.indexOf("sk_test_") === 0 ? "test" : "unavailable")
  }
};

if (config.isProduction && !config.sessionSecret) {
  throw new Error("SESSION_SECRET is required in production");
}

if (config.isProduction && (!config.adminUsername || !config.adminPassword)) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required in production");
}

module.exports = config;
