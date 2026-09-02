"use client";

import {
  Activity,
  Bot,
  Bug,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  Globe2,
  LayoutDashboard,
  Play,
  Radar,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TOUR = [
  {
    eyebrow: "Live operations",
    title: "Your security posture, in one view.",
  },
  {
    eyebrow: "Evidence first",
    title: "Move from alert to proof.",
  },
  {
    eyebrow: "DeltaAI",
    title: "Ask the attack surface.",
  },
] as const;

const SIDE_NAV = [
  [LayoutDashboard, "Overview"],
  [Globe2, "Assets"],
  [Radar, "Recon"],
  [ScanSearch, "Scans"],
  [Bug, "Findings"],
  [Bot, "DeltaAI"],
] as const;

const METRICS = [
  ["Verified assets", "38", "+12%", "ds-pui-cyan"],
  ["Endpoints", "1,284", "+43", "ds-pui-purple"],
  ["Running scans", "2", "Live", "ds-pui-lime"],
  ["Confirmed", "6", "+1", "ds-pui-red"],
] as const;

const FINDINGS = [
  ["Broken object-level authorization", "Critical", "91%", "GET /v1/accounts/{id}"],
  ["Reflected cross-site scripting", "High", "96%", "GET /search?q="],
  ["Excessive data exposure", "Medium", "82%", "POST /v2/orders"],
] as const;

function MiniSidebar({ active }: { active: "Overview" | "Findings" | "DeltaAI" }) {
  return (
    <aside className="ds-pui-side">
      <span className="ds-pui-mark"><ShieldCheck /></span>
      <div className="ds-pui-side-nav">
        {SIDE_NAV.map(([Glyph, label]) => (
          <span className={cn("ds-pui-side-link", active === label && "is-active")} key={label} title={label}>
            <Glyph />
            <small>{label}</small>
          </span>
        ))}
      </div>
      <span className="ds-pui-avatar">MC</span>
    </aside>
  );
}

function FrameTop({ route }: { route: string }) {
  return (
    <div className="ds-pui-chrome">
      <span className="ds-pui-dots"><i /><i /><i /></span>
      <span className="ds-pui-address"><ShieldCheck /> app.vulnexa.io/{route}</span>
      <span className="ds-pui-live"><i /> live</span>
    </div>
  );
}

function WorkspaceTop({ title, action }: { title: string; action: string }) {
  return (
    <div className="ds-pui-worktop">
      <div>
        <span>Northstar cloud / authorized workspace</span>
        <strong>{title}</strong>
      </div>
      <span className="ds-pui-search"><Search /> Search</span>
      <span className="ds-pui-action"><Play /> {action}</span>
    </div>
  );
}

function OverviewScene() {
  return (
    <div className="ds-pui-scene-inner">
      <FrameTop route="dashboard" />
      <div className="ds-pui-app">
        <MiniSidebar active="Overview" />
        <div className="ds-pui-workspace">
          <WorkspaceTop title="Security overview" action="Quick scan" />

          <div className="ds-pui-ai-banner">
            <span><Sparkles /></span>
            <div><strong>DeltaAI</strong><small>Run an autonomous analysis across the verified scope.</small></div>
            <b>Launch <ChevronRight /></b>
          </div>

          <div className="ds-pui-status">
            <span><ShieldCheck /> Authorized scanning</span>
            <span><i /> Workers <b>9/10</b></span>
            <span><i /> Assets <b>1,284</b></span>
            <span><i className="is-warn" /> Open <b>17</b></span>
            <span>Coverage <b>96%</b></span>
          </div>

          <div className="ds-pui-metrics">
            {METRICS.map(([label, value, delta, tone], i) => (
              <div className="ds-pui-metric" key={label}>
                <span>{label}<b>{delta}</b></span>
                <strong>{value}</strong>
                <i className={tone} style={{ "--bar": `${44 + i * 14}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>

          <div className="ds-pui-overview-grid">
            <div className="ds-pui-panel ds-pui-chart-panel">
              <div className="ds-pui-panel-head"><span>Finding trend</span><b>Last 30 days</b></div>
              <div className="ds-pui-chart">
                <span className="ds-pui-chart-label is-one">20</span>
                <span className="ds-pui-chart-label is-two">10</span>
                <span className="ds-pui-chart-label is-three">0</span>
                <svg viewBox="0 0 520 160" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <linearGradient id="ds-tour-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#a88cff" stopOpacity=".34" />
                      <stop offset="1" stopColor="#a88cff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="ds-pui-area" d="M0 139 C35 128 54 116 82 120 S131 89 165 97 S218 61 254 77 S306 42 342 53 S395 21 430 36 S480 10 520 18 L520 160 L0 160 Z" fill="url(#ds-tour-area)" />
                  <path className="ds-pui-line" d="M0 139 C35 128 54 116 82 120 S131 89 165 97 S218 61 254 77 S306 42 342 53 S395 21 430 36 S480 10 520 18" />
                  <path className="ds-pui-line ds-pui-line-alt" d="M0 148 C45 142 72 135 110 137 S170 119 210 123 S276 94 315 105 S370 74 414 82 S472 54 520 60" />
                </svg>
              </div>
            </div>

            <div className="ds-pui-panel ds-pui-severity">
              <div className="ds-pui-panel-head"><span>Open severity</span><b>17 total</b></div>
              <div className="ds-pui-severity-body">
                <span className="ds-pui-donut"><b>17<small>open</small></b></span>
                <ul>
                  <li><i className="is-critical" /> Critical <b>2</b></li>
                  <li><i className="is-high" /> High <b>4</b></li>
                  <li><i className="is-medium" /> Medium <b>7</b></li>
                  <li><i className="is-low" /> Low <b>4</b></li>
                </ul>
              </div>
            </div>

            <div className="ds-pui-panel ds-pui-scan-card">
              <div className="ds-pui-panel-head"><span>Live scan operations</span><b><i /> Running</b></div>
              <div className="ds-pui-scan-title"><strong>Northstar balanced scan</strong><span>68%</span></div>
              <span className="ds-pui-progress"><i /></span>
              <div className="ds-pui-pipeline">
                {(["Scope", "Recon", "Endpoints", "Passive", "Active", "Verify"] as const).map((step, i) => <span className={i < 5 ? "is-done" : ""} key={step}>{step}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FindingsScene() {
  return (
    <div className="ds-pui-scene-inner">
      <FrameTop route="findings/all" />
      <div className="ds-pui-app">
        <MiniSidebar active="Findings" />
        <div className="ds-pui-workspace">
          <WorkspaceTop title="Findings queue" action="Run scan" />
          <div className="ds-pui-filterbar">
            <span className="is-active">All findings <b>17</b></span>
            <span>Confirmed <b>6</b></span>
            <span>Candidates <b>11</b></span>
            <span className="ds-pui-filter-search"><Search /> Filter findings</span>
          </div>
          <div className="ds-pui-find-layout">
            <div className="ds-pui-find-list">
              <div className="ds-pui-find-head"><span>Finding</span><span>Severity</span><span>Confidence</span></div>
              {FINDINGS.map(([name, severity, confidence, endpoint], i) => (
                <div className={cn("ds-pui-find-row", i === 0 && "is-selected")} key={name}>
                  <span><i className={severity.toLowerCase()} /> <b>{name}</b><small>{endpoint}</small></span>
                  <span className={`ds-pui-sev is-${severity.toLowerCase()}`}>{severity}</span>
                  <span><strong>{confidence}</strong><i className="ds-pui-confidence"><b style={{ width: confidence }} /></i></span>
                </div>
              ))}
              <div className="ds-pui-find-row is-muted"><span><i /> <b>Missing Content-Security-Policy</b><small>GET /</small></span><span className="ds-pui-sev is-medium">Medium</span><span><strong>88%</strong></span></div>
            </div>

            <aside className="ds-pui-evidence">
              <div className="ds-pui-evidence-title"><span>DS-1042</span><b>Analyst review</b></div>
              <h3>Broken object-level authorization</h3>
              <div className="ds-pui-evidence-meta"><span className="ds-pui-sev is-critical">Critical</span><span><CircleDot /> Internet exposed</span></div>
              <div className="ds-pui-evidence-score"><span>Evidence confidence <b>91%</b></span><i><b /></i></div>
              <div className="ds-pui-request">
                <span><TerminalSquare /> Captured request</span>
                <code><b>GET</b> /v1/accounts/7842<br /><i>authorization:</i> Bearer •••••••<br /><i>x-tenant:</i> northstar<br /><br /><em>HTTP/2 200 OK</em><br />{`{"account":"external"}`}</code>
              </div>
              <div className="ds-pui-evidence-actions"><span>Reject</span><b><Check /> Confirm finding</b></div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalystScene() {
  return (
    <div className="ds-pui-scene-inner">
      <FrameTop route="ai-analyst/analysis" />
      <div className="ds-pui-app">
        <MiniSidebar active="DeltaAI" />
        <div className="ds-pui-workspace ds-pui-ai-workspace">
          <WorkspaceTop title="DeltaAI analyst" action="New analysis" />
          <div className="ds-pui-ai-layout">
            <aside className="ds-pui-ai-context">
              <div className="ds-pui-panel-head"><span>Analysis context</span><b>Live</b></div>
              <div className="ds-pui-target-card"><Globe2 /><span><b>Northstar portal</b><small>38 assets · 1,284 endpoints</small></span></div>
              <span className="ds-pui-context-label">Connected evidence</span>
              <ul>
                <li><Bug /> Open findings <b>17</b></li>
                <li><Activity /> Scan events <b>248</b></li>
                <li><FileText /> HTTP captures <b>34</b></li>
                <li><Radar /> Recon records <b>1.4k</b></li>
              </ul>
              <div className="ds-pui-agent-log"><span><i /> Agent activity</span><p>Correlated 34 captures</p><p>Merged 4 duplicates</p><p>Ranked 2 priorities</p></div>
            </aside>

            <div className="ds-pui-conversation">
              <div className="ds-pui-ai-intro"><span><Sparkles /></span><div><strong>What needs attention first?</strong><small>Ask across your authorized workspace.</small></div></div>
              <div className="ds-pui-user-message">Prioritize today’s findings and explain why.</div>
              <div className="ds-pui-ai-message">
                <span className="ds-pui-ai-icon"><Bot /></span>
                <div>
                  <p><b>Two findings need review now.</b> Both are internet-reachable and have reproducible evidence.</p>
                  <div className="ds-pui-priority is-critical"><span>01</span><div><b>Broken object-level authorization</b><small>Critical · 91% confidence · active API exposure</small></div><ChevronRight /></div>
                  <div className="ds-pui-priority is-high"><span>02</span><div><b>Reflected cross-site scripting</b><small>High · 96% confidence · payload reflected</small></div><ChevronRight /></div>
                  <p className="ds-pui-ai-note"><Check /> 4 duplicate signals grouped · evidence linked</p>
                </div>
              </div>
              <div className="ds-pui-composer"><span>Ask DeltaAI about assets, scans, or findings…</span><b><Sparkles /></b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCENES = [OverviewScene, FindingsScene, AnalystScene] as const;

export function ProductShowcase() {
  const [active, setActive] = useState(0);
  const stepsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.tourStep);
        if (Number.isFinite(index)) setActive(index);
      },
      { rootMargin: "-30% 0px -35%", threshold: [0, 0.25, 0.55, 0.8] },
    );

    const steps = stepsRef.current.filter((step): step is HTMLButtonElement => Boolean(step));
    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="ds-product-tour" id="product-tour">
      <div className="ds-wrap">
        <div className="ds-tour-head">
          <span className="ds-eyebrow" data-rise>Live product</span>
          <h2 className="ds-h2" data-rise style={{ "--i": 1 } as React.CSSProperties}>See the whole surface. Act on the right signal.</h2>
        </div>

        <div className="ds-tour-layout">
          <div className="ds-tour-stage" data-rise>
            <div className="ds-tour-orbit ds-tour-orbit-a" aria-hidden />
            <div className="ds-tour-orbit ds-tour-orbit-b" aria-hidden />
            <div className="ds-tour-frame" role="img" aria-label={`${TOUR[active].eyebrow}: ${TOUR[active].title}`}>
              <div className="ds-tour-scanline" aria-hidden />
              {SCENES.map((Scene, index) => (
                <div className={cn("ds-pui-scene", active === index && "is-active")} aria-hidden={active !== index} key={TOUR[index].title}>
                  <Scene />
                </div>
              ))}
            </div>
            <div className="ds-tour-pagination" aria-hidden>
              <span>0{active + 1}</span>
              <i><b style={{ width: `${((active + 1) / TOUR.length) * 100}%` }} /></i>
              <span>0{TOUR.length}</span>
            </div>
          </div>

          <div className="ds-tour-steps" role="tablist" aria-label="Product views">
            {TOUR.map((item, index) => (
              <button
                className={cn("ds-tour-step", active === index && "is-active")}
                data-tour-step={index}
                key={item.title}
                onClick={() => setActive(index)}
                ref={(node) => { stepsRef.current[index] = node; }}
                role="tab"
                aria-selected={active === index}
                type="button"
              >
                <span className="ds-tour-step-num">0{index + 1}</span>
                <span>
                  <small>{item.eyebrow}</small>
                  <strong>{item.title}</strong>
                </span>
                <ChevronRight />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
