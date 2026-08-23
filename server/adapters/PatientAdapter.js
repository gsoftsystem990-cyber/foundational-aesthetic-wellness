"use strict";

var ids = require("../lib/ids");

function LocalPatientAdapter(db) {
  this.db = db;
}

LocalPatientAdapter.prototype.matchOrCreate = function (input) {
  var externalId = input.externalPatientId ? String(input.externalPatientId).slice(0, 80) : "";
  var lastName = ids.normalizeName(input.lastName);
  var dob = input.dob;
  var phone = ids.normalizePhone(input.phone);
  var now = ids.nowIso();

  var existing = null;
  if (externalId) {
    existing = this.db.prepare("SELECT * FROM patients WHERE external_patient_id = ?").get(externalId);
  }
  if (!existing) {
    existing = this.db.prepare(
      "SELECT * FROM patients WHERE last_name = ? AND dob = ? AND phone_normalized = ?"
    ).get(lastName, dob, phone);
  }

  if (existing) {
    this.db.prepare(
      "UPDATE patients SET first_name = ?, email = ?, external_patient_id = COALESCE(external_patient_id, ?), updated_at = ? WHERE patient_id = ?"
    ).run(input.firstName, input.email, externalId || null, now, existing.patient_id);
    return this.db.prepare("SELECT * FROM patients WHERE patient_id = ?").get(existing.patient_id);
  }

  var patientId = ids.newId("pat");
  this.db.prepare(
    "INSERT INTO patients (patient_id, external_patient_id, first_name, last_name, email, phone_normalized, dob, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    patientId,
    externalId || null,
    input.firstName,
    lastName,
    input.email,
    phone,
    dob,
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
