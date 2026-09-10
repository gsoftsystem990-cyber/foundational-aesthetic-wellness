"use strict";

require("dotenv").config();

var express = require("express");
var cors = require("cors");
var helmet = require("helmet");
var rateLimit = require("express-rate-limit");
var cookieParser = require("cookie-parser");
var config = require("./config");
var db = require("./db");
var validate = require("./validate");
var auth = require("./auth");
var PatientService = require("./services/PatientService");
var MembershipService = require("./services/MembershipService");
var PaymentService = require("./services/PaymentService");
var WebhookService = require("./services/WebhookService");
var NotificationService = require("./services/NotificationService");
var AuditService = require("./services/AuditService");
var createPatientAdapter = require("./adapters/PatientAdapter").createPatientAdapter;
var adminRoutes = require("./routes/admin");
var ReviewService = require("./services/ReviewService");

var patientService = new PatientService(createPatientAdapter(db, config));
var membershipService = new MembershipService();
var paymentService = new PaymentService();
var webhookService = new WebhookService(membershipService, paymentService);
var reviewService = new ReviewService();

var app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "form-action": ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (config.allowedOrigins.indexOf(origin) !== -1) return cb(null, true);

    // Same host as this API (admin page at http://localhost:4242/admin)
    try {
      var parsed = new URL(origin);
      var apiHost = "localhost";
      var apiPort = String(config.port || 4242);
      if (
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        (parsed.port === apiPort || (!parsed.port && apiPort === "80"))
      ) {
        return cb(null, true);
      }
      // Local website previews (Live Server, etc.) in development
      if (!config.isProduction && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
        return cb(null, true);
      }
    } catch (e) { /* ignore */ }

    return cb(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));

app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

var checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait and try again." }
});

var reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many review submissions. Please wait and try again." }
});

app.get("/health", function (req, res) {
  res.json({ ok: true });
});

app.get("/public-status", function (req, res) {
  res.json({
    paymentAvailable: paymentService.isReady(),
    mode: paymentService.isReady() ? config.stripe.mode : "unavailable",
    reviewsAvailable: true
  });
});

app.get("/api/reviews", function (req, res) {
  try {
    res.set("Cache-Control", "no-store");
    res.json({ approved: reviewService.listApprovedPublic() });
  } catch (err) {
    console.error("reviews_list_failed");
    res.status(500).json({ error: "Unable to load reviews." });
  }
});

app.post("/api/reviews", reviewLimiter, function (req, res) {
  try {
    var result = reviewService.validateSubmit(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    var created = reviewService.createPending(result.data);
    AuditService.write("patient", "review_submitted", null, created.review_id);
    return res.status(201).json({
      ok: true,
      message: "Thank you! Your review was submitted and is waiting for staff approval."
    });
  } catch (err) {
    console.error("review_submit_failed");
    return res.status(500).json({ error: "Could not submit your review. Please try again." });
  }
});

app.post("/create-checkout-session", checkoutLimiter, async function (req, res) {
  try {
    if (!paymentService.isReady()) {
      return res.status(503).json({ error: "Online payment is currently unavailable." });
    }
    var result = validate.validateEnrollment(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    var data = result.data;

    var patient = await patientService.resolve({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dob: data.dob,
      externalPatientId: data.patientChartId
    });

    var session = await paymentService.createSubscriptionCheckout(data, patient.patient_id);
    membershipService.createPending(patient.patient_id, data.plan, session.id);
    AuditService.write("patient", "checkout_started", null, data.plan);
    return res.json({ url: session.url });
  } catch (err) {
    if (err && err.code === "PAYMENT_UNAVAILABLE") {
      return res.status(503).json({ error: "Online payment is currently unavailable." });
    }
    console.error("checkout_failed");
    return res.status(500).json({ error: "Online payment is currently unavailable." });
  }
});

app.post("/webhooks/stripe", async function (req, res) {
  if (!config.stripe.configured) {
    return res.status(503).json({ error: "Webhook not configured" });
  }
  var event;
  try {
    event = paymentService.verifyWebhook(req.body, req.headers["stripe-signature"]);
  } catch (err) {
    return res.status(400).json({ error: "Invalid signature" });
  }
  try {
    await webhookService.handle(event);
    return res.json({ received: true });
  } catch (err) {
    console.error("webhook_failed");
    return res.status(500).json({ error: "Handler error" });
  }
});

app.post("/internal/jobs/renewal-reminders", auth.requireCron, async function (req, res) {
  membershipService.markExpiredIfNeeded();
  var due = membershipService.dueForRenewalReminder(14);
  for (var i = 0; i < due.length; i++) {
    await NotificationService.upcomingRenewal(due[i]);
  }
  res.json({ ok: true, count: due.length });
});

app.use("/admin", adminRoutes);

app.use(function (err, req, res, next) {
  if (err && err.message === "Origin not allowed") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.status(500).json({ error: "Server error" });
});

db.initDb().then(function () {
  app.listen(config.port, function () {
    console.log("Membership API listening on port " + config.port);
  });
}).catch(function () {
  console.error("database_init_failed");
  process.exit(1);
});
