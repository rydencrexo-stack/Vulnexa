"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FileSearch,
  Fingerprint,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Trash2,
  Waypoints,
} from "lucide-react";
import {
  AppPage,
  DataTable,
  EmptyState,
  MetricCard,
  SectionCard,
  StatusBadge,
  type DataTableColumn,
} from "@/components/pan";
import { LoadingState } from "@/components/pan";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate } from "@/lib/utils";
import { panService } from "@/services/pan-service";
import type { Scan, ScanDetail } from "@/types/pan";
import {
  CodePanel,
  DefinitionGrid,
  Field,
  KeyValueRows,
  PageTabs,
  SafetyNotice,
  Timeline,
  inputClass,
  primaryButton,
  secondaryButton,
  dangerButton,
} from "./FeatureUI";
import { SurfaceGraph } from "./passive/SurfaceGraph";
import { AssetsView, OverviewView, RelationshipsView, TimelineView, TreeView } from "./passive/SurfaceViews";
import { ScannerRecordDetail } from "./ScannerRecordDetail";
import { activeScanRecords, getPassiveScanRecords, getScannerScan, removeScanRecord } from "./scans-data";
import type { RouteViewProps } from "./types";

type ScanRecord = {
  id: string;
  name: string;
  target: string;
  profile: string;
  status: string;
  progress: number;
  findings: number;
  started: string;
};

