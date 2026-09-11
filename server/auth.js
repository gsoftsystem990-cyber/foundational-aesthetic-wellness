"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var db = require("./db");
var ids = require("./lib/ids");
var config = require("./config");

var COOKIE = "faw_admin";
var MAX_AGE_MS = 8 * 60 * 60 * 1000;
var ENV_PATH = path.join(__dirname, ".env");
var MIN_PASSWORD_LEN = 8;

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

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString("hex");
}

function getAdminRow() {
  return db.prepare("SELECT * FROM admin_settings WHERE id = 1").get();
}

function saveAdminCredentials(username, password) {
  var salt = crypto.randomBytes(16).toString("hex");
  var passwordHash = hashPassword(password, salt);
  var now = ids.nowIso();
  var existing = getAdminRow();
  if (existing) {
    db.prepare(
      "UPDATE admin_settings SET username = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE id = 1"
    ).run(username, passwordHash, salt, now);
  } else {
    db.prepare(
      "INSERT INTO admin_settings (id, username, password_hash, password_salt, updated_at) VALUES (1, ?, ?, ?, ?)"
    ).run(username, passwordHash, salt, now);
  }
  config.adminUsername = username;
  config.adminPassword = String(password);
  return true;
}

function quoteEnvValue(value) {
  var str = String(value == null ? "" : value);
  if (/[\s#"']/.test(str) || str.indexOf("\\") !== -1) {
    return '"' + str.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return str;
}

function updateEnvPassword(newPassword) {
  try {
    if (!fs.existsSync(ENV_PATH)) return false;
    var text = fs.readFileSync(ENV_PATH, "utf8");
    var line = "ADMIN_PASSWORD=" + quoteEnvValue(newPassword);
    if (/^ADMIN_PASSWORD=/m.test(text)) {
      text = text.replace(/^ADMIN_PASSWORD=.*$/m, line);
    } else {
      text = text.replace(/\s*$/, "\n") + line + "\n";
    }
    fs.writeFileSync(ENV_PATH, text, "utf8");
    return true;
  } catch (err) {
    console.error("admin_env_password_update_failed");
    return false;
  }
}

function ensureAdminSeeded() {
  var row = getAdminRow();
  if (row) {
    if (row.username) config.adminUsername = row.username;
    return;
  }
  if (config.adminUsername && config.adminPassword) {
    saveAdminCredentials(config.adminUsername, config.adminPassword);
  }
}

function verifyPassword(password) {
  var row = getAdminRow();
  if (row && row.password_hash && row.password_salt) {
    var hashed = hashPassword(password, row.password_salt);
    return ids.safeEqual(hashed, row.password_hash);
  }
  if (!config.adminPassword) return false;
  return ids.safeEqual(password, config.adminPassword);
}

function getAdminUsername() {
  var row = getAdminRow();
  if (row && row.username) return row.username;
  return config.adminUsername || "";
}

function login(username, password) {
  ensureAdminSeeded();
  var expectedUser = getAdminUsername();
  if (!expectedUser) return false;
  return ids.safeEqual(username, expectedUser) && verifyPassword(password);
}

function changePassword(currentPassword, newPassword, confirmPassword) {
  ensureAdminSeeded();
  if (!verifyPassword(currentPassword)) {
    return { error: "Current password is incorrect." };
  }
  var next = String(newPassword || "");
  var confirm = String(confirmPassword || "");
  if (next.length < MIN_PASSWORD_LEN) {
    return { error: "New password must be at least " + MIN_PASSWORD_LEN + " characters." };
  }
  if (next.length > 128) {
    return { error: "New password is too long." };
  }
  if (next !== confirm) {
    return { error: "New password and confirmation do not match." };
  }
  if (ids.safeEqual(currentPassword, next)) {
    return { error: "New password must be different from the current password." };
  }

  var username = getAdminUsername() || config.adminUsername;
  if (!username) return { error: "Admin username is not configured." };

  saveAdminCredentials(username, next);
  var envUpdated = updateEnvPassword(next);
  return {
    ok: true,
    envUpdated: envUpdated,
    message: envUpdated
      ? "Password updated successfully."
      : "Password updated in the app. Could not update server/.env automatically — edit ADMIN_PASSWORD there if needed."
  };
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
  login: login,
  ensureAdminSeeded: ensureAdminSeeded,
  changePassword: changePassword,
  getAdminUsername: getAdminUsername,
  MIN_PASSWORD_LEN: MIN_PASSWORD_LEN
};
