"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  Bug,
  CheckCircle2,
  Download,
  FileSearch,
  Fingerprint,
  Gauge,
  Globe2,
  Play,
  PlugZap,
  Radar,
  RefreshCw,
  Route,
  Search,
  ScanLine,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Terminal,
  Waypoints,
} from "lucide-react";
import {
  AppPage,
  DataTable,
  EmptyState,
  LoadingState,
  MetricCard,
  SectionCard,
  StatusBadge,
} from "@/components/pan";
import {
  CodePanel,
  DefinitionGrid,
  Field,
  KeyValueRows,
  PageTabs,
  ProgressBar,
  SafetyNotice,
  SectionLink,
  Timeline,
  inputClass,
  primaryButton,
  secondaryButton,
  dangerButton,
} from "./FeatureUI";
import { PassiveScannerView } from "./passive/PassiveScannerView";
import { XssScannerView } from "./passive/XssScannerView";
import { ModuleScanner, RECON_MODULES, ReconTaskDetail, ReconTasksHistory, ReconTasksOverview } from "./recon-tasks-views";
import type { ReconModule } from "./recon-tasks";
import { ScannerRecordDetail } from "./ScannerRecordDetail";
import { scannerToolCatalog, type ScannerTool } from "./scanner-tools";
import { ToolScannerView } from "./toolkit/ToolScannerView";
import { toolConfigs } from "./toolkit/toolConfigs";
import type { RouteViewProps } from "./types";
import { OrbitalEarthHero } from "./OrbitalEarthHero";
import { useAsyncData } from "@/hooks/useAsyncData";
import { panService } from "@/services/pan-service";
import {
  acunetixService,
  type ActiveScanRow,
  type AcunetixReport,
  type AcunetixState,
  type AcunetixTarget,
  type SyncResult,
} from "./acunetix-service";

type ReconJob = {
  id: string;
  name: string;
  target: string;
  modules: string;
  status: string;
  progress: number;
  started: string;
};

const reconJobs: ReconJob[] = [
  {
    id: "recon_8f32",
    name: "Staging perimeter refresh",
    target: "Northstar Customer Portal",
    modules: "8 modules",
    status: "running",
    progress: 72,
    started: "6 min ago",
  },
  {
    id: "recon_7c10",
    name: "API surface discovery",
    target: "Atlas Partner API",
    modules: "5 modules",
    status: "completed",
    progress: 100,
    started: "Yesterday, 18:42",
  },
  {
    id: "recon_69ab",
    name: "Weekly passive inventory",
    target: "Northstar Customer Portal",
    modules: "4 modules",
    status: "completed",
    progress: 100,
    started: "Aug 24, 09:10",
  },
];

const reconModules = [
  {
    slug: "subdomains",
    name: "Subdomains",
    adapter: "Subfinder",
    description: "Map passive DNS and authorized active sources into a normalized host inventory.",
    output: "24 hosts",
    checks: ["Certificate transparency", "Passive DNS", "Wordlist enumeration"],
  },
  {
    slug: "live-hosts",
    name: "Live hosts",
    adapter: "HTTPx",
    description: "Probe approved HTTP and HTTPS hosts for availability, redirects, and response fingerprints.",
    output: "17 responsive",
    checks: ["HTTP status", "TLS metadata", "Redirect scope"],
  },
  {
    slug: "ports",
    name: "Ports",
    adapter: "Naabu",
    description: "Discover exposed services on the exact allowed port set with conservative rate limits.",
    output: "31 services",
    checks: ["Allowed TCP ports", "Service hints", "Exposure changes"],
  },
  {
    slug: "technologies",
    name: "Technologies",
    adapter: "PAN fingerprints",
    description: "Identify frameworks, servers, libraries, CDNs, and security controls from safe fingerprints.",
    output: "19 technologies",
    checks: ["Headers", "HTML markers", "JavaScript libraries"],
  },
  {
    slug: "url-discovery",
    name: "URL discovery",
    adapter: "Katana",
    description: "Crawl in-scope application links and forms while honoring exclusions and request ceilings.",
    output: "312 endpoints",
    checks: ["HTML links", "Form actions", "API references"],
  },
  {
    slug: "web-archive",
    name: "Web archive",
    adapter: "Wayback collector",
    description: "Collect historical URLs and parameters, then retain only records inside the approved scope.",
    output: "86 historical URLs",
    checks: ["Historical paths", "Legacy parameters", "Scope filtering"],
  },
  {
    slug: "javascript",
    name: "JavaScript",
    adapter: "PAN JS analyzer",
    description: "Extract routes, parameters, API references, and possible secret patterns from scripts.",
    output: "41 routes",
    checks: ["Route extraction", "Parameter names", "Secret indicators"],
  },
  {
    slug: "screenshots",
    name: "Screenshots",
    adapter: "Browser worker",
    description: "Build a visual asset inventory with safe, isolated browser captures of approved hosts.",
    output: "17 captures",
    checks: ["Visual inventory", "Page title", "Change detection"],
  },
];

const reconTabs = [
  { label: "Overview", value: "overview" },
  { label: "New recon", value: "new" },
  { label: "History", value: "history" },
  { label: "Subdomains", value: "subdomains" },
  { label: "Live hosts", value: "live-hosts" },
  { label: "URLs", value: "url-discovery" },
];

const moduleToolMap: Record<string, string[]> = {
  subdomains: ["Subfinder", "OWASP Amass", "Sublist3r", "Findomain", "crt.sh", "CertSpotter", "Censys", "VirusTotal", "AlienVault OTX", "SecurityTrails", "Shodan", "DNSDumpster", "Common Crawl", "RapidDNS", "HackerTarget", "Anubis"],
  "live-hosts": ["HTTPx", "httprobe", "Naabu", "Nmap"],
  ports: ["Naabu", "Nmap", "Masscan", "RustScan"],
  technologies: ["WhatWeb", "Wappalyzer", "httpx", "Webanalyze", "BuiltWith"],
  "url-discovery": ["Katana", "gau", "waybackurls", "hakrawler", "gospider", "feroxbuster", "ffuf"],
  "web-archive": ["Wayback Machine CDX", "waybackurls", "gau", "Common Crawl Index", "Arquivo.pt", "Memento Time Travel"],
  javascript: ["LinkFinder", "xnLinkFinder", "JSluice", "SecretFinder", "Mantra", "Retire.js"],
  screenshots: ["Playwright", "Puppeteer", "Selenium"],
};

export function ReconView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "overview";
  if (page === "overview" || page === "new") return <ReconTasksOverview />;
  if (page === "history") return <ReconTasksHistory />;
  const reconModule = RECON_MODULES.find((module) => module.id === page);
  if (reconModule) {
    if (segments[1]) return <ReconTaskDetail id={segments[1]} />;
    return <ModuleScanner module={page as ReconModule} />;
  }
  if (page.startsWith("recon_")) return <ReconTaskDetail id={page} />;
  return <ReconTasksOverview />;
}

function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}

