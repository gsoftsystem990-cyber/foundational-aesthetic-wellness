function openMNav() {
  var nav = document.getElementById('mNav');
  var btn = document.querySelector('.hamburger');
  if (!nav) return;
  nav.hidden = false;
  requestAnimationFrame(function () {
    nav.classList.add('open');
  });
  document.body.style.overflow = 'hidden';
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function closeMNav() {
  var nav = document.getElementById('mNav');
  var btn = document.querySelector('.hamburger');
  if (!nav) return;
  nav.classList.remove('open');
  document.body.style.overflow = '';
  if (btn) btn.setAttribute('aria-expanded', 'false');
  setTimeout(function () {
    if (!nav.classList.contains('open')) nav.hidden = true;
  }, 280);
}

function initMobileNavExtras() {
  var nav = document.getElementById('mNav');
  if (!nav || nav.dataset.ready === '1') return;
  nav.dataset.ready = '1';

  nav.querySelectorAll('[data-mnav-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.mnav-group');
      var sub = group ? group.querySelector('.mnav-sub') : null;
      if (!sub) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      sub.hidden = open;
      group.classList.toggle('is-open', !open);
    });
  });

  var search = document.getElementById('mnavSearch');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      nav.querySelectorAll('.mnav-item[data-mnav-label], .mnav-group').forEach(function (el) {
        if (el.classList.contains('mnav-group')) {
          var toggle = el.querySelector('[data-mnav-toggle]');
          var label = (toggle && toggle.getAttribute('data-mnav-label')) || '';
          var subText = Array.prototype.map.call(el.querySelectorAll('.mnav-sub a'), function (a) {
            return a.textContent || '';
          }).join(' ').toLowerCase();
          var match = !q || label.toLowerCase().indexOf(q) !== -1 || subText.indexOf(q) !== -1;
          el.hidden = !match;
          if (match && q && toggle && subText.indexOf(q) !== -1) {
            toggle.setAttribute('aria-expanded', 'true');
            var sub = el.querySelector('.mnav-sub');
            if (sub) sub.hidden = false;
            el.classList.add('is-open');
          }
          return;
        }
        var itemLabel = (el.getAttribute('data-mnav-label') || el.textContent || '').toLowerCase();
        el.hidden = !(!q || itemLabel.indexOf(q) !== -1);
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) closeMNav();
  });
}

document.addEventListener('DOMContentLoaded', initMobileNavExtras);
if (document.readyState !== 'loading') initMobileNavExtras();

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

function membershipApiBase() {
  var config = window.FAW_SITE_CONFIG || {};
  if (config.membershipApiUrl) return String(config.membershipApiUrl).replace(/\/$/, '');
  // Local previews: localhost server or opening HTML via file://
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') {
    return 'http://localhost:4242';
  }
  return '';
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

function todayIsoDate() {
  var today = new Date();
  return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
}

