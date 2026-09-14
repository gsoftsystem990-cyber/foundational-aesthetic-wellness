/**
 * Site configuration
 *
 * Reviews: patients submit to the membership API as pending.
 * Staff approve/reject in /admin → Comments. Only approved reviews show on the site.
 */
window.FAW_SITE_CONFIG = {
  // Legacy JSONBin settings (optional fallback). Prefer membership API reviews.
  reviewsBinId: '',
  reviewsBinKey: '',

  // Live public website URL (GitHub Pages).
  publicSiteUrl: 'https://gsoftsystem990-cyber.github.io/foundational-aesthetic-wellness/',

  // Public origin of the membership API (not a Stripe secret).
  // Local default is http://localhost:4242 when this value is empty.
  // Required on GitHub Pages so reviews can submit/load from the API.
  membershipApiUrl: '',

  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: ''
};
