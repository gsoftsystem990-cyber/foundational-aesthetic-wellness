/**
 * Site configuration
 * All form and review notifications are emailed to notifyEmail via FormSubmit.
 *
 * Reviews stay off the site until you open the email Approve link and click Publish.
 */
window.FAW_SITE_CONFIG = {
  notifyEmail: 'malikkhan0225@gmail.com',

  // Live public website URL (GitHub Pages).
  // Leave empty to auto-detect on github.io, or run deploy-github-pages.ps1 to set this.
  publicSiteUrl: 'https://gsoftsystem990-cyber.github.io/foundational-aesthetic-wellness/',

  // Used to verify approve links from email
  reviewApproveSecret: 'faw-approve-2026-mkhan',

  googlePlaceId: 'ChIJgxBm5BSVxokRzDPdSMCUzT4',
  googlePlacesApiKey: '',
  googleReviewsUrl: ''
};
