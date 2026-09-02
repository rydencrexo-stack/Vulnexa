(function () {
  'use strict';

  var finePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  var hasGsap = typeof window !== 'undefined' && !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  var introPlayed = false;
  function playIntro() {
    if (introPlayed) return;
    introPlayed = true;
    heroIntro();
  }

  var pre = document.getElementById('preloader');
  var bootLog = document.getElementById('bootLog');
  var bootFill = document.getElementById('bootFill');
  var bootPct = document.getElementById('bootPct');

  if (pre && bootLog) {
    var bootLines = [
      ['> vulnexa core v0.9.2 — initializing', ''],
      ['> loading scanner modules ............ ', 'ok'],
      ['> passive array ...................... ', 'ok'],
      ['> verifying target scope ............. ', 'ok'],
      ['> establishing secure uplink ......... ', 'ok'],
      ['> rendering interface', '']
    ];
    var li = 0;
    var lineIv = setInterval(function () {
      if (li >= bootLines.length) { clearInterval(lineIv); return; }
      var div = document.createElement('div');
      div.innerHTML = bootLines[li][0] + (bootLines[li][1] ? '<span class="ok">' + bootLines[li][1] + '</span>' : '');
      bootLog.appendChild(div);
      li++;
    }, 190);

    var p = 0;
    var pctIv = setInterval(function () {
      p = Math.min(100, p + 3 + Math.random() * 9);
      if (bootPct) bootPct.textContent = Math.floor(p) + '%';
      if (bootFill) bootFill.style.width = p + '%';
      if (p >= 100) {
        clearInterval(pctIv);
        setTimeout(function () {
          pre.classList.add('done');
          playIntro();
          setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 1000);
        }, 420);
      }
    }, 85);
  } else {
    playIntro();
  }

  var heroTitle = document.getElementById('heroTitle');
  var heroReveals = document.querySelectorAll('#top [data-reveal]');

  function splitWords(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.innerHTML = '';
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
          w.appendChild(wi); el.appendChild(w);
        });
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') { el.appendChild(node); return; }
        var w2 = document.createElement('span'); w2.className = 'w';
        var wi2 = document.createElement('span'); wi2.className = 'wi';
        wi2.appendChild(node); w2.appendChild(wi2); el.appendChild(w2);
      }
    });
  }

  if (hasGsap) {
    if (heroTitle) {
      splitWords(heroTitle);
      gsap.set('#top .wi', { yPercent: 115 });
    }
    gsap.set(heroReveals, { opacity: 0, y: 30 });
  }

  function heroIntro() {
    if (!hasGsap) return;
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    if (heroTitle) tl.to('#top .wi', { yPercent: 0, duration: 1.05, stagger: 0.045 });
    tl.to(heroReveals, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, '-=0.55');
  }

  var lenis = null;
  if (typeof window !== 'undefined' && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    var rafLenis = function (t) { lenis.raf(t); requestAnimationFrame(rafLenis); };
    requestAnimationFrame(rafLenis);
    if (hasGsap) lenis.on('scroll', ScrollTrigger.update);
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') { e.preventDefault(); return; }
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -80 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  if (finePointer) {
    document.body.classList.add('has-cursor');
    var cur = document.getElementById('cursor');
    var cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function cursorLoop() {
      cx += (tx - cx) * 0.35;
      cy += (ty - cy) * 0.35;
      if (cur) { cur.style.left = cx + 'px'; cur.style.top = cy + 'px'; }
      requestAnimationFrame(cursorLoop);
    })();
    document.querySelectorAll('a, button, .faq-toggle, input, .radar').forEach(function (el) {
      el.addEventListener('mouseenter', function () { if (cur) cur.classList.add('grow'); });
      el.addEventListener('mouseleave', function () { if (cur) cur.classList.remove('grow'); });
    });
  }

  if (finePointer) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + x * 0.15 + 'px,' + y * 0.25 + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  document.querySelectorAll('.hacker-panel, .panel').forEach(function (p) {
    p.addEventListener('mousemove', function (e) {
      var r = p.getBoundingClientRect();
      p.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      p.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  var header = document.getElementById('siteHeader');
  var progress = document.getElementById('scrollProgress');
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (header) {
      if (y > 24) {
        header.classList.add('bg-base/90', 'backdrop-blur-xl', 'border-line');
        header.classList.remove('border-transparent');
      } else {
        header.classList.remove('bg-base/90', 'backdrop-blur-xl', 'border-line');
        header.classList.add('border-transparent');
      }
    }
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
  }, { passive: true });

  var navLinks = document.querySelectorAll('#siteHeader nav a[href^="#"]');
  var spySections = [];
  navLinks.forEach(function (a) {
    var sec = document.querySelector(a.getAttribute('href'));
    if (sec) spySections.push({ link: a, sec: sec });
  });
  function spy() {
    var pos = window.scrollY + window.innerHeight * 0.35;
    var current = null;
    spySections.forEach(function (s) {
      if (s.sec.offsetTop <= pos) current = s;
    });
    navLinks.forEach(function (a) { a.classList.remove('nav-active'); });
    if (current) current.link.classList.add('nav-active');
  }
  if (spySections.length) {
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  var bar1 = document.getElementById('bar1');
  var bar2 = document.getElementById('bar2');
  var bar3 = document.getElementById('bar3');
  var menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    if (mobileMenu) mobileMenu.classList.toggle('hidden', !open);
    if (bar1) bar1.style.transform = open ? 'translateY(8px) rotate(45deg)' : '';
    if (bar2) bar2.style.opacity = open ? '0' : '1';
    if (bar3) bar3.style.transform = open ? 'translateY(-8px) rotate(-45deg)' : '';
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen); });
    document.querySelectorAll('.mobile-link').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  document.querySelectorAll('.faq-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  var counters = document.querySelectorAll('.counter');
  var counterIO = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      counterIO.unobserve(el);
      var target = parseInt(el.dataset.target, 10);
      var dur = 1800;
      var start = performance.now();
      function tick(now) {
        var t = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 }) : null;
  if(counterIO) counters.forEach(function (c) { counterIO.observe(c); });

  var logBox = document.getElementById('logBox');
  var scanning = false;

  function addLog(cls, text) {
    if (!logBox) return;
    var div = document.createElement('div');
    div.className = cls + ' log-line';
    div.textContent = text;
    logBox.appendChild(div);
    while (logBox.children.length > 8) logBox.removeChild(logBox.firstChild);
    logBox.scrollTop = logBox.scrollHeight;
  }

  var ambientLines = [
    ['text-mut', '[recon] enumerating subdomains... 47 found'],
    ['text-mut', '[httpx] probing live hosts... 31/47 alive'],
    ['text-acid', '[passive] analyzing security headers...'],
    ['text-amber', '[!] missing Content-Security-Policy'],
    ['text-mut', '[katana] crawling endpoints... 1,284 mapped'],
    ['text-mut', '[secrets] scanning JS bundles... clean'],
    ['text-alert', '[!!] reflected XSS candidate -> /search?q='],
    ['text-acid', '[ok] evidence captured - queued for review'],
    ['text-mut', '[ai] correlating findings... 3 duplicates merged'],
    ['text-acid', '[report] coverage 96% - 17 findings open']
  ];
  var ambientIdx = 0;
  setInterval(function () {
    if (scanning || !logBox) return;
    var entry = ambientLines[ambientIdx % ambientLines.length];
    ambientIdx++;
    addLog(entry[0], entry[1]);
  }, 2600);

  var scanForm = document.getElementById('scanForm');
  var scanTarget = document.getElementById('scanTarget');
  if (scanForm && scanTarget && logBox) {
    scanForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (scanning) return;
      var target = scanTarget.value.trim() || 'portal.example.com';
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(target)) {
        addLog('text-alert', '[error] invalid target — use a valid domain (simulated)');
        return;
      }
      scanning = true;
      var btn = scanForm.querySelector('button[type="submit"]');
      if (btn) btn.textContent = 'SCANNING...';
      var subs = Math.floor(18 + Math.random() * 60);
      var hosts = Math.floor(subs * 0.6);
      var eps = Math.floor(400 + Math.random() * 1400);
      var finds = Math.floor(3 + Math.random() * 18);
      var seq = [
        [200, 'text-dim', '$ vulnexa scan --target ' + target],
        [500, 'text-mut', '[scope] ownership check ................ ok'],
        [500, 'text-mut', '[recon] enumerating subdomains...'],
        [700, 'text-acid', '[recon] ' + subs + ' subdomains discovered'],
        [500, 'text-mut', '[httpx] probing live hosts... ' + hosts + '/' + subs + ' alive'],
        [600, 'text-mut', '[naabu] port sweep ................ 80, 443, 8080'],
        [600, 'text-mut', '[katana] crawling endpoints... ' + eps.toLocaleString('en-US') + ' mapped'],
        [600, 'text-acid', '[passive] header + TLS analysis complete'],
        [700, 'text-amber', '[!] weak Content-Security-Policy on 2 hosts'],
        [700, 'text-alert', '[!!] reflected XSS candidate -> /search?q='],
        [600, 'text-mut', '[secrets] scanning JS bundles ....... clean'],
        [700, 'text-acid', '[ai] correlating findings... duplicates merged'],
        [600, 'text-acid', '[done] report ready — ' + finds + ' findings queued for review (simulated)']
      ];
      var delay = 0;
      seq.forEach(function (step) {
        delay += step[0];
        setTimeout(function () { addLog(step[1], step[2]); }, delay);
      });
      setTimeout(function () {
        scanning = false;
        if (btn) btn.textContent = 'RUN SCAN';
      }, delay + 300);
    });
  }

  var aiResponse = document.getElementById('aiResponse');
  if (aiResponse) {
    var aiFinal = aiResponse.innerHTML;
    var aiPlain = aiResponse.textContent;
    aiResponse.textContent = '';
    var aiTyped = false;
    var aiIO = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || aiTyped) return;
        aiTyped = true;
        aiIO.unobserve(aiResponse);
        var i = 0;
        var typeIv = setInterval(function () {
          i += 2;
          aiResponse.textContent = aiPlain.slice(0, i);
          if (i >= aiPlain.length) {
            clearInterval(typeIv);
            aiResponse.innerHTML = aiFinal;
          }
        }, 18);
      });
    }, { threshold: 0.5 }) : null;
    if(aiIO) aiIO.observe(aiResponse);
  }

  var radar = document.querySelector('.radar');
  if (radar) {
    radar.addEventListener('click', function (e) {
      var r = radar.getBoundingClientRect();
      var b = document.createElement('span');
      b.className = 'radar-blip ping';
      b.style.left = Math.round((e.clientX - r.left) / r.width * 100) + '%';
      b.style.top = Math.round((e.clientY - r.top) / r.height * 100) + '%';
      radar.appendChild(b);
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2300);
    });
  }

  var tiltCard = document.getElementById('tiltCard');
  if (tiltCard && finePointer) {
    tiltCard.addEventListener('mousemove', function (e) {
      var r = tiltCard.getBoundingClientRect();
      var rx = ((e.clientY - r.top) / r.height - 0.5) * -3;
      var ry = ((e.clientX - r.left) / r.width - 0.5) * 4;
      tiltCard.style.transform = 'perspective(1100px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    });
    tiltCard.addEventListener('mouseleave', function () { tiltCard.style.transform = ''; });
  }

  if (hasGsap) {
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      if (el.closest('#top')) return;
      gsap.from(el, {
        y: 36,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    gsap.utils.toArray('.sec-num').forEach(function (n) {
      var sec = n.closest('section');
      if (!sec) return;
      gsap.to(n, {
        yPercent: -22,
        ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    if (document.getElementById('consoleTilt')) {
      gsap.fromTo('#consoleTilt',
        { rotateX: 10, y: 50, scale: 0.98, transformOrigin: 'center top' },
        {
          rotateX: 0, y: 0, scale: 1, ease: 'none',
          scrollTrigger: { trigger: '#top', start: 'top top', end: '80% bottom', scrub: 1 }
        });
    }

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    setTimeout(function () { ScrollTrigger.refresh(); }, 1500);
  }

  // Watchdog: never leave content invisible. If GSAP/ScrollTrigger failed to
  // reveal (bad script load, Lenis conflict, etc.), force everything visible.
  function forceReveal() {
    var all = document.querySelectorAll('[data-reveal], #top .wi');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!el) continue;
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.visibility = 'visible';
      el.classList.remove('w');
    }
  }
  // Reveal hero immediately after the preloader if the intro didn't play.
  function revealHeroNow() {
    var heroEls = document.querySelectorAll('#top [data-reveal], #top .wi');
    for (var i = 0; i < heroEls.length; i++) heroEls[i].style.opacity = '1';
  }
  function revealScrollTriggered() {
    if (hasGsap) { try { ScrollTrigger.update(); ScrollTrigger.refresh(); } catch (e) {} }
    // If any [data-reveal] element still has opacity 0 and is in view, force it.
    var els = document.querySelectorAll('[data-reveal]');
    for (var i = 0; i < els.length; i++) {
      var rect = els[i].getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        var op = window.getComputedStyle(els[i]).opacity;
        if (op === '0' || parseFloat(op) < 0.05) els[i].style.opacity = '1';
      }
    }
  }
  window.addEventListener('scroll', function () { revealScrollTriggered(); }, { passive: true });
  window.addEventListener('resize', function () { if (hasGsap) { try { ScrollTrigger.refresh(); } catch (e) {} } }, { passive: true });
  setTimeout(revealHeroNow, 2500);
  setTimeout(forceReveal, 4000);

  var canvas = document.getElementById('heroCanvas');
  if (canvas && window.THREE) {
    try {
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 6.5;

      var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      var group = new THREE.Group();
      scene.add(group);

      var NODE_COUNT = 420;
      var R = 2.6;
      var positions = new Float32Array(NODE_COUNT * 3);
      var pts = [];
      for (var i = 0; i < NODE_COUNT; i++) {
        var phi = Math.acos(1 - 2 * (i + 0.5) / NODE_COUNT);
        var theta = Math.PI * (1 + Math.sqrt(5)) * i;
        var x = R * Math.sin(phi) * Math.cos(theta);
        var y = R * Math.sin(phi) * Math.sin(theta);
        var z = R * Math.cos(phi);
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        pts.push(new THREE.Vector3(x, y, z));
      }
      var nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      group.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({
        color: 0xb9ff2d, size: 0.04, transparent: true, opacity: 0.85, sizeAttenuation: true
      })));

      var linePos = [];
      var threshold = 0.95;
      for (var a = 0; a < NODE_COUNT; a++) {
        for (var b = a + 1; b < NODE_COUNT; b++) {
          if (pts[a].distanceTo(pts[b]) < threshold) {
            linePos.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
          }
        }
      }
      var lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
      group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
        color: 0x3d4a35, transparent: true, opacity: 0.5
      })));

      group.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(R * 1.35, 1),
        new THREE.MeshBasicMaterial({ color: 0xb9ff2d, wireframe: true, transparent: true, opacity: 0.05 })
      ));

      var dustCount = 240;
      var dustPos = new Float32Array(dustCount * 3);
      for (var d = 0; d < dustCount; d++) {
        dustPos[d * 3] = (Math.random() - 0.5) * 16;
        dustPos[d * 3 + 1] = (Math.random() - 0.5) * 10;
        dustPos[d * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
      }
      var dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
        color: 0x8a9683, size: 0.02, transparent: true, opacity: 0.4
      }));
      scene.add(dust);

      var gmx = 0, gmy = 0;
      window.addEventListener('mousemove', function (e) {
        gmx = e.clientX / window.innerWidth - 0.5;
        gmy = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });

      function resize() {
        var w = canvas.clientWidth || canvas.parentElement.clientWidth;
        var h = canvas.clientHeight || canvas.parentElement.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize);
      resize();

      var clock = new THREE.Clock();
      (function animate() {
        requestAnimationFrame(animate);
        var t = clock.getElapsedTime();
        group.rotation.y = t * 0.07 + gmx * 0.35;
        group.rotation.x = Math.sin(t * 0.15) * 0.08 + gmy * 0.2;
        group.position.y = -0.3;
        group.position.x = window.innerWidth >= 1024 ? 2.1 : 0;
        dust.rotation.y = t * 0.015;
        renderer.render(scene, camera);
      })();
    } catch (err) {
      canvas.style.display = 'none';
    }
  }
})();