function openBookModal() {
  var modal = document.getElementById('bookModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  var dateInput = document.getElementById('book-date');
  if (dateInput) {
    var iso = todayIsoDate();
    dateInput.min = iso;
    if (!dateInput.value || dateInput.value < iso) dateInput.value = iso;
  }
  renderBookingAlternatives([]);
  if (typeof window.loadBookingSlots === 'function') window.loadBookingSlots();
  var first = modal.querySelector('input:not([type="hidden"]), select, textarea, button');
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

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function renderBookingAlternatives(list) {
  var box = document.getElementById('bookAlternatives');
  if (!box) return;
  box.innerHTML = '';
  if (!list || !list.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  var title = document.createElement('p');
  title.className = 'book-alternatives__title';
  title.textContent = 'Available alternative slots:';
  box.appendChild(title);
  var row = document.createElement('div');
  row.className = 'book-alternatives__list';
  list.forEach(function (item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-alt-slot';
    btn.textContent = item.label || item.slot;
    btn.addEventListener('click', function () {
      var dateInput = document.getElementById('book-date');
      var slotSelect = document.getElementById('book-slot');
      if (dateInput && item.date) dateInput.value = item.date;
      if (typeof window.loadBookingSlots === 'function') {
        window.loadBookingSlots().then(function () {
          selectBookingSlot(item.slot);
        });
      } else if (slotSelect) {
        slotSelect.value = item.slot;
      }
      box.hidden = true;
      var msgEl = document.getElementById('bookFormMsg');
      if (msgEl) {
        msgEl.textContent = 'Selected: ' + (item.label || item.slot) + '. You can submit again.';
        msgEl.className = 'book-form-message book-form-message--success';
      }
    });
    row.appendChild(btn);
  });
  box.appendChild(row);
}

function selectBookingSlot(slotValue) {
  var slotSelect = document.getElementById('book-slot');
  var grid = document.getElementById('bookSlotGrid');
  if (slotSelect) slotSelect.value = slotValue || '';
  if (!grid) return;
  Array.prototype.forEach.call(grid.querySelectorAll('.book-slot-btn'), function (btn) {
    var on = btn.getAttribute('data-slot') === slotValue && !btn.disabled;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function renderSlotGrid(slots) {
  var grid = document.getElementById('bookSlotGrid');
  var hint = document.getElementById('bookSlotHint');
  var slotSelect = document.getElementById('book-slot');
  if (!grid || !slotSelect) return;

  grid.innerHTML = '';
  grid.hidden = false;
  slotSelect.innerHTML = '<option value="">Select a time...</option>';

  var availableCount = 0;
  (slots || []).forEach(function (s) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-slot-btn' + (s.available ? '' : ' is-booked');
    btn.textContent = s.time;
    btn.setAttribute('data-slot', s.slot);
    btn.disabled = !s.available;
    btn.setAttribute('aria-pressed', 'false');
    if (s.available) {
      availableCount += 1;
      var opt = document.createElement('option');
      opt.value = s.slot;
      opt.textContent = s.time;
      slotSelect.appendChild(opt);
      btn.addEventListener('click', function () {
        selectBookingSlot(s.slot);
        var msgEl = document.getElementById('bookFormMsg');
        if (msgEl) {
          msgEl.textContent = '';
          msgEl.className = 'book-form-message';
        }
      });
    } else {
      btn.title = 'Already booked';
      btn.setAttribute('aria-label', s.time + ' already booked');
    }
    grid.appendChild(btn);
  });

  if (hint) {
    if (!slots || !slots.length) {
      hint.textContent = 'No time slots for this date.';
    } else if (!availableCount) {
      hint.textContent = 'All slots are booked for this date. Try another day.';
    } else {
      hint.textContent = availableCount + ' open slot' + (availableCount === 1 ? '' : 's') + ' — booked times are grayed out.';
    }
  }
}

window.loadBookingSlots = async function loadBookingSlots() {
  var dateInput = document.getElementById('book-date');
  var slotSelect = document.getElementById('book-slot');
  var hint = document.getElementById('bookSlotHint');
  var grid = document.getElementById('bookSlotGrid');
  if (!dateInput || !slotSelect) return;
  var date = dateInput.value;
  slotSelect.innerHTML = '<option value="">Loading slots...</option>';
  if (grid) {
    grid.innerHTML = '';
    grid.hidden = true;
  }
  if (hint) hint.textContent = 'Loading available times…';
  if (!date) {
    slotSelect.innerHTML = '<option value="">Select a date first</option>';
    if (hint) hint.textContent = 'Choose a date to see time slots.';
    return;
  }
  var api = membershipApiBase();
  if (!api) {
    slotSelect.innerHTML = '<option value="">Booking service unavailable</option>';
    if (hint) hint.textContent = 'Open the site at http://localhost:4242 so time slots can load.';
    return;
  }
  try {
    var res = await fetch(api + '/api/booking-slots?date=' + encodeURIComponent(date), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      slotSelect.innerHTML = '<option value="">Unable to load slots</option>';
      if (hint) hint.textContent = data.error || 'Unable to load time slots.';
      return;
    }
    if (data.closed) {
      slotSelect.innerHTML = '<option value="">Closed this day</option>';
      if (hint) hint.textContent = data.message || 'Clinic is closed on this day.';
      return;
    }
    renderSlotGrid(data.slots || []);
  } catch (e) {
    slotSelect.innerHTML = '<option value="">Unable to load slots</option>';
    if (hint) hint.textContent = 'Could not reach booking service. Is http://localhost:4242 running?';
  }
};

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

  var dateInput = document.getElementById('book-date');
  if (dateInput) {
    dateInput.min = todayIsoDate();
    dateInput.addEventListener('change', function () {
      renderBookingAlternatives([]);
      window.loadBookingSlots();
    });
  }

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

    if (!firstName || !lastName || !isValidEmail(email)) {
      setMsg('Please fill in your name and a valid email address.', 'error');
      return;
    }
    if (!phone || phoneDigits(phone).length < 10) {
      setMsg('Phone number is required (at least 10 digits) for WhatsApp confirmation.', 'error');
      form.phone.focus();
      return;
    }
    if (!preferred) {
      setMsg('Please select an available time slot.', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    setMsg('');
    renderBookingAlternatives([]);

    try {
      var api = membershipApiBase();
      if (!api) {
        throw new Error('Booking service is currently unavailable. Please call 00.');
      }
      var res = await fetch(api + '/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: phone,
          service: service || 'Not specified',
          preferred: preferred,
          message: message
        })
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 409 || data.code === 'SLOT_TAKEN') {
        setMsg(data.error || 'This time slot is already booked. Please choose another time.', 'error');
        renderBookingAlternatives(data.alternatives || []);
        if (typeof window.loadBookingSlots === 'function') window.loadBookingSlots();
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not send your request. Please try again.');
      }
      form.reset();
      if (dateInput) {
        dateInput.min = todayIsoDate();
        dateInput.value = todayIsoDate();
      }
      selectBookingSlot('');
      var grid = document.getElementById('bookSlotGrid');
      if (grid) {
        grid.innerHTML = '';
        grid.hidden = true;
      }
      var slotSelect = document.getElementById('book-slot');
      if (slotSelect) slotSelect.innerHTML = '<option value="">Select a date first</option>';
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
      var header = document.getElementById('header');
      var offset = header ? header.getBoundingClientRect().height + 12 : 80;
      window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
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
