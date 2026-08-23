(function () {
  var base = document.body.getAttribute("data-base") || "";
  var home = base + "index.html";
  var page = function (name) { return base + "pages/" + name; };
  var section = function (hash) { return home + hash; };

  if (!document.querySelector('link[rel="icon"]')) {
    var favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = base + "assets/images/favicon.svg";
    document.head.appendChild(favicon);

    var appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = base + "assets/images/favicon.svg";
    document.head.appendChild(appleIcon);
  }

  var services = [
    { name: "Cosmetic Laser Treatment", page: "cosmetic-laser-treatment.html" },
    { name: "Dermaplaning & Microneedling", page: "dermaplaning-microneedling.html" },
    { name: "Laser Esthetics", page: "laser-esthetics.html" },
    { name: "Skin Rejuvenation & Acne Care", page: "skin-rejuvenation-acne-care.html" },
    { name: "Lip Enhancement — Fotona LipLase", page: "lip-enhancement-liplase.html" },
    { name: "Eye Rejuvenation — Fotona SmoothEye", page: "eye-rejuvenation-smootheye.html" },
    { name: "EyeLase™ Non-Surgical Eye Lift", page: "eyelase-eye-lift.html" },
    { name: "Laser Hair Removal", page: "laser-hair-removal.html" }
  ];

  function serviceLinks() {
    return services.map(function (item) {
      return '<a href="' + page(item.page) + '">' + item.name + "</a>";
    }).join("");
  }

  var headerHtml =
    '<div id="topbar"><div class="topbar-inner">' +
    '<a class="tb-item" href="tel:+16109892224">' +
    '<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' +
    "610.989.2224</a>" +
    '<button type="button" class="tb-item tb-book" data-open-book-modal>Book Now</button>' +
    "</div></div>" +
    '<div id="header"><div class="header-inner">' +
    '<a href="' + home + '" class="logo-wrap">' +
    '<span class="logo-line1">Aesthetic &amp; Wellness Care</span>' +
    '<span class="logo-line2">Foundational <em>Wellness</em></span>' +
    '<span class="logo-line3">foundationalaestheticwellness.com</span></a>' +
    '<nav class="main-nav">' +
    '<div class="nav-item"><a href="' + home + '" class="nav-link">Home</a></div>' +
    '<div class="nav-item"><a href="' + page("providers.html") + '" class="nav-link">Our Providers <span class="chevron"></span></a>' +
    '<div class="dropdown">' +
    '<a href="' + page("nelly-silva.html") + '">Dr. Nelly Silva</a>' +
    '<a href="' + page("lexi-lojewski.html") + '">Lexi Lojewski</a>' +
    "</div></div>" +
    '<div class="nav-item"><a href="' + page("about-us.html") + '" class="nav-link">About <span class="chevron"></span></a>' +
    '<div class="dropdown">' +
    '<a href="' + page("about-us.html") + '">About Us</a>' +
    '<a href="' + page("our-practice.html") + '">Our Practice</a>' +
    "</div></div>" +
    '<div class="nav-item"><a href="' + section("#services") + '" class="nav-link">Services <span class="chevron"></span></a>' +
    '<div class="dropdown">' +
    serviceLinks() +
    "</div></div>" +
    '<div class="nav-item"><a href="' + page("membership.html") + '" class="nav-link">Membership</a></div>' +
    '<div class="nav-item"><a href="' + page("contact.html") + '" class="nav-link">Contact</a></div>' +
    "</nav>" +
    '<button class="hamburger" onclick="openMNav()" aria-label="Menu"><span></span><span></span><span></span></button>' +
    "</div></div>" +
    '<div class="mobile-nav-overlay" id="mNav">' +
    '<div class="mnav-head"><span class="mnav-logo">Foundational <em>Wellness</em></span>' +
    '<button class="mnav-close" onclick="closeMNav()" aria-label="Close menu">\u2715</button></div>' +
    '<div class="mnav-links">' +
    '<a href="' + home + '" onclick="closeMNav()">Home</a>' +
    '<div class="mnav-section">Our Providers</div>' +
    '<a href="' + page("nelly-silva.html") + '" onclick="closeMNav()">Dr. Nelly Silva</a>' +
    '<a href="' + page("lexi-lojewski.html") + '" onclick="closeMNav()">Lexi Lojewski</a>' +
    '<div class="mnav-section">About</div>' +
    '<a href="' + page("about-us.html") + '" onclick="closeMNav()">About Us</a>' +
    '<a href="' + page("our-practice.html") + '" onclick="closeMNav()">Our Practice</a>' +
    '<div class="mnav-section">Services</div>' +
    '<a href="' + page("cosmetic-laser-treatment.html") + '" onclick="closeMNav()">Cosmetic Laser Treatment</a>' +
    '<a href="' + page("dermaplaning-microneedling.html") + '" onclick="closeMNav()">Dermaplaning &amp; Microneedling</a>' +
    '<a href="' + page("laser-esthetics.html") + '" onclick="closeMNav()">Laser Esthetics</a>' +
    '<a href="' + page("skin-rejuvenation-acne-care.html") + '" onclick="closeMNav()">Skin Rejuvenation &amp; Acne Care</a>' +
    '<a href="' + page("lip-enhancement-liplase.html") + '" onclick="closeMNav()">Lip Enhancement — LipLase</a>' +
    '<a href="' + page("eye-rejuvenation-smootheye.html") + '" onclick="closeMNav()">Eye Rejuvenation — SmoothEye</a>' +
    '<a href="' + page("eyelase-eye-lift.html") + '" onclick="closeMNav()">EyeLase™ Eye Lift</a>' +
    '<a href="' + page("laser-hair-removal.html") + '" onclick="closeMNav()">Laser Hair Removal</a>' +
    '<div class="mnav-section">Quick Links</div>' +
    '<a href="' + page("membership.html") + '" onclick="closeMNav()">Membership Plan</a>' +
    '<a href="' + page("contact.html") + '" onclick="closeMNav()">Contact</a>' +
    '<a href="tel:+16109892224">\ud83d\udcde 610.989.2224</a>' +
    '<button type="button" class="mnav-book" data-open-book-modal onclick="closeMNav()">Book an Appointment</button>' +
    "</div></div>";

  var bookModalHtml =
    '<div class="book-modal" id="bookModal" hidden>' +
    '<div class="book-modal__backdrop" data-close-book-modal></div>' +
    '<div class="book-modal__panel" role="dialog" aria-modal="true" aria-labelledby="bookModalTitle">' +
    '<button type="button" class="book-modal__close" data-close-book-modal aria-label="Close">&times;</button>' +
    '<h3 id="bookModalTitle">Book an Appointment</h3>' +
    '<p class="book-modal__sub">Share your details and we will contact you to confirm your visit.</p>' +
    '<div class="form-success-msg" id="bookFormOk">Thank you! Your booking request has been sent. We will be in touch shortly.</div>' +
    '<form id="bookForm" novalidate>' +
    '<div class="form-row2">' +
    '<div class="fg"><label for="book-fn">First Name *</label><input type="text" id="book-fn" name="firstName" required placeholder="Jane"></div>' +
    '<div class="fg"><label for="book-ln">Last Name *</label><input type="text" id="book-ln" name="lastName" required placeholder="Smith"></div>' +
    '</div>' +
    '<div class="fg"><label for="book-em">Email Address *</label><input type="email" id="book-em" name="email" required placeholder="jane@example.com"></div>' +
    '<div class="fg"><label for="book-ph">Phone Number *</label><input type="tel" id="book-ph" name="phone" required placeholder="(610) 555-0000"></div>' +
    '<div class="fg"><label for="book-svc">Service of Interest</label><select id="book-svc" name="service">' +
    '<option value="">Select a service...</option>' +
    '<option>Cosmetic Laser Treatment</option>' +
    '<option>Dermaplaning &amp; Microneedling</option>' +
    '<option>Laser Esthetics</option>' +
    '<option>Skin Rejuvenation &amp; Acne Care</option>' +
    '<option>Lip Enhancement — Fotona LipLase</option>' +
    '<option>Eye Rejuvenation — Fotona SmoothEye</option>' +
    '<option>EyeLase™ Non-Surgical Eye Lift</option>' +
    '<option>Laser Hair Removal</option>' +
    '<option>Other / Consultation</option>' +
    '</select></div>' +
    '<div class="fg"><label for="book-pref">Preferred Date / Time</label><input type="text" id="book-pref" name="preferred" placeholder="e.g. Weekday mornings"></div>' +
    '<div class="fg"><label for="book-msg">Notes</label><textarea id="book-msg" name="message" placeholder="Tell us about your goals or questions..."></textarea></div>' +
    '<button type="submit" class="form-submit-btn" id="bookSubmitBtn">Send Booking Request</button>' +
    '<p class="book-form-message" id="bookFormMsg" aria-live="polite"></p>' +
    '</form></div></div>';

  var footerHtml =
    "<footer><div class=\"footer-top\">" +
    '<div class="footer-brand">' +
    '<div class="fb-logo">Foundational <em>Wellness</em></div>' +
    '<div class="fb-sub">foundationalaestheticwellness.com</div>' +
    "<p>Expert aesthetic wellness, laser treatments, and cosmetic care in Collegeville, PA.</p>" +
    '<div class="social-row">' +
    '<a href="https://maps.app.goo.gl/FrP8BQQtknxPzfUM8" target="_blank" rel="noopener" class="soc-btn" title="Google">G</a>' +
    '<a href="https://www.facebook.com/LaserSkinSurgeryPA/" target="_blank" rel="noopener" class="soc-btn" title="Facebook">f</a>' +
    '<a href="https://www.instagram.com/laserskinsurgerypa/" target="_blank" rel="noopener" class="soc-btn" title="Instagram">ig</a>' +
    "</div></div>" +
    '<div class="footer-col"><h4>Our Services</h4><ul>' +
    '<li><a href="' + page("cosmetic-laser-treatment.html") + '">Cosmetic Laser Treatment</a></li>' +
    '<li><a href="' + page("dermaplaning-microneedling.html") + '">Dermaplaning &amp; Microneedling</a></li>' +
    '<li><a href="' + page("skin-rejuvenation-acne-care.html") + '">Skin Rejuvenation &amp; Acne Care</a></li>' +
    '<li><a href="' + page("lip-enhancement-liplase.html") + '">Lip Enhancement — LipLase</a></li>' +
    '<li><a href="' + page("eye-rejuvenation-smootheye.html") + '">Eye Rejuvenation — SmoothEye</a></li>' +
    '<li><a href="' + page("eyelase-eye-lift.html") + '">EyeLase™ Eye Lift</a></li>' +
    '<li><a href="' + page("laser-hair-removal.html") + '">Laser Hair Removal</a></li>' +
    "</ul></div>" +
    '<div class="footer-col"><h4>Our Providers</h4><ul>' +
    '<li><a href="' + page("nelly-silva.html") + '">Dr. Nelly Silva</a></li>' +
    '<li><a href="' + page("lexi-lojewski.html") + '">Lexi Lojewski</a></li>' +
    "</ul></div>" +
    '<div class="footer-col"><h4>Patients</h4><ul>' +
    '<li><a href="' + page("membership.html") + '">Membership Plan</a></li>' +
    '<li><a href="' + page("contact.html") + '">Collegeville, PA</a></li>' +
    '<li><a href="tel:+16109892224">610.989.2224</a></li>' +
    "</ul></div></div>" +
    "</footer>";

  var main = document.getElementById("page-main");
  if (!main || document.getElementById("site-header")) return;

  var header = document.createElement("div");
  header.id = "site-header";
  header.innerHTML = headerHtml;
  main.parentNode.insertBefore(header, main);

  var footer = document.createElement("div");
  footer.id = "site-footer";
  footer.innerHTML = footerHtml;
  main.parentNode.insertBefore(footer, main.nextSibling);

  if (!document.getElementById("bookModal")) {
    var modalWrap = document.createElement("div");
    modalWrap.innerHTML = bookModalHtml;
    document.body.appendChild(modalWrap.firstChild);
  }
})();
