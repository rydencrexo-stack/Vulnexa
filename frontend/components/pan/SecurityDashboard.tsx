"use client";

import Link from "next/link";
import { Bot, Play, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { StatusBadge } from "@/components/pan/StatusBadge";

/* ------------------------------------------------------------------ */
/* Mock data                                                          */
/* ------------------------------------------------------------------ */

const STATUS_STRIP = [
  { label: "Scans Running", value: 2, tone: "teal" },
  { label: "Jobs Queued", value: 3, tone: "blue" },
  { label: "Workers Healthy", value: "9/10", tone: "teal" },
  { label: "Assets Monitored", value: 1284, tone: "teal" },
  { label: "Findings Open", value: 17, tone: "amber" },
  { label: "Scope Coverage", value: "96%", tone: "blue" },
  { label: "System Health", value: "Operational", tone: "teal" },
];

const KPIS = [
  { label: "Total Targets", value: 12, change: "+2", up: true, series: [2, 3, 5, 6, 8, 10, 12], sub: "4 verified · 8 in scope", tone: "#b9ff2d" },
  { label: "Verified Assets", value: 38, change: "+12%", up: true, series: [20, 24, 26, 30, 33, 36, 38], sub: "34 live / 4 inactive", tone: "#4cc9f0" },
  { label: "Live Hosts", value: 34, change: "+3", up: true, series: [22, 25, 27, 28, 31, 33, 34], sub: "24 HTTPS · 10 HTTP", tone: "#7ee787" },
  { label: "Endpoints", value: 1284, change: "+43", up: true, series: [900, 980, 1050, 1100, 1190, 1240, 1284], sub: "312 API · 91 params", tone: "#b388ff" },
  { label: "Open Ports", value: 47, change: "-5", up: false, series: [58, 56, 54, 53, 51, 49, 47], sub: "22 unique services", tone: "#ff9f43" },
  { label: "Running Scans", value: 2, change: "+1", up: true, series: [0, 1, 1, 2, 1, 2, 2], sub: "3 queued", tone: "#b9ff2d" },
  { label: "Confirmed Findings", value: 6, change: "+1", up: true, series: [2, 3, 3, 4, 5, 5, 6], sub: "2 critical · 4 high", tone: "#ff6b6b" },
  { label: "Candidate Findings", value: 11, change: "+2", up: true, series: [4, 5, 6, 8, 9, 10, 11], sub: "7 high confidence", tone: "#ffb020" },
];

type SurfaceNode = { id: string; label: string; level: number; risk?: string; ip?: string; tech?: string[]; finding?: string; children?: SurfaceNode[] };

const SURFACE_TREE: SurfaceNode[] = [
  { id: "target", label: "Northstar Customer Portal", level: 0, risk: "high", children: [
    { id: "dom", label: "northstar-demo.com", level: 1, children: [
      { id: "portal", label: "portal.northstar-demo.com", level: 2, ip: "203.0.113.42", risk: "critical", tech: ["Next.js", "Cloudflare"], children: [
        { id: "p443", label: "443/tcp", level: 3, children: [
          { id: "search", label: "/search?q=", level: 4, finding: "Reflected XSS" },
          { id: "api", label: "/api/v1/accounts/{id}", level: 4, finding: "IDOR" },
        ] },
      ] },
      { id: "api", label: "api.northstar-demo.com", level: 2, ip: "203.0.113.44", risk: "high", tech: ["FastAPI", "nginx"], children: [
        { id: "a443", label: "443/tcp", level: 3, children: [
          { id: "orders", label: "/v1/orders/{id}", level: 4, finding: "BOLA" },
        ] },
      ] },
      { id: "cdn", label: "cdn.northstar-demo.com", level: 2, ip: "198.51.100.21", tech: ["CloudFront", "S3"], children: [] },
    ] },
  ] },
];

const RUNNING_SCANS = [
  { id: "scan_01", status: "running", name: "Northstar balanced scan", target: "Northstar Customer Portal", profile: "Balanced", phase: "Active testing", progress: 68, assets: 14, endpoints: 312, params: 91, requests: 840, candidates: 7, confirmed: 2, worker: "scanner-worker-02", duration: "24m 12s", rate: "4 req/s", concurrency: 4, scope: "verified" },
  { id: "scan_02", status: "running", name: "Atlas API passive review", target: "Atlas Partner API", profile: "API focused", phase: "Endpoint Discovery", progress: 42, assets: 7, endpoints: 128, params: 44, requests: 512, candidates: 3, confirmed: 0, worker: "api-worker-01", duration: "11m 08s", rate: "6 req/s", concurrency: 3, scope: "verified" },
];

const PIPELINE = ["Scope Validation", "Reconnaissance", "Endpoint Discovery", "Passive Analysis", "Active Testing", "Verification", "AI Analysis", "Report Generation"];

const WORKERS = [
  { id: "recon-worker-01", status: "healthy", job: "subdomains enum", cpu: 22, mem: 18, queue: 2, hb: "now" },
  { id: "scanner-worker-02", status: "busy", job: "XSS testing", cpu: 78, mem: 64, queue: 4, hb: "now" },
  { id: "verification-worker-01", status: "healthy", job: "browser verify", cpu: 31, mem: 27, queue: 1, hb: "2s" },
  { id: "ai-worker-01", status: "healthy", job: "finding analysis", cpu: 45, mem: 51, queue: 3, hb: "now" },
  { id: "report-worker-01", status: "idle", job: "none", cpu: 4, mem: 12, queue: 0, hb: "30s" },
  { id: "api-worker-01", status: "busy", job: "API schema", cpu: 66, mem: 58, queue: 2, hb: "now" },
];

const SERVICES = [
  { name: "Recon worker", state: "healthy" }, { name: "Verification worker", state: "healthy" }, { name: "Acunetix", state: "disconnected" }, { name: "Nuclei", state: "ready" },
  { name: "XSS scanner", state: "running" }, { name: "SQLi scanner", state: "ready" }, { name: "API scanner", state: "running" }, { name: "AI worker", state: "healthy" }, { name: "Report worker", state: "ready" },
];

const SEVERITIES = { critical: 1, high: 4, medium: 7, low: 6, informational: 3 };

const NEEDS_ATTENTION = [
  { title: "Broken object-level authorization", severity: "critical", confidence: 91, target: "Northstar", endpoint: "GET /v1/accounts/{id}", param: "accountId", source: "API scanner", state: "high_confidence", age: "2h" },
  { title: "Reflected cross-site scripting", severity: "high", confidence: 96, target: "Northstar", endpoint: "GET /search?q=", param: "q", source: "XSS scanner", state: "confirmed", age: "4h" },
  { title: "Excessive data exposure", severity: "medium", confidence: 82, target: "Atlas", endpoint: "POST /v2/orders", param: "body", source: "API scanner", state: "candidate", age: "6h" },
  { title: "Missing Content-Security-Policy", severity: "medium", confidence: 88, target: "Northstar", endpoint: "GET /", param: null, source: "Passive rules", state: "candidate", age: "1d" },
];

const RECON = [
  { label: "Subdomains discovered", value: 24, change: "+8" },
  { label: "Live hosts", value: 17, change: "+3" },
  { label: "Open ports", value: 47, change: "+5" },
  { label: "Technologies", value: 19, change: "+2" },
  { label: "URLs", value: 1284, change: "+43" },
  { label: "Historical URLs", value: 86, change: "+12" },
  { label: "JavaScript routes", value: 41, change: "+6" },
  { label: "Screenshots", value: 17, change: "+1" },
];

const TECH_STACK = [
  { name: "Next.js", version: "Current", risk: "ok" }, { name: "React", version: "Current", risk: "ok" }, { name: "nginx", version: "Current", risk: "ok" },
  { name: "FastAPI", version: "Outdated", risk: "warn" }, { name: "PostgreSQL", version: "Current", risk: "ok" }, { name: "Cloudflare", version: "Unknown", risk: "info" },
  { name: "Node.js", version: "Outdated", risk: "warn" }, { name: "Django", version: "Current", risk: "ok" },
];

const ACTIVITY = [
  { time: "14:02", text: "Target verified", who: "Northstar · DNS TXT" },
  { time: "14:04", text: "Recon started", who: "recon-worker-01" },
  { time: "14:09", text: "12 subdomains discovered", who: "Subfinder" },
  { time: "14:11", text: "Acunetix scan started", who: "integration" },
  { time: "14:18", text: "Candidate XSS finding detected", who: "XSS scanner" },
  { time: "14:31", text: "AI analysis completed", who: "ai-worker-01" },
  { time: "14:34", text: "Analyst confirmed finding", who: "Maya Chen" },
  { time: "14:40", text: "Report generated", who: "report-worker-01" },
  { time: "15:02", text: "Retest completed", who: "verification-worker-01" },
];

const SCOPE = [
  { label: "Ownership verified", value: "Yes" }, { label: "Included hosts", value: "portal, api, cdn" },
  { label: "Excluded hosts", value: "payments" }, { label: "Sensitive paths excluded", value: "/logout, /delete" },
  { label: "Allowed ports", value: "80, 443" }, { label: "Request limit", value: "1,000" },
  { label: "Concurrency limit", value: "4" }, { label: "Emergency cancellation", value: "Enabled" },
];

const POSTURE = { score: 89, parts: [
  { label: "Scope coverage", value: 96 }, { label: "Asset exposure", value: 82 }, { label: "Finding severity", value: 74 },
  { label: "Finding confidence", value: 88 }, { label: "Remediation progress", value: 71 }, { label: "Technology risk", value: 90 }, { label: "External exposure", value: 78 },
] };

const REPORTS = [
  { name: "Executive security summary", type: "Executive", findings: "6 confirmed · 11 candidates", formats: "PDF · HTML", compliance: "SOC2 · ISO 27001", time: "14:40" },
  { name: "Northstar full-scan report", type: "Full scan", findings: "9 findings", formats: "PDF · JSON", compliance: "PCI-DSS", time: "Yesterday" },
];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / (max - min || 1)) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-6 w-full">
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Panel({ title, children, action, className = "" }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/[0.08] bg-[#0a0f0a] ${className}`}>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const toneText: Record<string, string> = { teal: "text-teal-300", blue: "text-cyan-300", purple: "text-violet-300", amber: "text-amber-300", red: "text-red-300", green: "text-emerald-300" };
const toneDot: Record<string, string> = { teal: "bg-teal-400", blue: "bg-cyan-400", purple: "bg-violet-400", amber: "bg-amber-400", red: "bg-red-400", green: "bg-emerald-400" };

function Node({ node, depth, onSelect }: { node: SurfaceNode; depth: number; onSelect: (n: SurfaceNode) => void }) {
  const [open, setOpen] = useState(true);
  const tone = node.risk === "critical" ? "red" : node.risk === "high" ? "amber" : node.finding ? "red" : "blue";
  return (
    <div className="ml-3 border-l border-white/10 pl-3">
      <div className="flex items-center gap-2 py-0.5">
        <button type="button" onClick={() => node.children?.length && setOpen((v) => !v)} className="text-slate-500">{node.children?.length ? (open ? "▾" : "▸") : "•"}</button>
        <button type="button" onClick={() => onSelect(node)} className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/[0.04]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} />
          <span className="truncate font-mono text-xs text-slate-200">{node.label}</span>
          {node.ip ? <span className="font-mono text-[10px] text-slate-500">{node.ip}</span> : null}
          {node.finding ? <StatusBadge value={node.finding} tone="danger" dot={false} /> : null}
          {node.risk ? <span className={`text-[10px] uppercase ${toneText[tone]}`}>{node.risk}</span> : null}
        </button>
      </div>
      {open && node.children?.length ? <div className="mt-0.5">{node.children.map((c, i) => <Node key={i} node={c} depth={depth + 1} onSelect={onSelect} />)}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main dashboard                                                      */
/* ------------------------------------------------------------------ */

export function SecurityDashboard() {
  const [selected, setSelected] = useState<SurfaceNode | null>(null);

  const surfaceNodeDetail = useMemo(() => {
    if (!selected) return null;
    return {
      hostname: selected.label,
      ip: selected.ip ?? "203.0.113.99",
      ports: selected.tech ? "443/tcp" : "80, 443",
      tech: selected.tech ?? ["nginx"],
      endpoints: selected.finding ? [selected.label] : ["/", "/api/v1"],
      auth: "required",
      findings: selected.finding ? [selected.finding] : ["No open findings"],
      lastSeen: "2m ago",
    };
  }, [selected]);

  return (
    <AppPage eyebrow="Security Operations" title="Security Overview" description="Live attack-surface, scan, worker, and findings posture across this authorized workspace." actions={<div className="flex flex-wrap gap-2"><Link className="pan-button pan-button-secondary" href="/recon/new"><Radar size={15} /> Run Recon</Link><Link className="pan-button pan-button-primary" href="/scans/new"><Play size={14} fill="currentColor" /> Quick Scan</Link></div>}>
      {/* Status strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.08] bg-[#0a0f0a] px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-semibold text-slate-200">Northstar Cloud <span className="inline-flex items-center gap-1 text-emerald-300"><ShieldCheck size={12} /> Authorized scanning</span></span>
        <span className="text-slate-500">Last sync · 2m ago</span>
        {STATUS_STRIP.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${toneDot[s.tone]}`} />{s.label} <strong className={`${toneText[s.tone]}`}>{s.value}</strong></span>
        ))}
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border border-white/[0.08] bg-[#0a0f0a] p-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5 text-xl font-bold text-slate-100">{k.value}<span className={`text-[10px] ${k.up ? "text-emerald-300" : "text-red-300"}`}>{k.change}</span></p>
            <div className="mt-1.5"><Sparkline data={k.series} tone={k.tone} /></div>
            <p className="mt-1 truncate text-[10px] text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Attack surface map | Security posture */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Attack Surface Map" action={<span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> risk <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> exposure</span>}>
          <div className="max-h-80 overflow-auto">
            {SURFACE_TREE.map((n) => <Node key={n.id} node={n} depth={0} onSelect={setSelected} />)}
          </div>
          {surfaceNodeDetail ? (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between"><p className="font-mono text-sm text-slate-100">{surfaceNodeDetail.hostname}</p><button type="button" onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300">✕</button></div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <Detail label="IP" value={surfaceNodeDetail.ip} mono /> <Detail label="Ports" value={surfaceNodeDetail.ports} mono />
                <Detail label="Auth" value={surfaceNodeDetail.auth} /> <Detail label="Last seen" value={surfaceNodeDetail.lastSeen} />
              </dl>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Tech</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{surfaceNodeDetail.tech.map((t) => <span key={t} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-300">{t}</span>)}</div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Findings</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{surfaceNodeDetail.findings.map((f) => <StatusBadge key={f} value={f} tone="danger" dot={false} />)}</div>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-slate-500">Click any node to inspect hostname, IP, ports, technology, endpoints, auth, findings, and last seen.</p>
          )}
        </Panel>

        <Panel title="Security Posture" action={<span className="text-lg font-bold text-slate-100">{POSTURE.score}<span className="text-xs text-slate-500"> / 100</span></span>}>
          <div className="mb-3 flex items-center gap-4">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#b9ff2d ${POSTURE.score * 3.6}deg, #182a3e 0)` }}>
              <div className="absolute inset-2 rounded-full bg-[#0a0f0a]" />
              <span className="relative text-2xl font-bold text-slate-100">{POSTURE.score}</span>
            </div>
            <p className="text-[11px] leading-5 text-slate-400">Coverage-weighted score. Healthy — resolve the critical candidate and two overdue retests.</p>
          </div>
          <div className="grid gap-2">
            {POSTURE.parts.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">{p.label}</span><span className="text-slate-200">{p.value}%</span></div>
                <div className="mt-0.5 h-1 rounded-full bg-white/[0.06]"><div className="h-1 rounded-full" style={{ width: `${p.value}%`, background: p.value >= 85 ? "#b9ff2d" : p.value >= 70 ? "#ffb020" : "#ff6b6b" }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 3: Live scans | Needs attention */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Panel title="Live Scan Operations" action={<Link href="/scans/running" className="text-[11px] text-teal-300">View all</Link>}>
          {RUNNING_SCANS.map((s) => (
            <div key={s.id} className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 last:mb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" /><span className="font-semibold text-slate-100">{s.name}</span><StatusBadge value={s.status ?? "running"} tone="success" dot={false} /></div>
                <span className="text-[11px] text-slate-500">{s.phase} · {s.progress}%</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]"><div className="h-1 rounded-full bg-teal-400" style={{ width: `${s.progress}%` }} /></div>
              <div className="mt-2 grid grid-cols-4 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-6">
                <Mini label="Target" value={s.target} /> <Mini label="Profile" value={s.profile} /> <Mini label="Assets" value={String(s.assets)} />
                <Mini label="Endpoints" value={String(s.endpoints)} /> <Mini label="Requests" value={String(s.requests)} /> <Mini label="Worker" value={s.worker} />
              </div>
              <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                {PIPELINE.map((p, i) => <span key={p} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] ${i < s.progress / (100 / PIPELINE.length) ? "bg-teal-400/15 text-teal-300" : "bg-white/[0.04] text-slate-500"}`}>{p}</span>)}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/[0.05]">Pause</button>
                <button type="button" className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/[0.05]">Cancel</button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Needs Analyst Review" action={<Link href="/findings/all" className="text-[11px] text-teal-300">Review queue</Link>}>
          <div className="grid gap-2">
            {NEEDS_ATTENTION.map((f) => (
              <div key={f.title} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-semibold text-slate-200">{f.title}</span><StatusBadge value={f.severity} /></div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                  <span>{f.target}</span><span className="font-mono">{f.endpoint}</span>{f.param ? <span>param: {f.param}</span> : null}<span>{f.source}</span><span className="text-slate-400">{f.age}</span>
                </div>
                <div className="mt-1 flex items-center gap-2"><span className="text-[10px] text-slate-500">Confidence {f.confidence}%</span><StatusBadge value={f.state} dot={false} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 4: Findings analytics | AI analyst */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Panel title="Findings Intelligence" action={<Link href="/findings/all" className="text-[11px] text-teal-300">All findings</Link>}>
          <div className="mb-3 grid grid-cols-5 gap-2">
            {Object.entries(SEVERITIES).map(([sev, val]) => <div key={sev} className="rounded-lg border border-white/[0.08] p-2 text-center"><p className="text-lg font-bold" style={{ color: sev === "critical" ? "#ff6b6b" : sev === "high" ? "#ffb020" : sev === "medium" ? "#b9ff2d" : sev === "low" ? "#7ee787" : "#8a9683" }}>{val}</p><p className="text-[10px] capitalize text-slate-500">{sev}</p></div>)}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
            <Mini label="Confirmed / Candidate" value="6 / 11" /> <Mini label="New this week" value="5" /> <Mini label="Resolved" value="8" /> <Mini label="False positives" value="3" />
            <Mini label="Reopened" value="1" /> <Mini label="Avg confidence" value="88%" />
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500"><span>Open vs Resolved · 7 days</span><span>▲ trend</span></div>
          <div className="mt-1 flex h-16 items-end gap-1.5">
            {[12, 14, 11, 16, 13, 15, 14].map((v, i) => <div key={i} className="flex-1 rounded-t bg-teal-400/25" style={{ height: `${v}%` }} title={`open ${v}`} />)}
          </div>
        </Panel>

        <Panel title="AI Analyst Intelligence" action={<Link href="/ai-analyst/analysis" className="text-[11px] text-violet-300"><Bot size={12} /> Open AI Analyst</Link>}>
          <div className="rounded-lg border border-violet-300/20 bg-violet-300/[0.06] p-3 text-sm leading-6 text-slate-200">
            <Sparkles size={15} className="mb-1 text-violet-300" />
            12 findings analyzed. 3 likely duplicates. 2 high-confidence issues require analyst confirmation. 5 remediation actions suggested across the critical and high findings.
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <Mini label="Findings analyzed" value="12" /> <Mini label="Duplicates found" value="3" /> <Mini label="High-risk assets" value="4" />
            <Mini label="Remediation actions" value="5" /> <Mini label="Need confirmation" value="2" /> <Mini label="Last analysis" value="14:31" />
          </div>
        </Panel>
      </div>

      {/* Row 5: Recon | Workers | Tech */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Panel title="Reconnaissance Activity" action={<Link href="/recon/history" className="text-[11px] text-teal-300">History</Link>}>
          <div className="grid grid-cols-2 gap-2">
            {RECON.map((r) => <div key={r.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2"><p className="text-base font-bold text-slate-100">{r.value}</p><p className="truncate text-[10px] text-slate-500">{r.label}</p><p className="text-[10px] text-emerald-300">{r.change}</p></div>)}
          </div>
        </Panel>

        <Panel title="Scanner & Worker Health">
          <div className="grid gap-2">
            {WORKERS.map((w) => (
              <div key={w.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${w.status === "healthy" ? "bg-emerald-400" : w.status === "busy" ? "bg-amber-400" : "bg-slate-500"}`} />
                <span className="w-32 truncate font-mono text-[11px] text-slate-300">{w.id}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{w.job}</span>
                <span className="font-mono text-[10px] text-slate-400">CPU {w.cpu}% · MEM {w.mem}%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SERVICES.map((s) => <StatusBadge key={s.name} value={s.state} dot={false} />)}
          </div>
        </Panel>

        <Panel title="Technology & Exposure" action={<Link href="/recon/technologies" className="text-[11px] text-teal-300">Details</Link>}>
          <div className="grid gap-2">
            {TECH_STACK.map((t) => (
              <div key={t.name} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
                <span className="flex-1 font-mono text-[11px] text-slate-200">{t.name}</span>
                <span className={`text-[10px] ${t.risk === "warn" ? "text-amber-300" : t.risk === "info" ? "text-cyan-300" : "text-emerald-300"}`}>{t.version}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 6: Activity | Reports | Scope */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Recent Activity">
          <div className="space-y-1.5">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="w-12 shrink-0 font-mono text-slate-500">{a.time}</span>
                <span className="text-slate-300">{a.text}</span>
                <span className="ml-auto text-[10px] text-slate-600">{a.who}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Reports & Compliance" action={<Link href="/reports/generate" className="text-[11px] text-teal-300">Generate</Link>}>
          {REPORTS.map((r) => (
            <div key={r.name} className="mb-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 last:mb-0">
              <p className="text-[12px] font-semibold text-slate-200">{r.name}</p>
              <p className="text-[10px] text-slate-500">{r.type} · {r.findings}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="text-[10px] text-slate-400">{r.formats}</span><span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400">{r.compliance}</span></div>
            </div>
          ))}
        </Panel>

        <Panel title="Scope & Safety">
          <div className="rounded-lg border border-teal-300/20 bg-teal-300/[0.05] px-3 py-2 text-[11px] text-teal-200"><span className="flex items-center gap-1.5"><ShieldCheck size={13} /> Scanning allowed — authorized scope active</span></div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {SCOPE.map((s) => <div key={s.label} className="flex justify-between gap-1"><span className="text-slate-500">{s.label}</span><span className="text-right text-slate-200">{s.value}</span></div>)}
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <><dt className="text-slate-500">{label}</dt><dd className={`${mono ? "font-mono text-slate-200" : "text-slate-200"}`}>{value}</dd></>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-200">{value}</p></div>;
}

export default SecurityDashboard;