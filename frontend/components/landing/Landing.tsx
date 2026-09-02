"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LandingBody } from "./LandingBody";
import { Counter, Panel, SurfaceCanvas, magnetic, useActiveSection, useReveal, useScrollState } from "./kit";

const NAV = [
  ["PLATFORM", "platform"],
  ["CAPABILITIES", "capabilities"],
  ["WORKFLOW", "how-it-works"],
  ["AI ANALYST", "ai-analyst"],
  ["SECURITY", "security"],
  ["LEARNING", "learning"],
  ["FAQ", "faq"],
] as const;

const RAIL = [
  ["00", "top", "Intro"],
  ["01", "platform", "Platform"],
  ["02", "capabilities", "Capabilities"],
  ["03", "how-it-works", "Workflow"],
  ["04", "ai-analyst", "AI Analyst"],
  ["05", "security", "Security"],
  ["06", "solution", "Why"],
  ["07", "learning", "Learning"],
  ["08", "faq", "FAQ"],
] as const;

const SECTION_IDS = RAIL.map(([, id]) => id);

const BOOT = [
  ["> vulnexa core v0.9.2 — initializing", ""],
  ["> loading scanner modules ............ ", "ok"],
  ["> passive array ...................... ", "ok"],
  ["> verifying target scope ............. ", "ok"],
  ["> establishing secure uplink ......... ", "ok"],
  ["> rendering interface", ""],
] as const;

const AMBIENT: Array<[string, string]> = [
  ["t-mute", "[recon] enumerating subdomains... 47 found"],
  ["t-mute", "[httpx] probing live hosts... 31/47 alive"],
  ["t-lime", "[passive] analyzing security headers..."],
  ["t-amber", "[!] missing Content-Security-Policy"],
  ["t-mute", "[katana] crawling endpoints... 1,284 mapped"],
  ["t-mute", "[secrets] scanning JS bundles... clean"],
  ["t-red", "[!!] reflected XSS candidate -> /search?q="],
  ["t-lime", "[ok] evidence captured - queued for review"],
  ["t-mute", "[ai] correlating findings... 3 duplicates merged"],
  ["t-lime", "[report] coverage 96% - 17 findings open"],
];

const TELEMETRY: Array<[string, string, string]> = [
  ["TARGETS VERIFIED", "12", "t-ink"],
  ["SCANNER MODULES", "10 ARMED", "t-ink"],
  ["PASSIVE CHECKS", "42 RUNNING", "t-lime"],
  ["SCAN COVERAGE", "96%", "t-ink"],
  ["OPEN FINDINGS", "17", "t-amber"],
  ["UPLINK", "SECURE", "t-lime"],
];

const STATS: Array<[number, string, string, number, string]> = [
  [247, "", "ASSETS DISCOVERED", 62, "t-ink"],
  [1284, "", "ENDPOINTS MAPPED", 78, "t-ink"],
  [96, "%", "SCAN COVERAGE", 96, "t-lime"],
  [17, "", "SECURITY FINDINGS", 34, "t-amber"],
];

const TICKER = [
  "SUBDOMAIN DISCOVERY",
  "ENDPOINT MAPPING",
  "PASSIVE ANALYSIS",
  "ACTIVE SCANNING",
  "AI-ASSISTED TRIAGE",
  "EVIDENCE-BASED FINDINGS",
  "VULNERABILITY INTELLIGENCE",
  "REMEDIATION TRACKING",
];

