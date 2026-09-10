"use strict";

var db = require("../db");
var ids = require("../lib/ids");

var STATUSES = ["new", "contacted", "completed", "cancelled"];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[0-9+().\s-]{7,20}$/;
var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;

function BookingService() {}

BookingService.prototype.validateSubmit = function (body) {
  if (!body || typeof body !== "object") return { error: "Invalid request." };

  var firstName = String(body.firstName || "").trim().slice(0, 60);
  var lastName = String(body.lastName || "").trim().slice(0, 60);
  var email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  var phone = String(body.phone || "").trim().slice(0, 20);
  var service = String(body.service || "").trim().slice(0, 120) || "Not specified";
  var preferred = String(body.preferred || body.preferredTime || "").trim().slice(0, 120);
  var message = String(body.message || "").trim().slice(0, 500);

  if (!firstName || !lastName) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!PHONE_RE.test(phone)) return { error: "Please enter a valid phone number." };
  if (CARD_LIKE.test([firstName, lastName, service, preferred, message].join(" "))) {
    return { error: "Invalid booking details." };
  }

  return {
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      service: service,
      preferred: preferred,
      message: message
    }
  };
};

BookingService.prototype.create = function (data) {
  var now = ids.nowIso();
  var bookingId = ids.newId("bk");
  db.prepare(
    "INSERT INTO bookings (booking_id, first_name, last_name, email, phone, service, preferred_time, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)"
  ).run(
    bookingId,
    data.firstName,
    data.lastName,
    data.email,
    data.phone,
    data.service,
    data.preferred || "",
    data.message || "",
    now,
    now
  );
  return this.getById(bookingId);
};

BookingService.prototype.getById = function (bookingId) {
  return db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(bookingId);
};

BookingService.prototype.list = function (status) {
  if (status && STATUSES.indexOf(status) !== -1) {
    return db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC").all(status);
  }
  return db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
};

BookingService.prototype.setStatus = function (bookingId, status) {
  if (STATUSES.indexOf(status) === -1) return null;
  var current = this.getById(bookingId);
  if (!current) return null;
  db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE booking_id = ?").run(
    status,
    ids.nowIso(),
    bookingId
  );
  return this.getById(bookingId);
};

BookingService.prototype.toAdminRow = function (row) {
  return {
    booking_id: row.booking_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    service: row.service,
    preferred_time: row.preferred_time || "",
    message: row.message || "",
    status: row.status,
    created_at: row.created_at
  };
};

module.exports = BookingService;
module.exports.STATUSES = STATUSES;
