"use strict";

var fs = require("fs");
var path = require("path");
var initSqlJs = require("sql.js");

var DATA_DIR = path.join(__dirname, "data");
var DB_FILE = path.join(DATA_DIR, "memberships.db");

var inner = null;

function persist(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  var data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function wrap(db) {
  return {
    exec: function (sql) {
      db.run(sql);
      persist(db);
    },
    prepare: function (sql) {
      return {
        run: function () {
          var stmt = db.prepare(sql);
          var args = Array.prototype.slice.call(arguments);
          if (args.length) stmt.bind(args);
          stmt.step();
          stmt.free();
          persist(db);
          return {};
        },
        get: function () {
          var stmt = db.prepare(sql);
          var args = Array.prototype.slice.call(arguments);
          if (args.length) stmt.bind(args);
          var row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        all: function () {
          var stmt = db.prepare(sql);
          var args = Array.prototype.slice.call(arguments);
          if (args.length) stmt.bind(args);
          var rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        }
      };
    }
  };
}

var facade = {
  exec: function (sql) { return inner.exec(sql); },
  prepare: function (sql) { return inner.prepare(sql); }
};

async function initDb() {
  var SQL = await initSqlJs();
  var fileDb = null;
  if (fs.existsSync(DB_FILE)) {
    fileDb = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fileDb = new SQL.Database();
  }
  inner = wrap(fileDb);
  inner.exec(`
CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT PRIMARY KEY,
  external_patient_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_normalized TEXT NOT NULL,
  dob TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  membership_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  membership_plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT,
  renewal_date TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_checkout_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  membership_id TEXT,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_patient ON memberships(patient_id);
CREATE INDEX IF NOT EXISTS idx_memberships_session ON memberships(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_memberships_sub ON memberships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_patients_match ON patients(last_name, dob, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_patients_external ON patients(external_patient_id);
`);
  return facade;
}

module.exports = facade;
module.exports.initDb = initDb;