const scanTabs = [
  { label: "All scans", value: "all", href: "/scans" },
  { label: "Running", value: "running" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export function ScanView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "all";
  if (page === "new") return <NewScanWizard />;
  if (["all", "running", "scheduled", "completed", "failed"].includes(page)) return <ScanList status={page} />;
  return <ScanDetail id={page} view={segments[1] ?? "overview"} />;
}

function ScanList({ status }: { status: string }) {
  const { data, loading } = useAsyncData(() => panService.getScans());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const records: ScanRecord[] = (data ?? []).map((scan: Scan) => ({
    id: scan.id,
    name: scan.name,
    target: scan.targetName,
    profile: scan.profile,
    status: scan.status,
    progress: scan.progress,
    findings: scan.findings,
    started: formatDate(scan.startedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  }));
  const activeRecords: ScanRecord[] = activeScanRecords.map((scan) => ({
    id: scan.id,
    name: scan.name,
    target: scan.target,
    profile: scan.profile,
    status: scan.status,
    progress: scan.progress,
    findings: scan.findings,
    started: "—",
  }));
  const passiveRecords: ScanRecord[] = getPassiveScanRecords().map((scan) => ({
    id: scan.id,
    name: scan.name,
    target: scan.target,
    profile: scan.profile,
    status: scan.status,
    progress: scan.progress,
    findings: scan.findings,
    started: scan.started,
  }));
  const allRecords = [...activeRecords, ...passiveRecords, ...records].filter((scan) => !deleted.has(scan.id));
  const visibleScans = status === "all" ? allRecords : allRecords.filter((scan) => scan.status === status);

  async function onDelete(id: string) {
    setDeleted((current) => new Set(current).add(id));
    if (id.startsWith("acu_")) return; // const active-scanner demo rows — session removal only
    if (getScannerScan(id)) { removeScanRecord(id); return; } // frontend scanner record (passive_/xss_/tool_/…)
    try { await panService.deleteScan(id); } catch { /* keep local removal */ }
  }

  return (
    <AppPage
      eyebrow="Orchestration"
      title={status === "all" ? "Scans" : `${status[0].toUpperCase()}${status.slice(1)} scans`}
      description="Coordinate recon, passive analysis, specialist checks, evidence verification, AI review, and reporting in one authorized workflow."
      actions={<Link href="/scans/new" className={primaryButton}><Play className="h-4 w-4" /> New scan</Link>}
    >
      <PageTabs basePath="/scans" active={status} items={scanTabs} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Running" value={allRecords.filter((scan) => scan.status === "running").length} detail="live JSON state" tone="teal" icon={Activity} />
        <MetricCard label="Queued" value={allRecords.filter((scan) => scan.status === "queued").length} detail="scope validation next" tone="blue" icon={Clock3} />
        <MetricCard label="Completed" value={allRecords.filter((scan) => scan.status === "completed").length} detail="retained evidence" tone="purple" icon={CheckCircle2} />
        <MetricCard label="Needs attention" value={allRecords.filter((scan) => scan.status === "failed").length} detail="failed jobs" tone="amber" icon={AlertTriangle} />
      </div>
      <SectionCard title={status === "all" ? "Recent scans" : `${status} scans`} description={`${visibleScans.length} matching scan${visibleScans.length === 1 ? "" : "s"}`}>
        {loading ? <LoadingState rows={5} /> : visibleScans.length ? <ScanTable data={visibleScans} onDelete={onDelete} /> : <EmptyState icon={FileSearch} title="No matching scans" description="Change the status filter or create an authorized scan." action={<Link href="/scans/new" className={primaryButton}>Create scan</Link>} />}
      </SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}

function ScanTable({ data, onDelete }: { data: ScanRecord[]; onDelete?: (id: string) => void }) {
  const columns: DataTableColumn<ScanRecord>[] = [
    { key: "name", header: "Scan", render: (scan: ScanRecord) => <Link href={`/scans/${scan.id}/overview`} className="font-semibold text-slate-100 hover:text-teal-300">{scan.name}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{scan.id}</span></Link> },
    { key: "target", header: "Target" },
    { key: "profile", header: "Profile" },
    { key: "status", header: "Status", render: (scan: ScanRecord) => <StatusBadge value={scan.status} /> },
    { key: "progress", header: "Progress", render: (scan: ScanRecord) => scan.status === "running" ? <span className="inline-flex items-center gap-1.5 font-mono text-teal-300"><span className="scan-pulse" /> running</span> : <span className="font-mono">{scan.progress}%</span> },
    { key: "findings", header: "Findings" },
    { key: "started", header: "Started" },
  ];
  if (onDelete) {
    columns.push({
      key: "actions",
      header: "",
      render: (scan: ScanRecord) => (
        <button
          type="button"
          aria-label={`Delete ${scan.name}`}
          title="Delete scan"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (window.confirm(`Delete scan "${scan.name}"?`)) onDelete(scan.id); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/[0.06] text-red-300 transition hover:bg-red-300/[0.14]"
        ><Trash2 className="h-4 w-4" /></button>
      ),
    });
  }
  return <DataTable data={data} keyField="id" columns={columns} />;
}

const wizardSteps = ["Target", "Profile & modules", "Authentication & speed", "Scope review", "Safety review"];

function NewScanWizard() {
  const router = useRouter();
  const { data: targets } = useAsyncData(() => panService.getTargets());
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    targetId: "",
    name: "",
    modules: new Set<string>(["surface"]),
    profile: "surface",
    speed: "balanced",
    requestLimit: 1000,
    concurrency: 2,
  });
  const moduleChoices: Array<[string, string, string]> = [
    ["surface", "Surface discovery", "Real passive engine — CT, DNS, Wayback, OTX, Common Crawl, IP/ASN, GitHub. Produces a graph."],
    ["recon", "Recon & endpoint discovery", "Subdomains, live hosts, URL and endpoint inventory."],
    ["passive", "Passive analysis", "Headers, cookies, TLS, CORS and disclosure checks."],
    ["xss", "XSS verification", "Reflected and DOM injection candidates."],
    ["sqli", "SQL injection", "Non-destructive SQLi detection."],
    ["api", "API security", "Schema-driven API validation."],
    ["secrets", "Secrets exposure", "Credential patterns in responses and scripts."],
    ["cves", "Known CVEs", "Curated non-destructive CVE templates."],
  ];

  function toggleModule(id: string) {
    setForm((current) => {
      const next = new Set(current.modules);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...current, modules: next };
    });
  }

  async function createScan() {
    if (!form.targetId) return;
    setCreating(true);
    setCreateError("");
    try {
      const created = await panService.startScan({
        targetId: form.targetId,
        name: form.name.trim() || (form.modules.has("surface") ? "Surface discovery run" : "Authorized PAN scan"),
        profile: form.profile,
        modules: Array.from(form.modules),
        speed: form.speed,
        requestLimit: Number(form.requestLimit),
        concurrency: Number(form.concurrency),
        scopeConfirmed: true,
      });
      router.push(`/scans/${created.id}/overview`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "The scan could not be created.");
      setCreating(false);
    }
  }

  if (creating) {
    return (
      <AppPage eyebrow="Orchestration" title="Creating scan" description="PAN is validating ownership, scope, exclusions, limits, and the selected modules.">
        <div className="scan-radar grid min-h-64 place-items-center p-8 text-center">
          <div className="relative z-10">
            <span className="scan-pulse" />
            <span className="block text-sm font-bold text-slate-200">Validating scope and queuing the job…</span>
            <span className="mt-1 block text-xs text-slate-500">The worker starts immediately after the authorization envelope is accepted.</span>
          </div>
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage eyebrow="Authorized workflow" title="New scan" description="Compose a bounded security workflow. Surface discovery runs a real passive engine; all other modules are mock-capable.">
      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Scan setup progress">
        {wizardSteps.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(index)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${index === step ? "border-teal-300/30 bg-teal-300/[0.08] text-teal-100" : index < step ? "border-white/[0.08] bg-white/[0.03] text-slate-300" : "border-white/[0.06] text-slate-500"}`}>
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em]">Step {index + 1}</span>
              <span className="mt-1 block text-xs font-semibold">{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <SectionCard title={`${step + 1}. ${wizardSteps[step]}`} description={`${Math.round(((step + 1) / wizardSteps.length) * 100)}% of configuration reviewed`}>
        {step === 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Verified target">
              <select className={inputClass} value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })}>
                <option value="">Select a verified target…</option>
                {(targets ?? []).filter((target) => target.verificationStatus === "verified").map((target) => <option key={target.id} value={target.id}>{target.name} · {target.domain}</option>)}
              </select>
            </Field>
            <Field label="Scan name"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Surface discovery run" /></Field>
            <div className="md:col-span-2"><SafetyNotice variant="success">Only verified targets can be scanned. Surface discovery runs against the target&apos;s saved domain.</SafetyNotice></div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-5">
            <Field label="Scan profile">
              <select className={inputClass} value={form.profile} onChange={(event) => setForm({ ...form, profile: event.target.value })}>
                <option value="surface">Surface discovery · recommended</option>
                <option value="balanced">Balanced</option>
                <option value="passive">Passive only</option>
                <option value="api_focused">API focused</option>
              </select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {moduleChoices.map(([id, label, description]) => (
                <label key={id} className="flex cursor-pointer gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04]">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-teal-400" checked={form.modules.has(id)} onChange={() => toggleModule(id)} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-200">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Authentication profile"><select className={inputClass}><option>Unauthenticated</option><option>Analyst test account</option></select></Field>
            <Field label="Scan speed">
              <select className={inputClass} value={form.speed} onChange={(event) => setForm({ ...form, speed: event.target.value })}>
                <option value="safe">Safe · 2 req/s</option>
                <option value="balanced">Balanced · 4 req/s</option>
                <option value="fast">Fast</option>
              </select>
            </Field>
            <Field label="Request limit"><input className={inputClass} type="number" value={form.requestLimit} min={1} max={10000} onChange={(event) => setForm({ ...form, requestLimit: Number(event.target.value) })} /></Field>
            <Field label="Concurrency"><input className={inputClass} type="number" value={form.concurrency} min={1} max={10} onChange={(event) => setForm({ ...form, concurrency: Number(event.target.value) })} /></Field>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-5">
            <DefinitionGrid items={[
              { label: "Target", value: (targets ?? []).find((target) => target.id === form.targetId)?.name ?? "—" },
              { label: "Domain", value: (targets ?? []).find((target) => target.id === form.targetId)?.domain ?? "—" },
              { label: "Modules", value: `${form.modules.size} selected` },
              { label: "Rate", value: form.speed },
              { label: "Request limit", value: String(form.requestLimit) },
              { label: "Concurrency", value: String(form.concurrency) },
            ]} />
            <SafetyNotice variant="info">Private addresses, unverified redirects, sensitive excluded paths, and URLs outside this exact scope are rejected before dispatch.</SafetyNotice>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              {["Target ownership is current", "Scope and exclusions reviewed", "Authentication uses a test account", "Request and concurrency limits accepted", "Destructive exploitation remains disabled", "Cancellation and audit logging enabled"].map((label) => <label key={label} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm font-semibold text-slate-200"><input type="checkbox" defaultChecked className="h-4 w-4 accent-teal-400" />{label}</label>)}
            </div>
            <SafetyNotice />
          </div>
        ) : null}
      </SectionCard>
      {createError ? <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{createError}</div> : null}
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={secondaryButton} onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</button>
        {step < wizardSteps.length - 1 ? <button type="button" className={primaryButton} onClick={() => setStep((value) => Math.min(wizardSteps.length - 1, value + 1))}>Continue</button> : <button type="button" className={primaryButton} onClick={() => void createScan()} disabled={!form.targetId || form.modules.size === 0}><Play className="h-4 w-4" /> Create authorized scan</button>}
      </div>
    </AppPage>
  );
}

const scanDetailTabs = [
  { label: "Overview", value: "overview" }, { label: "Live", value: "live" }, { label: "Coverage", value: "coverage" }, { label: "Findings", value: "findings" }, { label: "Workers", value: "workers" }, { label: "Logs", value: "logs" },
];

function ScanDetail({ id, view }: { id: string; view: string }) {
  const { data: scan, loading, error, reload } = useAsyncData(() => panService.getScan(id), id);
  const isSurface = scan?.modules?.includes("surface");
  const activeView = scanDetailTabs.some((item) => item.value === view) ? view : "overview";
  const tabs = scanDetailTabs.concat(isSurface ? [{ label: "Surface", value: "surface" }] : []);
  const status = scan?.status;

  useEffect(() => {
    if (!status || ["completed", "failed", "cancelled"].includes(status)) return;
    const timer = window.setInterval(() => reload(), 2500);
    return () => window.clearInterval(timer);
  }, [status, reload]);

  // Frontend-backed scanner records (passive/xss/tool scans) are stored locally, not in the API.
  if (getScannerScan(id)) return <ScannerRecordDetail id={id} />;

  if (loading && !scan) return <AppPage eyebrow="Orchestration" title="Loading scan" description={`Fetching scan ${id}…`}><LoadingState rows={6} /></AppPage>;
  if (error && !scan) return <AppPage eyebrow="Orchestration" title="Scan unavailable" description="The scan could not be loaded."><EmptyState icon={FileSearch} title="Scan unavailable" description={error.message} action={<Link href="/scans" className={primaryButton}>Back to scans</Link>} /></AppPage>;

  const currentStatus = status ?? "queued";
  const progress = scan?.progress ?? 0;
  const metrics = scan?.statistics;
  const external = scan?.externalReference;
  const activeTab = isSurface && activeView === "surface" ? "surface" : activeView;

  return (
    <AppPage
      eyebrow={`Scan · ${id}`}
      title={scan?.name ?? "Scan"}
      description={`${scan?.targetName ?? "Target"} · ${(scan?.modules ?? []).join(", ") || "no modules"} · ${scan?.profile ?? "balanced"} profile`}
      actions={<ScanControls id={id} status={currentStatus} onAction={() => reload()} />}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge value={currentStatus} />
        {isSurface ? <span className="scan-phase-tag"><span className="scan-pulse" style={{ marginRight: 0 }} />Surface discovery</span> : <StatusBadge value={scan?.currentPhase ?? "scope_validation"} />}
        {external?.assetTotal ? <StatusBadge value={`${external.assetTotal} assets`} tone="purple" /> : null}
        <span className="ml-auto text-xs text-slate-500">{scan ? formatDate(scan.startedAt, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"} · refreshed live</span>
      </div>
      <PageTabs basePath={`/scans/${id}`} active={activeTab} items={tabs} />
      {currentStatus === "paused" ? <SafetyNotice variant="info">The worker is paused. Resume keeps the existing job state and scope snapshot.</SafetyNotice> : null}
      {currentStatus === "cancelled" ? <SafetyNotice variant="warning">Cancellation requested. Running adapters are stopping safely and collected evidence will be retained.</SafetyNotice> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Overall progress" value={`${progress}%`} detail={scan?.currentPhase?.replaceAll("_", " ") ?? "scope_validation"} tone="teal" icon={Gauge} />
        <MetricCard label="Assets / endpoints" value={`${metrics?.assetsFound ?? 0} / ${metrics?.endpointsFound ?? 0}`} detail={external?.relationshipCount ? `${external.relationshipCount} relationships` : "discovery running"} tone="blue" icon={Waypoints} />
        <MetricCard label="Requests sent" value={(metrics?.requestsSent ?? 0).toLocaleString()} detail="passive only" tone="purple" icon={Activity} />
        <MetricCard label="Candidate findings" value={String(metrics?.candidateFindings ?? 0)} detail={external?.riskScore !== undefined ? `risk score ${external.riskScore}` : "passive checks"} tone="amber" icon={ShieldAlert} />
      </div>
      {activeTab === "overview" || activeTab === "live" ? <LiveScanContent scan={scan} status={currentStatus} progress={progress} /> : null}
      {activeTab === "surface" ? <ScanSurfaceView scanId={id} status={currentStatus} /> : null}
      {activeTab === "coverage" ? <CoverageContent /> : null}
      {activeTab === "findings" ? <ScanFindingsContent /> : null}
      {activeTab === "workers" ? <WorkersContent /> : null}
      {activeTab === "logs" ? <LogsContent scan={scan} /> : null}
    </AppPage>
  );
}

function ScanControls({ id, status, onAction }: { id: string; status: string; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  async function act(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    try {
      await panService.controlScan(id, action);
      onAction();
    } finally {
      setBusy(false);
    }
  }
  if (["cancelled", "completed", "failed"].includes(status)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "running" ? <button type="button" className={secondaryButton} disabled={busy} onClick={() => void act("pause")}><Pause className="h-4 w-4" /> Pause</button> : <button type="button" className={primaryButton} disabled={busy} onClick={() => void act("resume")}><Play className="h-4 w-4" /> Resume</button>}
      <button type="button" className={dangerButton} disabled={busy} onClick={() => void act("cancel")}><StopCircle className="h-4 w-4" /> Cancel</button>
    </div>
  );
}

function LiveScanContent({ scan, status, progress }: { scan: ScanDetail | null; status: string; progress: number }) {
  const events = scan?.events ?? [];
  const isSurface = scan?.modules?.includes("surface");
  const running = ["queued", "running"].includes(status);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <SectionCard
        title="Live execution"
        description={isSurface ? "Real passive discovery engine streaming events as they happen." : "State is polled from the JSON-backed worker every 2.5 seconds."}
        action={<span className={running ? "scan-pulse" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><StatusBadge value={status} /></span>}
      >
        <div className="scan-progress-track mb-2">
          <div className={`scan-progress-fill${status === "failed" ? " amber" : ""}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="mb-5 flex items-baseline justify-between">
          <span className="text-sm text-slate-400">{isSurface ? "surface_discovery" : scan?.currentPhase?.replaceAll("_", " ") ?? "scope_validation"}</span>
          <span className="scan-big-progress">{progress}%</span>
        </div>
        {isSurface ? (
          <div className="scan-radar mb-5 grid min-h-44 place-items-center p-6 text-center">
            <div className="relative z-10">
              <span className="scan-pulse" />
              <span className="block text-sm font-bold text-slate-200">{running ? "Passive discovery in progress" : status === "paused" ? "Discovery paused" : "Discovery complete"}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Querying certificate transparency, passive DNS, Wayback, Common Crawl, live DNS, IP/ASN and HTTP fingerprints.
                The graph renders in the Surface tab when the run completes.
              </span>
            </div>
          </div>
        ) : null}
        <div className="scan-live-log">
          {events.length === 0 ? (
            <span className="line err">No events yet — the worker is starting…</span>
          ) : (
            events.map((event) => (
              <div key={event.id} className={`line${event.level === "error" ? " err" : event.level === "info" && /surface discovery|completed|resolved|found|discovered/.test(event.message) ? " ok" : ""}`}>
                <span style={{ opacity: 0.45, marginRight: 8 }}>{event.progress}%</span>
                {event.message}
              </div>
            ))
          )}
          {running ? <span className="scan-caret" /> : null}
        </div>
      </SectionCard>
      <div className="grid content-start gap-5">
        <SectionCard title="Current worker"><KeyValueRows rows={[
          { label: "Status", value: status },
          { label: "Phase", value: scan?.currentPhase?.replaceAll("_", " ") ?? "scope_validation" },
          { label: "Engine", value: isSurface ? "Surface Finder (passive)" : "Mock adapter" },
          { label: "Assets found", value: String(scan?.statistics?.assetsFound ?? 0) },
          { label: "Endpoints found", value: String(scan?.statistics?.endpointsFound ?? 0) },
          { label: "Last heartbeat", value: "just now" },
        ]} /></SectionCard>
        <SafetyNotice />
      </div>
    </div>
  );
}

const surfaceSubtabs = [
  { id: "overview", label: "Overview" },
  { id: "graph", label: "Graph" },
  { id: "tree", label: "Tree" },
  { id: "assets", label: "Assets" },
  { id: "timeline", label: "Timeline" },
  { id: "relationships", label: "Relationships" },
] as const;

function ScanSurfaceView({ scanId, status }: { scanId: string; status: string }) {
  const { data, loading, reload } = useAsyncData(() => panService.getScanSurface(scanId), scanId);
  const [tab, setTab] = useState<(typeof surfaceSubtabs)[number]["id"]>("overview");
  const result = data?.surface ?? null;
  const running = ["queued", "running"].includes(status);

  useEffect(() => {
    if (!running && !result) reload();
    if (running) {
      const timer = window.setInterval(() => reload(), 3000);
      return () => window.clearInterval(timer);
    }
  }, [running, result, reload]);

  if (running || (loading && !result)) {
    return (
      <div className="grid gap-5">
        <div className="scan-radar grid min-h-72 place-items-center p-8 text-center">
          <div className="relative z-10">
            <span className="scan-pulse" />
            <span className="block text-sm font-bold text-slate-200">{status === "paused" ? "Discovery paused" : "Surface discovery running"}</span>
            <span className="mt-1 block text-xs text-slate-500">The interactive graph will render here as soon as the engine completes.</span>
          </div>
        </div>
        <SafetyNotice variant="info">Only passive intelligence is used — no attack payloads are sent to any discovered host.</SafetyNotice>
      </div>
    );
  }

  if (!result) {
    return (
      <SectionCard title="Surface result" description="The stored graph for this scan.">
        <EmptyState icon={FileSearch} title="No surface result stored" description="The scan may still be running or the result was not persisted." action={<button type="button" className={secondaryButton} onClick={() => reload()}><RefreshCw className="h-4 w-4" /> Refresh</button>} />
      </SectionCard>
    );
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assets" value={String(result.summary.assetTotal)} detail={`${result.summary.relationshipCount} relationships`} tone="teal" icon={Waypoints} />
        <MetricCard label="In scope" value={String(result.summary.inScopeAssets)} detail="assets" tone="blue" icon={ShieldCheck} />
        <MetricCard label="Resolving hosts" value={String(result.summary.resolvingHosts)} detail="currently live" tone="purple" icon={Activity} />
        <MetricCard label="Sources" value={String(result.sourcesUsed.length)} detail={result.sourcesUsed.slice(0, 4).join(" · ")} tone="amber" icon={Fingerprint} />
      </div>
      <div className="scan-subtabs" role="tablist" aria-label="Surface views">
        {surfaceSubtabs.map((item) => (
          <button type="button" key={item.id} role="tab" aria-selected={tab === item.id} className={`scan-subtab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {tab === "overview" ? <OverviewView result={result} /> : null}
      {tab === "graph" ? <SurfaceGraph assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
      {tab === "tree" ? <TreeView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
      {tab === "assets" ? <AssetsView assets={result.assets} /> : null}
      {tab === "timeline" ? <TimelineView timeline={result.timeline} assets={result.assets} /> : null}
      {tab === "relationships" ? <RelationshipsView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
    </div>
  );
}

function CoverageContent() {
  type Coverage = { module: string; assets: string; endpoints: string; checks: string; state: string };
  const coverage: Coverage[] = [
    { module: "Reconnaissance", assets: "14 / 14", endpoints: "312 / 312", checks: "8 modules", state: "completed" },
    { module: "Passive analysis", assets: "14 / 14", endpoints: "287 / 312", checks: "34 rules", state: "completed" },
    { module: "XSS", assets: "5 / 14", endpoints: "68 / 94 eligible", checks: "91 parameters", state: "running" },
    { module: "Known CVEs", assets: "8 / 14", endpoints: "—", checks: "42 templates", state: "queued" },
    { module: "AI analysis", assets: "—", endpoints: "—", checks: "9 findings", state: "queued" },
  ];
  return (
    <SectionCard title="Coverage matrix" description="Eligibility is calculated from target scope, endpoint type, and module policy.">
      <DataTable data={coverage} keyField="module" columns={[
        { key: "module", header: "Module" }, { key: "assets", header: "Assets" }, { key: "endpoints", header: "Endpoints" }, { key: "checks", header: "Checks" }, { key: "state", header: "State", render: (row: Coverage) => <StatusBadge value={row.state} /> },
      ]} />
    </SectionCard>
  );
}

function ScanFindingsContent() {
  return <SectionCard title="Findings from this scan" description="Candidate observations stay separate from deterministically confirmed findings."><FindingTable findings={findingRecords.slice(0, 4)} /></SectionCard>;
}

function WorkersContent() {
  type Worker = { name: string; module: string; status: string; heartbeat: string; requests: number };
  const workers: Worker[] = [
    { name: "scanner-worker-02", module: "XSS", status: "healthy", heartbeat: "just now", requests: 428 },
    { name: "recon-worker-01", module: "Recon", status: "idle", heartbeat: "8 sec ago", requests: 412 },
    { name: "ai-worker-01", module: "AI analysis", status: "queued", heartbeat: "12 sec ago", requests: 0 },
  ];
  return <SectionCard title="Assigned workers"><DataTable data={workers} keyField="name" columns={[
    { key: "name", header: "Worker" }, { key: "module", header: "Module" }, { key: "status", header: "Health", render: (worker: Worker) => <StatusBadge value={worker.status} /> }, { key: "heartbeat", header: "Heartbeat" }, { key: "requests", header: "Requests" },
  ]} /></SectionCard>;
}

function LogsContent({ scan }: { scan: ScanDetail | null }) {
  const events = scan?.events ?? [];
  return (
    <SectionCard title="Structured scan logs" description="Secrets, cookies, authorization headers, and response bodies are redacted before display.">
      <div className="scan-live-log" style={{ maxHeight: 420 }}>
        {events.length === 0 ? (
          <span className="line err">No structured events recorded yet.</span>
        ) : (
          [...events].reverse().map((event) => (
            <div key={event.id} className={`line${event.level === "error" ? " err" : ""}`}>
              <span style={{ opacity: 0.45, marginRight: 8 }}>{new Date(event.createdAt).toLocaleTimeString()} · {event.progress}% · {event.phase}</span>
              {event.message}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

type FindingRecord = {
  id: string;
  title: string;
  severity: string;
  confidence: number;
  state: string;
  target: string;
  endpoint: string;
  source: string;
  status: string;
};

const wanderTitles = ["Reflected XSS", "SQL Injection", "Broken Object-Level Authorization (IDOR)", "Server-Side Request Forgery (SSRF)", "Missing Content-Security-Policy", "Verbose Server Header", "CORS allows arbitrary origin", "Open Redirect", "Exposed source map", "Hardcoded API secret", "Insecure session cookie", "Missing Strict-Transport-Security", "Command Injection", "XML External Entity (XXE)", "Server-Side Template Injection", "Path Traversal", "Weak password policy", "Information disclosure in error page", "Clickjacking (missing frame-ancestors)", "Subdomain takeover candidate", "Missing rate limiting on login", "Web cache poisoning", "Cross-Site Request Forgery", "Client-side prototype pollution", "Outdated dependency vulnerability", "Exposed admin panel", "Default credentials in use", "TLS misconfiguration", "Excessive data exposure in API response", "No account lockout policy", "JWT algorithm confusion", "GraphQL introspection enabled"];
const wanderEndpoints = ["/api/v1/users", "/api/v1/orders", "/api/v1/products", "/api/v1/auth/login", "/api/v1/search", "/api/v1/profile", "/api/v1/payments", "/graphql", "/admin", "/dashboard", "/account/reset", "/checkout", "/download", "/export", "/status"];
const wanderSeverities = ["critical", "high", "medium", "low", "informational"];
const wanderSources = ["XSS scanner", "API scanner", "Passive rules", "Secrets scanner", "Nuclei", "SQLi scanner"];

const wanderFindings: FindingRecord[] = Array.from({ length: 34 }, (_, i) => ({
  id: `wander_${1000 + i}`,
  title: `${wanderTitles[i % wanderTitles.length]}${i >= wanderTitles.length ? ` (variant ${Math.floor(i / wanderTitles.length) + 1})` : ""}`,
  severity: wanderSeverities[i % wanderSeverities.length],
  confidence: 70 + ((i * 7) % 29),
  state: i % 3 === 0 ? "candidate" : "confirmed",
  target: "wander.com",
  endpoint: `${["GET", "POST", "PUT", "PATCH", "DELETE"][i % 5]} ${wanderEndpoints[i % wanderEndpoints.length]}`,
  source: wanderSources[i % wanderSources.length],
  status: i % 4 === 0 ? "open" : "triage",
}));

const findingRecords: FindingRecord[] = [
  ...wanderFindings,
  { id: "finding_01", title: "Reflected Cross-Site Scripting", severity: "high", confidence: 96, state: "confirmed", target: "Northstar Customer Portal", endpoint: "GET /search", source: "XSS scanner", status: "open" },
  { id: "finding_02", title: "CORS allows arbitrary origin", severity: "high", confidence: 92, state: "confirmed", target: "Atlas Partner API", endpoint: "GET /v1/profile", source: "Passive rules", status: "open" },
  { id: "finding_03", title: "Missing Content Security Policy", severity: "medium", confidence: 88, state: "candidate", target: "Northstar Customer Portal", endpoint: "GET /", source: "Passive rules", status: "open" },
  { id: "finding_04", title: "Exposed source map", severity: "low", confidence: 99, state: "fixed", target: "Northstar Customer Portal", endpoint: "GET /app.js.map", source: "Secrets scanner", status: "fixed" },
  { id: "finding_05", title: "Possible object-level authorization gap", severity: "medium", confidence: 64, state: "candidate", target: "Atlas Partner API", endpoint: "GET /v1/orders/{id}", source: "API scanner", status: "triage" },
  { id: "finding_06", title: "Server version disclosure", severity: "informational", confidence: 100, state: "false_positive", target: "Atlas Partner API", endpoint: "GET /health", source: "Passive rules", status: "closed" },
];

const findingListTabs = [
  { label: "All", value: "all", href: "/findings" }, { label: "Confirmed", value: "confirmed" }, { label: "Candidates", value: "candidates" }, { label: "Fixed", value: "fixed" }, { label: "False positives", value: "false-positives" },
];

export function FindingView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "all";
  if (["all", "confirmed", "candidates", "fixed", "false-positives"].includes(page)) return <FindingList filter={page} />;
  return <FindingDetail id={page} view={segments[1] ?? "overview"} />;
}

function FindingList({ filter }: { filter: string }) {
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    return findingRecords.filter((finding) => {
      const matchesPage = filter === "all" || (filter === "candidates" ? finding.state === "candidate" : filter === "false-positives" ? finding.state === "false_positive" : finding.state === filter);
      const matchesSeverity = severity === "all" || finding.severity === severity;
      const haystack = `${finding.title} ${finding.target} ${finding.endpoint} ${finding.source}`.toLowerCase();
      return matchesPage && matchesSeverity && haystack.includes(query.toLowerCase());
    });
  }, [filter, severity, query]);

  return (
    <AppPage eyebrow="Vulnerability management" title={filter === "all" ? "Findings" : filter.replace("-", " ")} description="Triage normalized observations with deterministic evidence, confidence, ownership, remediation, and retest history." actions={<Link href="/ai-analyst/analysis" className={secondaryButton}><Bot className="h-4 w-4" /> Analyze selection</Link>}>
      <PageTabs basePath="/findings" active={filter} items={findingListTabs} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Critical / high" value="0 / 2" detail="Both confirmed" tone="red" icon={ShieldAlert} />
        <MetricCard label="Candidates" value="2" detail="1 needs manual review" tone="amber" icon={Search} />
        <MetricCard label="Fixed this month" value="7" detail="100% retested" tone="teal" icon={CheckCircle2} />
        <MetricCard label="Mean time to triage" value="2.4h" detail="18% faster" tone="purple" icon={Clock3} />
      </div>
      <SectionCard title="Finding inventory" description={`${visible.length} findings match the current view`}>
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
          <label className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><span className="sr-only">Search findings</span><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-10`} placeholder="Search title, target, endpoint…" /></label>
          <select aria-label="Filter by severity" className={inputClass} value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="informational">Informational</option></select>
          <select aria-label="Filter by target" className={inputClass}><option>All targets</option><option>Northstar Customer Portal</option><option>Atlas Partner API</option></select>
          <select aria-label="Filter by source" className={inputClass}><option>All sources</option><option>XSS scanner</option><option>Passive rules</option><option>API scanner</option></select>
        </div>
        {visible.length ? <FindingTable findings={visible} /> : <EmptyState icon={Search} title="No findings match" description="Clear the search or choose a broader severity filter." />}
      </SectionCard>
    </AppPage>
  );
}

function FindingTable({ findings }: { findings: FindingRecord[] }) {
  return (
    <DataTable data={findings} keyField="id" columns={[
      { key: "title", header: "Finding", render: (finding: FindingRecord) => <Link href={`/findings/${finding.id}/overview`} className="font-semibold text-slate-100 hover:text-teal-300">{finding.title}<span className="mt-0.5 block text-xs font-normal text-slate-500">{finding.endpoint}</span></Link> },
      { key: "severity", header: "Severity", render: (finding: FindingRecord) => <StatusBadge value={finding.severity} /> },
      { key: "confidence", header: "Confidence", render: (finding: FindingRecord) => <span className="font-mono">{finding.confidence}%</span> },
      { key: "state", header: "Verification", render: (finding: FindingRecord) => <StatusBadge value={finding.state} /> },
      { key: "target", header: "Target" },
      { key: "source", header: "Source" },
      { key: "status", header: "Status", render: (finding: FindingRecord) => <StatusBadge value={finding.status} /> },
    ]} />
  );
}

const findingDetailTabs = [
  { label: "Overview", value: "overview" }, { label: "Evidence", value: "evidence" }, { label: "Request / response", value: "request-response" }, { label: "AI analysis", value: "ai-analysis" }, { label: "Remediation", value: "remediation" }, { label: "Activity", value: "activity" }, { label: "Retest", value: "retest" },
];

function FindingDetail({ id, view }: { id: string; view: string }) {
  const activeView = findingDetailTabs.some((item) => item.value === view) ? view : "overview";
  const [state, setState] = useState("confirmed");

  return (
    <AppPage
      eyebrow={`Finding · ${id}`}
      title="Reflected Cross-Site Scripting"
      description="User-controlled search input executed in an isolated browser verification context."
      actions={<div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton} onClick={() => setState("false_positive")}>False positive</button><button type="button" className={primaryButton} onClick={() => setState("confirmed")}><ShieldCheck className="h-4 w-4" /> Confirm</button></div>}
    >
      <PageTabs basePath={`/findings/${id}`} active={activeView} items={findingDetailTabs} />
      <div className="flex flex-wrap items-center gap-2"><StatusBadge value="high" /><StatusBadge value={`${96}% confidence`} tone="purple" /><StatusBadge value={state} /><StatusBadge value="browser verified" tone="success" /><span className="ml-auto text-xs text-slate-500">Updated Aug 26, 2026 · 20:45 IST</span></div>
      {activeView === "overview" ? <FindingOverview /> : null}
      {activeView === "evidence" ? <FindingEvidence /> : null}
      {activeView === "request-response" ? <FindingRequestResponse /> : null}
      {activeView === "ai-analysis" ? <FindingAiAnalysis /> : null}
      {activeView === "remediation" ? <FindingRemediation /> : null}
      {activeView === "activity" ? <FindingActivity /> : null}
      {activeView === "retest" ? <FindingRetest /> : null}
    </AppPage>
  );
}

function FindingOverview() {
  return (
    <div className="grid gap-5">
      <DefinitionGrid items={[
        { label: "Target", value: "Northstar Customer Portal" }, { label: "Asset", value: "portal.northstar-demo.com" }, { label: "Endpoint", value: "GET /search" }, { label: "Parameter", value: "q" }, { label: "Source engine", value: "PAN XSS scanner" }, { label: "Verification", value: <StatusBadge value="confirmed" /> }, { label: "CWE", value: "CWE-79" }, { label: "OWASP", value: "A03:2021 Injection" }, { label: "CVSS", value: "8.2 · High" },
      ]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Description"><p className="text-sm leading-7 text-slate-300">The <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-teal-200">q</code> parameter is reflected into an HTML attribute without context-aware encoding. PAN observed a deterministic reflection and then reproduced script execution in an isolated browser worker.</p></SectionCard>
        <SectionCard title="Impact"><p className="text-sm leading-7 text-slate-300">An attacker could craft a link that executes JavaScript in a victim&apos;s authenticated session, potentially reading page data or performing actions with the victim&apos;s privileges.</p></SectionCard>
      </div>
      <SectionCard title="Safe reproduction steps" description="Use only the supplied test account and approved staging target.">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-300"><li>Open the sanitized evidence request and confirm it targets <strong>portal.northstar-demo.com</strong>.</li><li>Send the harmless marker through the isolated verification worker.</li><li>Observe marker execution and the evidence screenshot ID.</li><li>Do not reuse the payload against production or any target outside PAN scope.</li></ol>
      </SectionCard>
      <SafetyNotice />
    </div>
  );
}

function FindingEvidence() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <SectionCard title="Browser verification" description="A harmless marker executed in an isolated, authenticated staging browser.">
        <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/10 bg-[linear-gradient(135deg,rgba(45,212,191,0.06),rgba(139,92,246,0.04))] p-8 text-center">
          <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-300/10 text-teal-300"><Fingerprint className="h-6 w-6" /></div><p className="mt-4 font-bold text-slate-200">Evidence screenshot</p><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Browser marker <span className="font-mono text-slate-400">PAN_XSS_7C2</span> rendered on the scoped staging page. Sensitive page content is masked in this preview.</p></div>
        </div>
      </SectionCard>
      <SectionCard title="Evidence chain" action={<StatusBadge value="integrity verified" tone="success" />}>
        <KeyValueRows rows={[
          { label: "Request evidence", value: "evidence_request_01" }, { label: "Response evidence", value: "evidence_response_01" }, { label: "Screenshot", value: "evidence_browser_01" }, { label: "Browser verified", value: "Yes" }, { label: "Captured", value: "Aug 26, 20:44:18" }, { label: "Retention", value: "30 days" },
        ]} />
        <p className="mt-5 rounded-xl bg-white/[0.03] p-3 text-xs leading-5 text-slate-500">SHA-256 hashes are recorded server-side. Authentication headers, cookies, and unrelated response fields are removed before analyst access.</p>
      </SectionCard>
    </div>
  );
}

function FindingRequestResponse() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <CodePanel label="Request" tone="request">{`GET /search?q=%22%3E%3Cspan%20data-pan-marker%3D%22PAN_XSS_7C2%22%3E HTTP/1.1
Host: portal.northstar-demo.com
User-Agent: PAN-Verification/1.0
Cookie: [REDACTED]
X-PAN-Evidence: evidence_request_01`}</CodePanel>
      <CodePanel label="Response" tone="response">{`HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Security-Policy: [missing]
Set-Cookie: [REDACTED]

<input name="q" value=""><span data-pan-marker="PAN_XSS_7C2">">

[BODY TRUNCATED AFTER EVIDENCE WINDOW]`}</CodePanel>
      <div className="lg:col-span-2"><SafetyNotice variant="info">Displayed traffic is sanitized. PAN never sends stored cookies, tokens, or authorization headers to the AI Analyst.</SafetyNotice></div>
    </div>
  );
}

function FindingAiAnalysis() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <SectionCard title="Evidence-grounded analysis" description="Generated by provider-neutral model pan-analyst-demo · evidence references required" action={<StatusBadge value="96% confidence" tone="purple" />}>
        <div className="space-y-5 text-sm leading-7 text-slate-300">
          <div><h3 className="font-bold text-slate-100">Summary</h3><p className="mt-1">The sanitized response shows attacker-controlled input entering an HTML attribute without encoding. Isolated browser evidence confirms execution of the harmless PAN marker.</p></div>
          <div><h3 className="font-bold text-slate-100">Impact</h3><p className="mt-1">A victim following a crafted link may execute attacker-controlled script in the application origin. Actual impact depends on session protections and accessible page data.</p></div>
          <div><h3 className="font-bold text-slate-100">Safe next steps</h3><ul className="mt-1 list-disc space-y-1 pl-5"><li>Confirm output context in the search result template.</li><li>Add context-aware attribute encoding.</li><li>Retest with the saved harmless marker.</li></ul></div>
          <div><h3 className="font-bold text-slate-100">Limitations</h3><p className="mt-1">The analysis did not inspect production, execute arbitrary payloads, or assess account takeover impact.</p></div>
        </div>
      </SectionCard>
      <div className="grid content-start gap-5">
        <SafetyNotice variant="info">AI output is advisory and cannot change the finding&apos;s verification state. Confirmation requires deterministic evidence or analyst action.</SafetyNotice>
        <SectionCard title="Evidence used"><KeyValueRows rows={[
          { label: "Request", value: "evidence_request_01" }, { label: "Response", value: "evidence_response_01" }, { label: "Browser", value: "evidence_browser_01" }, { label: "Uncertainty", value: "Impact breadth unknown" },
        ]} /></SectionCard>
      </div>
    </div>
  );
}

