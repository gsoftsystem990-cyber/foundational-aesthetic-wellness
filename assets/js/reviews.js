(function () {
  const STORAGE_KEY = 'faw_patient_reviews';
  const GOOGLE_CACHE_KEY = 'faw_google_reviews_cache';
  const PENDING_KEY = 'faw_pending_review_verification';
  const CACHE_TTL_MS = 60 * 60 * 1000;

  const config = window.FAW_SITE_CONFIG || {};
  const verifyConfig = config.reviewVerification || {};

  function getReviews() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getVerifiedSiteReviews() {
    return getReviews().filter(function (review) {
      return review.verified === true;
    });
  }

  function saveReviews(reviews) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  }

  function addReview({ name, rating, text }) {
    const reviews = getReviews();
    const review = {
      id: 'r_' + Date.now(),
      name: name.trim(),
      rating: Number(rating),
      text: text.trim(),
      date: new Date().toISOString(),
      source: 'site',
      verified: true,
      verifiedAt: new Date().toISOString()
    };
    reviews.unshift(review);
    saveReviews(reviews);
    return review;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function starsHtml(rating) {
    const safe = Math.min(5, Math.max(0, Math.round(rating)));
    return '★'.repeat(safe) + '☆'.repeat(5 - safe);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function maskEmail(email) {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const local = parts[0];
    const masked = local.length <= 2
      ? local.charAt(0) + '***'
      : local.charAt(0) + '***' + local.charAt(local.length - 1);
    return masked + '@' + parts[1];
  }

  function normalizeSiteReview(review) {
    return Object.assign({ source: 'site' }, review);
  }

  function normalizeGoogleReview(review, index) {
    return {
      id: 'google_' + index + '_' + (review.publishTime || index),
      name: (review.authorAttribution && review.authorAttribution.displayName) || 'Google User',
      rating: review.rating || 5,
      text: (review.text && review.text.text) || (review.originalText && review.originalText.text) || '',
      date: review.publishTime || new Date().toISOString(),
      source: 'google'
    };
  }

  function readGoogleCache() {
    try {
      const raw = sessionStorage.getItem(GOOGLE_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
      return cached;
    } catch {
      return null;
    }
  }

  function writeGoogleCache(payload) {
    sessionStorage.setItem(GOOGLE_CACHE_KEY, JSON.stringify(Object.assign({ fetchedAt: Date.now() }, payload)));
  }

  async function fetchGoogleReviews() {
    const placeId = config.googlePlaceId;
    const apiKey = config.googlePlacesApiKey;

    if (!placeId || !apiKey) return null;

    const cached = readGoogleCache();
    if (cached) return cached;

    try {
      const response = await fetch('https://places.googleapis.com/v1/places/' + placeId, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'reviews,rating,userRatingCount'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      const payload = {
        reviews: (data.reviews || []).map(normalizeGoogleReview),
        rating: data.rating || null,
        userRatingCount: data.userRatingCount || null
      };
      writeGoogleCache(payload);
      return payload;
    } catch {
      return null;
    }
  }

  async function loadAllReviews() {
    const siteReviews = getVerifiedSiteReviews().map(normalizeSiteReview);
    const googleData = await fetchGoogleReviews();
    const googleReviews = googleData ? googleData.reviews : [];

    return {
      reviews: googleReviews.concat(siteReviews),
      googleMeta: googleData
        ? { rating: googleData.rating, userRatingCount: googleData.userRatingCount }
        : null
    };
  }

  function computeStats(reviews, googleMeta) {
    const siteOnly = reviews.filter(function (r) { return r.source === 'site'; });

    if (googleMeta && googleMeta.userRatingCount && !siteOnly.length) {
      return {
        count: googleMeta.userRatingCount,
        average: googleMeta.rating,
        label: 'Google Rating'
      };
    }

    if (!reviews.length) return null;

    const sum = reviews.reduce(function (total, review) {
      return total + review.rating;
    }, 0);

    return {
      count: reviews.length,
      average: Math.round((sum / reviews.length) * 10) / 10,
      label: 'Verified Reviews'
    };
  }

  function renderReviewCard(review, showDate) {
    let sourceBadge = '';
    if (review.source === 'google') {
      sourceBadge = '<span class="testi-source">Google Review</span>';
    } else if (review.verified) {
      sourceBadge = '<span class="testi-source testi-source--verified">Verified Review</span>';
    }

    return (
      '<article class="testi-card" data-review-id="' + escapeHtml(review.id) + '" data-source="' + review.source + '">' +
        '<div class="testi-stars" aria-label="' + review.rating + ' out of 5 stars">' + starsHtml(review.rating) + '</div>' +
        '<p class="testi-text">"' + escapeHtml(review.text) + '"</p>' +
        '<p class="testi-author">' + escapeHtml(review.name) + '</p>' +
        sourceBadge +
        (showDate ? '<p class="testi-date">' + formatDate(review.date) + '</p>' : '') +
      '</article>'
    );
  }

  function renderReviewsList(container, reviews, options) {
    const limit = options.limit || null;
    const emptyMessage = options.emptyMessage || 'No verified reviews yet. Be the first to share your experience!';
    const showDate = options.showDate || false;
    const googleUrl = config.googleReviewsUrl;

    let list = reviews.slice();
    if (limit) list = list.slice(0, limit);

    if (!list.length) {
      var emptyHtml = '<p class="reviews-empty">' + escapeHtml(emptyMessage) + '</p>';
      if (googleUrl) {
        emptyHtml +=
          '<p class="reviews-google-cta">' +
            '<a href="' + escapeHtml(googleUrl) + '" class="btn-outline-gold reviews-google-cta__btn" target="_blank" rel="noopener">View Reviews on Google</a>' +
          '</p>';
      }
      container.innerHTML = emptyHtml;
      return;
    }

    container.innerHTML = list.map(function (review) {
      return renderReviewCard(review, showDate);
    }).join('');
  }

  function renderStats(container, reviews, googleMeta) {
    const stats = computeStats(reviews, googleMeta);
    if (!stats) {
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.innerHTML =
      '<div class="rating-stat">' +
        '<div class="rnum">' + stats.count + '</div>' +
        '<div class="rlbl">' + escapeHtml(stats.label) + '</div>' +
      '</div>' +
      '<div class="rating-stat">' +
        '<div class="rnum">' + stats.average + '</div>' +
        '<div class="rlbl">Average Rating</div>' +
      '</div>';
  }

  function renderGoogleNotice() {
    var notice = document.querySelector('[data-reviews-google-notice]');
    if (!notice || config.googlePlacesApiKey) return;

    var googleUrl = config.googleReviewsUrl;
    notice.hidden = false;
    notice.innerHTML =
      '<p><strong>Reviews left on Google</strong> appear on Google Maps, not automatically on this website.</p>' +
      '<p>To show your review here, use the <a href="leave-a-review.html">on-site review form</a> with email verification.</p>' +
      (googleUrl
        ? '<a href="' + escapeHtml(googleUrl) + '" class="btn-outline-gold" target="_blank" rel="noopener">Read Our Google Reviews</a>'
        : '');
  }

  function showFormMessage(form, message, type) {
    var el = form.querySelector('.review-form-message');
    if (!el) return;
    el.textContent = message;
    el.className = 'review-form-message review-form-message--' + type;
  }

  function isEmailJsConfigured() {
    const emailjs = config.emailjs || {};
    return Boolean(emailjs.publicKey && emailjs.serviceId && emailjs.templateId);
  }

  function generateCode() {
    const length = verifyConfig.codeLength || 6;
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  function readPending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writePending(data) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
  }

  function clearPending() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  function canResendCode(email) {
    const key = 'faw_code_sent_' + email.toLowerCase();
    const lastSent = sessionStorage.getItem(key);
    const cooldown = (verifyConfig.resendCooldownSeconds || 60) * 1000;
    if (!lastSent) return true;
    return Date.now() - Number(lastSent) > cooldown;
  }

  function markCodeSent(email) {
    sessionStorage.setItem('faw_code_sent_' + email.toLowerCase(), String(Date.now()));
  }

  async function sendVerificationEmail(email, name, code) {
    const emailjsConfig = config.emailjs || {};

    if (!window.emailjs) {
      throw new Error('Email service failed to load. Please refresh and try again.');
    }

    if (!window.emailjs.initCalled) {
      window.emailjs.init(emailjsConfig.publicKey);
      window.emailjs.initCalled = true;
    }

    await window.emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      to_email: email,
      verification_code: code,
      user_name: name,
      reply_to: email
    });
  }

  async function requestVerificationCode(form, reviewData) {
    if (!isEmailJsConfigured()) {
      showFormMessage(
        form,
        'Email verification is not configured yet. Please contact the site administrator.',
        'error'
      );
      return false;
    }

    const email = reviewData.email.toLowerCase().trim();

    if (!canResendCode(email)) {
      showFormMessage(form, 'Please wait a minute before requesting another code.', 'error');
      return false;
    }

    const code = generateCode();
    const expiryMs = (verifyConfig.codeExpiryMinutes || 15) * 60 * 1000;

    try {
      await sendVerificationEmail(email, reviewData.name, code);
    } catch {
      showFormMessage(form, 'Could not send verification email. Please try again later.', 'error');
      return false;
    }

    writePending({
      code: code,
      email: email,
      expiresAt: Date.now() + expiryMs,
      attempts: 0,
      review: {
        name: reviewData.name,
        rating: reviewData.rating,
        text: reviewData.text
      }
    });

    markCodeSent(email);
    return true;
  }

  function showVerifyStep(form, email) {
    var detailsStep = form.querySelector('#review-step-details');
    var verifyStep = form.querySelector('#review-step-verify');
    var emailEl = form.querySelector('#review-verify-email');

    if (detailsStep) detailsStep.hidden = true;
    if (verifyStep) verifyStep.hidden = false;
    if (emailEl) emailEl.textContent = maskEmail(email);

    var codeInput = form.querySelector('#review-code');
    if (codeInput) {
      codeInput.value = '';
      codeInput.focus();
    }

    showFormMessage(form, 'Verification code sent. Check your email (and spam folder).', 'success');
  }

  function showDetailsStep(form) {
    var detailsStep = form.querySelector('#review-step-details');
    var verifyStep = form.querySelector('#review-step-verify');
    if (detailsStep) detailsStep.hidden = false;
    if (verifyStep) verifyStep.hidden = true;
    showFormMessage(form, '', '');
  }

  function verifyCodeAndSubmit(form, enteredCode) {
    const pending = readPending();
    if (!pending) {
      showFormMessage(form, 'No pending review found. Please request a new verification code.', 'error');
      showDetailsStep(form);
      return false;
    }

    if (Date.now() > pending.expiresAt) {
      clearPending();
      showFormMessage(form, 'Verification code expired. Please request a new code.', 'error');
      showDetailsStep(form);
      return false;
    }

    pending.attempts = (pending.attempts || 0) + 1;
    writePending(pending);

    const maxAttempts = verifyConfig.maxAttempts || 5;
    if (pending.attempts > maxAttempts) {
      clearPending();
      showFormMessage(form, 'Too many failed attempts. Please start over.', 'error');
      showDetailsStep(form);
      return false;
    }

    if (enteredCode.trim() !== pending.code) {
      showFormMessage(
        form,
        'Incorrect code. ' + (maxAttempts - pending.attempts + 1) + ' attempt(s) remaining.',
        'error'
      );
      return false;
    }

    addReview(pending.review);
    clearPending();
    return true;
  }

  function initStarRating(form) {
    var hidden = form.querySelector('[name="rating"]');
    var stars = form.querySelectorAll('.star-rating__btn');
    if (!hidden || !stars.length) return;

    function setRating(value) {
      hidden.value = value;
      stars.forEach(function (btn) {
        var active = Number(btn.dataset.value) <= value;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', btn.dataset.value === String(value) ? 'true' : 'false');
      });
    }

    stars.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setRating(Number(btn.dataset.value));
      });
    });
  }

  function getReviewFormData(form) {
    if (form.company && form.company.value.trim()) {
      return null;
    }

    return {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      rating: form.rating.value,
      text: form.text.value.trim()
    };
  }

  function validateReviewFormData(data, form) {
    if (!data) return false;

    if (!data.name || !data.text || !data.rating) {
      showFormMessage(form, 'Please fill in all required fields and select a rating.', 'error');
      return false;
    }

    if (!data.email || !isValidEmail(data.email)) {
      showFormMessage(form, 'Please enter a valid email address for verification.', 'error');
      return false;
    }

    return true;
  }

  function resetReviewForm(form) {
    form.reset();
    form.querySelectorAll('.star-rating__btn').forEach(function (btn) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-checked', 'false');
    });
    showDetailsStep(form);
  }

  function initReviewForm() {
    var form = document.getElementById('review-form');
    if (!form) return;

    initStarRating(form);

    var sendBtn = form.querySelector('#review-send-code-btn');
    var resendBtn = form.querySelector('#review-resend-code');
    var editBtn = form.querySelector('#review-edit-details');

    if (sendBtn) {
      sendBtn.addEventListener('click', async function () {
        var data = getReviewFormData(form);
        if (!validateReviewFormData(data, form)) return;

        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        var sent = await requestVerificationCode(form, data);

        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Verification Email';

        if (sent) showVerifyStep(form, data.email);
      });
    }

    if (resendBtn) {
      resendBtn.addEventListener('click', async function () {
        var pending = readPending();
        if (!pending) {
          showFormMessage(form, 'Please fill in your review details first.', 'error');
          showDetailsStep(form);
          return;
        }

        resendBtn.disabled = true;
        var sent = await requestVerificationCode(form, Object.assign({ email: pending.email }, pending.review));
        resendBtn.disabled = false;

        if (sent) showFormMessage(form, 'A new verification code has been sent.', 'success');
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', function () {
        showDetailsStep(form);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var verifyStep = form.querySelector('#review-step-verify');
      if (verifyStep && verifyStep.hidden) return;

      var codeInput = form.querySelector('#review-code');
      var enteredCode = codeInput ? codeInput.value : '';

      if (!enteredCode || enteredCode.trim().length < (verifyConfig.codeLength || 6)) {
        showFormMessage(form, 'Please enter the ' + (verifyConfig.codeLength || 6) + '-digit verification code from your email.', 'error');
        return;
      }

      var verified = verifyCodeAndSubmit(form, enteredCode);
      if (!verified) return;

      showFormMessage(form, 'Email verified! Your review has been published.', 'success');
      resetReviewForm(form);

      var redirect = form.dataset.redirect;
      if (redirect) {
        setTimeout(function () {
          window.location.href = redirect;
        }, 1500);
      }
    });

    if (readPending()) {
      var pending = readPending();
      if (pending && Date.now() < pending.expiresAt) {
        showVerifyStep(form, pending.email);
      } else {
        clearPending();
      }
    }
  }

  async function init() {
    renderGoogleNotice();
    initReviewForm();

    var containers = document.querySelectorAll('[data-reviews-list]');
    if (!containers.length) return;

    containers.forEach(function (el) {
      el.classList.add('reviews-loading');
    });

    var data = await loadAllReviews();

    containers.forEach(function (el) {
      el.classList.remove('reviews-loading');
      renderReviewsList(el, data.reviews, {
        limit: el.dataset.reviewsLimit ? parseInt(el.dataset.reviewsLimit, 10) : null,
        emptyMessage: el.dataset.reviewsEmpty || undefined,
        showDate: el.dataset.reviewsShowDate === 'true'
      });
    });

    document.querySelectorAll('[data-reviews-stats]').forEach(function (el) {
      renderStats(el, data.reviews, data.googleMeta);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FAWReviews = {
    getReviews: getVerifiedSiteReviews,
    addReview: addReview,
    loadAllReviews: loadAllReviews
  };
})();
