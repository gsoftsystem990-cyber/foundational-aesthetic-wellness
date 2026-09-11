"use strict";

var db = require("../db");
var ids = require("../lib/ids");

var STATUSES = ["new", "read", "replied", "archived"];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;

function ContactMessageService() {}

ContactMessageService.prototype.validateSubmit = function (body) {
  if (!body || typeof body !== "object") return { error: "Invalid request." };

  var firstName = String(body.firstName || "").trim().slice(0, 60);
  var lastName = String(body.lastName || "").trim().slice(0, 60);
  var email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  var phone = String(body.phone || "").trim().slice(0, 20);
  var service = String(body.service || "").trim().slice(0, 120) || "Not specified";
  var message = String(body.message || "").trim().slice(0, 2000);

  if (!firstName || !lastName) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!message || message.length < 2) return { error: "Please enter a message." };
  if (CARD_LIKE.test([firstName, lastName, service, message, phone].join(" "))) {
    return { error: "Invalid message details." };
  }

  return {
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      service: service,
      message: message
    }
  };
};

ContactMessageService.prototype.create = function (data) {
  var now = ids.nowIso();
  var messageId = ids.newId("msg");
  db.prepare(
    "INSERT INTO contact_messages (message_id, first_name, last_name, email, phone, service, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)"
  ).run(
    messageId,
    data.firstName,
    data.lastName,
    data.email,
    data.phone || "",
    data.service || "Not specified",
    data.message,
    now,
    now
  );
  return this.getById(messageId);
};

ContactMessageService.prototype.getById = function (messageId) {
  return db.prepare("SELECT * FROM contact_messages WHERE message_id = ?").get(messageId);
};

ContactMessageService.prototype.list = function (status) {
  if (status && STATUSES.indexOf(status) !== -1) {
    return db.prepare("SELECT * FROM contact_messages WHERE status = ? ORDER BY created_at DESC").all(status);
  }
  return db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
};

ContactMessageService.prototype.setStatus = function (messageId, status) {
  if (STATUSES.indexOf(status) === -1) return null;
  var current = this.getById(messageId);
  if (!current) return null;
  db.prepare("UPDATE contact_messages SET status = ?, updated_at = ? WHERE message_id = ?").run(
    status,
    ids.nowIso(),
    messageId
  );
  return this.getById(messageId);
};

ContactMessageService.prototype.toAdminRow = function (row) {
  return {
    message_id: row.message_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone || "",
    service: row.service || "",
    message: row.message || "",
    status: row.status,
    created_at: row.created_at
  };
};

module.exports = ContactMessageService;
module.exports.STATUSES = STATUSES;
