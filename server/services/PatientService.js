"use strict";

var fs = require("fs");
var path = require("path");
var db = require("../db");
var ids = require("../lib/ids");

var PHOTO_DIR = path.join(__dirname, "..", "data", "patient-photos");
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

function ensurePhotoDir() {
  if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

function PatientService(adapter) {
  this.adapter = adapter;
}

PatientService.prototype.cacheLocal = function (patient) {
  var now = ids.nowIso();
  var existing = db.prepare("SELECT patient_id FROM patients WHERE patient_id = ?").get(patient.patient_id);
  if (existing) {
    db.prepare(
      "UPDATE patients SET first_name = ?, last_name = ?, email = ?, phone_normalized = ?, dob = ?, external_patient_id = ?, updated_at = ? WHERE patient_id = ?"
    ).run(
      patient.first_name,
      patient.last_name,
      patient.email || null,
      patient.phone_normalized,
      patient.dob || "",
      patient.external_patient_id || null,
      now,
      patient.patient_id
    );
    return;
  }
  db.prepare(
    "INSERT INTO patients (patient_id, external_patient_id, first_name, last_name, email, phone_normalized, phone_display, dob, address, notes, photo_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    patient.patient_id,
    patient.external_patient_id || null,
    patient.first_name,
    patient.last_name,
    patient.email || null,
    patient.phone_normalized,
    patient.phone_display || patient.phone_normalized || "",
    patient.dob || "",
    patient.address || "",
    patient.notes || "",
    patient.photo_path || null,
    now,
    now
  );
};

PatientService.prototype.resolve = async function (input) {
  var patient = await this.adapter.matchOrCreate(input);
  this.cacheLocal(patient);
  return patient;
};

PatientService.prototype.toAdminRow = function (row) {
  if (!row) return null;
  return {
    patient_id: row.patient_id,
    external_patient_id: row.external_patient_id || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    email: row.email || "",
    phone: row.phone_display || row.phone_normalized || "",
    phone_normalized: row.phone_normalized || "",
    dob: row.dob || "",
    address: row.address || "",
    notes: row.notes || "",
    photo_url: row.photo_path ? ("/admin/api/patients/" + encodeURIComponent(row.patient_id) + "/photo") : "",
    has_photo: Boolean(row.photo_path),
    created_at: row.created_at || "",
    updated_at: row.updated_at || ""
  };
};

PatientService.prototype.list = function (query) {
  var q = String(query || "").trim().toLowerCase();
  var rows = db.prepare("SELECT * FROM patients ORDER BY updated_at DESC, created_at DESC").all();
  var self = this;
  if (!q) return rows.map(function (row) { return self.toAdminRow(row); });
  return rows.filter(function (row) {
    var blob = [
      row.first_name,
      row.last_name,
      row.email,
      row.phone_display,
      row.phone_normalized,
      row.external_patient_id,
      row.notes,
      row.address
    ].join(" ").toLowerCase();
    return blob.indexOf(q) !== -1;
  }).map(function (row) { return self.toAdminRow(row); });
};

PatientService.prototype.getById = function (patientId) {
  return db.prepare("SELECT * FROM patients WHERE patient_id = ?").get(patientId);
};

PatientService.prototype.validateProfile = function (body, isUpdate) {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  var firstName = String(body.firstName || body.first_name || "").trim().slice(0, 60);
  var lastName = String(body.lastName || body.last_name || "").trim().slice(0, 60);
  var email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  var phoneRaw = String(body.phone || body.phone_display || "").trim().slice(0, 30);
  var phoneNormalized = ids.normalizePhone(phoneRaw);
  var dob = String(body.dob || "").trim().slice(0, 20);
  var address = String(body.address || "").trim().slice(0, 300);
  var notes = String(body.notes || "").trim().slice(0, 4000);
  var externalId = String(body.externalPatientId || body.external_patient_id || "").trim().slice(0, 80);

  if (!firstName || !lastName) return { error: "Please enter first and last name." };
  if (!phoneNormalized || phoneNormalized.length < 7) {
    return { error: "Please enter a valid phone number." };
  }
  if (email && !EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (!isUpdate && !email) {
    // email optional but recommended; allow create without email
  }

  return {
    data: {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phoneDisplay: phoneRaw || phoneNormalized,
      phoneNormalized: phoneNormalized,
      dob: dob || "",
      address: address,
      notes: notes,
      externalPatientId: externalId
    }
  };
};

PatientService.prototype.create = function (data) {
  var now = ids.nowIso();
  var patientId = ids.newId("pat");
  db.prepare(
    "INSERT INTO patients (patient_id, external_patient_id, first_name, last_name, email, phone_normalized, phone_display, dob, address, notes, photo_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
  ).run(
    patientId,
    data.externalPatientId || null,
    data.firstName,
    data.lastName,
    data.email || null,
    data.phoneNormalized,
    data.phoneDisplay,
    data.dob || "",
    data.address || "",
    data.notes || "",
    now,
    now
  );
  return this.getById(patientId);
};

PatientService.prototype.update = function (patientId, data) {
  var current = this.getById(patientId);
  if (!current) return null;
  var now = ids.nowIso();
  db.prepare(
    "UPDATE patients SET external_patient_id = ?, first_name = ?, last_name = ?, email = ?, phone_normalized = ?, phone_display = ?, dob = ?, address = ?, notes = ?, updated_at = ? WHERE patient_id = ?"
  ).run(
    data.externalPatientId || current.external_patient_id || null,
    data.firstName,
    data.lastName,
    data.email || null,
    data.phoneNormalized,
    data.phoneDisplay,
    data.dob || "",
    data.address || "",
    data.notes || "",
    now,
    patientId
  );
  return this.getById(patientId);
};

PatientService.prototype.savePhotoFromDataUrl = function (patientId, dataUrl) {
  var current = this.getById(patientId);
  if (!current) return { error: "Patient not found." };
  var raw = String(dataUrl || "");
  var match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return { error: "Photo must be a JPG, PNG, or WEBP image." };
  var ext = match[1].toLowerCase().indexOf("png") !== -1 ? "png" : (match[1].toLowerCase().indexOf("webp") !== -1 ? "webp" : "jpg");
  var buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch (e) {
    return { error: "Invalid photo data." };
  }
  if (!buffer.length) return { error: "Photo is empty." };
  if (buffer.length > MAX_PHOTO_BYTES) return { error: "Photo is too large (max about 1.5 MB)." };

  ensurePhotoDir();
  var fileName = patientId + "." + ext;
  var filePath = path.join(PHOTO_DIR, fileName);
  // Remove previous photo files for this patient (any extension).
  try {
    fs.readdirSync(PHOTO_DIR).forEach(function (name) {
      if (name.indexOf(patientId + ".") === 0) {
        try { fs.unlinkSync(path.join(PHOTO_DIR, name)); } catch (e) { /* ignore */ }
      }
    });
  } catch (e) { /* ignore */ }

  fs.writeFileSync(filePath, buffer);
  var relative = path.join("patient-photos", fileName).replace(/\\/g, "/");
  db.prepare("UPDATE patients SET photo_path = ?, updated_at = ? WHERE patient_id = ?").run(
    relative,
    ids.nowIso(),
    patientId
  );
  return { ok: true, patient: this.getById(patientId) };
};

PatientService.prototype.getPhotoAbsolutePath = function (patientId) {
  var row = this.getById(patientId);
  if (!row || !row.photo_path) return null;
  var abs = path.join(__dirname, "..", "data", row.photo_path);
  if (!fs.existsSync(abs)) return null;
  return abs;
};

PatientService.prototype.removePhoto = function (patientId) {
  var row = this.getById(patientId);
  if (!row) return null;
  if (row.photo_path) {
    var abs = path.join(__dirname, "..", "data", row.photo_path);
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch (e) { /* ignore */ }
  }
  db.prepare("UPDATE patients SET photo_path = NULL, updated_at = ? WHERE patient_id = ?").run(ids.nowIso(), patientId);
  return this.getById(patientId);
};

PatientService.prototype.linkedRecords = function (patient) {
  var email = String(patient.email || "").trim().toLowerCase();
  var phone = ids.normalizePhone(patient.phone_display || patient.phone_normalized || "");

  var bookings = db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all().filter(function (row) {
    var rowEmail = String(row.email || "").toLowerCase();
    var rowPhone = ids.normalizePhone(row.phone || "");
    return (email && rowEmail === email) || (phone && rowPhone && rowPhone === phone);
  });

  var messages = db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all().filter(function (row) {
    var rowEmail = String(row.email || "").toLowerCase();
    var rowPhone = ids.normalizePhone(row.phone || "");
    return (email && rowEmail === email) || (phone && rowPhone && rowPhone === phone);
  });

  var reviewRows = db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all().filter(function (row) {
    var rowEmail = String(row.email || "").toLowerCase();
    return email && rowEmail === email;
  });

  var membershipRows = db.prepare(
    "SELECT m.*, p.first_name, p.last_name, p.external_patient_id FROM memberships m LEFT JOIN patients p ON p.patient_id = m.patient_id WHERE m.patient_id = ? ORDER BY m.created_at DESC"
  ).all(patient.patient_id);

  return {
    bookings: bookings.map(function (row) {
      return {
        booking_id: row.booking_id,
        service: row.service,
        preferred_time: row.preferred_time || "",
        status: row.status,
        message: row.message || "",
        created_at: row.created_at
      };
    }),
    messages: messages.map(function (row) {
      return {
        message_id: row.message_id,
        service: row.service || "",
        message: row.message || "",
        status: row.status,
        created_at: row.created_at
      };
    }),
    reviews: reviewRows.map(function (row) {
      return {
        review_id: row.review_id,
        rating: Number(row.rating),
        text: row.text,
        status: row.status,
        created_at: row.created_at
      };
    }),
    memberships: membershipRows.map(function (row) {
      return {
        membership_id: row.membership_id,
        membership_plan_id: row.membership_plan_id,
        status: row.status,
        start_date: row.start_date,
        renewal_date: row.renewal_date,
        created_at: row.created_at
      };
    })
  };
};

PatientService.prototype.getProfile = function (patientId) {
  var row = this.getById(patientId);
  if (!row) return null;
  return {
    patient: this.toAdminRow(row),
    records: this.linkedRecords(row)
  };
};

module.exports = PatientService;
