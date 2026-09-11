"use strict";

var express = require("express");
var path = require("path");
var rateLimit = require("express-rate-limit");
var auth = require("../auth");
var MembershipService = require("../services/MembershipService");
var ReviewService = require("../services/ReviewService");
var BookingService = require("../services/BookingService");
var ContactMessageService = require("../services/ContactMessageService");
var AuditService = require("../services/AuditService");
var NotificationService = require("../services/NotificationService");
var dateFilter = require("../lib/dateFilter");

var memberships = new MembershipService();
var reviews = new ReviewService();
var bookings = new BookingService();
var contactMessages = new ContactMessageService();
var router = express.Router();

var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts." }
});

router.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

router.post("/login", loginLimiter, function (req, res) {
  var username = String((req.body && req.body.username) || "");
  var password = String((req.body && req.body.password) || "");
  if (!auth.login(username, password)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  var session = auth.createSession();
  res.cookie(auth.COOKIE, session.sessionId, auth.cookieOptions());
  AuditService.write("admin", "admin_login", null, "ok");
  res.json({ ok: true, csrf: session.csrfToken });
});

router.post("/logout", auth.requireAdmin, auth.requireCsrf, function (req, res) {
  auth.destroySession(req);
  res.clearCookie(auth.COOKIE, auth.cookieOptions());
  res.json({ ok: true });
});

router.get("/api/memberships", auth.requireAdmin, function (req, res) {
  var status = String(req.query.status || "");
  var rows = memberships.list(status || null).map(function (row) {
    return {
      membership_id: row.membership_id,
      patient_id: row.patient_id,
      external_patient_id: row.external_patient_id || "",
      first_name: row.first_name,
      last_name: row.last_name,
      membership_plan_id: row.membership_plan_id,
      status: row.status,
      start_date: row.start_date,
      renewal_date: row.renewal_date,
      created_at: row.created_at || row.start_date || ""
    };
  });
  rows = dateFilter.filterRows(rows, "created_at", req.query);
  res.json({
    csrf: req.adminSession.csrf_token,
    memberships: rows
  });
});

router.get("/api/reviews", auth.requireAdmin, function (req, res) {
  var status = String(req.query.status || "");
  var rows = reviews.list(status || null).map(function (row) {
    return reviews.toAdminRow(row);
  });
  rows = dateFilter.filterRows(rows, "created_at", req.query);
  res.json({
    csrf: req.adminSession.csrf_token,
    reviews: rows
  });
});

router.post("/api/reviews/:id/approve", auth.requireAdmin, auth.requireCsrf, function (req, res) {
  var updated = reviews.setStatus(req.params.id, "approved");
  if (!updated) return res.status(404).json({ error: "Review not found." });
  AuditService.write("admin", "review_approved", null, updated.review_id);
  res.json({ ok: true, review: reviews.toAdminRow(updated) });
});

router.post("/api/reviews/:id/reject", auth.requireAdmin, auth.requireCsrf, function (req, res) {
  var updated = reviews.setStatus(req.params.id, "rejected");
  if (!updated) return res.status(404).json({ error: "Review not found." });
  AuditService.write("admin", "review_rejected", null, updated.review_id);
  res.json({ ok: true, review: reviews.toAdminRow(updated) });
});

router.get("/api/bookings", auth.requireAdmin, function (req, res) {
  var status = String(req.query.status || "");
  var rows = bookings.list(status || null).map(function (row) {
    return bookings.toAdminRow(row);
  });
  rows = dateFilter.filterRows(rows, "created_at", req.query);
  res.json({
    csrf: req.adminSession.csrf_token,
    bookings: rows
  });
});

router.post("/api/bookings/:id/status", auth.requireAdmin, auth.requireCsrf, async function (req, res) {
  var status = String((req.body && req.body.status) || "");
  var updated = bookings.setStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: "Booking not found or invalid status." });
  AuditService.write("admin", "booking_status", null, updated.booking_id + ":" + status);

  var payload = {
    ok: true,
    booking: bookings.toAdminRow(updated)
  };

  if (status === "confirmed") {
    var message = bookings.buildConfirmationMessage(updated);
    var whatsapp = await NotificationService.bookingConfirmed(updated, message);
    payload.whatsapp = {
      ok: Boolean(whatsapp && whatsapp.ok),
      mode: (whatsapp && whatsapp.mode) || "none",
      deepLink: (whatsapp && whatsapp.deepLink) || "",
      error: (whatsapp && whatsapp.error) || "",
      message: message
    };
  }

  res.json(payload);
});

router.get("/api/contact-messages", auth.requireAdmin, function (req, res) {
  var status = String(req.query.status || "");
  var rows = contactMessages.list(status || null).map(function (row) {
    return contactMessages.toAdminRow(row);
  });
  rows = dateFilter.filterRows(rows, "created_at", req.query);
  res.json({
    csrf: req.adminSession.csrf_token,
    messages: rows
  });
});

router.post("/api/contact-messages/:id/status", auth.requireAdmin, auth.requireCsrf, function (req, res) {
  var status = String((req.body && req.body.status) || "");
  var updated = contactMessages.setStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: "Message not found or invalid status." });
  AuditService.write("admin", "contact_message_status", null, updated.message_id + ":" + status);
  res.json({ ok: true, message: contactMessages.toAdminRow(updated) });
});

router.get("/api/account", auth.requireAdmin, function (req, res) {
  res.json({
    csrf: req.adminSession.csrf_token,
    username: auth.getAdminUsername(),
    minPasswordLength: auth.MIN_PASSWORD_LEN
  });
});

router.post("/api/change-password", auth.requireAdmin, auth.requireCsrf, function (req, res) {
  var body = req.body || {};
  var result = auth.changePassword(body.currentPassword, body.newPassword, body.confirmPassword);
  if (result.error) return res.status(400).json({ error: result.error });
  AuditService.write("admin", "admin_password_changed", null, "ok");
  res.json({
    ok: true,
    message: result.message,
    envUpdated: Boolean(result.envUpdated),
    csrf: req.adminSession.csrf_token
  });
});

module.exports = router;
