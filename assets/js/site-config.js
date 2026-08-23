/**
 * Site configuration
 * All form and review notifications are emailed to notifyEmail via FormSubmit.
 *
 * Reviews stay off the site until you open the email Approve link and click Publish.
 * Live GitHub Pages publishing requires reviewsBinId (run SETUP-REVIEWS-STORAGE.bat once).
 */
window.FAW_SITE_CONFIG = {
  notifyEmail: 'malikkhan0225@gmail.com',

  // Optional: get a free access key at https://web3forms.com
  web3formsAccessKey: '',

  // Required for live review publishing on GitHub Pages
  // Run SETUP-REVIEWS-STORAGE.bat once, then DEPLOY-GITHUB-PAGES.bat
  reviewsBinId: '',
  reviewsBinKey: '',

  // Live public website URL (GitHub Pages).
  publicSiteUrl: 'https://gsoftsystem990-cyber.github.io/foundational-aesthetic-wellness/',

  // Membership checkout API (Node server). Leave empty on GitHub Pages until
  // the Stripe server is deployed. Local: http://localhost:4242
  membershipApiUrl: '',

  // Used to verify approve links from email
  reviewApproveSecret: 'faw-approve-2026-mkhan',

  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: ''
};