function NewRecon() {
  const [launched, setLaunched] = useState(false);
  const [modules, setModules] = useState(() => new Set(reconModules.map((module) => module.slug)));

  function toggleModule(slug: string) {
    setModules((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <AppPage
      eyebrow="Authorized discovery"
      title="New recon job"
      description="Select a verified target, review its exact scope, and choose non-destructive discovery modules."
    >
      <PageTabs basePath="/recon" active="new" items={reconTabs} />
      {launched ? (
        <SectionCard title="Recon job queued" description="PAN validated the target and created a mock worker task.">
          <div className="flex flex-col items-start gap-4 rounded-xl border border-teal-300/20 bg-teal-300/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-300" />
                <p className="font-bold text-teal-100">recon_91c4 is queued</p>
              </div>
              <p className="mt-2 text-sm text-slate-400">{modules.size} modules · Northstar Customer Portal · Balanced rate</p>
            </div>
            <Link href="/recon/recon_91c4" className={primaryButton}>Open live job</Link>
          </div>
        </SectionCard>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            setLaunched(true);
          }}
        >
          <SectionCard title="1. Target and scope" description="Only verified targets can be selected.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Verified target">
                <select className={inputClass} defaultValue="target_01">
                  <option value="target_01">Northstar Customer Portal · staging</option>
                  <option value="target_02">Atlas Partner API · development</option>
                </select>
              </Field>
              <Field label="Discovery intensity" hint="Conservative keeps request volume below 2 requests/second.">
                <select className={inputClass} defaultValue="balanced">
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="thorough">Thorough</option>
                </select>
              </Field>
            </div>
            <div className="mt-5">
              <DefinitionGrid
                items={[
                  { label: "Included hosts", value: "portal.northstar-demo.com, api.northstar-demo.com" },
                  { label: "Excluded paths", value: "/logout, /payments, /delete-account" },
                  { label: "Allowed ports", value: "80, 443" },
                  { label: "Verification", value: <StatusBadge value="verified" /> },
                  { label: "Redirect policy", value: "Block outside scope" },
                  { label: "Maximum requests", value: "1,200" },
                ]}
              />
            </div>
          </SectionCard>
          <SectionCard title="2. Discovery modules" description={`${modules.size} of ${reconModules.length} selected`}>
            <div className="grid gap-3 md:grid-cols-2">
              {reconModules.map((module) => (
                <label key={module.slug} className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-teal-400"
                    checked={modules.has(module.slug)}
                    onChange={() => toggleModule(module.slug)}
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-200">{module.name}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-500">{module.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </SectionCard>
          <SafetyNotice />
          <div className="flex justify-end">
            <button className={primaryButton} type="submit" disabled={modules.size === 0}>
              <Play className="h-4 w-4" /> Validate scope and start
            </button>
          </div>
        </form>
      )}
    </AppPage>
  );
}

function ReconHistory() {
  return (
    <AppPage
      eyebrow="Attack surface"
      title="Recon history"
      description="Review discovery jobs, their scope-safe execution status, and normalized output."
      actions={<Link href="/recon/new" className={primaryButton}>New recon</Link>}
    >
      <PageTabs basePath="/recon" active="history" items={reconTabs} />
      <SectionCard title="Recent jobs" description="3 jobs across 2 verified targets">
        <DataTable
          data={reconJobs}
          keyField="id"
          columns={[
            {
              key: "name",
              header: "Job",
              render: (job: ReconJob) => (
                <Link href={`/recon/${job.id}`} className="font-semibold text-slate-100 hover:text-teal-300">
                  {job.name}
                  <span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{job.id}</span>
                </Link>
              ),
            },
            { key: "target", header: "Target" },
            { key: "modules", header: "Modules" },
            { key: "status", header: "Status", render: (job: ReconJob) => <StatusBadge value={job.status} /> },
            { key: "progress", header: "Progress", render: (job: ReconJob) => <span className="font-mono">{job.progress}%</span> },
            { key: "started", header: "Started" },
          ]}
        />
      </SectionCard>
    </AppPage>
  );
}

function ReconModule({ reconModule }: { reconModule: (typeof reconModules)[number] }) {
  const [started, setStarted] = useState(false);
  return (
    <AppPage
      eyebrow={`Recon · ${reconModule.adapter}`}
      title={reconModule.name}
      description={reconModule.description}
      actions={
        <button type="button" className={primaryButton} onClick={() => setStarted(true)}>
          <Play className="h-4 w-4" /> Run module
        </button>
      }
    >
      <PageTabs basePath="/recon" active={reconModule.slug} items={reconTabs} />
      {started ? (
        <SafetyNotice variant="success">
          {reconModule.name} task queued in mock mode. Target, redirect, exclusion, and request-limit checks passed.
        </SafetyNotice>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <SectionCard title="Module configuration" description={`Structured adapter: ${reconModule.adapter}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Verified target">
              <select className={inputClass}><option>Northstar Customer Portal</option><option>Atlas Partner API</option></select>
            </Field>
            <Field label="Rate policy">
              <select className={inputClass}><option>Balanced · 4 req/s</option><option>Conservative · 2 req/s</option></select>
            </Field>
          </div>
          <div className="mt-5">
            <DefinitionGrid
              items={[
                { label: "Included", value: "*.portal.northstar-demo.com" },
                { label: "Excluded", value: "/payments, /logout" },
                { label: "Adapter timeout", value: "10 minutes" },
                { label: "Last output", value: reconModule.output },
                { label: "Mode", value: <StatusBadge value="mock mode" tone="info" /> },
                { label: "Format", value: "Normalized JSON" },
              ]}
            />
          </div>
        </SectionCard>
        <SectionCard title="Supported discovery" description="The module will collect only these safe signals.">
          <ul className="space-y-3">
            {reconModule.checks.map((check) => (
              <li key={check} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-teal-300" /> {check}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      <SectionCard title="Tool stack" description={`Engines that power the ${reconModule.name} module. Adapter-ready — no external binaries run in mock mode.`}>
        <div className="flex flex-wrap gap-2">
          {(moduleToolMap[reconModule.slug] ?? [reconModule.adapter]).map((tool) => (
            <span key={tool} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
              <span className="font-semibold">{tool}</span>
            </span>
          ))}
        </div>
      </SectionCard>
      <SafetyNotice />
      <SectionCard title="Recent module jobs">
        <DataTable
          data={reconJobs.slice(0, 2)}
          keyField="id"
          columns={[
            { key: "name", header: "Job", render: (job: ReconJob) => <Link href={`/recon/${job.id}`} className="font-semibold text-teal-300">{job.name}</Link> },
            { key: "target", header: "Target" },
            { key: "status", header: "Status", render: (job: ReconJob) => <StatusBadge value={job.status} /> },
            { key: "started", header: "Started" },
          ]}
        />
      </SectionCard>
    </AppPage>
  );
}

function ReconJobDetail({ id, view }: { id: string; view: string }) {
  const [cancelled, setCancelled] = useState(false);
  const activeView = ["overview", "logs", "assets", "endpoints"].includes(view) ? view : "overview";
  return (
    <AppPage
      eyebrow={`Recon job · ${id}`}
      title="Staging perimeter refresh"
      description="Authorized discovery against Northstar Customer Portal · started 6 minutes ago"
      actions={
        <button type="button" className={dangerButton} onClick={() => setCancelled(true)} disabled={cancelled}>
          <StopCircle className="h-4 w-4" /> {cancelled ? "Cancelled" : "Cancel job"}
        </button>
      }
    >
      <PageTabs
        basePath={`/recon/${id}`}
        active={activeView}
        items={[
          { label: "Overview", value: "overview" },
          { label: "Assets", value: "assets" },
          { label: "Endpoints", value: "endpoints" },
          { label: "Logs", value: "logs" },
        ]}
      />
      {cancelled ? <SafetyNotice variant="info">Cancellation requested. The worker will finish its current safe operation and preserve collected evidence.</SafetyNotice> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assets found" value="24" detail="17 responsive" tone="teal" icon={Globe2} />
        <MetricCard label="Endpoints" value="312" detail="86 historical" tone="blue" icon={Waypoints} />
        <MetricCard label="Technologies" value="19" detail="2 outdated signals" tone="purple" icon={Fingerprint} />
        <MetricCard label="Scope blocks" value="2" detail="External redirects" tone="amber" icon={ShieldCheck} />
      </div>
      <SectionCard title="Live progress" action={<StatusBadge value={cancelled ? "cancelled" : "running"} />}>
        <ProgressBar value={cancelled ? 72 : 76} label="JavaScript analysis" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
          <Timeline
            items={[
              { title: "Scope validation", detail: "2 hosts, 3 exclusions, and 2 allowed ports accepted.", time: "09:14:02", state: "done" },
              { title: "Host discovery", detail: "24 unique in-scope hostnames normalized.", time: "09:15:48", state: "done" },
              { title: "HTTP probing", detail: "17 responsive services returned safe fingerprints.", time: "09:17:31", state: "done" },
              { title: cancelled ? "Cancellation requested" : "JavaScript analysis", detail: cancelled ? "Waiting for current script parse to complete." : "Processing 12 remaining scripts.", time: "now", state: "active" },
              { title: "Screenshots", detail: "Waiting for an isolated browser worker.", time: "pending", state: "pending" },
            ]}
          />
          <KeyValueRows rows={[
            { label: "Current worker", value: "mock-worker-02" },
            { label: "Requests", value: "438 / 1,200" },
            { label: "Average rate", value: "3.6 req/s" },
            { label: "Warnings", value: "2 redirects blocked" },
          ]} />
        </div>
      </SectionCard>
    </AppPage>
  );
}

const activeScannerTabs = [
  { label: "Overview", value: "overview" },
  { label: "Targets", value: "targets" },
  { label: "New scan", value: "new-scan" },
  { label: "Scans", value: "scans" },
  { label: "Findings", value: "findings" },
  { label: "Reports", value: "reports" },
  { label: "Settings", value: "settings" },
];

export function ActiveScannerView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "overview";
  const known = activeScannerTabs.some((item) => item.value === page);
  if (!known) return <ActiveScanDetail id={page} view={segments[1] ?? "overview"} />;
  if (page === "new-scan") return <NewActiveScan />;
  if (page === "settings") return <ActiveScannerSettings />;
  if (page === "scans") return <ActiveScanList />;
  if (page === "targets") return <ActiveTargets />;
  if (page === "findings") return <ActiveFindings />;
  if (page === "reports") return <ActiveReports />;

  return <ActiveOverview />;
}

const ACX_PROFILES = [
  { value: "full_scan", label: "Full Scan" },
  { value: "safe", label: "High Risk Vulnerabilities (safe)" },
  { value: "quick", label: "Quick Scan" },
];

const TERMINAL_STATUS = ["completed", "cancelled", "failed"];

function usePolling(active: boolean, reload: () => void, intervalMs = 5000) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(reload, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, reload, intervalMs]);
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scanFindingsCount(scan: ActiveScanRow) {
  const stats = scan.statistics ?? {};
  return (stats.candidateFindings ?? 0) + (stats.confirmedFindings ?? 0);
}

function ActiveOverview() {
  const { data: state, loading, reload } = useAsyncData(() => acunetixService.status(), "acx-status");
  const { data: acxTargets } = useAsyncData(() => acunetixService.targets(), "acx-targets");
  const { data: scans, reload: reloadScans } = useAsyncData(() => acunetixService.listScans(), "acx-scans");
  usePolling(!loading && !!state?.connected, () => { reload(); reloadScans(); });

  const running = (scans ?? []).filter((scan) => !TERMINAL_STATUS.includes(scan.status)).length;
  const completed = (scans ?? []).filter((scan) => scan.status === "completed").length;
  const totalFindings = (scans ?? []).reduce((sum, scan) => sum + scanFindingsCount(scan), 0);
  const connected = state?.connected && state.mode === "connected";

  return (
    <AppPage
      eyebrow="Acunetix integration"
      title="Active Scanner"
      description="Start and synchronize authorized Acunetix scans while PAN normalizes imported vulnerabilities into one findings workflow."
      actions={<Link href="/active-scanner/new-scan" className={primaryButton}><Play className="h-4 w-4" /> New active scan</Link>}
    >
      <PageTabs basePath="/active-scanner" active="overview" items={activeScannerTabs} />
      <div className={`rounded-2xl border p-5 ${connected ? "border-teal-300/20 bg-teal-300/[0.055]" : "border-amber-300/20 bg-amber-300/[0.055]"}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${connected ? "bg-teal-300/10 text-teal-200" : "bg-amber-300/10 text-amber-200"}`}><PlugZap className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`font-bold ${connected ? "text-teal-100" : "text-amber-100"}`}>{connected ? "Acunetix is connected" : "Acunetix is disconnected"}</h2>
                {state ? <StatusBadge value={state.mode} tone={connected ? "success" : "warning"} /> : <StatusBadge value="checking…" tone="info" />}
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                {state?.message ?? "Checking connection to the configured Acunetix instance…"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} onClick={() => { reload(); reloadScans(); }}><RefreshCw className="h-4 w-4" /> Test connection</button>
            <Link href="/active-scanner/settings" className={secondaryButton}><Settings2 className="h-4 w-4" /> Configure</Link>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Synchronized targets" value={String(acxTargets?.length ?? 0)} detail="On the Acunetix instance" tone="teal" icon={Globe2} />
        <MetricCard label="Running active scans" value={String(running)} detail={`${completed} completed`} tone="blue" icon={ScanLine} />
        <MetricCard label="Imported findings" value={String(totalFindings)} detail="Across Acunetix scans" tone="purple" icon={ShieldAlert} />
        <MetricCard label="Connection mode" value={connected ? "live" : state?.mode ?? "unknown"} detail={state?.baseUrl ?? "Not configured"} tone={connected ? "teal" : "amber"} icon={RefreshCw} />
      </div>
      <SectionCard title="Recent Acunetix scans" action={<Link href="/active-scanner/scans" className={secondaryButton}>View all</Link>}>
        {loading ? <LoadingState /> : <ActiveScanTable scans={(scans ?? []).slice(0, 6)} />}
      </SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}

function ActiveScanTable({ scans }: { scans: ActiveScanRow[] }) {
  return (
    <DataTable
      data={scans}
      keyField="id"
      columns={[
        { key: "name", header: "Scan", render: (scan: ActiveScanRow) => <Link href={`/active-scanner/${scan.id}/overview`} className="font-semibold text-slate-100 hover:text-teal-300">{scan.name}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{scan.id}</span></Link> },
        { key: "targetName", header: "Target", render: (scan: ActiveScanRow) => <span className="text-slate-300">{scan.targetName ?? "—"}</span> },
        { key: "profile", header: "Profile", render: (scan: ActiveScanRow) => <span className="font-mono text-xs">{scan.profile}</span> },
        { key: "status", header: "Status", render: (scan: ActiveScanRow) => <StatusBadge value={scan.status} /> },
        { key: "progress", header: "Progress", render: (scan: ActiveScanRow) => <span className="font-mono">{scan.progress}%</span> },
        { key: "findings", header: "Findings", render: (scan: ActiveScanRow) => <span className="font-mono">{scanFindingsCount(scan)}</span> },
        { key: "startedAt", header: "Started", render: (scan: ActiveScanRow) => <span className="text-xs text-slate-500">{formatTime(scan.startedAt)}</span> },
      ]}
    />
  );
}

function ActiveScanList() {
  const { data: scans, loading, error, reload } = useAsyncData(() => acunetixService.listScans(), "acx-scans");
  usePolling(!loading && (scans ?? []).some((scan) => !TERMINAL_STATUS.includes(scan.status)), reload, 6000);
  return (
    <AppPage eyebrow="Acunetix integration" title="Acunetix scans" description="Track imported scan state and synchronize vulnerabilities into PAN findings." actions={<Link href="/active-scanner/new-scan" className={primaryButton}><Play className="h-4 w-4" /> New scan</Link>}>
      <PageTabs basePath="/active-scanner" active="scans" items={activeScannerTabs} />
      <SectionCard title="Scan history" action={<button type="button" className={secondaryButton} onClick={reload}><RefreshCw className="h-4 w-4" /> Refresh</button>}>
        {loading ? <LoadingState /> : error ? <EmptyState icon={FileSearch} title="Could not load scans" description={error.message} /> : <ActiveScanTable scans={scans ?? []} />}
      </SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}

function NewActiveScan() {
  const { data: targets, loading } = useAsyncData(() => panService.getTargets(), "acx-pan-targets");
  const { data: workspaces } = useAsyncData(() => panService.getWorkspaces(), "acx-workspaces");
  const verified = useMemo(() => (targets ?? []).filter((target) => target.verificationStatus === "verified"), [targets]);
  const [targetId, setTargetId] = useState("");
  const [profile, setProfile] = useState("full_scan");
  const [started, setStarted] = useState<ActiveScanRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = verified.find((target) => target.id === targetId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = (workspaces ?? [])[0];
      if (!workspace) throw new Error("No workspace is available.");
      const scan = await acunetixService.startScan({
        workspaceId: workspace.id,
        targetId: selected.id,
        name: `Acunetix ${profile} · ${selected.name}`,
        profile,
        authorizationAcknowledged: true,
      });
      setStarted(scan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan could not be started.");
    } finally {
      setBusy(false);
    }
  }

  if (started) {
    return (
      <AppPage eyebrow="Acunetix · live adapter" title="New active scan" description="The scan was accepted by the Acunetix instance and is now tracked by PAN.">
        <PageTabs basePath="/active-scanner" active="new-scan" items={activeScannerTabs} />
        <SectionCard title="Active scan created" description="PAN scope validation passed and the scan is running on the Acunetix instance.">
          <div className="flex flex-col gap-4 rounded-xl border border-teal-300/20 bg-teal-300/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-teal-100">{started.name} · {started.status}</p>
              <p className="mt-1 text-sm text-slate-400">{started.targetName ?? "Target"} · {started.profile} · live adapter</p>
            </div>
            <Link href={`/active-scanner/${started.id}/overview`} className={primaryButton}><Activity className="h-4 w-4" /> Open live scan</Link>
          </div>
        </SectionCard>
      </AppPage>
    );
  }

  return (
    <AppPage eyebrow="Acunetix · live adapter" title="New active scan" description="Map an approved PAN target to Acunetix, select a profile, and review scope before submission.">
      <PageTabs basePath="/active-scanner" active="new-scan" items={activeScannerTabs} />
      <form onSubmit={submit} className="grid gap-5">
        <SectionCard title="Scan configuration">
          {loading ? <LoadingState /> : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Verified target" hint="Only targets with verified ownership are eligible.">
                <select className={inputClass} value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
                  <option value="">Select a verified target…</option>
                  {verified.map((target) => <option key={target.id} value={target.id}>{target.name} · {target.domain}</option>)}
                </select>
              </Field>
              <Field label="Acunetix profile">
                <select className={inputClass} value={profile} onChange={(event) => setProfile(event.target.value)}>
                  {ACX_PROFILES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            </div>
          )}
          {selected ? (
            <div className="mt-5">
              <DefinitionGrid items={[
                { label: "Included hosts", value: selected.scope.includedHosts.length ? selected.scope.includedHosts.join(", ") : selected.domain },
                { label: "Excluded hosts", value: selected.scope.excludedHosts.length ? selected.scope.excludedHosts.join(", ") : "None" },
                { label: "Allowed ports", value: selected.scope.allowedPorts.join(", ") },
                { label: "Target status", value: <StatusBadge value="verified" /> },
                { label: "Adapter", value: <StatusBadge value="acunetix live" tone="success" /> },
                { label: "Disruptive checks", value: "Disabled" },
              ]} />
            </div>
          ) : null}
        </SectionCard>
        {error ? <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm font-semibold text-rose-200">{error}</p> : null}
        <SafetyNotice>Starting a scan sends authorized traffic from the Acunetix instance to the target. Only verified, in-scope targets are eligible.</SafetyNotice>
        <div className="flex justify-end"><button type="submit" className={primaryButton} disabled={busy || !selected}><Play className="h-4 w-4" /> {busy ? "Starting…" : "Validate and start"}</button></div>
      </form>
    </AppPage>
  );
}

function ActiveScannerSettings() {
  const { data: state, loading, reload } = useAsyncData(() => acunetixService.status(), "acx-status");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AcunetixState | null>(null);
  const connected = state?.connected && state.mode === "connected";

  async function runTest() {
    setTesting(true);
    try {
      setResult(await acunetixService.testConnection());
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppPage eyebrow="Acunetix integration" title="Connection settings" description="Connection secrets are read by the backend from environment variables and are never returned to the browser.">
      <PageTabs basePath="/active-scanner" active="settings" items={activeScannerTabs} />
      <SafetyNotice variant="info">Set ACUNETIX_BASE_URL and ACUNETIX_API_KEY in the backend environment, then restart the API. PAN stores only synchronization metadata.</SafetyNotice>
      <SectionCard title="Connection status" action={loading ? <StatusBadge value="checking…" tone="info" /> : <StatusBadge value={connected ? "connected" : "disconnected"} tone={connected ? "success" : "warning"} />}>
        <div className="grid gap-4">
          <Field label="Acunetix base URL"><input className={inputClass} value={state?.baseUrl ?? "Not configured on server"} disabled /></Field>
          <Field label="API key"><input className={inputClass} value={state?.configured ? "••••••••••••••••" : "Not configured on server"} disabled type="password" /></Field>
          {state?.message ? <p className={`text-sm ${connected ? "text-teal-300" : "text-slate-400"}`}>{state.message}</p> : null}
          {result ? (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${result.connected && result.mode === "connected" ? "border-teal-300/20 bg-teal-300/[0.06] text-teal-200" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-200"}`}>
              {result.message}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button className={secondaryButton} type="button" onClick={runTest} disabled={testing}><RefreshCw className="h-4 w-4" /> {testing ? "Testing…" : "Test server connection"}</button>
            <button className={secondaryButton} type="button" onClick={reload}>Refresh status</button>
          </div>
        </div>
      </SectionCard>
    </AppPage>
  );
}

function ActiveTargets() {
  const { data: targets, loading, error, reload } = useAsyncData(() => acunetixService.targets(), "acx-targets");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setSyncError(null);
    try {
      setSyncResult(await acunetixService.syncTargets());
      reload();
    } catch (reason) {
      setSyncError(reason instanceof Error ? reason.message : "Synchronization failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppPage eyebrow="Acunetix integration" title="Synchronized targets" description="Map verified PAN targets to Acunetix without exposing credentials or widening their approved scope." actions={<button type="button" className={secondaryButton} onClick={sync} disabled={syncing}><RefreshCw className="h-4 w-4" /> {syncing ? "Synchronizing…" : "Synchronize from PAN"}</button>}>
      <PageTabs basePath="/active-scanner" active="targets" items={activeScannerTabs} />
      {syncResult ? <div className="mb-4 rounded-xl border border-teal-300/20 bg-teal-300/[0.06] px-4 py-3 text-sm font-semibold text-teal-200">{syncResult.synchronized} targets synchronized · {syncResult.externalRequests ?? 0} external requests</div> : null}
      {syncError ? <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm font-semibold text-rose-200">{syncError}</div> : null}
      <SectionCard title="Target mappings" action={loading ? <StatusBadge value="loading…" tone="info" /> : <StatusBadge value={targets?.length ? "live" : "empty"} tone={targets?.length ? "success" : "info"} />}>
        {loading ? <LoadingState /> : error ? <EmptyState icon={FileSearch} title="Could not load targets" description={error.message} /> : (
          <DataTable data={targets ?? []} keyField="id" columns={[
            { key: "address", header: "Target", render: (target: AcunetixTarget) => <span className="font-semibold text-slate-100">{target.address}</span> },
            { key: "description", header: "Description", render: (target: AcunetixTarget) => <span className="text-slate-300">{target.description ?? "—"}</span> },
            { key: "criticality", header: "Criticality", render: (target: AcunetixTarget) => <span className="font-mono">{target.criticality ?? "—"}</span> },
            { key: "state", header: "State", render: (target: AcunetixTarget) => <StatusBadge value={target.state ?? "unknown"} /> },
            { key: "id", header: "Acunetix ID", render: (target: AcunetixTarget) => <span className="font-mono text-xs text-slate-500">{target.id}</span> },
          ]} />
        )}
      </SectionCard>
    </AppPage>
  );
}

function ActiveFindings() {
  const { data: findings, loading, error } = useAsyncData(() => panService.getFindings(), "acx-findings");
  const imported = (findings ?? []).filter((finding) => finding.source === "acunetix");
  return (
    <AppPage eyebrow="Acunetix integration" title="Imported findings" description="Acunetix vulnerabilities normalized and correlated with PAN assets, endpoints, and existing evidence.">
      <PageTabs basePath="/active-scanner" active="findings" items={activeScannerTabs} />
      <SectionCard title="Normalized findings" action={<StatusBadge value={`${imported.length} imported`} tone="purple" />}>
        {loading ? <LoadingState /> : error ? <EmptyState icon={FileSearch} title="Could not load findings" description={error.message} /> : imported.length === 0 ? (
          <EmptyState icon={Bug} title="No Acunetix findings yet" description="Run a live Acunetix scan and synchronize findings from the scan detail page. Imported vulnerabilities appear here with source 'acunetix'." action={<Link href="/active-scanner/new-scan" className={primaryButton}>Start active scan</Link>} />
        ) : (
          <DataTable data={imported} keyField="id" columns={[
            { key: "title", header: "Finding", render: (finding: { id: string; title: string }) => <Link href={`/findings/${finding.id}/overview`} className="font-semibold text-teal-300">{finding.title}</Link> },
            { key: "severity", header: "Severity", render: (finding: { severity: string }) => <StatusBadge value={finding.severity} /> },
            { key: "confidence", header: "Confidence", render: (finding: { confidence: number }) => <span className="font-mono">{finding.confidence}%</span> },
            { key: "targetName", header: "Target" },
            { key: "verificationState", header: "PAN state", render: (finding: { verificationState: string }) => <StatusBadge value={finding.verificationState} /> },
          ]} />
        )}
      </SectionCard>
    </AppPage>
  );
}

function ActiveReports() {
  const { data: scans, loading } = useAsyncData(() => acunetixService.listScans(), "acx-reports");
  const completed = (scans ?? []).filter((scan) => scan.status === "completed");
  return (
    <AppPage eyebrow="Acunetix integration" title="Imported reports" description="Acunetix report artifacts synchronized into PAN with source, timestamp, and scan linkage.">
      <PageTabs basePath="/active-scanner" active="reports" items={activeScannerTabs} />
      {loading ? <LoadingState /> : completed.length === 0 ? (
        <EmptyState icon={FileSearch} title="No Acunetix reports imported" description="Complete a live Acunetix scan, then open its Report tab to generate and download the source report artifact." action={<Link href="/active-scanner/new-scan" className={primaryButton}>Start active scan</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {completed.map((scan) => <ReportCard key={scan.id} scan={scan} />)}
        </div>
      )}
    </AppPage>
  );
}

function ReportCard({ scan }: { scan: ActiveScanRow }) {
  const [reports, setReports] = useState<AcunetixReport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setReports(await acunetixService.reports(scan.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Report generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title={scan.name} description={`${scan.targetName ?? "Target"} · ${scan.profile} · completed`} action={<StatusBadge value="completed" tone="success" />}>
      {reports === null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate-400">Generate the source report on the Acunetix instance, then download it through PAN.</p>
          <button type="button" className={secondaryButton} onClick={generate} disabled={busy}><Download className="h-4 w-4" /> {busy ? "Generating…" : "Generate report"}</button>
          {error ? <p className="text-sm font-semibold text-rose-200">{error}</p> : null}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState icon={FileSearch} title="No report available" description="The Acunetix instance did not return a report for this scan." />
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div key={report.reportId} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <div>
                <p className="font-mono text-xs text-slate-400">{report.reportId}</p>
                <StatusBadge value={report.available ? "completed" : report.status} tone={report.available ? "success" : "info"} />
              </div>
              {report.available ? <a className={primaryButton} href={acunetixService.reportDownloadUrl(scan.id, report.reportId)}><Download className="h-4 w-4" /> Download</a> : <span className="text-xs text-slate-500">Processing…</span>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ActiveScanDetail({ id, view }: { id: string; view: string }) {
  const activeView = ["overview", "live", "status", "findings", "activity", "logs", "report"].includes(view) ? view : "overview";
  const { data: scan, loading, error, reload } = useAsyncData(() => acunetixService.getScan(id), `acx-detail-${id}`);
  const [stopping, setStopping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [reports, setReports] = useState<AcunetixReport[] | null>(null);
  const [reportsBusy, setReportsBusy] = useState(false);
  const { data: findings, reload: reloadFindings } = useAsyncData(() => panService.getFindings(), `acx-findings-${id}`);
  usePolling(!!scan && !TERMINAL_STATUS.includes(scan.status), reload, 5000);

  const provider = scan?.providerStatus;
  const progress = provider?.progress ?? scan?.progress ?? 0;
  const scanFindings = (findings ?? []).filter((finding) => finding.source === "acunetix");

  async function stop() {
    setStopping(true);
    try {
      await acunetixService.stopScan(id);
      reload();
    } finally {
      setStopping(false);
    }
  }

  async function syncFindings() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await acunetixService.syncFindings(id);
      setSyncMessage(`${result.imported} vulnerabilities imported and normalized.`);
      reloadFindings();
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : "Finding synchronization failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function generateReport() {
    setReportsBusy(true);
    try {
      setReports(await acunetixService.reports(id));
    } finally {
      setReportsBusy(false);
    }
  }

  if (loading) return <AppPage eyebrow="Acunetix scan" title="Loading scan…" description="Fetching the latest state from the Acunetix instance."><LoadingState /></AppPage>;
  if (error || !scan) return <AppPage eyebrow="Acunetix scan" title="Scan unavailable" description="The scan could not be loaded."><EmptyState icon={FileSearch} title="Could not load scan" description={error?.message ?? "Scan not found."} /></AppPage>;

  const canStop = !TERMINAL_STATUS.includes(scan.status);

  return (
    <AppPage
      eyebrow={`Acunetix scan · ${id}`}
      title={scan.name}
      description={`${scan.targetName ?? "Target"} · ${scan.profile} profile · ${provider?.providerStatus ?? "synchronizing"} · ${provider?.status ?? scan.status}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {scan.status === "completed" ? <button type="button" className={secondaryButton} onClick={syncFindings} disabled={syncing}><RefreshCw className="h-4 w-4" /> {syncing ? "Synchronizing…" : "Sync findings"}</button> : null}
          {canStop ? <button type="button" className={dangerButton} onClick={stop} disabled={stopping}><StopCircle className="h-4 w-4" /> {stopping ? "Stopping…" : "Stop scan"}</button> : null}
        </div>
      }
    >
      <PageTabs basePath={`/active-scanner/${id}`} active={activeView} items={[
        { label: "Overview", value: "overview" }, { label: "Live", value: "live" }, { label: "Status", value: "status" }, { label: "Findings", value: "findings" }, { label: "Activity", value: "activity" }, { label: "Logs", value: "logs" }, { label: "Report", value: "report" },
      ]} />
      {syncMessage ? <SafetyNotice variant={syncMessage.includes("imported") ? "success" : "info"}>{syncMessage}</SafetyNotice> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Progress" value={`${progress}%`} detail={provider?.status ?? "synchronizing"} tone="teal" icon={Gauge} />
        <MetricCard label="Provider state" value={provider?.providerStatus ?? "—"} detail={provider ? `severity ${provider.severity ?? 0}` : "pending first poll"} tone="blue" icon={Activity} />
        <MetricCard label="Imported findings" value={String(scanFindings.length)} detail="source: acunetix" tone="purple" icon={Bug} />
        <MetricCard label="Requests sent" value={String(scan.statistics?.requestsSent ?? 0)} detail={`${scan.statistics?.endpointsFound ?? 0} endpoints found`} tone="amber" icon={ShieldCheck} />
      </div>
      {activeView === "overview" || activeView === "live" ? <SectionCard title="Acunetix progress" action={<StatusBadge value={scan.status} tone={TERMINAL_STATUS.includes(scan.status) ? "success" : "info"} />}>
        <ProgressBar value={progress} label={`${scan.profile} profile`} />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <KeyValueRows rows={[
            { label: "Current activity", value: provider?.providerStatus ?? scan.currentPhase ?? "Starting…" },
            { label: "PAN target", value: scan.targetName ?? "—", href: scan.targetId ? `/targets/${scan.targetId}/overview` : undefined },
            { label: "Acunetix scan id", value: scan.externalReference?.id ?? "—" },
            { label: "Adapter", value: <StatusBadge value={scan.externalReference?.mode ?? "connected"} tone="success" /> },
          ]} />
          <Timeline items={[
            { title: "Scan submitted", detail: "Accepted by the Acunetix instance.", time: formatTime(scan.startedAt), state: "done" },
            { title: provider?.status && !TERMINAL_STATUS.includes(scan.status) ? "Scanning" : "Scan finished", detail: provider?.status && !TERMINAL_STATUS.includes(scan.status) ? `Running at ${progress}% on the remote instance.` : `Terminal state: ${scan.status}.`, time: formatTime(scan.completedAt), state: TERMINAL_STATUS.includes(scan.status) ? "done" : "active" },
          ]} />
        </div>
      </SectionCard> : null}
      {activeView === "status" ? <SectionCard title="Adapter status" description="PAN polls the server-side adapter; Acunetix credentials never reach this page.">
        <DefinitionGrid items={[
          { label: "PAN state", value: <StatusBadge value={scan.status} /> },
          { label: "Acunetix state", value: provider?.providerStatus ?? "unknown" },
          { label: "Progress", value: `${progress}%` },
          { label: "Severity", value: String(provider?.severity ?? "—") },
          { label: "Event log", value: provider?.eventLogId ?? "—" },
          { label: "Adapter", value: <StatusBadge value={scan.externalReference?.mode ?? "connected"} tone="success" /> },
        ]} />
      </SectionCard> : null}
      {activeView === "findings" ? <SectionCard title="Imported vulnerabilities" description="Normalized candidates linked back to their Acunetix source identifiers." action={scan.status === "completed" ? <button type="button" className={secondaryButton} onClick={syncFindings} disabled={syncing}><RefreshCw className="h-4 w-4" /> {syncing ? "Synchronizing…" : "Sync findings"}</button> : null}>
        {scanFindings.length === 0 ? <EmptyState icon={Bug} title="No imported findings yet" description="Run the synchronization after the scan completes; Acunetix vulnerabilities are normalized into PAN findings with source 'acunetix'." /> : (
          <DataTable data={scanFindings} keyField="id" columns={[
            { key: "title", header: "Vulnerability", render: (finding: { id: string; title: string }) => <Link href={`/findings/${finding.id}/overview`} className="font-semibold text-teal-300">{finding.title}</Link> },
            { key: "severity", header: "Severity", render: (finding: { severity: string }) => <StatusBadge value={finding.severity} /> },
            { key: "confidence", header: "Confidence", render: (finding: { confidence: number }) => <span className="font-mono">{finding.confidence}%</span> },
            { key: "verificationState", header: "PAN state", render: (finding: { verificationState: string }) => <StatusBadge value={finding.verificationState} /> },
          ]} />
        )}
      </SectionCard> : null}
      {activeView === "activity" ? <SectionCard title="Synchronization activity">
        <Timeline items={[
          { title: "Scan submitted", detail: "Accepted by the Acunetix instance with target scope mapping.", time: formatTime(scan.startedAt), state: "done" },
          { title: "Status synchronized", detail: `Provider reported ${provider?.providerStatus ?? "unknown"} at ${progress}%.`, time: "Last poll", state: TERMINAL_STATUS.includes(scan.status) ? "done" : "active" },
          { title: "Scan finished", detail: `Terminal state: ${scan.status}.`, time: formatTime(scan.completedAt), state: TERMINAL_STATUS.includes(scan.status) ? "done" : "pending" },
        ]} />
      </SectionCard> : null}
      {activeView === "logs" ? <SectionCard title="Adapter logs" description="API keys, authorization headers, and response bodies are redacted.">
        <CodePanel label="Synchronization log">{`-- live adapter -- scan=${id} target=${scan.targetName ?? "?"} profile=${scan.profile}
provider=${scan.externalReference?.mode ?? "connected"} state=${provider?.providerStatus ?? "unknown"} progress=${progress}
requests=${scan.statistics?.requestsSent ?? 0} endpoints=${scan.statistics?.endpointsFound ?? 0}
warnings=${(scan.warnings ?? []).join(" | ") || "none"}
next_poll=5s while active`}</CodePanel>
      </SectionCard> : null}
      {activeView === "report" ? <SectionCard title="Acunetix report" description="A source report can be generated and downloaded after the scan reaches a terminal state." action={scan.status === "completed" ? <button type="button" className={secondaryButton} onClick={generateReport} disabled={reportsBusy}><Download className="h-4 w-4" /> {reportsBusy ? "Generating…" : "Generate report"}</button> : null}>
        {reports === null ? (
          <EmptyState icon={FileSearch} title={scan.status === "completed" ? "Report not generated yet" : "Scan still running"} description={scan.status === "completed" ? "Generate the source report on the Acunetix instance, then download it through PAN." : "PAN offers source-report import after Acunetix finishes."} action={scan.status === "completed" ? <button type="button" className={primaryButton} onClick={generateReport} disabled={reportsBusy}><Download className="h-4 w-4" /> Generate report</button> : <Link href="/reports/generate" className={secondaryButton}>Generate PAN progress report</Link>} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileSearch} title="No report available" description="The Acunetix instance did not return a report for this scan." />
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.reportId} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <div>
                  <p className="font-mono text-xs text-slate-400">{report.reportId}</p>
                  <StatusBadge value={report.available ? "completed" : report.status} tone={report.available ? "success" : "info"} />
                </div>
                {report.available ? <a className={primaryButton} href={acunetixService.reportDownloadUrl(id, report.reportId)}><Download className="h-4 w-4" /> Download</a> : <span className="text-xs text-slate-500">Processing…</span>}
              </div>
            ))}
          </div>
        )}
      </SectionCard> : null}
      <SafetyNotice />
    </AppPage>
  );
}

const scannerModules = [
  { slug: "passive", name: "Passive analysis", engine: "PAN rules · ZAP-ready", description: "Analyze captured responses, headers, cookies, and configuration signals without sending attack payloads.", classes: ["Headers and cookies", "TLS posture", "Information disclosure"] },
  { slug: "xss", name: "Cross-site scripting", engine: "Dalfox / XSS0r adapter", description: "Detect reflected and DOM injection candidates with optional isolated browser verification.", classes: ["Reflected XSS", "DOM XSS", "Unsafe sinks"] },
  { slug: "sqli", name: "SQL injection", engine: "SQLmap / PAN detector", description: "Run bounded SQL injection checks against explicitly approved parameters with destructive techniques disabled.", classes: ["Error-based SQLi", "Boolean differential", "Time differential"] },
  { slug: "api", name: "API security", engine: "Schemathesis-ready", description: "Import OpenAPI or Postman definitions and exercise validated API contracts within scope.", classes: ["Schema violations", "Authorization drift", "Input handling"] },
  { slug: "secrets", name: "Secrets exposure", engine: "Gitleaks · TruffleHog · PAN", description: "Identify credential patterns in JavaScript, source maps, and captured responses without revealing secret values.", classes: ["API key patterns", "High-entropy tokens", "Private keys"] },
  { slug: "misconfigurations", name: "Misconfigurations", engine: "Nuclei · PAN rules", description: "Evaluate common security configuration weaknesses using curated, non-destructive checks.", classes: ["Security headers", "Exposed consoles", "Unsafe defaults"] },
  { slug: "cves", name: "Known CVEs", engine: "Curated Nuclei templates", description: "Match confirmed technology signals against approved CVE templates with evidence-first output.", classes: ["Known exposures", "Version signals", "Safe template checks"] },
  { slug: "custom", name: "Custom checks", engine: "PAN approved-check runner", description: "Create workspace-specific, reviewed checks with constrained requests and no arbitrary code execution.", classes: ["Response assertions", "Header checks", "Pattern checks"] },
];

const scannerTabs = [
  { label: "Overview", value: "overview" },
  { label: "Passive", value: "passive" },
  { label: "XSS", value: "xss" },
  { label: "SQLi", value: "sqli" },
  { label: "API", value: "api" },
  { label: "Secrets", value: "secrets" },
  { label: "Misconfigurations", value: "misconfigurations" },
  { label: "CVEs", value: "cves" },
  { label: "Custom", value: "custom" },
];

export function ScannerModuleView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "overview";
  if (segments.length >= 2 && segments[1]) return <ScannerScanDetail id={segments[1]} />;
  if (page === "overview") return <ScannerOverview />;
  if (page === "passive") return <PassiveScannerView />;
  if (page === "xss") return <XssScannerView />;
  if (toolConfigs[page]) return <ToolScannerView config={toolConfigs[page]} />;
  const scannerModule = scannerModules.find((item) => item.slug === page);
  if (!scannerModule) return <ScannerOverview />;
  if (page === "custom" && segments[1] === "new") return <NewCustomCheck />;
  if (page === "custom" && segments[1] === "templates") return <CustomTemplates />;
  if (page === "custom" && segments[1]) return <CustomCheckDetail id={segments[1]} />;
  return <ScannerModule scannerModule={scannerModule} />;
}

function ScannerScanDetail({ id }: { id: string }) {
  return <ScannerRecordDetail id={id} />;
}

const scannerToolGrid = [
  { slug: "passive", name: "Passive Recon", engine: "PAN · CT · OTX · Wayback · DNS", description: "Graph-based attack-surface discovery. Subdomains, certs, IPs, ASNs, URLs, tech.", status: "real", href: "/scanner/passive" },
  { slug: "xss", name: "XSS", engine: "Dalfox", description: "Real payload XSS detection with CLI terminal and normalized findings.", status: "real", href: "/scanner/xss" },
  { slug: "open-redirect", name: "Open Redirect", engine: "PAN · payload corpus", description: "Protocol + encoding bypass sweep across redirect parameters. 300+ payloads.", status: "real", href: "/scanner/open-redirect" },
  { slug: "secrets", name: "Secrets", engine: "PAN · gitleaks/trufflehog ready", description: "Scan HTML, JS and source maps for API keys, tokens and credentials.", status: "real", href: "/scanner/secrets" },
  { slug: "cves", name: "Known CVEs", engine: "Nuclei", description: "13,000+ templates with severity + tag filters. Real nuclei binary.", status: "real", href: "/scanner/cves" },
  { slug: "ssti", name: "SSTI", engine: "SSTImap", description: "Server-side template injection detection across popular engines.", status: "real", href: "/scanner/ssti" },
  { slug: "sqli", name: "SQL Injection", engine: "SQLMap", description: "Bounded sqlmap runs against parameterized endpoints.", status: "real", href: "/scanner/sqli" },
  { slug: "ssrf", name: "SSRF", engine: "ssrfmap", description: "Probe URL-fetching params for server-side request forgery.", status: "real", href: "/scanner/ssrf" },
];

function ScannerOverview() {
  return (
    <AppPage eyebrow="Specialist engines" title="Scanner toolkit" description="Focused, adapter-backed checks after PAN validates target ownership, exact scope, and safe execution limits. These run real tools — passive, Dalfox, Nuclei, SSTImap, SQLMap, ssrfmap and PAN engines." actions={<Link href="/scans/new" className={primaryButton}><Play className="h-4 w-4" /> Compose scan</Link>}>
      <PageTabs basePath="/scanner" active="overview" items={scannerTabs} />
      <OrbitalEarthHero mode="scanner" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Real engines" value="8" detail="Passive · Dalfox · Nuclei · SSTImap · SQLMap · ssrfmap" tone="teal" icon={Boxes} />
        <MetricCard label="Attack classes" value="7" detail="XSS · redirect · secrets · CVE · SSTI · SQLi · SSRF" tone="blue" icon={Bug} />
        <MetricCard label="CLI surfaced" value="Always" detail="Every run shows its exact command + output" tone="purple" icon={Terminal} />
        <MetricCard label="Mode" value="Authorized" detail="Targets verified before dispatch" tone="amber" icon={ShieldCheck} />
      </div>
      <SectionCard title="Tool catalog" description="Adapter-ready recon &amp; discovery engines grouped by capability. Click a category to expand.">
        <ScannerToolCatalog />
      </SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}

function ScannerToolCatalog() {
  const [open, setOpen] = useState<Set<string>>(new Set(scannerToolCatalog.map((cat) => cat.id)));
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  function toggle(id: string) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const categories = query
    ? scannerToolCatalog
        .map((cat) => ({ ...cat, tools: cat.tools.filter((tool) => tool.name.toLowerCase().includes(query) || tool.engine.toLowerCase().includes(query)) }))
        .filter((cat) => cat.tools.length > 0)
    : scannerToolCatalog;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} pl-9`} placeholder="Filter tools…" />
        </span>
        <button type="button" className={secondaryButton} onClick={() => setOpen(new Set(scannerToolCatalog.map((cat) => cat.id)))}>Expand all</button>
        <button type="button" className={secondaryButton} onClick={() => setOpen(new Set())}>Collapse all</button>
      </div>
      {categories.map((cat) => (
        <SectionCard key={cat.id} title={cat.label} description={`${cat.description} · ${cat.tools.length} tools`} action={<button type="button" className={secondaryButton} onClick={() => toggle(cat.id)}>{open.has(cat.id) ? "Collapse" : "Expand"}</button>}>
          {open.has(cat.id) ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cat.tools.map((tool) => <ToolChip key={tool.name} tool={tool} />)}
            </div>
          ) : null}
        </SectionCard>
      ))}
      {categories.length === 0 ? <p className="text-sm text-slate-500">No tools match “{filter}”.</p> : null}
    </div>
  );
}

function ToolChip({ tool }: { tool: ScannerTool }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 transition hover:border-teal-300/30 hover:bg-white/[0.04]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-200">{tool.name}</p>
        <p className="truncate text-xs text-slate-500">{tool.engine}</p>
      </div>
    </div>
  );
}

function ScannerModule({ scannerModule }: { scannerModule: (typeof scannerModules)[number] }) {
  const [started, setStarted] = useState(false);
  return (
    <AppPage eyebrow={`Scanner · ${scannerModule.engine}`} title={scannerModule.name} description={scannerModule.description} actions={<button className={primaryButton} type="button" onClick={() => setStarted(true)}><Play className="h-4 w-4" /> Start module scan</button>}>
      <PageTabs basePath="/scanner" active={scannerModule.slug} items={scannerTabs} />
      {started ? <SafetyNotice variant="success">Mock job scan_mod_7e2 queued after scope validation. No external scanner process was started.</SafetyNotice> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <SectionCard title="Run configuration" description="Configuration is constrained by the target's saved authorization envelope.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Verified target"><select className={inputClass}><option>Northstar Customer Portal · staging</option><option>Atlas Partner API · development</option></select></Field>
            <Field label="Authentication profile"><select className={inputClass}><option>Analyst test account</option><option>Unauthenticated</option></select></Field>
            <Field label="Scan intensity"><select className={inputClass}><option>Balanced · 4 req/s</option><option>Conservative · 2 req/s</option></select></Field>
            <Field label="Evidence handling"><select className={inputClass}><option>Sanitize and retain 30 days</option><option>Metadata only</option></select></Field>
          </div>
          <div className="mt-5"><DefinitionGrid items={[
            { label: "Included scope", value: "portal.northstar-demo.com/*" },
            { label: "Excluded paths", value: "/logout, /payments, /delete-account" },
            { label: "Request limit", value: "1,000" },
            { label: "Concurrency", value: "4" },
            { label: "Engine", value: scannerModule.engine },
            { label: "Mode", value: <StatusBadge value="mock mode" tone="info" /> },
          ]} /></div>
        </SectionCard>
        <SectionCard title="Supported checks" description="No destructive exploitation is included.">
          <ul className="space-y-3">{scannerModule.classes.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-teal-300" />{item}</li>)}</ul>
          <div className="mt-5 border-t border-white/[0.07] pt-4"><KeyValueRows rows={[
            { label: "Recent jobs", value: "3" }, { label: "Findings produced", value: scannerModule.slug === "xss" ? "4" : "2" }, { label: "Last run", value: "Yesterday" },
          ]} /></div>
        </SectionCard>
      </div>
      <SafetyNotice />
      <SectionCard title="Recent jobs">
        <DataTable data={[
          { id: "job_a91", target: "Northstar Customer Portal", status: "completed", findings: 3, time: "Yesterday, 18:42" },
          { id: "job_32d", target: "Atlas Partner API", status: "completed", findings: 1, time: "Aug 24, 10:18" },
        ]} keyField="id" columns={[
          { key: "id", header: "Job ID" }, { key: "target", header: "Target" }, { key: "status", header: "Status", render: (job: {status: string}) => <StatusBadge value={job.status} /> }, { key: "findings", header: "Findings" }, { key: "time", header: "Started" },
        ]} />
      </SectionCard>
    </AppPage>
  );
}

function NewCustomCheck() {
  const [saved, setSaved] = useState(false);
  return (
    <AppPage eyebrow="Scanner · custom" title="Create approved check" description="Define a constrained request and response assertion. Arbitrary code, shell commands, and out-of-scope URLs are not supported.">
      <PageTabs basePath="/scanner" active="custom" items={scannerTabs} />
      <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="grid gap-5">
        <SectionCard title="Check definition">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Check name"><input className={inputClass} defaultValue="Unexpected admin header" /></Field>
            <Field label="Method"><select className={inputClass}><option>GET</option><option>HEAD</option><option>OPTIONS</option></select></Field>
            <Field label="Path template" hint="Relative paths only; validated against target scope."><input className={inputClass} defaultValue="/health" /></Field>
            <Field label="Expected signal"><select className={inputClass}><option>Response header exists</option><option>Status equals</option><option>Body contains safe pattern</option></select></Field>
          </div>
        </SectionCard>
        <SafetyNotice>Custom checks require analyst review before they can run. Request bodies, redirect following, and concurrency stay policy-controlled.</SafetyNotice>
        <div className="flex items-center justify-end gap-3">{saved ? <span className="text-sm font-semibold text-teal-300">Draft saved for review</span> : null}<button type="submit" className={primaryButton}>Save draft</button></div>
      </form>
    </AppPage>
  );
}

function CustomTemplates() {
  return (
    <AppPage eyebrow="Scanner · custom" title="Approved check templates" description="Start from a workspace-reviewed assertion with safe defaults and constrained inputs." actions={<Link href="/scanner/custom/new" className={primaryButton}>New check</Link>}>
      <PageTabs basePath="/scanner" active="custom" items={scannerTabs} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SectionLink href="/scanner/custom/check_header_01" eyebrow="Response header" title="Required security header" description="Confirm that a named security header exists on selected in-scope routes." badge="approved" />
        <SectionLink href="/scanner/custom/check_status_02" eyebrow="Status assertion" title="Sensitive path unavailable" description="Verify a sensitive path stays blocked without submitting credentials or payloads." badge="approved" />
        <SectionLink href="/scanner/custom/check_pattern_03" eyebrow="Safe pattern" title="Environment marker" description="Detect development environment markers in a sanitized response sample." badge="draft" />
      </div>
    </AppPage>
  );
}

function CustomCheckDetail({ id }: { id: string }) {
  return (
    <AppPage eyebrow={`Custom check · ${id}`} title="Required security header" description="Workspace-approved response assertion for verified targets." actions={<button type="button" className={primaryButton}>Run check</button>}>
      <PageTabs basePath="/scanner" active="custom" items={scannerTabs} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Definition"><KeyValueRows rows={[
          { label: "Method", value: "GET" }, { label: "Path template", value: "/*" }, { label: "Assertion", value: "Content-Security-Policy exists" }, { label: "Status", value: <StatusBadge value="approved" /> }, { label: "Created by", value: "Maya Chen" }, { label: "Last reviewed", value: "Aug 25, 2026" },
        ]} /></SectionCard>
        <SectionCard title="Guardrails"><ul className="space-y-3 text-sm text-slate-300"><li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" />Relative routes only</li><li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" />GET requests only</li><li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" />Maximum 2 requests/second</li><li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-teal-300" />External redirects blocked</li></ul></SectionCard>
      </div>
      <SafetyNotice />
    </AppPage>
  );
}