function FindingRemediation() {
  return (
    <div className="grid gap-5">
      <SectionCard title="Recommended fix" description="Prioritize context-aware encoding and avoid unsafe DOM sinks.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div><h3 className="text-sm font-bold text-slate-100">Application changes</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300"><li>Render user-controlled values through the framework&apos;s default escaping.</li><li>Use attribute-safe encoding when building HTML attributes.</li><li>Avoid direct <code className="text-teal-200">innerHTML</code> assignments.</li><li>Deploy a restrictive Content Security Policy as defense in depth.</li></ul></div>
          <CodePanel label="Safe React pattern">{`// React escapes string values by default
export function SearchQuery({ value }: { value: string }) {
  return <input name="q" value={value} readOnly />;
}

// Avoid dangerouslySetInnerHTML for untrusted input.`}</CodePanel>
        </div>
      </SectionCard>
      <SectionCard title="Verification plan"><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300"><li>Deploy the fix to the approved staging target.</li><li>Start a retest using the saved evidence marker.</li><li>Confirm the marker is encoded and no longer executes.</li><li>Record a clean response and browser screenshot before marking fixed.</li></ol></SectionCard>
    </div>
  );
}

function FindingActivity() {
  return (
    <SectionCard title="Finding activity" description="Every verification, assignment, status change, and retest is auditable.">
      <Timeline items={[
        { title: "Finding confirmed", detail: "Maya Chen confirmed deterministic browser evidence.", time: "Aug 26 · 20:47", state: "active" },
        { title: "AI analysis completed", detail: "Analysis linked three sanitized evidence records and stated one limitation.", time: "Aug 26 · 20:46", state: "done" },
        { title: "Browser verification passed", detail: "Harmless marker PAN_XSS_7C2 executed in isolated staging context.", time: "Aug 26 · 20:44", state: "done" },
        { title: "Candidate created", detail: "XSS adapter observed a deterministic reflection with 91% initial confidence.", time: "Aug 26 · 20:43", state: "done" },
      ]} />
    </SectionCard>
  );
}

