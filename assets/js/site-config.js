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

  // Live public website URL (custom domain).
  publicSiteUrl: 'https://gsoftsystem990-cyber.github.io/foundational-aesthetic-wellness/',

  // Public origin of the membership API (not a Stripe secret).
  // Empty = same origin as the website (recommended when Express serves site + /admin).
  // Local file/localhost previews still fall back to http://localhost:4242 in JS.
  membershipApiUrl: '',

  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: ''
};
