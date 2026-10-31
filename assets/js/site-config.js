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

  // Live public website URL (custom domain on your Node host — not GitHub Pages alone).
  // Update this when you deploy to production web hosting.
  publicSiteUrl: 'https://gsoftsystem990-cyber.github.io/foundational-aesthetic-wellness/',

  // Public origin of the membership API (not a Stripe secret).
  // Empty = same origin as the website (required when Express serves site + /admin on one host).
  // Local file/localhost previews still fall back to http://localhost:4242 in JS.
  membershipApiUrl: '',

  practicePhone: '267-281-8236',
  practicePhoneTel: '+12672818236',

  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: '',

  // Practice location — embed needs no API key; directions opens Google Maps.
  practiceAddress: '399 Arcola Road, Suite 100, Collegeville, PA 19426',
  mapsEmbedUrl: 'https://www.google.com/maps?q=399+Arcola+Road,+Suite+100,+Collegeville,+PA+19426&z=16&output=embed',
  mapsDirectionsUrl: 'https://maps.app.goo.gl/FrP8BQQtknxPzfUM8'
};
