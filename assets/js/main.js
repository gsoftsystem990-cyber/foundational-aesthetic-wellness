function openMNav() {
  document.getElementById('mNav').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMNav() {
  document.getElementById('mNav').classList.remove('open');
  document.body.style.overflow = '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function sendSiteEmail(payload) {
  var config = window.FAW_SITE_CONFIG || {};
  var notifyEmail = config.notifyEmail || 'malikkhan0225@gmail.com';
  var body = Object.assign({
    _template: 'table',
    _captcha: 'false'
  }, payload);

  var res = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(notifyEmail), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  var data = await res.json().catch(function () { return {}; });
  if (!res.ok || (data && (data.success === 'false' || data.success === false))) {
    throw new Error((data && data.message) || 'Unable to send. Please try again.');
  }

  return data;
}

async function submitForm(e) {
  e.preventDefault();
  var form = document.getElementById('cForm');
  var okMsg = document.getElementById('formOk');
  var btn = form ? form.querySelector('.form-submit-btn') : null;
  if (!form) return;

  var firstName = (document.getElementById('fn') || {}).value || '';
  var lastName = (document.getElementById('ln') || {}).value || '';
  var email = (document.getElementById('em') || {}).value || '';
  var phone = (document.getElementById('ph') || {}).value || '';
  var serviceEl = document.getElementById('svc');
  var service = serviceEl ? serviceEl.value : '';
  var message = (document.getElementById('msg') || {}).value || '';

  firstName = firstName.trim();
  lastName = lastName.trim();
  email = email.trim();
  phone = phone.trim();
  message = message.trim();

  if (!firstName || !lastName || !isValidEmail(email)) {
    alert('Please enter your name and a valid email address.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  try {
    await sendSiteEmail({
      _subject: 'New Contact Message — Foundational Aesthetic Wellness',
      type: 'Contact Form',
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone || 'Not provided',
      service: service || 'Not specified',
      message: message || 'No message provided'
    });
    form.reset();
    if (okMsg) {
      okMsg.style.display = 'block';
      setTimeout(function () {
        okMsg.style.display = 'none';
      }, 6000);
    }
  } catch (err) {
    alert(err.message || 'Could not send your message. Please try again.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  }
}

function openBookModal() {
  var modal = document.getElementById('bookModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  var first = modal.querySelector('input, select, textarea, button');
  if (first) first.focus();
}

function closeBookModal() {
  var modal = document.getElementById('bookModal');
  if (!modal) return;
  modal.hidden = true;
  if (!document.getElementById('mNav') || !document.getElementById('mNav').classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function initBookModal() {
  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest('[data-open-book-modal]');
    if (openBtn) {
      e.preventDefault();
      openBookModal();
      return;
    }
    if (e.target.closest('[data-close-book-modal]')) {
      closeBookModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeBookModal();
  });

  var form = document.getElementById('bookForm');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var msgEl = document.getElementById('bookFormMsg');
    var okMsg = document.getElementById('bookFormOk');
    var btn = document.getElementById('bookSubmitBtn');

    var firstName = form.firstName.value.trim();
    var lastName = form.lastName.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();
    var service = form.service.value;
    var preferred = form.preferred.value.trim();
    var message = form.message.value.trim();

    function setMsg(text, type) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.className = 'book-form-message' + (type ? ' book-form-message--' + type : '');
    }

    if (!firstName || !lastName || !isValidEmail(email) || !phone) {
      setMsg('Please fill in your name, email, and phone number.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    setMsg('');

    try {
      await sendSiteEmail({
        _subject: 'New Booking Request — Foundational Aesthetic Wellness',
        type: 'Booking Request',
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        service: service || 'Not specified',
        preferred_time: preferred || 'Not specified',
        message: message || 'No notes provided'
      });
      form.reset();
      setMsg('');
      if (okMsg) {
        okMsg.style.display = 'block';
        setTimeout(function () {
          okMsg.style.display = 'none';
          closeBookModal();
        }, 2500);
      } else {
        closeBookModal();
      }
    } catch (err) {
      setMsg(err.message || 'Could not send your request. Please try again.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Booking Request';
      }
    }
  });
}

document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var t = document.querySelector(this.getAttribute('href'));
    if (t) {
      e.preventDefault();
      window.scrollTo({ top: t.offsetTop - 100, behavior: 'smooth' });
      closeMNav();
    }
  });
});

function markReveal(el, cls) {
  el.classList.add(cls || 'reveal');
}

document.querySelectorAll('.service-tile').forEach(function (el, i) {
  markReveal(el, 'reveal-scale');
  el.style.transitionDelay = (i % 3) * 0.1 + 's';
});

document.querySelectorAll('.stat-item').forEach(function (el, i) {
  markReveal(el, 'reveal');
  el.style.transitionDelay = i * 0.12 + 's';
});

document.querySelectorAll('.testi-card').forEach(function (el, i) {
  markReveal(el, 'reveal');
  el.style.transitionDelay = i * 0.1 + 's';
});

document.querySelectorAll('.welcome-img-wrap, .provider-img-wrap').forEach(function (el) {
  markReveal(el, 'reveal-left');
});
document.querySelectorAll('.welcome-text, .provider-text').forEach(function (el) {
  markReveal(el, 'reveal-right');
});
document.querySelectorAll('.contact-info').forEach(function (el) {
  markReveal(el, 'reveal-left');
});
document.querySelectorAll('.contact-form-box').forEach(function (el) {
  markReveal(el, 'reveal-right');
});
document.querySelectorAll('.section-title-center, .section-eyebrow-center, .section-sub-center').forEach(function (el) {
  markReveal(el, 'reveal');
});
document.querySelectorAll('.page-body > *, .treatment-feature-img').forEach(function (el, i) {
  if (el.tagName === 'SCRIPT') return;
  markReveal(el, 'reveal');
  el.style.transitionDelay = Math.min(i * 0.06, 0.4) + 's';
});

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function (el) {
    io.observe(el);
  });

  document.querySelectorAll('.stat-num').forEach(function (el) {
    var finalText = el.textContent.trim();
    var match = finalText.match(/^(\d+)(\+?)$/);
    if (!match) return;
    var target = parseInt(match[1], 10);
    var suffix = match[2] || '';
    el.dataset.target = String(target);
    el.dataset.suffix = suffix;
    el.textContent = '0' + suffix;

    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var node = entry.target;
        var end = parseInt(node.dataset.target, 10);
        var endSuffix = node.dataset.suffix || '';
        var start = performance.now();
        var duration = 1200;
        function tick(now) {
          var p = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          node.textContent = Math.round(end * eased) + endSuffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        nio.unobserve(node);
      });
    }, { threshold: 0.4 });
    nio.observe(el);
  });
} else {
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(function (el) {
    el.classList.add('is-visible');
  });
}

initBookModal();
