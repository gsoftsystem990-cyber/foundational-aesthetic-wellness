"use strict";

var config = require("../config");
var AuditService = require("./AuditService");

function normalizeWhatsAppTo(phone, defaultCountry) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && defaultCountry) return String(defaultCountry) + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return digits;
  return digits;
}

function whatsappDeepLink(phone, text) {
  var to = normalizeWhatsAppTo(phone, (config.whatsapp && config.whatsapp.defaultCountry) || "1");
  if (!to) return "";
  return "https://wa.me/" + to + "?text=" + encodeURIComponent(String(text || ""));
}

async function sendWhatsApp(phone, text) {
  var message = String(text || "").trim();
  var to = normalizeWhatsAppTo(phone, (config.whatsapp && config.whatsapp.defaultCountry) || "1");
  var deepLink = whatsappDeepLink(phone, message);
  if (!to || !message) {
    return { ok: false, mode: "none", error: "Missing phone or message.", deepLink: deepLink };
  }

  var token = config.whatsapp && config.whatsapp.token;
  var phoneNumberId = config.whatsapp && config.whatsapp.phoneNumberId;
  if (token && phoneNumberId) {
    try {
      var version = (config.whatsapp && config.whatsapp.apiVersion) || "v21.0";
      var res = await fetch(
        "https://graph.facebook.com/" + version + "/" + encodeURIComponent(phoneNumberId) + "/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: message.slice(0, 4000) }
          })
        }
      );
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        console.error("whatsapp_api_failed");
        return {
          ok: false,
          mode: "api",
          error: (data && data.error && data.error.message) || "WhatsApp API send failed.",
          deepLink: deepLink
        };
      }
      return { ok: true, mode: "api", deepLink: deepLink };
    } catch (err) {
      console.error("whatsapp_api_failed");
      return { ok: false, mode: "api", error: "WhatsApp API send failed.", deepLink: deepLink };
    }
  }

  // No Cloud API keys: staff can open deepLink from admin to message the patient.
  return { ok: true, mode: "deeplink", deepLink: deepLink };
}

async function bookingConfirmed(booking, message) {
  return sendWhatsApp(booking.phone, message);
}

function membershipId(row) {
  return row && (row.membership_id || row.membershipId) || null;
}

function logStaffEvent(action, membership, detail) {
  try {
    AuditService.write("system", action, membershipId(membership), detail || "");
    console.info("membership_notify", action, membershipId(membership) || "");
  } catch (err) {
    console.error("membership_notify_failed");
  }
  return Promise.resolve({ ok: true, mode: "audit" });
}

function activated(membership) {
  return logStaffEvent("membership_activated_notify", membership, "Membership activated — follow up in admin if needed.");
}

function paymentFailed(membership) {
  return logStaffEvent("membership_payment_failed_notify", membership, "Payment failed — contact patient.");
}

function cancelled(membership) {
  return logStaffEvent("membership_cancelled_notify", membership, "Membership cancelled.");
}

function upcomingRenewal(membership) {
  return logStaffEvent(
    "membership_renewal_reminder",
    membership,
    "Renewal due within reminder window — contact patient if needed."
  );
}

function expired(membership) {
  return logStaffEvent("membership_expired_notify", membership, "Membership expired.");
}

module.exports = {
  send: function () { return Promise.resolve({ ok: true, mode: "none" }); },
  activated: activated,
  paymentFailed: paymentFailed,
  cancelled: cancelled,
  upcomingRenewal: upcomingRenewal,
  expired: expired,
  sendWhatsApp: sendWhatsApp,
  whatsappDeepLink: whatsappDeepLink,
  bookingConfirmed: bookingConfirmed
};
