"use strict";

require("dotenv").config();

var express = require("express");
var path = require("path");
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
var BookingService = require("./services/BookingService");
var ContactMessageService = require("./services/ContactMessageService");

var patientService = new PatientService(createPatientAdapter(db, config));
var membershipService = new MembershipService();
var paymentService = new PaymentService();
var webhookService = new WebhookService(membershipService, paymentService);
var reviewService = new ReviewService();
var bookingService = new BookingService();
var contactMessageService = new ContactMessageService();

var app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "connect-src": ["'self'", "https:"],
      "form-action": ["'self'", "https:"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    // Browsers send Origin: null for file:// pages
    if (origin === "null" && !config.isProduction) return cb(null, true);
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
  max: config.isProduction ? 8 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait and try again." }
});

var reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many review submissions. Please wait and try again." }
});

var bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 12 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many booking requests. Please wait and try again." }
});

var contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 12 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please wait and try again." }
});

app.get("/health", function (req, res) {
  res.json({ ok: true });
});

app.get("/public-status", function (req, res) {
  res.json({
    paymentAvailable: paymentService.isReady(),
    mode: paymentService.isReady() ? config.stripe.mode : "unavailable",
    reviewsAvailable: true,
    bookingsAvailable: true,
    contactMessagesAvailable: true
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

app.get("/api/booking-slots", function (req, res) {
  try {
    res.set("Cache-Control", "no-store");
    var date = String(req.query.date || "").trim();
    var result = bookingService.getSlotsForDate(date);
    if (result.error) return res.status(400).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    console.error("booking_slots_failed");
    return res.status(500).json({ error: "Unable to load time slots." });
  }
});

app.post("/api/bookings", bookingLimiter, function (req, res) {
  try {
    var result = bookingService.validateSubmit(req.body);
    if (result.code === "SLOT_TAKEN") {
      return res.status(409).json({
        error: result.error,
        code: "SLOT_TAKEN",
        alternatives: result.alternatives || []
      });
    }
    if (result.error) return res.status(400).json({ error: result.error });
    var created = bookingService.create(result.data);
    AuditService.write("patient", "booking_submitted", null, created.booking_id);
    return res.status(201).json({
      ok: true,
      message: "Thank you! Your booking request was received. We will contact you shortly.",
      bookingId: created.booking_id,
      slot: created.preferred_time,
      slotLabel: bookingService.formatSlotLabel(created.preferred_time)
    });
  } catch (err) {
    if (err && err.code === "SLOT_TAKEN") {
      return res.status(409).json({
        error: "This time slot is already booked.",
        code: "SLOT_TAKEN",
        alternatives: err.alternatives || bookingService.findAlternatives((req.body && (req.body.preferred || req.body.slot)) || "", 6)
      });
    }
    console.error("booking_submit_failed");
    return res.status(500).json({ error: "Could not submit your booking request. Please try again." });
  }
});

app.post("/api/contact-messages", contactLimiter, function (req, res) {
  try {
    var result = contactMessageService.validateSubmit(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    var created = contactMessageService.create(result.data);
    AuditService.write("patient", "contact_message_submitted", null, created.message_id);
    NotificationService.send("New contact message", {
      type: "contact_message",
      message_id: created.message_id,
      first_name: created.first_name,
      last_name: created.last_name,
      email: created.email,
      phone: created.phone || "",
      service: created.service || "",
      message: created.message
    }).catch(function () {});
    return res.status(201).json({
      ok: true,
      message: "Thank you! Your message was received. We will be in touch shortly.",
      messageId: created.message_id
    });
  } catch (err) {
    console.error("contact_message_submit_failed");
    return res.status(500).json({ error: "Could not send your message. Please try again." });
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

// Serve the marketing website from the project root (same port as the API).
var siteRoot = path.join(__dirname, "..");
app.use(express.static(siteRoot, {
  index: "index.html",
  extensions: ["html"],
  dotfiles: "ignore",
  setHeaders: function (res, filePath) {
    if (/\.(html)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

app.use(function (err, req, res, next) {
  if (err && err.message === "Origin not allowed") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.status(500).json({ error: "Server error" });
});

db.initDb().then(function () {
  auth.ensureAdminSeeded();
  app.listen(config.port, function () {
    console.log("Membership API listening on port " + config.port);
  });
}).catch(function () {
  console.error("database_init_failed");
  process.exit(1);
});
