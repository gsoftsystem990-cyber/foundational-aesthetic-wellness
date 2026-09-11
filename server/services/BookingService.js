"use strict";

var db = require("../db");
var ids = require("../lib/ids");

var STATUSES = ["new", "contacted", "confirmed", "completed", "cancelled"];
var ACTIVE_SLOT_STATUSES = ["new", "contacted", "confirmed"];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var PHONE_RE = /^[0-9+().\s-]{7,20}$/;
var CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;
var SLOT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

var WEEKDAY_TIMES = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30"
];
var SATURDAY_TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayLocalIsoDate() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function parseIsoDate(dateStr) {
  var m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  var day = Number(m[3]);
  var dt = new Date(y, mo - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return null;
  return dt;
}

function addDays(date, days) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return d;
}

function toIsoDate(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function timesForDate(date) {
  var day = date.getDay();
  if (day === 0) return [];
  if (day === 6) return SATURDAY_TIMES.slice();
  return WEEKDAY_TIMES.slice();
}

function formatSlotLabel(slot) {
  var m = String(slot || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return String(slot || "");
  var dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  try {
    return dt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch (e) {
    return slot;
  }
}

function digitsOnly(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function BookingService() {}

BookingService.prototype.normalizePhone = function (phone) {
  var digits = digitsOnly(phone);
  if (digits.length === 11 && digits.charAt(0) === "1") return digits;
  if (digits.length === 10) return "1" + digits;
  return digits;
};

BookingService.prototype.formatSlotLabel = formatSlotLabel;

BookingService.prototype.isValidSlot = function (slot) {
  if (!SLOT_RE.test(slot)) return false;
  var parts = slot.split(" ");
  var date = parseIsoDate(parts[0]);
  if (!date) return false;
  var time = parts[1];
  var allowed = timesForDate(date);
  if (allowed.indexOf(time) === -1) return false;
  var today = todayLocalIsoDate();
  if (parts[0] < today) return false;
  if (parts[0] === today) {
    var now = new Date();
    var hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    if (time <= hhmm) return false;
  }
  return true;
};

BookingService.prototype.listTakenSlots = function (dateStr) {
  var rows = db.prepare(
    "SELECT preferred_time FROM bookings WHERE preferred_time LIKE ? AND status IN ('new','contacted','confirmed')"
  ).all((dateStr || "") + " %");
  var map = {};
  rows.forEach(function (row) {
    if (row.preferred_time) map[row.preferred_time] = true;
  });
  return map;
};

BookingService.prototype.isSlotTaken = function (slot) {
  var row = db.prepare(
    "SELECT booking_id FROM bookings WHERE preferred_time = ? AND status IN ('new','contacted','confirmed') LIMIT 1"
  ).get(slot);
  return Boolean(row);
};

BookingService.prototype.getSlotsForDate = function (dateStr) {
  var date = parseIsoDate(dateStr);
  if (!date) return { error: "Please choose a valid date." };
  var today = todayLocalIsoDate();
  if (dateStr < today) return { error: "Please choose today or a future date." };

  var times = timesForDate(date);
  if (!times.length) {
    return {
      date: dateStr,
      closed: true,
      slots: [],
      message: "The clinic is closed on Sundays. Please choose another day."
    };
  }

  var taken = this.listTakenSlots(dateStr);
  var now = new Date();
  var nowHm = pad(now.getHours()) + ":" + pad(now.getMinutes());
  var slots = times.map(function (time) {
    var slot = dateStr + " " + time;
    var past = dateStr === today && time <= nowHm;
    var available = !past && !taken[slot];
    return {
      time: time,
      slot: slot,
      label: formatSlotLabel(slot),
      available: available
    };
  });

  return { date: dateStr, closed: false, slots: slots };
};

BookingService.prototype.findAlternatives = function (preferredSlot, limit) {
  var max = Math.max(1, Math.min(Number(limit) || 6, 12));
  var parts = String(preferredSlot || "").split(" ");
  var startDate = parseIsoDate(parts[0]) || new Date();
  var out = [];
  var seen = {};

  for (var dayOffset = 0; dayOffset < 21 && out.length < max; dayOffset++) {
    var date = addDays(startDate, dayOffset);
    var dateStr = toIsoDate(date);
    if (dateStr < todayLocalIsoDate()) continue;
    var daySlots = this.getSlotsForDate(dateStr);
    if (daySlots.error || daySlots.closed) continue;
    (daySlots.slots || []).forEach(function (item) {
      if (out.length >= max) return;
      if (!item.available) return;
      if (item.slot === preferredSlot) return;
      if (seen[item.slot]) return;
      seen[item.slot] = true;
      out.push({
        slot: item.slot,
        label: item.label,
        date: dateStr,
        time: item.time
      });
    });
  }
  return out;
};

BookingService.prototype.validateSubmit = function (body) {
  if (!body || typeof body !== "object") return { error: "Invalid request." };

  var firstName = String(body.firstName || "").trim().slice(0, 60);
  var lastName = String(body.lastName || "").trim().slice(0, 60);
  var email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  var phone = String(body.phone || "").trim().slice(0, 20);
  var service = String(body.service || "").trim().slice(0, 120) || "Not specified";
  var preferred = String(body.preferred || body.preferredTime || body.slot || "").trim().slice(0, 120);
  var message = String(body.message || "").trim().slice(0, 500);

  if (!firstName || !lastName) return { error: "Please enter your first and last name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!phone) return { error: "Phone number is required for booking confirmation." };
  if (!PHONE_RE.test(phone) || digitsOnly(phone).length < 10) {
    return { error: "Please enter a valid phone number (at least 10 digits)." };
  }
  if (!preferred) return { error: "Please select an available date and time slot." };
  if (!this.isValidSlot(preferred)) {
    return { error: "Please select a valid open appointment time slot." };
  }
  if (CARD_LIKE.test([firstName, lastName, service, preferred, message].join(" "))) {
    return { error: "Invalid booking details." };
  }

  if (this.isSlotTaken(preferred)) {
    return {
      error: "This time slot is already booked.",
      code: "SLOT_TAKEN",
      alternatives: this.findAlternatives(preferred, 6)
    };
  }

  return {
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      phoneNormalized: this.normalizePhone(phone),
      service: service,
      preferred: preferred,
      message: message
    }
  };
};

BookingService.prototype.create = function (data) {
  if (this.isSlotTaken(data.preferred)) {
    var err = new Error("SLOT_TAKEN");
    err.code = "SLOT_TAKEN";
    err.alternatives = this.findAlternatives(data.preferred, 6);
    throw err;
  }

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
    preferred_label: formatSlotLabel(row.preferred_time || ""),
    message: row.message || "",
    status: row.status,
    created_at: row.created_at
  };
};

BookingService.prototype.buildConfirmationMessage = function (row) {
  var when = formatSlotLabel(row.preferred_time || "") || (row.preferred_time || "your selected time");
  var name = String(row.first_name || "there").trim() || "there";
  var service = row.service && row.service !== "Not specified" ? row.service : "your appointment";
  return (
    "Hi " + name + ", your booking at Foundational Aesthetic Wellness is confirmed.\n\n" +
    "Service: " + service + "\n" +
    "When: " + when + "\n\n" +
    "If you need to reschedule, call 00. We look forward to seeing you!"
  );
};

module.exports = BookingService;
module.exports.STATUSES = STATUSES;
module.exports.ACTIVE_SLOT_STATUSES = ACTIVE_SLOT_STATUSES;
