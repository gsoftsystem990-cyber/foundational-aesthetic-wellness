"use strict";

var crypto = require("crypto");
var db = require("./db");
var ids = require("./lib/ids");
var config = require("./config");

var COOKIE = "faw_admin";
var MAX_AGE_MS = 8 * 60 * 60 * 1000;

function createSession() {
  var sessionId = crypto.randomBytes(32).toString("hex");
  var csrfToken = crypto.randomBytes(24).toString("hex");
  var expires = new Date(Date.now() + MAX_AGE_MS).toISOString();
  db.prepare("INSERT INTO sessions (session_id, csrf_token, expires_at) VALUES (?, ?, ?)").run(
    sessionId,
    csrfToken,
    expires
  );
  return { sessionId: sessionId, csrfToken: csrfToken };
}

function readSession(req) {
  var sid = req.cookies && req.cookies[COOKIE];
  if (!sid) return null;
  var row = db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sid);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sid);
    return null;
  }
  return row;
}

function destroySession(req) {
  var sid = req.cookies && req.cookies[COOKIE];
  if (sid) db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sid);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: MAX_AGE_MS
  };
}

function requireAdmin(req, res, next) {
  var session = readSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.adminSession = session;
  next();
}

function requireCsrf(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD") return next();
  var token = req.get("x-csrf-token") || (req.body && req.body._csrf);
  if (!req.adminSession || !token || !ids.safeEqual(token, req.adminSession.csrf_token)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function requireCron(req, res, next) {
  var provided = req.get("x-cron-secret") || "";
  if (!config.cronSecret || !ids.safeEqual(provided, config.cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function login(username, password) {
  if (!config.adminUsername || !config.adminPassword) return false;
  return ids.safeEqual(username, config.adminUsername) && ids.safeEqual(password, config.adminPassword);
}

module.exports = {
  COOKIE: COOKIE,
  createSession: createSession,
  readSession: readSession,
  destroySession: destroySession,
  cookieOptions: cookieOptions,
  requireAdmin: requireAdmin,
  requireCsrf: requireCsrf,
  requireCron: requireCron,
  login: login
};
