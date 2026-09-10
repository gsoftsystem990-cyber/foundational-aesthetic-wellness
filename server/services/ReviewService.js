"use strict";

var db = require("../db");
var ids = require("../lib/ids");

var STATUSES = ["pending", "approved", "rejected"];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;

function ReviewService() {}

ReviewService.prototype.validateSubmit = function (body) {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  if (String(body.company || "").trim()) return { error: "Unable to process this request." };

  var name = String(body.name || "").trim().slice(0, 80);
  var email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  var text = String(body.text || "").trim().slice(0, 500);
  var rating = Number(body.rating);

  if (!name || name.length < 2) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!text || text.length < 5) return { error: "Please write a short review." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Please select a rating from 1 to 5." };
  }
  if (CARD_LIKE.test(name + " " + text + " " + email)) {
    return { error: "Invalid review content." };
  }

  return {
    data: {
      name: name,
      email: email,
      text: text,
      rating: rating
    }
  };
};

ReviewService.prototype.createPending = function (data) {
  var now = ids.nowIso();
  var reviewId = ids.newId("rev");
  db.prepare(
    "INSERT INTO reviews (review_id, name, email, rating, text, status, created_at, updated_at, approved_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)"
  ).run(reviewId, data.name, data.email, data.rating, data.text, now, now);
  return this.getById(reviewId);
};

ReviewService.prototype.getById = function (reviewId) {
  return db.prepare("SELECT * FROM reviews WHERE review_id = ?").get(reviewId);
};

ReviewService.prototype.list = function (status) {
  if (status && STATUSES.indexOf(status) !== -1) {
    return db.prepare(
      "SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC"
    ).all(status);
  }
  return db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
};

ReviewService.prototype.listApprovedPublic = function () {
  return db.prepare(
    "SELECT review_id AS id, name, rating, text, created_at AS date, approved_at AS approvedAt FROM reviews WHERE status = 'approved' ORDER BY approved_at DESC, created_at DESC"
  ).all().map(function (row) {
    return {
      id: row.id,
      name: row.name,
      rating: Number(row.rating),
      text: row.text,
      date: row.date,
      approvedAt: row.approvedAt || "",
      verified: true,
      source: "site"
    };
  });
};

ReviewService.prototype.setStatus = function (reviewId, status) {
  if (STATUSES.indexOf(status) === -1) return null;
  var current = this.getById(reviewId);
  if (!current) return null;
  var now = ids.nowIso();
  var approvedAt = status === "approved" ? now : null;
  db.prepare(
    "UPDATE reviews SET status = ?, updated_at = ?, approved_at = ? WHERE review_id = ?"
  ).run(status, now, approvedAt, reviewId);
  return this.getById(reviewId);
};

ReviewService.prototype.toAdminRow = function (row) {
  return {
    review_id: row.review_id,
    name: row.name,
    email: row.email,
    rating: Number(row.rating),
    text: row.text,
    status: row.status,
    created_at: row.created_at,
    approved_at: row.approved_at || ""
  };
};

module.exports = ReviewService;
module.exports.STATUSES = STATUSES;
