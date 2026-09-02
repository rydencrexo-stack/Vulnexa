/* PAN Academy — shared header, working nav, and backend profile.
 * Injected on every /learn/*.html page. Fixes the broken relative nav,
 * keeps the header visible, and shows the logged-in user from the PAN API. */
(function () {
  var API = (typeof window.NEXT_PUBLIC_API_URL !== "undefined" ? window.NEXT_PUBLIC_API_URL : "http://127.0.0.1:8000").replace(/\/$/, "");
  var BASE = "/learn";

  function initials(name) {
    return String(name || "U").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || "PAN";
  }

  function fixNavLinks() {
    var links = document.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var label = (link.textContent || "").trim().toLowerCase();
      if (label === "dashboard") { link.setAttribute("href", "/dashboard"); continue; }
      if (label === "learn") { link.setAttribute("href", BASE + "/index.html"); continue; }
      if (label === "practice") { link.setAttribute("href", BASE + "/vulnerabilities/index.html"); continue; }
    }
    /* Rewrite any internal .html link to an absolute /learn path so deep
     * pages (e.g. xss/index.html) never resolve to the wrong file. */
    var all = document.querySelectorAll("a[href]");
    for (var j = 0; j < all.length; j++) {
      var href = (all[j].getAttribute("href") || "").trim();
      if (!href || href.charAt(0) === "#" || href.charAt(0) === "/" || /^(https?:)?\/\//.test(href) || !/\.html$/.test(href)) continue;
      var a = document.createElement("a");
      a.href = href;
      var p = new URL(a.href, location.href).pathname;
      var idx = p.indexOf(BASE + "/");
      if (idx >= 0) all[j].setAttribute("href", p.slice(idx));
    }
  }

  function profileMarkup(name, role, init) {
    return '<a href="/profile/personal-information" class="academy-bar-profile" title="Open PAN profile">' +
      '<span class="academy-bar-avatar">' + init + '</span>' +
      '<span class="academy-bar-meta"><b>' + name + '</b><small>' + role + '</small></span></a>';
  }

  function injectBar(name, role, init) {
    if (document.querySelector(".academy-bar")) return;
    var bar = document.createElement("div");
    bar.className = "academy-bar";
    bar.innerHTML =
      '<a class="academy-bar-brand" href="' + BASE + '/index.html">DELTA<span>· Academy</span></a>' +
      '<nav class="academy-bar-nav">' +
        '<a href="/dashboard">Dashboard</a>' +
        '<a href="' + BASE + '/index.html">Learn</a>' +
        '<a href="' + BASE + '/vulnerabilities/index.html">Practice</a>' +
      '</nav>' +
      profileMarkup(name, role, init);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function applyProfile(user) {
    var name = user ? (user.fullName || user.email || "PAN User") : "PAN User";
    var role = user ? (user.role || "analyst") : "Guest";
    var init = initials(name);

    /* Root academy home already has its own header — fix its links + avatar. */
    var avatar = document.querySelector(".avatar-badge");
    if (avatar) {
      avatar.textContent = init;
      avatar.title = name + " · " + role;
      avatar.style.cursor = "pointer";
      avatar.style.fontWeight = "700";
      avatar.addEventListener("click", function () { location.href = "/profile/personal-information"; });
      var pill = avatar.closest(".user-stats-pill");
      if (pill) pill.style.cursor = "pointer";
      return;
    }
    /* All other pages get a consistent top bar with working nav + profile. */
    injectBar(name, role, init);
  }

  function fetchUser(cb) {
    try {
      fetch(API + "/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } })
        .then(function (res) { if (!res.ok) throw new Error("unauth"); return res.json(); })
        .then(function (data) { cb(data && data.user ? data.user : null); })
        .catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }

  function injectStyles() {
    if (document.getElementById("academy-bar-css")) return;
    var style = document.createElement("style");
    style.id = "academy-bar-css";
    style.textContent =
      ".academy-bar{position:sticky;top:0;z-index:9999;display:flex;align-items:center;gap:18px;" +
      "padding:0 20px;height:54px;background:#111827;border-bottom:1px solid rgba(185,255,45,.25);" +
      "font-family:Inter,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 24px -12px rgba(0,0,0,.6)}" +
      ".academy-bar-brand{display:inline-flex;align-items:baseline;gap:6px;font-weight:800;letter-spacing:.06em;color:#e9f2e3;text-decoration:none;font-size:15px}" +
      ".academy-bar-brand span{color:#b9ff2d;font-size:11px;font-weight:600}" +
      ".academy-bar-nav{display:flex;align-items:center;gap:4px;flex:1}" +
      ".academy-bar-nav a{padding:7px 12px;border-radius:8px;color:#c4cdbd;text-decoration:none;font-size:12px;font-weight:600}" +
      ".academy-bar-nav a:hover{background:rgba(185,255,45,.12);color:#e9f2e3}" +
      ".academy-bar-profile{display:inline-flex;align-items:center;gap:9px;padding:5px 8px;border-radius:9px;color:#e9f2e3;text-decoration:none}" +
      ".academy-bar-profile:hover{background:rgba(185,255,45,.1)}" +
      ".academy-bar-avatar{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;" +
      "background:#b9ff2d;color:#031714;font-size:11px;font-weight:800}" +
      ".academy-bar-meta{display:flex;flex-direction:column;line-height:1.15}" +
      ".academy-bar-meta b{font-size:11px}" +
      ".academy-bar-meta small{font-size:9px;color:#8a9683;text-transform:uppercase;letter-spacing:.08em}" +
      "@media(max-width:640px){.academy-bar-meta{display:none}.academy-bar-nav a{padding:7px 9px;font-size:11px}.academy-bar{gap:10px}}";
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    fixNavLinks();
    fetchUser(applyProfile);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();