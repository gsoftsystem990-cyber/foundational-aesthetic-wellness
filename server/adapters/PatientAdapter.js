"use strict";

var ids = require("../lib/ids");

function LocalPatientAdapter(db) {
  this.db = db;
}

LocalPatientAdapter.prototype.buildEnrollmentNotes = function (input) {
  var parts = [];
  var family = String(input.family || "").trim().slice(0, 400);
  var notes = String(input.notes || "").trim().slice(0, 500);
  if (family) parts.push("Family members: " + family);
  if (notes) parts.push(notes);
  return parts.join("\n").slice(0, 4000);
};

LocalPatientAdapter.prototype.matchOrCreate = function (input) {
  var externalId = input.externalPatientId ? String(input.externalPatientId).slice(0, 80) : "";
  var lastName = ids.normalizeName(input.lastName);
  var dob = input.dob;
  var phone = ids.normalizePhone(input.phone);
  var now = ids.nowIso();
  var enrollmentNotes = this.buildEnrollmentNotes(input);

  var existing = null;
  if (externalId) {
    existing = this.db.prepare("SELECT * FROM patients WHERE external_patient_id = ?").get(externalId);
  }
  if (!existing) {
    existing = this.db.prepare(
      "SELECT * FROM patients WHERE lower(last_name) = ? AND dob = ? AND phone_normalized = ?"
    ).get(lastName, dob, phone);
  }

  if (existing) {
    var mergedNotes = String(existing.notes || "").trim();
    if (enrollmentNotes) {
      mergedNotes = mergedNotes
        ? (mergedNotes + "\n\n[" + now.slice(0, 10) + " enrollment]\n" + enrollmentNotes)
        : enrollmentNotes;
      mergedNotes = mergedNotes.slice(0, 4000);
    }
    this.db.prepare(
      "UPDATE patients SET first_name = ?, email = ?, phone_display = COALESCE(?, phone_display), external_patient_id = COALESCE(external_patient_id, ?), notes = ?, updated_at = ? WHERE patient_id = ?"
    ).run(
      input.firstName,
      input.email,
      input.phone || null,
      externalId || null,
      mergedNotes,
      now,
      existing.patient_id
    );
    return this.db.prepare("SELECT * FROM patients WHERE patient_id = ?").get(existing.patient_id);
  }

  var patientId = ids.newId("pat");
  this.db.prepare(
    "INSERT INTO patients (patient_id, external_patient_id, first_name, last_name, email, phone_normalized, phone_display, dob, address, notes, photo_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, NULL, ?, ?)"
  ).run(
    patientId,
    externalId || null,
    input.firstName,
    lastName,
    input.email,
    phone,
    input.phone || phone,
    dob,
    enrollmentNotes || "",
    now,
    now
  );
  return this.db.prepare("SELECT * FROM patients WHERE patient_id = ?").get(patientId);
};

function HttpPatientAdapter(config) {
  this.config = config;
}

HttpPatientAdapter.prototype.matchOrCreate = async function (input) {
  if (!this.config.patientApiUrl || !this.config.patientApiKey) {
    throw new Error("patient_adapter_unconfigured");
  }
  var res = await fetch(this.config.patientApiUrl + "/patients/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + this.config.patientApiKey
    },
    body: JSON.stringify({
      externalPatientId: input.externalPatientId || "",
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob,
      phone: ids.normalizePhone(input.phone)
    })
  });
  if (!res.ok) throw new Error("patient_adapter_failed");
  var data = await res.json();
  if (!data || !data.patientId) throw new Error("patient_adapter_invalid");
  return {
    patient_id: data.patientId,
    external_patient_id: data.externalPatientId || input.externalPatientId || null,
    first_name: input.firstName,
    last_name: ids.normalizeName(input.lastName),
    email: input.email,
    phone_normalized: ids.normalizePhone(input.phone),
    dob: input.dob
  };
};

function createPatientAdapter(db, config) {
  if (config.patientAdapter === "http") return new HttpPatientAdapter(config);
  return new LocalPatientAdapter(db);
}

module.exports = {
  LocalPatientAdapter: LocalPatientAdapter,
  HttpPatientAdapter: HttpPatientAdapter,
  createPatientAdapter: createPatientAdapter
};
