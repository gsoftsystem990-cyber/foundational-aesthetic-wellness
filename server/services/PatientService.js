"use strict";

var db = require("../db");
var ids = require("../lib/ids");

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
      patient.dob,
      patient.external_patient_id || null,
      now,
      patient.patient_id
    );
    return;
  }
  db.prepare(
    "INSERT INTO patients (patient_id, external_patient_id, first_name, last_name, email, phone_normalized, dob, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    patient.patient_id,
    patient.external_patient_id || null,
    patient.first_name,
    patient.last_name,
    patient.email || null,
    patient.phone_normalized,
    patient.dob,
    now,
    now
  );
};

PatientService.prototype.resolve = async function (input) {
  var patient = await this.adapter.matchOrCreate(input);
  this.cacheLocal(patient);
  return patient;
};

module.exports = PatientService;
