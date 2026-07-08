/**
 * Site configuration
 *
 * Google reviews: enable Places API (New) and add googlePlacesApiKey
 * Email verification: set up EmailJS at https://www.emailjs.com/
 *   1. Create account + Email Service (Gmail, etc.)
 *   2. Create template with variables: {{to_email}}, {{verification_code}}, {{user_name}}
 *   3. Set "To Email" in template to {{to_email}}
 *   4. Paste publicKey, serviceId, templateId below
 */
window.FAW_SITE_CONFIG = {
  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: 'https://www.google.com/maps/search/?api=1&query_place_id=ChIJgxBm5BSVxokRzDPdSMCUzT4',

  emailjs: {
    publicKey: '',
    serviceId: '',
    templateId: ''
  },

  reviewVerification: {
    codeLength: 6,
    codeExpiryMinutes: 15,
    maxAttempts: 5,
    resendCooldownSeconds: 60
  }
};