type LogLine = { id: number; tone: string; text: string };

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const { progress, stuck } = useScrollState();
  const active = useActiveSection(SECTION_IDS);
  useReveal(root);

  const [booting, setBooting] = useState(true);
  const [bootOut, setBootOut] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [bootPct, setBootPct] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [charged, setCharged] = useState(false);
  const [target, setTarget] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([
    { id: 0, tone: "t-dim", text: "$ vulnexa scan --target portal.example.com" },
  ]);

  const lineId = useRef(1);
  const ambientAt = useRef(0);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  const push = useCallback((tone: string, text: string) => {
    setLines((prev) => [...prev, { id: lineId.current++, tone, text }].slice(-8));
  }, []);

  /* ---- boot sequence -------------------------------------------------- */
  useEffect(() => {
    const skip =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.sessionStorage.getItem("ds-booted") === "1";
    if (skip) {
      setBooting(false);
      return;
    }
    document.body.style.overflow = "hidden";
    const steps = window.setInterval(() => setBootStep((n) => Math.min(BOOT.length, n + 1)), 190);
    const pct = window.setInterval(() => setBootPct((n) => Math.min(100, n + 4)), 34);
    const out = window.setTimeout(() => setBootOut(true), 1250);
    const gone = window.setTimeout(() => {
      setBooting(false);
      window.sessionStorage.setItem("ds-booted", "1");
    }, 2100);
    return () => {
      window.clearInterval(steps);
      window.clearInterval(pct);
      window.clearTimeout(out);
      window.clearTimeout(gone);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!booting) document.body.style.overflow = "";
  }, [booting]);

  /* ---- meters + ambient log ------------------------------------------- */
  useEffect(() => {
    const t = window.setTimeout(() => setCharged(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      if (busy.current) return;
      const [tone, text] = AMBIENT[ambientAt.current % AMBIENT.length];
      ambientAt.current += 1;
      push(tone, text);
    }, 2600);
    return () => window.clearInterval(iv);
  }, [push]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  /* ---- simulated scan -------------------------------------------------- */
  const runScan = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const host = target.trim() || "portal.example.com";
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(host)) {
      push("t-red", "[error] invalid target — use a valid domain (simulated)");
      return;
    }
    busy.current = true;
    setScanning(true);

    const subs = Math.floor(18 + Math.random() * 60);
    const hosts = Math.floor(subs * 0.6);
    const endpoints = Math.floor(400 + Math.random() * 1400);
    const findings = Math.floor(3 + Math.random() * 18);
    const steps: Array<[number, string, string]> = [
      [200, "t-dim", `$ vulnexa scan --target ${host}`],
      [500, "t-mute", "[scope] ownership check ................ ok"],
      [500, "t-mute", "[recon] enumerating subdomains..."],
      [700, "t-lime", `[recon] ${subs} subdomains discovered`],
      [500, "t-mute", `[httpx] probing live hosts... ${hosts}/${subs} alive`],
      [600, "t-mute", "[naabu] port sweep ................ 80, 443, 8080"],
      [600, "t-mute", `[katana] crawling endpoints... ${endpoints.toLocaleString("en-US")} mapped`],
      [600, "t-lime", "[passive] header + TLS analysis complete"],
      [700, "t-amber", "[!] weak Content-Security-Policy on 2 hosts"],
      [700, "t-red", "[!!] reflected XSS candidate -> /search?q="],
      [600, "t-mute", "[secrets] scanning JS bundles ....... clean"],
      [700, "t-lime", "[ai] correlating findings... duplicates merged"],
      [600, "t-lime", `[done] report ready — ${findings} findings queued for review (simulated)`],
    ];

    let at = 0;
    for (const [wait, tone, text] of steps) {
      at += wait;
      timers.current.push(window.setTimeout(() => push(tone, text), at));
    }
    timers.current.push(
      window.setTimeout(() => {
        busy.current = false;
        setScanning(false);
      }, at + 320),
    );
  };

  return (
    <div ref={root}>
      {booting ? (
        <div className={cn("ds-boot", bootOut && "is-done")} onClick={() => setBootOut(true)}>
          <div className="ds-boot-card">
            <div className="flex items-center gap-3 mb-6">
              <Mark className="w-6 h-6" />
              <span className="ds-mono t-ink">VULNEXA // BOOT SEQUENCE</span>
            </div>
            <div className="ds-boot-log">
              {BOOT.slice(0, bootStep).map(([text, ok]) => (
                <div key={text}>
                  {text}
                  {ok ? <b>{ok}</b> : null}
                </div>
              ))}
            </div>
            <div className="ds-boot-bar">
              <span style={{ width: `${bootPct}%` }} />
            </div>
            <div className="flex justify-between mt-3 ds-mono t-dim">
              <span>{bootPct}%</span>
              <span>SYS.CHECK — ALPHA 0.9.2</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ds-progress" style={{ "--p": `${progress}%` } as React.CSSProperties} />
      <div aria-hidden className="ds-bg" />
      <div aria-hidden className="ds-grain" />

      <nav aria-label="Sections" className="ds-rail">
        {RAIL.map(([num, id, label]) => (
          <a className={cn(active === id && "is-active")} href={`#${id}`} key={id}>
            <i />
            <span>
              {num} {label}
            </span>
          </a>
        ))}
      </nav>
      <div aria-hidden className="ds-sidetag">VULNEXA // ATTACK SURFACE INTELLIGENCE — 2026</div>

      <div className="ds-strip">
        <div className="ds-shell h-9 flex items-center justify-between ds-mono t-dim">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2.5 t-mute">
              <i className="ds-dot ds-dot--pulse" />
              SYSTEM: OPERATIONAL
            </span>
            <span className="hidden md:inline">BUILD ALPHA 0.9.2</span>
          </div>
          <div className="hidden sm:flex items-center gap-5">
            <span>RECON — OK</span>
            <span>PASSIVE — OK</span>
            <span>ACTIVE — STANDBY</span>
          </div>
          <span className="t-lime">VULNEXA ALPHA</span>
        </div>
      </div>

      <header className={cn("ds-header", stuck && "is-stuck")}>
        <div className="ds-shell flex items-center justify-between h-[74px]">
          <a className="flex items-center gap-3" href="#top">
            <Mark className="w-8 h-8" />
            <span className="ds-brand t-ink">
              DELTA<span className="t-lime">SEC</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8" aria-label="Primary">
            {NAV.map(([label, id]) => (
              <a className={cn("ds-navlink", active === id && "is-active")} href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:flex items-center gap-2.5">
              <Link className="ds-btn ds-btn--ghost ds-btn--sm" href="/login">
                LOGIN
              </Link>
              <Link className="ds-btn ds-btn--primary ds-btn--sm" href="/register">
                START FREE
              </Link>
            </span>
            <button
              aria-expanded={menuOpen}
              aria-label="Menu"
              className={cn("ds-burger lg:hidden", menuOpen && "is-open")}
              onClick={() => setMenuOpen((v) => !v)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        <div className={cn("ds-drawer lg:hidden", menuOpen && "is-open")}>
          <nav className="ds-shell py-6 flex flex-col gap-4" aria-label="Mobile">
            {NAV.map(([label, id]) => (
              <a className="ds-navlink" href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <div className="flex gap-3 pt-5 mt-1 border-t" style={{ borderColor: "var(--hair)" }}>
              <Link className="ds-btn ds-btn--ghost flex-1" href="/login" onClick={() => setMenuOpen(false)}>
                LOGIN
              </Link>
              <Link className="ds-btn ds-btn--primary flex-1" href="/register" onClick={() => setMenuOpen(false)}>
                START FREE
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="ds-main">
        <section className="relative overflow-hidden" id="top">
          <SurfaceCanvas className="ds-hero-canvas" />
          <div className="ds-shell relative pt-16 sm:pt-24 pb-16">
            <div className="grid lg:grid-cols-12 gap-10 xl:gap-14 items-start">
              <div className="lg:col-span-7">
                <span className="ds-eyebrow" data-reveal>
                  SEC.00 — ATTACK SURFACE INTELLIGENCE
                </span>

                <h1 className="ds-h1 mt-7" data-reveal style={{ "--d": "60ms" } as React.CSSProperties}>
                  See your <span className="ds-grad">attack surface</span> before attackers do
                  <span className="t-lime">.</span>
                </h1>

                <p className="ds-lead mt-7 max-w-xl" data-reveal style={{ "--d": "140ms" } as React.CSSProperties}>
                  Vulnexa helps security teams discover assets, map endpoints, identify vulnerabilities and transform
                  complex scanner output into clear, actionable security insights.
                </p>

                <div
                  className="mt-9 flex flex-wrap items-center gap-3"
                  data-reveal
                  style={{ "--d": "220ms" } as React.CSSProperties}
                >
                  <Link className="ds-btn ds-btn--primary" href="/bug-hunter" {...magnetic}>
                    START SCANNING <span className="ds-arr">&#8594;</span>
                  </Link>
                  <Link className="ds-btn ds-btn--ghost" href="/learn/index.html" {...magnetic}>
                    START LEARNING
                  </Link>
                  <Link className="ds-btn ds-btn--ghost" href="/dashboard" {...magnetic}>
                    EXPLORE PLATFORM
                  </Link>
                </div>

                <div
                  className="ds-notice mt-9 max-w-xl"
                  data-reveal
                  style={{ "--d": "290ms" } as React.CSSProperties}
                >
                  <p className="ds-mono t-lime">Authorized testing only</p>
                  <p className="mt-1.5 text-[13.5px] t-mute">
                    Vulnexa is designed exclusively for authorized security testing. Active scans require target
                    ownership verification.
                  </p>
                </div>

                <div
                  className="mt-8 flex flex-wrap gap-2"
                  data-reveal
                  style={{ "--d": "350ms" } as React.CSSProperties}
                >
                  {[
                    "Unified Reconnaissance",
                    "Passive & Active Scanning",
                    "AI-Assisted Analysis",
                    "Evidence-Based Findings",
                    "Centralized Reporting",
                  ].map((chip) => (
                    <span className="ds-chip" key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 lg:pt-8">
                <Panel bracket className="p-6 sm:p-7" delay={140} lift reveal>
                  <div className="flex items-center justify-between mb-6">
                    <span className="ds-mono t-ink">LIVE TELEMETRY</span>
                    <span className="flex items-center gap-2 ds-mono t-lime">
                      <i className="ds-dot ds-dot--pulse" />
                      REC
                    </span>
                  </div>

                  <div className="space-y-3">
                    {TELEMETRY.map(([label, value, tone]) => (
                      <div className="ds-tel" key={label}>
                        <span className="t-dim">{label}</span>
                        <i />
                        <b className={tone}>{value}</b>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 flex items-center gap-6">
                    <Radar />
                    <div className="ds-mono t-dim leading-[1.9]">
                      PERIMETER SWEEP
                      <br />
                      SECTOR 7A-2C
                      <br />
                      <span className="t-lime">3 CONTACTS</span> / NOMINAL
                    </div>
                  </div>

                  <p className="mt-6 ds-mono t-dim fs-9">* demonstration data</p>
                </Panel>

                <div
                  className="mt-3 px-1 flex justify-between ds-mono t-dim fs-9"
                  data-reveal
                  style={{ "--d": "220ms" } as React.CSSProperties}
                >
                  <span>GRID 44.000</span>
                  <span>NODE 7A-2C</span>
                  <span>SIG -32DB</span>
                </div>
              </div>
            </div>

            {/* ---- scan console ---- */}
            <Panel className="mt-16 sm:mt-20" delay={80} reveal>
              <div aria-hidden className="ds-scanline" />
              <div className="ds-panel-head">
                <span className="ds-mono t-mute">[ VULNEXA — SCAN CONSOLE ]</span>
                <span className="flex items-center gap-2 ds-mono t-lime">
                  <i className="ds-dot ds-dot--pulse" />
                  LIVE
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div
                  className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-[10px] overflow-hidden"
                  style={{ background: "var(--hair)" }}
                >
                  {STATS.map(([value, suffix, label, meter, tone]) => (
                    <div className="ds-stat" key={label}>
                      <div className={cn("ds-stat-value", tone)}>
                        <Counter suffix={suffix} to={value} />
                      </div>
                      <div className="ds-mono t-dim mt-2.5 fs-10">{label}</div>
                      <div className={cn("ds-meter", tone)}>
                        <span style={{ "--v": charged ? `${meter}%` : "0%" } as React.CSSProperties} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-right ds-mono t-dim fs-9">* demonstration data</p>

                <div className="ds-term mt-4">
                  <form className="flex items-center gap-3 px-4 py-3 border-b" onSubmit={runScan} style={{ borderColor: "var(--hair)" }}>
                    <span className="ds-mono t-lime fs-12">&gt;</span>
                    <input
                      aria-label="Target domain"
                      autoComplete="off"
                      className="ds-input"
                      onChange={(event) => setTarget(event.target.value)}
                      placeholder="enter target domain — try portal.example.com"
                      spellCheck={false}
                      type="text"
                      value={target}
                    />
                    <button className="ds-btn ds-btn--ghost ds-btn--sm shrink-0" disabled={scanning} type="submit">
                      {scanning ? "SCANNING..." : "RUN SCAN"}
                    </button>
                  </form>
                  <div className="ds-term-body">
                    {lines.map((line) => (
                      <div className={cn("ds-term-line", line.tone)} key={line.id}>
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="ds-marquee relative py-3.5">
            <div className="ds-marquee-track">
              {[0, 1].map((copy) => (
                <div aria-hidden={copy === 1} className="flex items-center gap-7 pr-7" key={copy}>
                  {TICKER.map((item) => (
                    <span className="flex items-center gap-7 ds-mono t-dim whitespace-nowrap" key={item}>
                      {item}
                      <span className="t-lime">///</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingBody />
      </main>

      <footer className="ds-footer">
        <div className="ds-shell py-7 flex flex-col sm:flex-row items-center justify-between gap-3 ds-mono">
          <p className="t-dim">&copy; 2026 Vulnexa. All rights reserved.</p>
          <p className="flex items-center gap-2.5 t-lime">
            <i className="ds-dot" />
            Built for authorized security testing.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 36 36">
      <path d="M18 3 L33 30 L3 30 Z" fill="none" stroke="#c2ff45" strokeLinejoin="round" strokeWidth="2.2" />
      <path
        d="M18 12 L25 26 L11 26 Z"
        fill="rgba(194,255,69,.14)"
        stroke="#c2ff45"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <circle cx="18" cy="21" fill="#c2ff45" r="1.8" />
    </svg>
  );
}

const BLIPS = [
  { top: "22%", left: "60%" },
  { top: "64%", left: "30%", animationDelay: ".8s" },
  { top: "48%", left: "74%", animationDelay: "1.5s" },
];

function Radar() {
  const [pings, setPings] = useState<Array<{ id: number; top: string; left: string }>>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!pings.length) return;
    const t = window.setTimeout(() => setPings((prev) => prev.slice(1)), 2200);
    return () => window.clearTimeout(t);
  }, [pings]);

  return (
    <div
      className="ds-radar w-24 h-24 shrink-0"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const id = nextId.current++;
        setPings((prev) => [
          ...prev.slice(-3),
          {
            id,
            top: `${((event.clientY - box.top) / box.height) * 100}%`,
            left: `${((event.clientX - box.left) / box.width) * 100}%`,
          },
        ]);
      }}
      role="presentation"
    >
      {BLIPS.map((blip, index) => (
        <span className="ds-blip" key={index} style={blip} />
      ))}
      {pings.map((ping) => (
        <span className="ds-blip ds-blip--ping" key={ping.id} style={{ top: ping.top, left: ping.left }} />
      ))}
    </div>
  );
}

