(function () {
  var config = window.FAW_SITE_CONFIG || {};
  var STORAGE_KEY = 'faw_approved_reviews_v4';

  function emptyList() {
    return [];
  }

  function membershipApiBase() {
    var configured = String(config.membershipApiUrl || '').replace(/\/+$/, '');
    if (configured) return configured;
    var host = window.location.hostname;
    var protocol = window.location.protocol;
    // Local previews: localhost server or opening HTML via file://
    if (host === 'localhost' || host === '127.0.0.1' || protocol === 'file:') {
      return 'http://localhost:4242';
    }
    return '';
  }

  function readLocalCache() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return emptyList();
    }
  }

  function writeLocalCache(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
    } catch (e) { /* ignore */ }
  }

  function cleanReview(review) {
    if (!review || !review.id || !review.name || !review.text || !review.rating) return null;
    return {
      id: String(review.id),
      name: String(review.name).trim(),
      rating: Number(review.rating),
      text: String(review.text).trim(),
      date: review.date || review.created_at || new Date().toISOString(),
      verified: true,
      source: 'site',
      approvedAt: review.approvedAt || review.approved_at || ''
    };
  }

  function normalizeList(data) {
    var list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.approved)) list = data.approved;
    else if (data && Array.isArray(data.record)) list = data.record;
    return list.map(cleanReview).filter(Boolean).sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  async function fetchSeededReviews() {
    var base = document.body.getAttribute('data-base') || '';
    try {
      var res = await fetch(base + 'assets/data/approved-reviews.json?_=' + Date.now(), {
        cache: 'no-store'
      });
      if (!res.ok) return emptyList();
      return normalizeList(await res.json());
    } catch (e) {
      return emptyList();
    }
  }

  async function fetchApiApprovedReviews() {
    var api = membershipApiBase();
    if (!api) return emptyList();
    try {
      var res = await fetch(api + '/api/reviews?_=' + Date.now(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) return emptyList();
      return normalizeList(await res.json());
    } catch (e) {
      return emptyList();
    }
  }

  function mergeReviews() {
    var map = {};
    Array.prototype.slice.call(arguments).forEach(function (list) {
      (list || []).forEach(function (item) {
        var review = cleanReview(item);
        if (review) map[review.id] = review;
      });
    });
    return Object.keys(map).map(function (id) { return map[id]; }).sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  async function getPublicReviews() {
    var apiReviews = await fetchApiApprovedReviews();
    var seeded = await fetchSeededReviews();
    // API-approved reviews are primary. Seeded JSON is only a fallback when API is empty/unavailable.
    var list = apiReviews.length ? apiReviews : seeded;
    if (apiReviews.length && seeded.length) list = mergeReviews(apiReviews, seeded);
    writeLocalCache(list);
    return list.length ? list : readLocalCache();
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

  async function submitPendingReview(payload) {
    var api = membershipApiBase();
    if (!api) {
      throw new Error('Review service is currently unavailable. Please try again later or call the office.');
    }
    var res = await fetch(api + '/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || 'Could not submit your review. Please try again.');
    }
    return data;
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

      try {
        await submitPendingReview({
          name: data.name,
          email: data.email.toLowerCase(),
          rating: Number(data.rating),
          text: data.text,
          company: form.company ? form.company.value : ''
        });
        showFormMessage(
          form,
          'Thank you! Your review was submitted. It will appear on the website after our team approves it in the admin panel.',
          'success'
        );
        form.reset();
        form.querySelectorAll('.star-rating__btn').forEach(function (starBtn) {
          starBtn.classList.remove('is-active');
          starBtn.setAttribute('aria-checked', 'false');
        });
      } catch (err) {
        showFormMessage(form, err.message || 'Could not submit your review. Please try again.', 'error');
      } finally {
        submitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Review';
        }
      }
    });
  }

  function initApprovePageNotice() {
    var statusEl = document.getElementById('approve-status');
    var detailEl = document.getElementById('approve-detail');
    var btn = document.getElementById('approve-confirm-btn');
    if (!statusEl) return;
    if (btn) btn.hidden = true;
    statusEl.textContent = 'Use the staff admin panel';
    statusEl.className = 'approve-status approve-status--info';
    if (detailEl) {
      detailEl.innerHTML =
        '<p>Email approval links are no longer used. Sign in to the staff admin panel and open the <strong>Comments</strong> tab to approve or reject reviews.</p>' +
        '<p class="field-hint">Admin URL: your payment API host + <code>/admin</code> (for example <code>http://localhost:4242/admin</code>).</p>';
    }
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

  initApprovePageNotice();
  initReviewForm();
  initDisplays();
})();
