"use strict";

var config = require("../config");

function safeFields(fields) {
  var out = {};
  Object.keys(fields || {}).forEach(function (key) {
    var lower = key.toLowerCase();
    if (/(card|cvc|cvv|pan|secret|password|token)/.test(lower)) return;
    out[key] = fields[key];
  });
  return out;
}

async function send(subject, fields) {
  if (!config.notifyEmail) return;
  var body = Object.assign({
    _subject: String(subject || "Membership update").slice(0, 120),
    _template: "table",
    _captcha: "false"
  }, safeFields(fields));
  try {
    await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(config.notifyEmail), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("notification_failed");
  }
}

function activated(membership) {
  return send("Membership activated", {
    type: "membership_activated",
    membership_id: membership.membership_id,
    plan: membership.membership_plan_id,
    status: membership.status,
    renewal_date: membership.renewal_date || "",
    note: "Match this membership to the patient chart in practice software. Do not email card data."
  });
}

function paymentFailed(membership) {
  return send("Membership payment failed", {
    type: "membership_payment_failed",
    membership_id: membership.membership_id,
    status: membership.status
  });
}

function cancelled(membership) {
  return send("Membership cancelled", {
    type: "membership_cancelled",
    membership_id: membership.membership_id,
    status: membership.status
  });
}

function upcomingRenewal(membership) {
  return send("Membership renewal upcoming", {
    type: "membership_renewal_upcoming",
    membership_id: membership.membership_id,
    renewal_date: membership.renewal_date || ""
  });
}

function expired(membership) {
  return send("Membership expired", {
    type: "membership_expired",
    membership_id: membership.membership_id
  });
}

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
  var result = await sendWhatsApp(booking.phone, message);
  await send("Booking confirmed", {
    type: "booking_confirmed",
    booking_id: booking.booking_id,
    patient: (booking.first_name || "") + " " + (booking.last_name || ""),
    phone: booking.phone,
    email: booking.email,
    service: booking.service,
    preferred_time: booking.preferred_time || "",
    whatsapp_mode: result.mode,
    note: "Patient confirmation message prepared for WhatsApp."
  });
  return result;
}

module.exports = {
  send: send,
  activated: activated,
  paymentFailed: paymentFailed,
  cancelled: cancelled,
  upcomingRenewal: upcomingRenewal,
  expired: expired,
  sendWhatsApp: sendWhatsApp,
  whatsappDeepLink: whatsappDeepLink,
  bookingConfirmed: bookingConfirmed
};
