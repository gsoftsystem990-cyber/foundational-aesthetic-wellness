(function () {
  // Email/FormSubmit notifications were removed.
  // Contact, reviews, and bookings go through the membership API + admin panel.
  window.FAWForms = {
    sendEmail: async function () {
      return { ok: true, skipped: true };
    }
  };
})();
