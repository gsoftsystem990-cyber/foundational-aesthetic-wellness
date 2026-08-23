"use strict";

var db = require("../db");
var ids = require("../lib/ids");

function write(actor, action, membershipId, detail) {
  db.prepare(
    "INSERT INTO audit_log (at, actor, action, membership_id, detail) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.nowIso(),
    String(actor || "system").slice(0, 80),
    String(action || "").slice(0, 80),
    membershipId || null,
    detail ? String(detail).slice(0, 240) : null
  );
}

function recent(limit) {
  return db.prepare(
    "SELECT at, actor, action, membership_id FROM audit_log ORDER BY id DESC LIMIT ?"
  ).all(Number(limit) || 50);
}

module.exports = {
  write: write,
  recent: recent
};
