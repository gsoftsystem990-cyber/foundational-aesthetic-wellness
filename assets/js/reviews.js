(function () {
  var APPROVED_KEY = 'faw_approved_reviews_v2';
  var LEGACY_KEY = 'faw_patient_reviews';
  var config = window.FAW_SITE_CONFIG || {};
  var approveSecret = config.reviewApproveSecret || 'faw-approve-2026-mkhan';
  var notifyEmail = config.notifyEmail || 'malikkhan0225@gmail.com';
  var reviewsBinId = String(config.reviewsBinId || '').trim();
  var reviewsBinKey = String(config.reviewsBinKey || '').trim();

  function emptyList() {
    return [];
  }

  function readLocalApproved() {
    try {
      var raw = localStorage.getItem(APPROVED_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return emptyList();
    }
  }

  function writeLocalApproved(list) {
    localStorage.setItem(APPROVED_KEY, JSON.stringify(list));
  }

  function upsertLocal(review) {
    var list = readLocalApproved().filter(function (r) { return r && r.id !== review.id; });
    list.unshift(review);
    writeLocalApproved(list);
    return list;
  }

  function readLegacyLocal() {
    try {
      var raw = localStorage.getItem(LEGACY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return emptyList();
      return parsed.filter(function (r) {
        return r && r.verified !== false && r.name && r.text && r.rating;
      }).map(function (r) {
        return {
          id: r.id || ('legacy_' + Date.now()),
          name: r.name,
          email: r.email || '',
          rating: Number(r.rating),
          text: r.text,
          date: r.date || new Date().toISOString(),
          verified: true,
          source: 'site'
        };
      });
    } catch (e) {
      return emptyList();
    }
  }

  function apiBase() {
    return window.location.origin;
  }

  function publicSiteBase() {
    var configured = String(config.publicSiteUrl || '').replace(/\/+$/, '');
    if (configured && configured.indexOf('loca.lt') === -1 && configured.indexOf('trycloudflare.com') === -1) {
      return configured;
    }
    var host = window.location.hostname;
    if (host.endsWith('github.io')) {
      var segs = window.location.pathname.split('/').filter(Boolean);
      var repo = segs[0] || 'foundational-aesthetic-wellness';
      return window.location.protocol + '//' + host + '/' + repo;
    }
    if (configured) return configured;
    return window.location.origin.replace(/\/+$/, '');
  }

  function isGitHubPages() {
    return window.location.hostname.endsWith('github.io');
  }

  function hasCloudStorage() {
    return !!(reviewsBinId && reviewsBinKey);
  }

  async function fetchApiReviews() {
    try {
      var res = await fetch(apiBase() + '/api/reviews?_=' + Date.now(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) return emptyList();
      var data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.approved)) return data.approved;
      return emptyList();
    } catch (e) {
      return emptyList();
    }
  }

  async function fetchSeededReviews() {
    var base = document.body.getAttribute('data-base') || '';
    var url = base + 'assets/data/approved-reviews.json';
    try {
      var res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return emptyList();
      var data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.approved)) return data.approved;
      return emptyList();
    } catch (e) {
      return emptyList();
    }
  }

  async function fetchCloudReviews() {
    if (!reviewsBinId) return emptyList();
    try {
      var headers = { Accept: 'application/json' };
      if (reviewsBinKey) headers['X-Master-Key'] = reviewsBinKey;
      var res = await fetch('https://api.jsonbin.io/v3/b/' + reviewsBinId + '/latest?_=' + Date.now(), {
        headers: headers,
        cache: 'no-store'
      });
      if (!res.ok) return emptyList();
      var data = await res.json();
      var record = data.record;
      if (Array.isArray(record)) return record;
      if (record && Array.isArray(record.approved)) return record.approved;
      return emptyList();
    } catch (e) {
      return emptyList();
    }
  }

  async function saveApiReview(review) {
    try {
      var res = await fetch(apiBase() + '/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ review: review })
      });
      if (!res.ok) return false;
      var data = await res.json();
      if (data && Array.isArray(data.approved)) {
        writeLocalApproved(data.approved);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async function saveCloudReview(review) {
    if (!hasCloudStorage()) {
      throw new Error(
        'Review cloud storage is not configured. Run SETUP-REVIEWS-STORAGE.bat once, then DEPLOY-GITHUB-PAGES.bat.'
      );
    }

    var current = await fetchCloudReviews();
    var list = mergeReviews(current, [review]);

    var res = await fetch('https://api.jsonbin.io/v3/b/' + reviewsBinId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Master-Key': reviewsBinKey,
        'X-Bin-Versioning': 'false'
      },
      body: JSON.stringify(list)
    });

    if (!res.ok) {
      var errText = '';
      try { errText = await res.text(); } catch (e) { /* ignore */ }
      throw new Error(errText || 'Could not save the approved review online.');
    }
    return true;
  }

  function mergeReviews() {
    var map = {};
    var args = Array.prototype.slice.call(arguments);
    args.forEach(function (list) {
      (list || []).forEach(function (review) {
        if (!review || !review.id) return;
        if (!review.name || !review.text || !review.rating) return;
        map[review.id] = {
          id: review.id,
          name: String(review.name),
          email: String(review.email || ''),
          rating: Number(review.rating),
          text: String(review.text),
          date: review.date || '',
          verified: true,
          source: 'site',
          approvedAt: review.approvedAt || ''
        };
      });
    });
    return Object.keys(map).map(function (id) { return map[id]; }).sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  function starsHtml(rating) {
    var full = Math.round(Number(rating) || 0);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(full);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function toBase64Url(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(str) {
    var cleaned = String(str || '')
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9\-_%=]/g, '');
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    while (cleaned.length % 4) cleaned += '=';
    return decodeURIComponent(escape(atob(cleaned)));
  }

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function signPayload(payloadB64) {
    return simpleHash(payloadB64 + '|' + approveSecret);
  }

  function buildApproveUrl(review) {
    var payload = {
      i: review.id,
      n: review.name,
      e: review.email,
      r: Number(review.rating),
      t: review.text,
      d: review.date
    };
    var encoded = toBase64Url(JSON.stringify(payload));
    var sig = signPayload(encoded);
    var origin = publicSiteBase();
    var page = origin + '/pages/approve-review.html';
    return page + '?d=' + encodeURIComponent(encoded) + '&s=' + encodeURIComponent(sig);
  }

  function normalizeReviewData(raw) {
    if (!raw) return null;
    var review = {
      id: raw.i || raw.id,
      name: raw.n || raw.name,
      email: raw.e || raw.email || '',
      rating: Number(raw.r || raw.rating),
      text: raw.t || raw.text,
      date: raw.d || raw.date || new Date().toISOString()
    };
    if (!review.name || !review.text || !review.rating) return null;
    if (!review.id) review.id = 'r_' + Date.now();
    return review;
  }

  function parseApproveParams(search) {
    var params = new URLSearchParams(search || window.location.search);
    var encoded = params.get('d') || '';
    var sig = params.get('s') || '';

    encoded = decodeURIComponent(String(encoded).replace(/\s+/g, ''));
    sig = decodeURIComponent(String(sig).replace(/\s+/g, ''));

    if (!encoded || !sig) return null;
    if (signPayload(encoded) !== sig) {
      var alt = String(params.get('d') || '').replace(/\s+/g, '');
      if (signPayload(alt) === sig) encoded = alt;
      else return null;
    }

    try {
      return normalizeReviewData(JSON.parse(fromBase64Url(encoded)));
    } catch (e) {
      return null;
    }
  }

  function computeStats(reviews) {
    if (!reviews.length) return null;
    var sum = reviews.reduce(function (total, review) {
      return total + Number(review.rating);
    }, 0);
    return {
      count: reviews.length,
      average: Math.round((sum / reviews.length) * 10) / 10,
      label: 'Verified Reviews'
    };
  }

  function renderReviewCard(review, showDate) {
    return (
      '<article class="testi-card" data-review-id="' + escapeHtml(review.id) + '">' +
        '<div class="testi-stars" aria-label="' + review.rating + ' out of 5 stars">' + starsHtml(review.rating) + '</div>' +
        '<p class="testi-text">"' + escapeHtml(review.text) + '"</p>' +
        '<p class="testi-author">' + escapeHtml(review.name) + '</p>' +
        (showDate ? '<p class="testi-date">' + formatDate(review.date) + '</p>' : '') +
      '</article>'
    );
  }

  function renderReviewsList(container, reviews, options) {
    var limit = options.limit || null;
    var emptyMessage = options.emptyMessage || 'No reviews yet. Be the first to share your experience!';
    var showDate = options.showDate || false;
    var list = reviews.slice();
    if (limit) list = list.slice(0, Number(limit));

    if (!list.length) {
      container.innerHTML = '<p class="reviews-empty">' + escapeHtml(emptyMessage) + '</p>';
      return;
    }

    container.innerHTML = list.map(function (review) {
      return renderReviewCard(review, showDate);
    }).join('');
  }

  function renderStats(container, reviews) {
    var stats = computeStats(reviews);
    if (!stats) {
      container.hidden = true;
      container.innerHTML = '';
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

  function showFormMessage(form, message, type) {
    var el = form.querySelector('.review-form-message');
    if (!el) return;
    el.textContent = message;
    el.className = 'review-form-message review-form-message--' + type;
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

  async function notifyOwnerForApproval(review, approveUrl) {
    var siteUrl = publicSiteBase();
    var body = {
      _subject: 'ACTION NEEDED: Approve review from ' + review.name,
      _url: siteUrl + '/pages/leave-a-review.html',
      type: 'Review Pending Approval',
      patient_name: review.name,
      patient_email: review.email,
      rating: review.rating + ' / 5 stars',
      review_text: review.text,
      approve_link: approveUrl,
      message:
        'A new patient review is waiting for approval.\n\n' +
        'Patient: ' + review.name + '\n' +
        'Email: ' + review.email + '\n' +
        'Rating: ' + review.rating + ' / 5\n\n' +
        'Review:\n' + review.text + '\n\n' +
        'OPEN THIS LINK TO APPROVE:\n' + approveUrl
    };

    if (window.FAWForms && window.FAWForms.sendEmail) {
      await window.FAWForms.sendEmail(body);
      return;
    }

    var res = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(notifyEmail), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(Object.assign({ _template: 'table', _captcha: 'false' }, body))
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || (data && (data.success === 'false' || data.success === false))) {
      var msg = (data && data.message) || 'Could not send your review for approval. Please try again.';
      if (/activation|activate form/i.test(msg)) {
        msg =
          'One-time email setup is required. Check ' + notifyEmail +
          ' (and spam) for a FormSubmit activation email, click the link, then submit again.';
      }
      throw new Error(msg);
    }
  }

  async function publishReview(data) {
    var review = {
      id: data.id,
      name: String(data.name).trim(),
      email: String(data.email || '').trim().toLowerCase(),
      rating: Number(data.rating),
      text: String(data.text).trim(),
      date: data.date || new Date().toISOString(),
      verified: true,
      source: 'site',
      approvedAt: new Date().toISOString()
    };

    if (await saveApiReview(review)) {
      upsertLocal(review);
      return review;
    }

    if (hasCloudStorage()) {
      await saveCloudReview(review);
      upsertLocal(review);
      return review;
    }

    if (isGitHubPages()) {
      throw new Error(
        'Review storage is not set up for the live website. ' +
        'On your PC run SETUP-REVIEWS-STORAGE.bat once, then DEPLOY-GITHUB-PAGES.bat.'
      );
    }

    upsertLocal(review);
    return review;
  }

  async function approveReviewFromParams() {
    var statusEl = document.getElementById('approve-status');
    var detailEl = document.getElementById('approve-detail');
    var btn = document.getElementById('approve-confirm-btn');
    var approving = false;

    function setStatus(title, detail, type) {
      if (statusEl) {
        statusEl.textContent = title;
        statusEl.className = 'approve-status approve-status--' + (type || 'info');
      }
      if (detailEl && typeof detail === 'string') detailEl.textContent = detail || '';
    }

    var data = parseApproveParams();
    if (!data) {
      setStatus(
        'Invalid approval link',
        'This link is missing data or was altered by the email app. Please open the latest approval email and click the full Approve Link.',
        'error'
      );
      if (btn) btn.hidden = true;
      return;
    }

    var existing = await getPublicReviews();
    if (existing.some(function (r) { return r.id === data.id; })) {
      setStatus(
        'Already approved',
        'This review was already published. You can view it on the Reviews page.',
        'success'
      );
      if (detailEl) {
        detailEl.innerHTML =
          '<p class="approve-preview">"' + escapeHtml(data.text) + '"</p>' +
          '<p><a class="btn-gold" href="reviews.html">View Reviews</a></p>';
      }
      if (btn) btn.hidden = true;
      return;
    }

    if (btn) {
      btn.hidden = false;
      btn.disabled = false;
      btn.onclick = async function () {
        if (approving) return;
        approving = true;
        btn.disabled = true;
        btn.textContent = 'Publishing…';
        try {
          var review = await publishReview(data);
          setStatus(
            'Review approved',
            review.name + ' — ' + review.rating + '/5 stars is now live on the website for all visitors.',
            'success'
          );
          if (detailEl) {
            detailEl.innerHTML =
              '<p class="approve-preview">"' + escapeHtml(review.text) + '"</p>' +
              '<p><a class="btn-gold" href="reviews.html">View Reviews</a> ' +
              '<a class="btn-outline-gold" href="../index.html" style="margin-left:10px">Go Home</a></p>';
          }
          btn.hidden = true;
        } catch (err) {
          setStatus('Could not approve review', err.message || 'Please try again.', 'error');
          btn.disabled = false;
          btn.textContent = 'Approve & Publish Review';
          approving = false;
        }
      };
    }

    setStatus(
      'Ready to approve',
      data.name + ' rated ' + data.rating + '/5. Click the button below to publish this review on the website.',
      'info'
    );
    if (detailEl) {
      detailEl.innerHTML =
        '<p class="approve-preview">"' + escapeHtml(data.text) + '"</p>' +
        '<p style="margin-bottom:18px;color:#666">From: ' + escapeHtml(data.name) +
        (data.email ? ' (' + escapeHtml(data.email) + ')' : '') + '</p>';
    }
  }

  function initReviewForm() {
    var form = document.getElementById('review-form');
    if (!form) return;

    initStarRating(form);
    var submitBtn = form.querySelector('.form-submit-btn');
    var submitting = false;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (submitting) return;
      if (form.company && form.company.value.trim()) return;

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        rating: form.rating.value,
        text: form.text.value.trim()
      };

      if (!data.name || !data.text || !data.rating) {
        showFormMessage(form, 'Please fill in all required fields and select a rating.', 'error');
        return;
      }
      if (!data.email || !isValidEmail(data.email)) {
        showFormMessage(form, 'Please enter a valid email address.', 'error');
        return;
      }

      submitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      var review = {
        id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: data.name,
        email: data.email.toLowerCase(),
        rating: Number(data.rating),
        text: data.text,
        date: new Date().toISOString()
      };

      try {
        var approveUrl = buildApproveUrl(review);
        await notifyOwnerForApproval(review, approveUrl);
        showFormMessage(
          form,
          'Thank you! Your review was sent for approval. It will appear on the website after our team confirms it.',
          'success'
        );
        form.reset();
        form.querySelectorAll('.star-rating__btn').forEach(function (starBtn) {
          starBtn.classList.remove('is-active');
          starBtn.setAttribute('aria-checked', 'false');
        });
      } catch (err) {
        showFormMessage(form, err.message || 'Could not send your review. Please try again.', 'error');
      } finally {
        submitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Review';
        }
      }
    });
  }

  async function getPublicReviews() {
    var cloud = hasCloudStorage() ? await fetchCloudReviews() : emptyList();
    var api = await fetchApiReviews();
    var seeded = await fetchSeededReviews();
    var local = readLocalApproved();

    var merged = mergeReviews(seeded, cloud, api, local);
    writeLocalApproved(merged);
    return merged;
  }

  async function initDisplays() {
    var reviews = await getPublicReviews();

    document.querySelectorAll('[data-reviews-list]').forEach(function (container) {
      renderReviewsList(container, reviews, {
        limit: container.getAttribute('data-reviews-limit'),
        emptyMessage: container.getAttribute('data-reviews-empty') || undefined,
        showDate: container.getAttribute('data-reviews-show-date') === 'true'
      });
    });

    document.querySelectorAll('[data-reviews-stats]').forEach(function (container) {
      renderStats(container, reviews);
    });
  }

  if (document.getElementById('approve-status')) {
    approveReviewFromParams();
  }

  initReviewForm();
  initDisplays();
})();
