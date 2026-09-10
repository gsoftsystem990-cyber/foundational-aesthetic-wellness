"use strict";

var express = require("express");
var path = require("path");
var rateLimit = require("express-rate-limit");
var auth = require("../auth");
var MembershipService = require("../services/MembershipService");
var ReviewService = require("../services/ReviewService");
var AuditService = require("../services/AuditService");

var memberships = new MembershipService();
var reviews = new ReviewService();
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
      renewal_date: row.renewal_date
    };
  });
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

module.exports = router;
