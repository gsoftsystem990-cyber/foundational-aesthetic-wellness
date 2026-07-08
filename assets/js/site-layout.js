(function () {
  var base = document.body.getAttribute("data-base") || "";
  var home = base + "index.html";
  var page = function (name) { return base + "pages/" + name; };
  var section = function (hash) { return home + hash; };

  var services = [
    { name: "Cosmetic Laser Treatment", page: "cosmetic-laser-treatment.html" },
    { name: "Dermaplaning & Microneedling", page: "dermaplaning-microneedling.html" },
    { name: "Laser Esthetics & Snoring Solutions", page: "laser-esthetics-snoring-solutions.html" }
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
    '<a class="tb-item" href="https://laserskinpa.ema.md/ema/pay/online" target="_blank" rel="noopener">Pay Online</a>' +
    '<a class="tb-item tb-book" href="https://www.zocdoc.com/practice/laser-and-skin-surgery-center-of-pennsylvania-71450?lock=true&isNewPatient=false&referrerType=widget" target="_blank" rel="noopener">Book Now</a>' +
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
    '<a href="' + page("providers.html") + '">Jordan V. Wang, MD, MBE, MBA</a>' +
    '<a href="' + page("providers.html") + '">Danielle M. DeHoratius, MD</a>' +
    '<a href="' + page("providers.html") + '">Stephanie Slaski, PA-C</a>' +
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
    '<div class="nav-item"><a href="' + section("#resources") + '" class="nav-link">Resources <span class="chevron"></span></a>' +
    '<div class="dropdown">' +
    '<a href="' + section("#resources") + '">Patient Information</a>' +
    '<a href="' + section("#resources") + '">Insurance</a>' +
    '<a href="' + section("#resources") + '">Credit Card Policy</a>' +
    '<a href="' + section("#resources") + '">Blog</a>' +
    "</div></div>" +
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
    '<a href="' + page("providers.html") + '" onclick="closeMNav()">Jordan V. Wang, MD, MBE, MBA</a>' +
    '<a href="' + page("providers.html") + '" onclick="closeMNav()">Danielle M. DeHoratius, MD</a>' +
    '<a href="' + page("providers.html") + '" onclick="closeMNav()">Stephanie Slaski, PA-C</a>' +
    '<div class="mnav-section">About</div>' +
    '<a href="' + page("about-us.html") + '" onclick="closeMNav()">About Us</a>' +
    '<a href="' + page("our-practice.html") + '" onclick="closeMNav()">Our Practice</a>' +
    '<div class="mnav-section">Services</div>' +
    '<a href="' + page("cosmetic-laser-treatment.html") + '" onclick="closeMNav()">Cosmetic Laser Treatment</a>' +
    '<a href="' + page("dermaplaning-microneedling.html") + '" onclick="closeMNav()">Dermaplaning &amp; Microneedling</a>' +
    '<a href="' + page("laser-esthetics-snoring-solutions.html") + '" onclick="closeMNav()">Laser Esthetics &amp; Snoring</a>' +
    '<div class="mnav-section">Quick Links</div>' +
    '<a href="' + page("contact.html") + '" onclick="closeMNav()">Contact</a>' +
    '<a href="tel:+16109892224">\ud83d\udcde 610.989.2224</a>' +
    '<a class="mnav-book" href="https://www.zocdoc.com/practice/laser-and-skin-surgery-center-of-pennsylvania-71450" target="_blank" rel="noopener" onclick="closeMNav()">Book an Appointment</a>' +
    "</div></div>";

  var footerHtml =
    "<footer><div class=\"footer-top\">" +
    '<div class="footer-brand">' +
    '<div class="fb-logo">Foundational <em>Wellness</em></div>' +
    '<div class="fb-sub">foundationalaestheticwellness.com</div>' +
    "<p>Expert aesthetic wellness, laser treatments, and cosmetic care in Devon, PA on the Main Line in the Philadelphia area.</p>" +
    '<div class="social-row">' +
    '<a href="https://maps.app.goo.gl/FrP8BQQtknxPzfUM8" target="_blank" rel="noopener" class="soc-btn" title="Google">G</a>' +
    '<a href="https://www.facebook.com/LaserSkinSurgeryPA/" target="_blank" rel="noopener" class="soc-btn" title="Facebook">f</a>' +
    '<a href="https://www.instagram.com/laserskinsurgerypa/" target="_blank" rel="noopener" class="soc-btn" title="Instagram">ig</a>' +
    "</div></div>" +
    '<div class="footer-col"><h4>Our Services</h4><ul>' +
    '<li><a href="' + page("cosmetic-laser-treatment.html") + '">Cosmetic Laser Treatment</a></li>' +
    '<li><a href="' + page("dermaplaning-microneedling.html") + '">Dermaplaning &amp; Microneedling</a></li>' +
    '<li><a href="' + page("laser-esthetics-snoring-solutions.html") + '">Laser Esthetics &amp; Snoring</a></li>' +
    "</ul></div>" +
    '<div class="footer-col"><h4>Our Providers</h4><ul>' +
    '<li><a href="' + page("providers.html") + '">Dr. Jordan V. Wang</a></li>' +
    '<li><a href="' + page("providers.html") + '">Dr. Danielle M. DeHoratius</a></li>' +
    '<li><a href="' + page("providers.html") + '">Stephanie Slaski, PA-C</a></li>' +
    "</ul>" +
    '<h4 id="resources" style="margin-top:24px">Resources</h4><ul>' +
    '<li><a href="' + section("#resources") + '">Patient Information</a></li>' +
    '<li><a href="' + section("#resources") + '">Insurance</a></li>' +
    '<li><a href="' + page("reviews.html") + '">Reviews</a></li>' +
    "</ul></div>" +
    '<div class="footer-col"><h4>Contact</h4><ul>' +
    '<li><a href="https://maps.app.goo.gl/FrP8BQQtknxPzfUM8" target="_blank" rel="noopener">92 Lancaster Avenue</a></li>' +
    '<li><a href="https://maps.app.goo.gl/FrP8BQQtknxPzfUM8" target="_blank" rel="noopener">Suite 120, Devon, PA 19333</a></li>' +
    '<li><a href="tel:+16109892224">610.989.2224</a></li>' +
    "</ul></div></div>" +
    '<div class="footer-bottom"><p>\u00a9 Copyright 2026 Foundational Aesthetic Wellness</p></div>' +
    "</footer>" +
    '<div class="disclaimer-bar"><p>Individual results are not guaranteed and may vary from person to person. Images may contain models.</p></div>';

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
})();
