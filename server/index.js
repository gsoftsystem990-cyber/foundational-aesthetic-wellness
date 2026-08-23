"use strict";

require("dotenv").config();

var fs = require("fs");
var path = require("path");
var express = require("express");
var cors = require("cors");
var helmet = require("helmet");
var rateLimit = require("express-rate-limit");
var Stripe = require("stripe");
var validateEnrollment = require("./validate").validateEnrollment;

var PORT = Number(process.env.PORT || 4242);
var PUBLIC_SITE_URL = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
var NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";
var DATA_DIR = path.join(__dirname, "data");
var MEMBERS_FILE = path.join(DATA_DIR, "members.json");

var allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is missing. Copy server/.env.example to server/.env");
}

var stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" })
  : null;

var app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error("Origin not allowed"));
  },
  methods: ["POST", "GET", "OPTIONS"]
}));

app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "16kb" }));

var checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait and try again." }
});

function priceForPlan(plan) {
  if (plan === "child") return process.env.STRIPE_PRICE_CHILD;
  return process.env.STRIPE_PRICE_ADULT;
}

function readMembers() {
  try {
    return JSON.parse(fs.readFileSync(MEMBERS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeMembers(rows) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(rows, null, 2));
}

function upsertMember(record) {
  var rows = readMembers();
  var key = String(record.email || "").toLowerCase();
  var idx = rows.findIndex(function (r) { return r.email === key; });
  var next = Object.assign({}, record, { email: key, updatedAt: new Date().toISOString() });
  if (idx >= 0) rows[idx] = Object.assign({}, rows[idx], next);
  else rows.push(Object.assign({ createdAt: next.updatedAt }, next));
  writeMembers(rows);
}

async function notifyOffice(subject, fields) {
  if (!NOTIFY_EMAIL) return;
  var body = Object.assign({
    _subject: subject,
    _template: "table",
    _captcha: "false"
  }, fields);
  try {
    await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(NOTIFY_EMAIL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("Office notify failed");
  }
}

app.get("/health", function (req, res) {
  res.json({ ok: true, checkout: Boolean(stripe) });
});

app.post("/create-checkout-session", checkoutLimiter, async function (req, res) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Payment server is not configured yet." });
    }
    var result = validateEnrollment(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    var data = result.data;
    var price = priceForPlan(data.plan);
    if (!price || price.indexOf("price_") !== 0) {
      return res.status(503).json({ error: "Membership prices are not configured in Stripe yet." });
    }
    if (!PUBLIC_SITE_URL) {
      return res.status(503).json({ error: "PUBLIC_SITE_URL is not configured." });
    }

    var metadata = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      dob: data.dob,
      existingPatient: data.existingPatient,
      plan: data.plan,
      family: data.family.slice(0, 400),
      notes: data.notes.slice(0, 400),
      matchHint: data.lastName.toLowerCase() + "|" + data.dob + "|" + data.phone.replace(/\D/g, "")
    };

    var session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: data.email,
      client_reference_id: metadata.matchHint.slice(0, 200),
      line_items: [{ price: price, quantity: 1 }],
      success_url: PUBLIC_SITE_URL + "/pages/membership-success.html",
      cancel_url: PUBLIC_SITE_URL + "/pages/membership-cancel.html",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      metadata: metadata,
      subscription_data: {
        metadata: metadata
      }
    });

    if (!session.url) {
      return res.status(500).json({ error: "Unable to start secure checkout." });
    }

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error");
    return res.status(500).json({ error: "Unable to start checkout. Please try again or call the office." });
  }
});

app.post("/webhooks/stripe", async function (req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Webhook not configured");
  }
  var sig = req.headers["stripe-signature"];
  var event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send("Invalid signature");
  }

  try {
    if (event.type === "checkout.session.completed") {
      var session = event.data.object;
      var meta = session.metadata || {};
      upsertMember({
        email: session.customer_email || session.customer_details && session.customer_details.email,
        status: "active",
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        firstName: meta.firstName,
        lastName: meta.lastName,
        phone: meta.phone,
        dob: meta.dob,
        existingPatient: meta.existingPatient,
        plan: meta.plan,
        matchHint: meta.matchHint
      });
      await notifyOffice("New membership paid — match to chart", {
        type: "Membership checkout",
        name: (meta.firstName || "") + " " + (meta.lastName || ""),
        email: session.customer_email || "",
        phone: meta.phone || "",
        dob: meta.dob || "",
        existing_patient: meta.existingPatient || "",
        plan: meta.plan || "",
        family: meta.family || "",
        match_hint: meta.matchHint || "",
        stripe_customer: session.customer || "",
        action: "Flag this chart as Active Member in the practice software."
      });
    }

    if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
      var obj = event.data.object;
      var email = obj.customer_email || "";
      if (event.type === "customer.subscription.deleted") {
        upsertMember({
          email: email,
          status: "canceled",
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.id
        });
        await notifyOffice("Membership canceled — remove chart flag", {
          type: "Membership canceled",
          stripe_customer: obj.customer || "",
          subscription: obj.id || ""
        });
      }
    }
  } catch (err) {
    console.error("Webhook handler error");
    return res.status(500).send("Handler error");
  }

  res.json({ received: true });
});

app.use(function (err, req, res, next) {
  if (err && err.message === "Origin not allowed") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.status(500).json({ error: "Server error" });
});

app.listen(PORT, function () {
  console.log("Membership payment API on http://localhost:" + PORT);
});