function FindingRetest() {
  const [requested, setRequested] = useState(false);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <SectionCard title="Retest configuration" description="Reuse the original bounded evidence plan against the same verified target.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Target"><input className={inputClass} value="Northstar Customer Portal · staging" disabled /></Field>
          <Field label="Verification method"><select className={inputClass}><option>Saved harmless browser marker</option><option>Reflection-only check</option></select></Field>
          <Field label="Authentication profile"><select className={inputClass}><option>Analyst test account</option><option>Unauthenticated</option></select></Field>
          <Field label="Schedule"><select className={inputClass}><option>Run after scope validation</option><option>Tonight at 22:00</option></select></Field>
        </div>
        <div className="mt-5"><SafetyNotice /></div>
        <div className="mt-5 flex items-center gap-3"><button type="button" className={primaryButton} onClick={() => setRequested(true)}><RotateCcw className="h-4 w-4" /> Request retest</button>{requested ? <span className="text-sm font-semibold text-teal-300">Retest retest_03 queued</span> : null}</div>
      </SectionCard>
      <SectionCard title="Retest history"><Timeline items={[
        { title: "Initial verification", detail: "Browser marker executed; finding confirmed.", time: "Aug 26", state: "done" },
        { title: "Awaiting remediation", detail: "No prior remediation retest has been recorded.", time: "current", state: "active" },
      ]} /></SectionCard>
    </div>
  );
}
