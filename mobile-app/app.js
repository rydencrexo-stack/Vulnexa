/* Vulnexa Live — premium mobile app */
(function () {
  var AUTH_KEY = "vulnexa_live_auth";
  var AUTH_USER = "admin";
  var AUTH_PASS = "admin";

  var user = { name: "Delta Admin", role: "Administrator", org: "Northstar Cloud", email: "admin@vulnexa.io" };

  /* ---------------- SVG icons ---------------- */
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var ICONS = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
    targets: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'),
    scans: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><circle cx="11" cy="11" r="1"/>'),
    assets: svg('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    findings: svg('<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="M12 8v4M12 15.5h.01"/>'),
    ai: svg('<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/>'),
    reports: svg('<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h7M9 16h5"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
    download: svg('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    send: svg('<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'),
    server: svg('<rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
    db: svg('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    shield: svg('<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>'),
    alert: svg('<path d="M12 3 2 20h20z"/><path d="M12 9v4M12 16.5h.01"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    share: svg('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>'),
    external: svg('<path d="M7 17 17 7M8 7h9v9"/>'),
  };
  function ico(name) { return ICONS[name] || ICONS.home; }

  /* ---------------- Data ---------------- */
  var targets = [
    { id: 0, name: "Northstar Customer Portal", domain: "northstar-demo.com", env: "production", verified: true, assets: 18, endpoints: 342, findings: 9, risk: "high", score: 78, scope: ["portal.*", "api.*"], excluded: ["payments.*"], ports: "80, 443", auth: "Customer test account", lastScan: "Aug 27 · 08:42", created: "Aug 12" },
    { id: 1, name: "Atlas Partner API", domain: "atlas-demo.dev", env: "staging", verified: true, assets: 7, endpoints: 128, findings: 4, risk: "medium", score: 84, scope: ["sandbox-api"], excluded: [], ports: "443", auth: "Partner token", lastScan: "Aug 26 · 16:10", created: "Aug 18" },
    { id: 2, name: "Aurora Fintech Web", domain: "aurora-finance.com", env: "production", verified: true, assets: 26, endpoints: 511, findings: 14, risk: "critical", score: 58, scope: ["app.*", "api.*", "cdn.*"], excluded: ["banking.*"], ports: "80, 443, 8443", auth: "Analyst finance account", lastScan: "Aug 29 · 11:20", created: "Aug 05" },
    { id: 3, name: "Pulse Mobile API", domain: "pulse-mobile.io", env: "development", verified: false, assets: 5, endpoints: 64, findings: 2, risk: "low", score: 92, scope: ["api"], excluded: [], ports: "443", auth: null, lastScan: "Never", created: "Aug 22" },
    { id: 4, name: "Nexus Healthcare", domain: "nexushealth.org", env: "staging", verified: true, assets: 33, endpoints: 478, findings: 12, risk: "high", score: 66, scope: ["portal.*", "api.*"], excluded: ["intake.*"], ports: "443", auth: "Clinician account", lastScan: "Aug 28 · 18:05", created: "Aug 10" },
  ];

  var scans = [
    { id: 0, name: "Northstar balanced scan", target: "Northstar Customer Portal", phase: "Active testing", progress: 68, status: "running", worker: "scanner-worker-02", profile: "Balanced", endpoints: 312, requests: 840, findings: 7, duration: "24m", modules: ["recon", "passive", "xss", "sqli", "api"], assets: 14, params: 91, candidates: 5, confirmed: 2 },
    { id: 1, name: "Aurora full assessment", target: "Aurora Fintech Web", phase: "Passive Analysis", progress: 44, status: "running", worker: "scanner-worker-03", profile: "Full scan", endpoints: 511, requests: 1210, findings: 6, duration: "12m", modules: ["recon", "passive", "xss", "sqli", "api", "cve"], assets: 26, params: 120, candidates: 4, confirmed: 2 },
    { id: 2, name: "Atlas API passive review", target: "Atlas Partner API", phase: "Complete", progress: 100, status: "completed", worker: "api-worker-01", profile: "API focused", endpoints: 128, requests: 512, findings: 4, duration: "48m", modules: ["api", "passive"], assets: 7, params: 44, candidates: 3, confirmed: 1 },
    { id: 3, name: "Nexus PHI compliance", target: "Nexus Healthcare", phase: "Complete", progress: 100, status: "completed", worker: "scanner-worker-01", profile: "Balanced", endpoints: 478, requests: 1490, findings: 9, duration: "1h 5m", modules: ["recon", "passive", "api", "secrets"], assets: 33, params: 98, candidates: 6, confirmed: 3 },
    { id: 4, name: "Aurora API security sweep", target: "Aurora Fintech Web", phase: "Queued", progress: 0, status: "queued", worker: "pending", profile: "API focused", endpoints: 0, requests: 0, findings: 0, duration: "—", modules: ["api"], assets: 0, params: 0, candidates: 0, confirmed: 0 },
  ];

  var assets = [
    { host: "portal.northstar-demo.com", ip: "203.0.113.42", tech: ["Next.js", "Cloudflare", "React"], ports: "443", risk: "high", title: "Northstar Portal", tls: "TLS 1.3 · 61d", firstSeen: "Aug 12" },
    { host: "api.northstar-demo.com", ip: "203.0.113.44", tech: ["FastAPI", "nginx"], ports: "443", risk: "medium", title: "Northstar API", tls: "TLS 1.3 · 61d", firstSeen: "Aug 12" },
    { host: "app.aurora-finance.com", ip: "203.0.113.120", tech: ["React", "Cloudflare"], ports: "443", risk: "critical", title: "Aurora Banking", tls: "TLS 1.3 · 92d", firstSeen: "Aug 05" },
    { host: "api.aurora-finance.com", ip: "203.0.113.122", tech: ["Go", "Kong", "Kubernetes"], ports: "443", risk: "high", title: "Aurora API", tls: "TLS 1.3 · 92d", firstSeen: "Aug 05" },
    { host: "portal.nexushealth.org", ip: "192.0.2.200", tech: ["Django", "PostgreSQL"], ports: "443", risk: "high", title: "Nexus Patient Portal", tls: "TLS 1.3 · 120d", firstSeen: "Aug 10" },
    { host: "cdn.northstar-demo.com", ip: "198.51.100.21", tech: ["CloudFront", "S3"], ports: "443", risk: "low", title: "Static content", tls: "TLS 1.3 · 44d", firstSeen: "Aug 14" },
    { host: "sandbox-api.atlas-demo.dev", ip: "198.51.100.88", tech: ["Go", "Kubernetes", "Envoy"], ports: "443", risk: "medium", title: "Atlas API", tls: "TLS 1.3 · 72d", firstSeen: "Aug 18" },
  ];

  var findings = [
    { id: 0, title: "IDOR on account enumeration", severity: "critical", confidence: 89, target: "Aurora", state: "candidate", cwe: "CWE-639", owasp: "A01:2021", cvss: "9.1", endpoint: "GET /v2/accounts/{id}", param: "id", desc: "Predictable numeric IDs allow enumerating another customer's account data by incrementing the ID.", impact: "Unauthorized read of financial account details across tenants.", remediation: "Use opaque IDs and enforce object-level authorization checks server-side.", evidence: "Observed 200 with differing account data when incrementing ID in a valid session." },
    { id: 1, title: "Broken object-level authorization", severity: "critical", confidence: 91, target: "Northstar", state: "high_confidence", cwe: "CWE-639", owasp: "A01:2021", cvss: "9.1", endpoint: "GET /v1/accounts/{accountId}", param: "accountId", desc: "Authenticated user can access another user's account object via the API.", impact: "Full account takeover of data across the customer base.", remediation: "Authorize each object access against the session principal.", evidence: "Two distinct sessions returned another user's profile." },
    { id: 2, title: "Reflected cross-site scripting", severity: "high", confidence: 96, target: "Northstar", state: "confirmed", cwe: "CWE-79", owasp: "A03:2021", cvss: "8.2", endpoint: "GET /search?q=", param: "q", desc: "Search parameter reflected without encoding into an HTML attribute.", impact: "Script execution in a victim's authenticated session.", remediation: "Context-aware output encoding; restrictive CSP.", evidence: "Browser marker executed in isolated verification worker." },
    { id: 3, title: "GraphQL introspection enabled", severity: "high", confidence: 95, target: "Aurora", state: "confirmed", cwe: "CWE-200", owasp: "A01:2021", cvss: "7.5", endpoint: "POST /graphql", param: "query", desc: "GraphQL introspection exposes the full schema.", impact: "Attackers map every type, query, and mutation.", remediation: "Disable introspection in production.", evidence: "Introspection query returned complete schema." },
    { id: 4, title: "Patient record exposure", severity: "critical", confidence: 93, target: "Nexus", state: "high_confidence", cwe: "CWE-639", owasp: "A01:2021", cvss: "9.4", endpoint: "GET /v1/patients/{id}/records", param: "id", desc: "Health records retrievable without authorizing the requesting clinician.", impact: "PHI exposure — compliance + privacy breach.", remediation: "Enforce role + relationship checks before serving PHI.", evidence: "Unrelated patientId returned records." },
    { id: 5, title: "Missing Content-Security-Policy", severity: "medium", confidence: 88, target: "Northstar", state: "candidate", cwe: "CWE-693", owasp: "A05:2021", cvss: "5.3", endpoint: "GET /", param: null, desc: "No CSP header on the main origin.", impact: "Reduced defense-in-depth against XSS.", remediation: "Deploy a strict CSP.", evidence: "Response headers lacked Content-Security-Policy." },
    { id: 6, title: "Missing rate limiting on login", severity: "medium", confidence: 78, target: "Nexus", state: "candidate", cwe: "CWE-307", owasp: "A07:2021", cvss: "6.5", endpoint: "POST /auth/login", param: "body", desc: "No account lockout or rate limit on the login endpoint.", impact: "Credential brute-force possible.", remediation: "Add throttling + lockout.", evidence: "Consecutive failed logins returned 200." },
  ];

  var reports = [
    { name: "Executive security summary", type: "Executive", findings: "6 confirmed · 11 candidates", formats: "PDF · HTML", compliance: "SOC2 · ISO 27001", time: "Aug 29 · 14:40", summary: "Two critical authorization issues and one high-confidence XSS require immediate remediation." },
    { name: "Northstar full-scan report", type: "Full scan", findings: "9 findings", formats: "PDF · JSON", compliance: "PCI-DSS", time: "Aug 27 · 09:10", summary: "Complete Northstar assessment including all verified findings, evidence, and retests." },
    { name: "Aurora API assessment", type: "API", findings: "14 findings", formats: "HTML · CSV", compliance: "SOC2", time: "Aug 29 · 11:40", summary: "API-focused assessment covering GraphQL, IDOR, and token handling." },
  ];

  var workers = [
    { name: "recon-worker-01", status: "ok", job: "subdomain enum", cpu: 22 }, { name: "scanner-worker-02", status: "busy", job: "XSS testing", cpu: 78 },
    { name: "verification-worker-01", status: "ok", job: "browser verify", cpu: 31 }, { name: "ai-worker-01", status: "ok", job: "finding analysis", cpu: 45 },
    { name: "api-worker-01", status: "busy", job: "API schema", cpu: 66 }, { name: "report-worker-01", status: "idle", job: "none", cpu: 6 },
  ];

  var activityPool = [
    ["Target verified", "Northstar"], ["Recon started", "recon-worker-01"], ["12 subdomains discovered", "Subfinder"],
    ["Candidate XSS finding detected", "XSS scanner"], ["AI analysis completed", "ai-worker-01"], ["Analyst confirmed finding", "Delta Admin"],
    ["Acunetix scan started", "integration"], ["Report generated", "report-worker-01"], ["Retest completed", "verification-worker-01"],
  ];
  var activity = activityPool.map(function (a) { return { t: "", text: a[0], who: a[1] }; });
  var DATA_API = "/api/mobile/data";
  var liveConnected = false;

  /* ---------------- State ---------------- */
  var state = { view: "home", id: null, ai: [] };
  var titles = { home: "Dashboard", targets: "Targets", scans: "Scans", assets: "Assets", findings: "Findings", reports: "Reports", ai: "AI Chat", settings: "Settings" };
  var deferredInstall = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function pill(text, cls) { return '<span class="badge-pill ' + cls + '">' + esc(text) + '</span>'; }
  function riskPill(risk) {
    var cls = risk === "critical" ? "pill-red" : risk === "high" ? "pill-amber" : risk === "medium" ? "pill-blue" : "pill-teal";
    return pill(risk.toUpperCase(), cls);
  }
  function sevPill(sev) {
    var cls = sev === "critical" ? "pill-red" : sev === "high" ? "pill-amber" : sev === "medium" ? "pill-blue" : sev === "low" ? "pill-teal" : "pill-dim";
    return pill(sev.toUpperCase(), cls);
  }
  function timeNow() {
    var d = new Date();
    return (d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0"));
  }
  function detailHeader(name) {
    return '<div class="detail-head"><button class="icon-btn" onclick="window.__back()">' + ico("back") + '</button><h1>' + esc(name) + '</h1></div>';
  }
  function kv(label, value) { return '<div class="kv"><span>' + esc(label) + '</span><strong>' + esc(value || "—") + '</strong></div>'; }

  function auth() { try { return localStorage.getItem(AUTH_KEY) === "1"; } catch (e) { return false; } }

  function nav() {
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
    render();
  }
  function logout() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    $("app").classList.add("hidden");
    $("login").classList.remove("hidden");
  }
  function closeSidebar() { $("app").classList.remove("sidebar-open"); }

  function render() {
    closeSidebar();
    $("pageTitle").textContent = state.id != null ? "Details" : (titles[state.view] || "Dashboard");
    $("view").classList.toggle("chat-mode", state.view === "ai");
    $("view").innerHTML = viewFor();
    if (state.view === "ai") bindChat();
    if (state.view === "home" && state.id == null) bindHome();
    document.querySelectorAll("#sidebarNav a, #bottomNav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-view") === state.view && state.id == null);
    });
    renderIcons();
  }
  function viewFor() {
    if (state.id != null) {
      if (state.view === "targets") return renderTargetDetail(state.id);
      if (state.view === "scans") return renderScanDetail(state.id);
      if (state.view === "assets") return renderAssetDetail(state.id);
      if (state.view === "findings") return renderFindingDetail(state.id);
      if (state.view === "reports") return renderReportDetail(state.id);
    }
    return (views[state.view] || renderHome)();
  }
  function go(view, id) { state.view = view; state.id = id || null; render(); }
  window.__back = function () { state.id = null; render(); };
  window.go = go;

  function renderIcons() {
    document.querySelectorAll("[data-ico]").forEach(function (el) {
      if (!el.getAttribute("data-filled")) { el.innerHTML = ico(el.getAttribute("data-ico")); el.setAttribute("data-filled", "1"); }
    });
  }

  /* ---------------- Views ---------------- */
  var views = { home: renderHome, targets: renderTargets, scans: renderScans, assets: renderAssets, findings: renderFindings, reports: renderReports, ai: renderAi, settings: renderSettings };

  /* ---- dashboard chart helpers ---- */
  function sparkSvg(points, down) {
    var pts = points.split(",").map(Number);
    var w = 56, h = 20, pad = 2;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var step = (w - pad * 2) / (pts.length - 1);
    var coords = pts.map(function (p, i) { return [pad + i * step, pad + (h - pad * 2) * (1 - (p - min) / (max - min || 1))]; });
    var line = coords.map(function (c) { return c[0].toFixed(1) + "," + c[1].toFixed(1); }).join(" ");
    var area = line + " " + (w - pad) + "," + (h - pad) + " " + pad + "," + (h - pad);
    var col = down ? "var(--red)" : "var(--teal)";
    var gid = "spg" + (down ? "d" : "u");
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".35"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><polygon points="' + area + '" fill="url(#' + gid + ')"/><polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" class="draw-line"/></svg>';
  }
  function donutSvg(counts, total) {
    var size = 110, r = 42, c = 2 * Math.PI * r;
    var colors = ["var(--red)", "var(--amber)", "var(--blue)", "var(--teal)"];
    var sum = counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    var offset = 0, parts = "";
    counts.forEach(function (n, i) {
      if (!n) return;
      var frac = n / sum;
      parts += '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + colors[i] + '" stroke-width="11" stroke-dasharray="' + (frac * c).toFixed(1) + ' ' + c.toFixed(1) + '" stroke-dashoffset="' + (-offset * c).toFixed(1) + '" class="donut-seg" style="transform:rotate(-90deg);transform-origin:center;animation-delay:' + (i * 130) + 'ms"/>';
      offset += frac;
    });
    return '<div class="donut-wrap"><svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><circle cx="55" cy="55" r="' + r + '" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="11"/>' + parts + '<text x="55" y="54" text-anchor="middle" class="donut-n">' + total + '</text><text x="55" y="69" text-anchor="middle" class="donut-l">findings</text></svg></div>';
  }
  function ringSvg(pct) {
    var r = 19, c = 2 * Math.PI * r;
    var dash = (pct / 100) * c;
    return '<div class="ring-wrap"><svg viewBox="0 0 46 46" width="46" height="46"><circle cx="23" cy="23" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4"/><circle class="ring-fill" cx="23" cy="23" r="' + r + '" fill="none" stroke="var(--blue)" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" style="transform:rotate(-90deg);transform-origin:center"/></svg><span class="ring-num">' + pct + '%</span></div>';
  }
  function areaSvg(points) {
    var w = 300, h = 92, pad = 6;
    var max = Math.max.apply(null, points);
    var step = (w - pad * 2) / (points.length - 1);
    var coords = points.map(function (p, i) { return [pad + i * step, pad + (h - pad * 2) * (1 - p / (max || 1))]; });
    var line = coords.map(function (c) { return c[0].toFixed(1) + "," + c[1].toFixed(1); }).join(" ");
    var area = "0," + (h - pad) + " " + line + " " + (w - pad) + "," + (h - pad);
    var grid = "";
    for (var g = 1; g < 4; g++) { var y = pad + (h - pad * 2) * g / 4; grid += '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>'; }
    var dots = coords.map(function (c, i) { return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="2.4" fill="var(--teal)" class="trend-dot" style="animation-delay:' + (0.2 + i * 0.12) + 's"/>'; }).join("");
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' + grid + '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--teal)" stop-opacity=".28"/><stop offset="1" stop-color="var(--teal)" stop-opacity="0"/></linearGradient></defs><polygon points="' + area + '" fill="url(#tg)"/><polyline class="draw-line" points="' + line + '" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' + dots + '</svg><div class="trend-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>';
  }

  function renderHome() {
    var running = scans.filter(function (s) { return s.status === "running"; });
    var openFindings = findings.filter(function (f) { return f.state !== "confirmed"; }).length;
    var sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(function (f) { if (sevCounts[f.severity] != null) sevCounts[f.severity]++; });
    var busyWorkers = workers.filter(function (w) { return w.status === "busy"; }).length;
    var trend = [3, 6, 4, 8, 11, 9, 14];
    var html = '';

    html += '<div class="card hero-live anim-in"><div class="hero-radar"><span class="radar-ring r1"></span><span class="radar-ring r2"></span><span class="radar-sweep"></span><span class="radar-core"></span></div>';
    html += '<div class="hero-info"><div class="row-name">Live operations <span class="live-tag' + (liveConnected ? "" : " off") + '">' + (liveConnected ? "LIVE" : "DEMO") + '</span></div><div class="row-sub">' + running.length + ' scans running · ' + busyWorkers + ' workers busy · ' + assets.length + ' assets monitored</div></div>';
    html += '<div class="eq">' + [0, 1, 2, 3, 4].map(function (i) { return '<span style="animation-delay:' + (i * 0.13) + 's"></span>'; }).join("") + '</div></div>';

    var kpis = [
      { n: running.length, l: "Running scans", sub: "▲ 2 active", spark: "2,3,1,2,2,3,2" },
      { n: targets.length, l: "Targets", sub: "▲ 1 new", spark: "3,4,4,4,5,5,5" },
      { n: assets.length, l: "Assets", sub: "▲ 7 live", spark: "74,78,81,83,85,89,89" },
      { n: openFindings, l: "Open findings", sub: "▼ action needed", spark: "9,8,8,7,6,5,5", down: true },
    ];
    html += '<div class="kpi-row">';
    kpis.forEach(function (k, i) {
      html += '<div class="kpi anim-in" style="animation-delay:' + (80 + i * 70) + 'ms"><div class="kpi-head"><span class="n count-up" data-count="' + k.n + '">0</span><span class="kpi-spark">' + sparkSvg(k.spark, k.down) + '</span></div><div class="l">' + k.l + '</div><div class="d ' + (k.down ? "down" : "up") + '">' + k.sub + '</div></div>';
    });
    html += '</div>';

    html += '<h2 class="section-title">Risk overview</h2><div class="charts-row">';
    html += '<div class="card chart-card anim-in" style="animation-delay:160ms"><div class="chart-title">Findings by severity</div>' + donutSvg([sevCounts.critical, sevCounts.high, sevCounts.medium, sevCounts.low], findings.length) + '</div>';
    html += '<div class="card chart-card anim-in" style="animation-delay:230ms"><div class="chart-title">Severity spread</div>';
    [["critical", sevCounts.critical, "var(--red)"], ["high", sevCounts.high, "var(--amber)"], ["medium", sevCounts.medium, "var(--blue)"], ["low", sevCounts.low, "var(--teal)"]].forEach(function (b) {
      var w = Math.round(b[1] / Math.max(1, sevCounts.critical) * 100);
      html += '<div class="h-bar-row"><div class="h-bar-label">' + b[0] + '</div><div class="h-bar-track"><div class="h-bar-fill" data-w="' + w + '" style="background:' + b[2] + '"></div></div><div class="h-bar-num">' + b[1] + '</div></div>';
    });
    html += '</div></div>';

    html += '<h2 class="section-title">Attack surface trend</h2><div class="card chart-card anim-in" style="animation-delay:300ms"><div class="chart-title">Findings discovered · last 7 days</div>' + areaSvg(trend) + '</div>';

    html += '<h2 class="section-title">Running scans</h2><div class="grid-list">';
    running.forEach(function (s, i) {
      s.progress = Math.min(100, s.progress + Math.floor(Math.random() * 3));
      html += '<div class="row-card scan-card anim-in" style="animation-delay:' + (340 + i * 60) + 'ms" onclick="go(\'scans\',' + s.id + ')"><div class="row-top"><div><div class="row-name">' + esc(s.name) + '</div><div class="row-sub">' + esc(s.target) + ' · ' + s.phase + '</div></div><span data-scan="' + s.id + '">' + ringSvg(s.progress) + '</span></div>';
      html += '<div class="meta"><span>' + s.endpoints + ' endpoints</span><span>' + s.requests + ' req</span><span>' + s.findings + ' findings</span></div></div>';
    });
    html += running.length ? "" : '<div class="empty">No scans running right now.</div>';
    html += '</div>';

    html += '<h2 class="section-title">Live activity</h2><ul class="activity anim-in" style="animation-delay:420ms">';
    activity.slice(0, 6).forEach(function (a) {
      html += '<li>' + (a.t ? '<span class="t" data-fixed="1">' + esc(a.t) + '</span>' : '<span class="t">' + timeNow() + '</span>') + esc(a.text) + ' <span class="who">· ' + esc(a.who) + '</span></li>';
    });
    html += '</ul>';
    return html;
  }

  function bindHome() {
    document.querySelectorAll(".count-up").forEach(function (el) {
      var target = Number(el.getAttribute("data-count")) || 0;
      var start = performance.now(), dur = 900;
      function tick(t) {
        var p = Math.min(1, (t - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    requestAnimationFrame(function () {
      document.querySelectorAll(".ring-fill").forEach(function (el) { el.style.strokeDashoffset = "0"; });
      document.querySelectorAll(".h-bar-fill").forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; });
    });
  }

  function renderTargets() {
    var html = '<h2 class="section-title">Verified targets</h2><div class="grid-list">';
    targets.forEach(function (t) {
      html += '<div class="row-card" onclick="go(\'targets\',' + t.id + ')"><div class="row-top"><div><div class="row-name">' + esc(t.name) + '</div><div class="row-sub">' + esc(t.domain) + ' · ' + t.env + '</div></div>' + (t.verified ? pill("verified", "pill-teal") : pill("pending", "pill-amber")) + '</div>';
      html += '<div class="meta"><span>' + t.assets + ' assets</span><span>' + t.endpoints + ' endpoints</span><span>' + t.findings + ' findings</span><span>Score ' + t.score + '</span></div>' + riskPill(t.risk) + '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderTargetDetail(id) {
    var t = targets[id]; if (!t) return renderTargets();
    var html = detailHeader(t.name);
    html += '<div class="card">' + riskPill(t.risk) + ' ' + (t.verified ? pill("verified", "pill-teal") : pill("pending", "pill-amber")) + ' ' + pill(t.env, "pill-blue");
    html += '<hr class="divider"><div class="kv-grid">';
    html += kv("Domain", t.domain); html += kv("Security score", t.score + " / 100"); html += kv("Assets", t.assets); html += kv("Endpoints", t.endpoints);
    html += kv("Findings", t.findings); html += kv("Auth profile", t.auth); html += kv("Allowed ports", t.ports); html += kv("Last scan", t.lastScan); html += kv("Created", t.created);
    html += '</div></div>';
    html += '<h2 class="section-title">Scope</h2><div class="card"><div class="meta" style="flex-direction:column;gap:6px"><span>Included · ' + t.scope.join(", ") + '</span><span>Excluded · ' + (t.excluded.length ? t.excluded.join(", ") : "none") + '</span></div></div>';
    html += '<h2 class="section-title">Related findings</h2><div class="grid-list">';
    findings.filter(function (f) { return f.target === (t.name.split(" ")[0] === "Atlas" ? "Atlas" : t.name.split(" ")[0]); }).slice(0, 3).forEach(function (f) {
      html += '<div class="row-card" onclick="go(\'findings\',' + f.id + ')"><div class="row-top"><div><div class="row-name">' + esc(f.title) + '</div><div class="row-sub">' + f.endpoint + '</div></div>' + sevPill(f.severity) + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderScans() {
    var html = '<div class="tab-row"><span class="tab-pill active">All</span><span class="tab-pill">Running</span><span class="tab-pill">Completed</span><span class="tab-pill">Queued</span></div><div class="grid-list">';
    scans.forEach(function (s) {
      var cls = s.status === "running" ? "pill-blue" : s.status === "completed" ? "pill-teal" : "pill-dim";
      html += '<div class="row-card" onclick="go(\'scans\',' + s.id + ')"><div class="row-top"><div><div class="row-name">' + esc(s.name) + '</div><div class="row-sub">' + esc(s.target) + ' · ' + s.profile + '</div></div>' + pill(s.status, cls) + '</div>';
      html += '<div class="bar"><span style="width:' + s.progress + '%"></span></div>';
      html += '<div class="meta"><span>Phase ' + s.phase + '</span><span>' + s.requests + ' req</span><span>' + s.findings + ' findings</span><span>' + s.duration + '</span></div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderScanDetail(id) {
    var s = scans[id]; if (!s) return renderScans();
    var cls = s.status === "running" ? "pill-blue" : s.status === "completed" ? "pill-teal" : "pill-dim";
    var html = detailHeader(s.name);
    html += '<div class="card">' + pill(s.status, cls) + ' ' + pill(s.phase, "pill-blue");
    html += '<div class="bar" style="margin-top:12px"><span style="width:' + s.progress + '%"></span></div>';
    html += '<div class="meta"><span>' + s.progress + '%</span><span>Duration ' + s.duration + '</span></div></div>';
    html += '<h2 class="section-title">Statistics</h2><div class="kpi-row">';
    html += '<div class="kpi"><div class="n">' + s.assets + '</div><div class="l">Assets found</div></div>';
    html += '<div class="kpi"><div class="n">' + s.endpoints + '</div><div class="l">Endpoints</div></div>';
    html += '<div class="kpi"><div class="n">' + s.requests + '</div><div class="l">Requests</div></div>';
    html += '<div class="kpi"><div class="n">' + s.params + '</div><div class="l">Parameters</div></div>';
    html += '<div class="kpi"><div class="n">' + s.candidates + '</div><div class="l">Candidates</div></div>';
    html += '<div class="kpi"><div class="n">' + s.confirmed + '</div><div class="l">Confirmed</div></div>';
    html += '</div>';
    html += '<h2 class="section-title">Modules</h2><div class="card"><div class="meta">' + s.modules.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join("") + '</div></div>';
    return html;
  }

  function renderAssets() {
    var html = '<h2 class="section-title">Asset inventory</h2><div class="grid-list">';
    assets.forEach(function (a, i) {
      html += '<div class="row-card" onclick="go(\'assets\',' + i + ')"><div class="row-top"><div><div class="row-name">' + esc(a.host) + '</div><div class="row-sub">' + a.ip + ' · ' + a.ports + '/tcp</div></div>' + riskPill(a.risk) + '</div>';
      html += '<div class="meta">' + a.tech.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join("") + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderAssetDetail(i) {
    var a = assets[i]; if (!a) return renderAssets();
    var html = detailHeader(a.host);
    html += '<div class="card">' + riskPill(a.risk);
    html += '<hr class="divider"><div class="kv-grid">';
    html += kv("IP address", a.ip); html += kv("Ports", a.ports + "/tcp"); html += kv("Page title", a.title); html += kv("TLS", a.tls); html += kv("First seen", a.firstSeen);
    html += '</div></div>';
    html += '<h2 class="section-title">Technology</h2><div class="card"><div class="meta">' + a.tech.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join("") + '</div></div>';
    return html;
  }

  function renderFindings() {
    var html = '<h2 class="section-title">Findings overview</h2>';
    html += '<div class="kpi-row">';
    html += '<div class="kpi"><div class="n">3</div><div class="l">Critical</div></div>';
    html += '<div class="kpi"><div class="n">3</div><div class="l">High</div></div>';
    html += '<div class="kpi"><div class="n">2</div><div class="l">Medium</div></div>';
    html += '<div class="kpi"><div class="n">1</div><div class="l">Low</div></div>';
    html += '</div>';
    html += '<h2 class="section-title">Open findings</h2><div class="grid-list">';
    findings.forEach(function (f) {
      html += '<div class="row-card" onclick="go(\'findings\',' + f.id + ')"><div class="row-top"><div><div class="row-name">' + esc(f.title) + '</div><div class="row-sub">' + f.target + ' · ' + f.endpoint + '</div></div>' + sevPill(f.severity) + '</div>';
      html += '<div class="meta"><span class="chip">' + f.state.replace("_", " ") + '</span><span>' + f.confidence + '% confidence</span></div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderFindingDetail(id) {
    var f = findings[id]; if (!f) return renderFindings();
    var html = detailHeader(f.title);
    html += '<div class="card">' + sevPill(f.severity) + ' ' + pill(f.state.replace("_", " "), f.state === "confirmed" ? "pill-teal" : "pill-amber") + ' <span class="badge-pill pill-blue">' + f.confidence + '%</span>';
    html += '<hr class="divider"><div class="kv-grid">';
    html += kv("Target", f.target); html += kv("Endpoint", f.endpoint); html += kv("Parameter", f.param); html += kv("CWE", f.cwe); html += kv("OWASP", f.owasp); html += kv("CVSS", f.cvss);
    html += '</div></div>';
    html += '<h2 class="section-title">Description</h2><div class="card"><p style="font-size:13px;color:var(--muted);line-height:1.6">' + esc(f.desc) + '</p></div>';
    html += '<h2 class="section-title">Impact</h2><div class="card"><p style="font-size:13px;color:var(--muted);line-height:1.6">' + esc(f.impact) + '</p></div>';
    html += '<h2 class="section-title">Remediation</h2><div class="card"><p style="font-size:13px;color:var(--teal);line-height:1.6">' + esc(f.remediation) + '</p></div>';
    html += '<h2 class="section-title">Evidence</h2><div class="card"><p style="font-size:12px;color:var(--muted);line-height:1.6">' + esc(f.evidence) + '</p></div>';
    return html;
  }

  function renderReports() {
    var html = '<h2 class="section-title">Generated reports</h2><div class="grid-list">';
    reports.forEach(function (r, i) {
      html += '<div class="row-card" onclick="go(\'reports\',' + i + ')"><div class="row-top"><div><div class="row-name">' + esc(r.name) + '</div><div class="row-sub">' + r.type + ' · ' + r.findings + '</div></div>' + pill(r.formats, "pill-blue") + '</div>';
      html += '<div class="meta"><span>' + r.time + '</span><span class="chip">' + r.compliance + '</span></div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderReportDetail(i) {
    var r = reports[i]; if (!r) return renderReports();
    var html = detailHeader(r.name);
    html += '<div class="card">' + pill(r.type, "pill-blue") + ' ' + pill(r.formats, "pill-teal");
    html += '<hr class="divider"><p style="font-size:13px;color:var(--muted);line-height:1.6">' + esc(r.summary) + '</p>';
    html += '<div class="kv-grid" style="margin-top:12px">' + kv("Findings", r.findings) + kv("Compliance", r.compliance) + kv("Generated", r.time) + '</div></div>';
    html += '<button class="btn-primary" style="margin-top:16px" onclick="window.__back()">' + ico("download") + ' Download</button>';
    return html;
  }

  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isInstalled() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    return !!window.navigator.standalone;
  }

  function renderSettings() {
    var html = '<h2 class="section-title">Profile</h2><div class="card">';
    html += '<div style="display:flex;align-items:center;gap:13px"><div class="avatar">DA</div><div><strong>' + esc(user.name) + '</strong><br><small style="color:var(--muted)">' + esc(user.role) + '</small></div></div>';
    html += '<hr class="divider"><div class="kv-grid">' + kv("Email", user.email) + kv("Organization", user.org) + kv("Version", "1.0") + '</div></div>';

    html += '<h2 class="section-title">App · Home screen</h2><div class="card">';
    if (isInstalled()) {
      html += '<div class="install-ok"><span class="nav-ico" data-ico="check"></span><div><strong>Installed on this device</strong><div class="row-sub">Vulnexa Live launches from your home screen.</div></div></div>';
    } else if (isIOS()) {
      html += '<p class="row-name">Add to iPhone / iPad home screen</p><p class="row-sub" style="margin:2px 0 12px">Open Vulnexa Live in Safari first:</p>';
      html += '<div class="mono-url">http://192.168.1.105:4000</div>';
      html += '<div class="install-step"><span class="install-n">1</span><div><strong>Tap the Share button</strong><div class="row-sub">in Safari’s bottom bar</div></div><span class="nav-ico" data-ico="share"></span></div>';
      html += '<div class="install-step"><span class="install-n">2</span><div><strong>Tap “Add to Home Screen”</strong><div class="row-sub">scroll down the share menu</div></div><span class="nav-ico" data-ico="plus"></span></div>';
      html += '<div class="install-step"><span class="install-n">3</span><div><strong>Tap Add</strong><div class="row-sub">Vulnexa Live appears on your home screen</div></div><span class="nav-ico" data-ico="check"></span></div>';
    } else {
      html += '<p class="row-name">Install on Android — fullscreen, no browser UI</p>';
      if (deferredInstall) {
        html += '<button id="settingsInstall" class="btn-primary" style="margin:10px 0 4px">' + ico("download") + ' Install app</button>';
      }
      html += '<div class="install-step"><span class="install-n">1</span><div><strong>Download the certificate</strong><div class="row-sub">one-time setup, tap below</div></div><a class="mini-btn" href="/vulnexa-ca.crt" download>' + ico("download") + '</a></div>';
      html += '<div class="install-step"><span class="install-n">2</span><div><strong>Install the CA on your phone</strong><div class="row-sub">Settings → Security → More → Install a certificate → CA certificate → pick the downloaded file</div></div></div>';
      html += '<div class="install-step"><span class="install-n">3</span><div><strong>Open the secure app</strong><div class="row-sub">tap below, accept any warning</div></div><a class="mini-btn" href="https://192.168.1.105:4443">' + ico("external") + '</a></div>';
      html += '<div class="install-step"><span class="install-n">4</span><div><strong>Add to Home screen</strong><div class="row-sub">Chrome menu ⋮ → Install app / Add to Home screen</div></div></div>';
      html += '<p class="hint">Launches standalone — no URL bar, no Chrome controls.</p>';
    }
    html += '</div>';

    html += '<h2 class="section-title">Preferences</h2><div class="grid-list">';
    html += '<div class="row-card"><span class="row-name">Notifications</span><div class="row-sub">3 unread</div></div>';
    html += '<div class="row-card"><span class="row-name">Theme</span><div class="row-sub">Dark</div></div>';
    html += '<div class="row-card"><span class="row-name">Data source</span><div class="row-sub">' + (liveConnected ? "Live API · connected" : "Connecting… (demo fallback)") + '</div></div>';
    html += '</div>';
    html += '<button class="btn-danger" style="margin-top:10px" onclick="window.__logout()">' + ico("logout") + ' Sign out</button>';
    return html;
  }

  /* ---------------- AI Chat (ChatGPT-style) ---------------- */
  var CHAT_KEY = "vulnexa_chat_v1";
  var MOBILE_TOKEN = "vulnexa-mobile-2026";
  var MOBILE_API = "/api/mobile/chat";
  var currentChatId = null;
  var chats = loadChats();
  var attachedFile = null;
  var cmdIndex = -1;

  var AI_REPLIES = [
    "I can see {N} critical findings across your targets. The top risk is an IDOR on Aurora's account endpoint — remediate that first.",
    "There are 2 scans running right now. Aurora is in passive analysis; Northstar is in active testing.",
    "Your attack surface covers 5 targets, 89 monitored assets, and 1523 endpoints. Scope coverage is strong.",
    "For the reflected XSS on Northstar /search, apply context-aware output encoding and a strict Content-Security-Policy.",
    "Prioritize by CVSS: the IDOR (9.1) and patient record exposure (9.4) should be fixed before anything else.",
  ];
  var COMMANDS = [
    { name: "/targets", desc: "All targets", icon: "targets" },
    { name: "/assets", desc: "Asset inventory", icon: "assets" },
    { name: "/scans", desc: "All scans", icon: "scans" },
    { name: "/findings", desc: "All findings", icon: "findings" },
    { name: "/reports", desc: "Generated reports", icon: "reports" },
  ];

  function loadChats() {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveChats() {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(chats)); } catch (e) {}
  }
  function ensureChat() {
    if (currentChatId && chats[currentChatId]) return;
    currentChatId = "chat_" + Date.now();
    chats[currentChatId] = { messages: [], createdAt: new Date().toLocaleString() };
    saveChats();
  }
  function chatMessages() { return currentChatId && chats[currentChatId] ? chats[currentChatId].messages : []; }

  function addChat(role, html, isData) {
    ensureChat();
    chats[currentChatId].messages.push({ role: role, html: html, data: !!isData });
    saveChats();
    render();
  }
  function escHtml(s) { return esc(s).replace(/\n/g, "<br>"); }
  function md(text) {
    var s = esc(text);
    s = s.replace(/```([\s\S]*?)```/g, function (m, code) { return '<pre class="md-code">' + code + "</pre>"; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`\n]+)`/g, '<code class="md-inline">$1</code>');
    s = s.replace(/^#{1,4}\s+(.+)$/gm, '<div class="md-h">$1</div>');
    s = s.replace(/^\d+\.\s+(.+)$/gm, '<div class="md-li"><span class="md-num"></span>$1</div>');
    s = s.replace(/^[-*]\s+(.+)$/gm, '<div class="md-li"><span class="md-bullet">•</span>$1</div>');
    s = s.replace(/\n/g, "<br>");
    return s;
  }
  function dataBlock(title, items, lineFn) {
    var body = items.map(lineFn).join("");
    return '<div class="cap">' + esc(title) + '</div>' + body;
  }
  function resolveCommand(text) {
    var t = text.trim().toLowerCase();
    if (t.indexOf("/targets") === 0) return dataBlock("TARGETS · " + targets.length, targets, function (x) { return '<div class="li-row"><div><div class="li-title">' + esc(x.name) + '</div><div class="li-sub">' + esc(x.domain) + ' · ' + x.findings + ' findings</div></div>' + riskPill(x.risk) + '</div>'; });
    if (t.indexOf("/assets") === 0) return dataBlock("ASSETS · " + assets.length, assets, function (x) { return '<div class="li-row"><div><div class="li-title">' + esc(x.host) + '</div><div class="li-sub">' + esc(x.ip) + ' · ' + esc(x.tech.join(", ")) + '</div></div>' + riskPill(x.risk) + '</div>'; });
    if (t.indexOf("/scans") === 0) return dataBlock("SCANS · " + scans.length, scans, function (x) { return '<div class="li-row"><div><div class="li-title">' + esc(x.name) + '</div><div class="li-sub">' + x.status + ' · ' + x.progress + '%</div></div>' + pill(x.status, x.status === "running" ? "pill-blue" : "pill-teal") + '</div>'; });
    if (t.indexOf("/findings") === 0) return dataBlock("FINDINGS · " + findings.length, findings, function (x) { return '<div class="li-row"><div><div class="li-title">' + esc(x.title) + '</div><div class="li-sub">' + esc(x.target) + ' · ' + x.confidence + '%</div></div>' + sevPill(x.severity) + '</div>'; });
    if (t.indexOf("/reports") === 0) return dataBlock("REPORTS · " + reports.length, reports, function (x) { return '<div class="li-row"><div><div class="li-title">' + esc(x.name) + '</div><div class="li-sub">' + x.type + ' · ' + x.findings + '</div></div>' + pill(x.formats, "pill-blue") + '</div>'; });
    return null;
  }

  function renderAi() {
    var msgs = chatMessages();
    var html = '<div class="chat-screen">';
    html += '<div class="chat-top"><button class="icon-btn" onclick="window.__back()">' + ico("back") + '</button><h1>AI Chat</h1><span class="spacer"></span>';
    html += '<button class="icon-btn" title="New chat" onclick="window.__newChat()">' + ico("plus") + '</button>';
    html += '<button class="icon-btn" title="History" onclick="window.__toggleHistory()">' + ico("menu") + '</button></div>';
    html += '<div id="chatMessages" class="chat-messages"></div>';
    html += '<div id="chatScreen" style="position:relative;flex:0 0 auto">';
    html += '<div id="cmdMenu" class="cmd-menu hidden"></div>';
    html += '<div class="chat-inputbar"><div id="attachChips"></div><div class="chat-inputrow">';
    html += '<button class="icon-btn" id="attachBtn" title="Attach file">' + ico("plus") + '</button>';
    html += '<input id="chatText" placeholder="Ask Vulnexa AI… type / for commands" />';
    html += '<button class="icon-btn" id="chatSend" title="Send">' + ico("send") + '</button>';
    html += '</div><p class="hint">Use <strong>/</strong> to see commands · Enter to send</p></div>';
    html += '<input id="fileInput" type="file" class="hidden" /></div></div>';
    // history panel
    html += '<div id="historyPanel" class="history-panel hidden"></div>';
    return html;
  }

  function renderChatMessages() {
    var el = $("chatMessages"); if (!el) return;
    var msgs = chatMessages();
    if (!msgs.length) {
      el.innerHTML = '<div class="chat-empty">' + ico("chat") + '<div><strong>Vulnexa AI</strong><p>Ask about targets, scans, findings, reports — or type <b>/</b> to see options.</p></div></div>';
      return;
    }
    el.innerHTML = msgs.map(function (m) {
      return '<div class="chat-msg ' + m.role + '"><div class="bubble' + (m.data ? " data" : "") + '">' + m.html + '</div></div>';
    }).join("");
    el.scrollTop = el.scrollHeight;
  }

  function renderHistory() {
    var panel = $("historyPanel"); if (!panel) return;
    var ids = Object.keys(chats).sort(function (a, b) { return (chats[b].createdAt || "") < (chats[a].createdAt || "") ? -1 : 1; });
    if (!ids.length) { panel.innerHTML = '<div class="history-empty">No previous chats yet.</div>'; return; }
    panel.innerHTML = ids.map(function (id) {
      var c = chats[id]; var title = c.messages.length ? c.messages[0].html.replace(/<[^>]+>/g, "").slice(0, 40) : "Empty chat";
      return '<div class="history-item"><div><div class="h-title">' + esc(title) + '</div><div class="h-sub">' + esc(c.createdAt || "") + ' · ' + c.messages.length + ' msgs</div></div><button onclick="window.__deleteChat(\'' + id + '\')">Delete</button></div>';
    }).join("");
    panel.classList.remove("hidden");
  }

  function bindChat() {
    renderChatMessages();
    var log = $("chatMessages");
    if (log && log.scrollHeight) log.scrollTop = log.scrollHeight;

    $("chatSend").addEventListener("click", sendChat);
    $("chatText").addEventListener("keydown", chatKeydown);
    $("chatText").addEventListener("input", chatInput);
    $("attachBtn").addEventListener("click", function () { $("fileInput").click(); });
    $("fileInput").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (f) { attachedFile = f.name; $("attachChips").innerHTML = '<span class="attach-chip">' + esc(f.name) + ' <b onclick="window.__clearAttach()" style="cursor:pointer">×</b></span>'; }
    });
  }

  function chatInput() {
    var input = $("chatText"); var menu = $("cmdMenu"); var v = input.value;
    if (v.trim().charAt(0) === "/") {
      var q = v.trim().toLowerCase().slice(1);
      var matches = COMMANDS.filter(function (c) { return c.name.slice(1).indexOf(q) === 0; });
      menu.innerHTML = matches.length ? matches.map(function (c, i) {
        return '<div class="cmd-item" data-i="' + i + '"><span class="cmd-name">' + c.name + '</span><span class="cmd-desc">' + c.desc + '</span></div>';
      }).join("") : '<div class="cmd-empty">No commands match “' + esc(q) + '”</div>';
      menu.classList.remove("hidden");
      cmdIndex = -1;
      Array.prototype.forEach.call(menu.children, function (child) {
        child.onclick = function () { input.value = COMMANDS[Number(child.getAttribute("data-i"))].name + " "; menu.classList.add("hidden"); input.focus(); };
      });
    } else {
      menu.classList.add("hidden");
    }
  }

  function chatKeydown(e) {
    var menu = $("cmdMenu");
    if (menu.classList.contains("hidden")) {
      if (e.key === "Enter") { e.preventDefault(); sendChat(); }
      return;
    }
    var items = menu.querySelectorAll(".cmd-item");
    if (!items.length) { if (e.key === "Enter") { e.preventDefault(); sendChat(); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); cmdIndex = (cmdIndex + 1) % items.length; }
    else if (e.key === "ArrowUp") { e.preventDefault(); cmdIndex = (cmdIndex - 1 + items.length) % items.length; }
    else if (e.key === "Enter") { e.preventDefault(); items[cmdIndex > -1 ? cmdIndex : 0].onclick(); return; }
    else { cmdIndex = -1; return; }
    items.forEach(function (it, i) { it.style.background = i === cmdIndex ? "rgba(185,255,45,.12)" : ""; });
  }

  function sendChat() {
    var input = $("chatText"); var text = input.value.trim(); if (!text) return;
    input.value = ""; $("cmdMenu").classList.add("hidden");
    addChat("user", escHtml(text));
    var note = attachedFile ? " (attached: " + esc(attachedFile) + ")" : "";
    var file = attachedFile;
    attachedFile = null; $("attachChips").innerHTML = "";
    var data = resolveCommand(text);
    if (data) { addChat("ai", data + note, true); return; }
    // Ask the live backend for a real, context-aware answer.
    askMobile(text, file, note);
  }

  function askMobile(text, file, note) {
    var history = chatMessages().slice(-10).map(function (m) {
      return { role: m.role, content: m.html.replace(/<[^>]+>/g, " ") };
    });
    addChat("ai", '<i style="color:var(--dim)">Vulnexa AI is thinking…</i>');
    fetch(MOBILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: MOBILE_TOKEN, messages: history, attachment: file || "" }),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        var reply = res.ok && res.j && res.j.reply ? res.j.reply : (res.j && res.j.detail ? res.j.detail : "No answer.");
        var last = chatMessages();
        last[last.length - 1].html = md(reply) + note;
        saveChats(); renderChatMessages();
      })
      .catch(function () {
        // Offline / backend down: fall back to a local context-aware reply.
        var last = chatMessages();
        var reply = AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)].replace("{N}", findings.filter(function (f) { return f.severity === "critical"; }).length);
        last[last.length - 1].html = md(reply) + note + '<div style="color:var(--dim);font-size:10px;margin-top:6px">offline reply</div>';
        saveChats(); renderChatMessages();
      });
  }

  window.__newChat = function () {
    currentChatId = null; ensureChat();
    var hp = $("historyPanel"); if (hp) hp.classList.add("hidden");
    render();
  };
  window.__toggleHistory = function () {
    var hp = $("historyPanel");
    if (hp.classList.contains("hidden")) { renderHistory(); hp.classList.remove("hidden"); }
    else { hp.classList.add("hidden"); }
  };
  window.__deleteChat = function (id) { delete chats[id]; saveChats(); renderHistory(); };
  window.__clearAttach = function () { attachedFile = null; $("attachChips").innerHTML = ""; };

  /* ---------------- Install PWA ---------------- */
  function showInstall() {
    var btns = ["installBtn", "installSidebar", "settingsInstall"];
    btns.forEach(function (id) { var el = $(id); if (el) el.classList.remove("hidden"); });
  }
  function requestInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then(function () { deferredInstall = null; });
  }

  /* ---------------- Live data from the backend ---------------- */
  function loadLiveData() {
    fetch(DATA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: MOBILE_TOKEN }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j) return;
        var d = res.j;
        if (d.targets && d.targets.length) targets = d.targets;
        if (d.scans && d.scans.length) scans = d.scans;
        if (d.assets && d.assets.length) assets = d.assets;
        if (d.findings && d.findings.length) findings = d.findings;
        if (d.reports && d.reports.length) reports = d.reports;
        if (d.workers && d.workers.length) workers = d.workers;
        if (d.activity && d.activity.length) activity = d.activity;
        liveConnected = true;
        if (auth() && state.id == null && state.view === "home") render();
      })
      .catch(function () { /* keep demo data when the backend is unreachable */ });
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderIcons();
    if (auth()) { nav(); } else { $("login").classList.remove("hidden"); }

    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if ($("user").value.trim() === AUTH_USER && $("pass").value === AUTH_PASS) {
        try { localStorage.setItem(AUTH_KEY, "1"); } catch (err) {}
        $("loginError").classList.add("hidden");
        nav();
      } else {
        $("loginError").classList.remove("hidden");
      }
    });

    var lastTap = 0;
    function routeTap(target) {
      var t = target && target.closest ? target.closest("#menuBtn, #notifBtn, #installBtn, #installSidebar, #logoutSidebar, #settingsInstall, #sidebarNav a, #bottomNav a") : null;
      if (!t) return;
      var id = t.id;
      if (id === "menuBtn") { $("app").classList.add("sidebar-open"); return; }
      if (id === "notifBtn") { go("findings"); return; }
      if (id === "installBtn" || id === "installSidebar" || id === "settingsInstall") { requestInstall(); return; }
      if (id === "logoutSidebar") { logout(); return; }
      go(t.getAttribute("data-view"));
    }
    // iOS-safe taps: run inline onclick handlers from touchend so no synthetic click is needed.
    document.addEventListener("touchend", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[onclick]") : null;
      if (t && t.onclick) { lastTap = Date.now(); e.preventDefault(); t.onclick(e); return; }
      lastTap = Date.now();
      routeTap(e.target);
    }, { passive: false });
    document.addEventListener("click", function (e) {
      if (Date.now() - lastTap < 500) return;
      routeTap(e.target);
    });
    $("backdrop").addEventListener("click", closeSidebar);
    $("backdrop").addEventListener("touchend", closeSidebar);

    setInterval(function () {
      if (!auth() || state.view !== "home" || state.id != null) return;
      document.querySelectorAll("[data-scan]").forEach(function (wrap) {
        var s = scans[Number(wrap.getAttribute("data-scan"))]; if (!s) return;
        s.progress = Math.min(100, s.progress + Math.floor(Math.random() * 3));
        var num = wrap.querySelector(".ring-num"); if (num) num.textContent = s.progress + "%";
        var fill = wrap.querySelector(".ring-fill");
        if (fill) { var c = 2 * Math.PI * 19; fill.style.strokeDasharray = (s.progress / 100 * c).toFixed(1) + " " + c.toFixed(1); }
      });
      document.querySelectorAll(".activity .t:not([data-fixed])").forEach(function (el) { el.textContent = timeNow(); });
    }, 3000);

    loadLiveData();
    setInterval(loadLiveData, 30000);
  });

  window.__logout = logout;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    showInstall();
  });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
})();