"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, ArrowLeft, Boxes, Play, Radar, Route, Server, Trash2, Waypoints } from "lucide-react";
import { AppPage, DataTable, EmptyState, MetricCard, SectionCard, StatusBadge, type DataTableColumn } from "@/components/pan";
import { SafetyNotice, primaryButton, secondaryButton, inputClass } from "./FeatureUI";
import { OrbitalEarthHero } from "./OrbitalEarthHero";
import {
  clearReconTasks,
  completeReconTask,
  getReconTask,
  getReconTasks,
  getReconTasksByModule,
  removeReconTask,
  startReconTask,
  type ReconModule,
  type ReconTask,
} from "./recon-tasks";

export const RECON_MODULES: Array<{ id: ReconModule; name: string; description: string }> = [
  { id: "subdomains", name: "Subdomains", description: "Enumerate subdomains and asset discovery." },
  { id: "live-hosts", name: "Live hosts", description: "Probe which hosts respond over HTTP." },
  { id: "url-discovery", name: "URL discovery", description: "Crawl and extract URLs and endpoints." },
  { id: "web-archive", name: "Web archive", description: "Collect historical URLs from the web archive." },
  { id: "ports", name: "Ports", description: "Discover exposed TCP services." },
  { id: "technologies", name: "Technologies", description: "Identify frameworks and servers." },
  { id: "javascript", name: "JavaScript", description: "Extract routes and secrets from scripts." },
  { id: "screenshots", name: "Screenshots", description: "Capture approved hosts in a browser." },
];

function taskColumns(onDelete?: (id: string) => void): DataTableColumn<ReconTask>[] {
  const columns: DataTableColumn<ReconTask>[] = [
    { key: "url", header: "Target", render: (task: ReconTask) => <Link href={`/recon/${task.module}/${task.id}`} className="font-semibold text-slate-100 hover:text-teal-300"><span className="font-mono">{task.url}</span><span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{task.id}</span></Link> },
    { key: "status", header: "Status", render: (task: ReconTask) => <StatusBadge value={task.status} /> },
    { key: "progress", header: "Progress", render: (task: ReconTask) => task.status === "running" ? <span className="inline-flex items-center gap-1.5 font-mono text-teal-300"><span className="scan-pulse" /> running</span> : <span className="font-mono">{task.progress}%</span> },
    { key: "started", header: "Started", render: (task: ReconTask) => <span className="text-xs text-slate-400">{task.started}</span> },
  ];
  if (onDelete) {
    columns.push({
      key: "actions",
      header: "",
      render: (task: ReconTask) => (
        <button type="button" aria-label={`Delete ${task.url}`} title="Delete task" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (window.confirm(`Delete recon task for ${task.url}?`)) onDelete(task.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/[0.06] text-red-300 transition hover:bg-red-300/[0.14]"><Trash2 className="h-4 w-4" /></button>
      ),
    });
  }
  return columns;
}

export function ModuleScanner({ module }: { module: ReconModule }) {
  const router = useRouter();
  const meta = RECON_MODULES.find((m) => m.id === module) ?? RECON_MODULES[0];
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState<ReconTask[]>(() => getReconTasksByModule(module));

  async function run() {
    const list = url.split(/[\s,]+/).filter(Boolean);
    if (!list.length || !list.some((u) => /^(\w+:\/\/)?[^\s]+\.[^\s]+$/.test(u))) return;
    setRunning(true);
    const task = startReconTask(module, url.trim());
    setTasks(getReconTasksByModule(module));
    await completeReconTask(task.id);
    setRunning(false);
    setTasks(getReconTasksByModule(module));
    router.push(`/recon/${module}/${task.id}`);
  }

  function onDelete(id: string) {
    removeReconTask(id);
    setTasks(getReconTasksByModule(module));
  }

  return (
    <AppPage eyebrow={`Recon · ${meta.name}`} title={meta.name} description={meta.description} actions={<Link href="/recon/history" className={secondaryButton}>History</Link>}>
      <SectionCard title="Scan targets" description="Enter one or more URLs/domains (one per line). A task is created and stored to Scans and history.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea
            className={`${inputClass} min-h-20 flex-1 resize-y font-mono`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={"example.com\napi.example.com  https://shop.example.com"}
            spellCheck={false}
          />
          <div className="flex flex-col justify-end gap-2">
            <button type="button" className={primaryButton} disabled={running} onClick={run}><Play className="h-4 w-4" /> {running ? "Scanning…" : "Scan"}</button>
          </div>
        </div>
        {running ? <div className="mt-3 flex items-center gap-3"><span className="scan-pulse" /><span className="font-mono text-xs text-teal-300">Scanning {url}…</span><div className="scan-progress-track flex-1"><div className="scan-progress-fill indeterminate" /></div></div> : null}
        <div className="mt-4"><SafetyNotice variant="info">Only run this against targets you own or are authorized to test. Single target only.</SafetyNotice></div>
      </SectionCard>
      <SectionCard title={`${meta.name} tasks`} description={`${tasks.length} stored · newest first`}>
        {tasks.length ? <DataTable data={tasks} keyField="id" columns={taskColumns(onDelete)} /> : <EmptyState icon={Boxes} title="No tasks yet" description="Enter a URL above and scan to create a task." />}
      </SectionCard>
    </AppPage>
  );
}

export function ReconTasksOverview() {
  const tasks = getReconTasks();
  const current = tasks[0] ?? null;
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalItems = tasks.reduce((acc, t) => acc + (Array.isArray(t.result?.items) ? t.result.items.length : 0), 0);

  return (
    <AppPage eyebrow="Attack surface" title="Reconnaissance" description="Build a current, evidence-backed inventory before testing. Run a module on a single target — every task is stored to Scans and history." actions={<Link href="/recon/new" className={primaryButton}><Radar className="h-4 w-4" /> New recon</Link>}>
      <OrbitalEarthHero mode="recon" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tasks run" value={String(tasks.length)} detail="across all modules" tone="teal" icon={Activity} />
        <MetricCard label="Running" value={String(runningCount)} detail="live jobs" tone="blue" icon={Waypoints} />
        <MetricCard label="Completed" value={String(completedCount)} detail="stored results" tone="purple" icon={Server} />
        <MetricCard label="Assets found" value={String(totalItems)} detail="aggregated" tone="amber" icon={Boxes} />
      </div>
      <SectionCard title="Discovery modules" description="Choose a module, enter a single target, and scan. Each creates a task in Scans and history.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RECON_MODULES.map((module) => (
            <Link key={module.id} href={`/recon/${module.id}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-teal-300/30 hover:bg-white/[0.04]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">{module.id}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-200">{module.name}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{module.description}</span>
            </Link>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Current job" description={current ? `Most recent recon task · ${current.module}` : "No recon tasks yet"}>
        {current ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge value={current.status} />
                <Link href={`/recon/${current.module}/${current.id}`} className="font-mono text-sm text-slate-400 hover:text-teal-300">{current.url}</Link>
              </div>
              {current.status === "running" ? (
                <div className="flex items-center gap-3"><span className="scan-pulse" /><span className="font-mono text-xs text-teal-300">Scanning {current.url}…</span><div className="scan-progress-track flex-1"><div className="scan-progress-fill indeterminate" /></div></div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-100">{current.progress}%</span>
                  <div className="flex-1"><div className="scan-progress-track"><div className="scan-progress-fill" style={{ width: `${current.progress}%` }} /></div></div>
                </div>
              )}
              <p className="mt-3 text-sm text-slate-400">{current.result?.summary ? String(current.result.summary) : `Module ${current.module} · started ${current.started}`}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href={`/recon/${current.module}/${current.id}`} className={secondaryButton}>View task <ArrowLeft className="ml-1 h-3 w-3 rotate-180" /></Link>
              <Link href="/recon/history" className={secondaryButton}>All history</Link>
            </div>
          </div>
        ) : (
          <EmptyState icon={Radar} title="No recon tasks yet" description="Open any discovery module and scan a single target to begin." action={<Link href="/recon/subdomains" className={primaryButton}>Start scanning</Link>} />
        )}
      </SectionCard>
    </AppPage>
  );
}

export function ReconTasksHistory() {
  const [tasks, setTasks] = useState<ReconTask[]>(() => getReconTasks());
  function onDelete(id: string) {
    removeReconTask(id);
    setTasks(getReconTasks());
  }
  function onClear() {
    if (window.confirm(`Delete all ${tasks.length} recon tasks and their scan records?`)) {
      clearReconTasks();
      setTasks([]);
    }
  }
  return (
    <AppPage eyebrow="Reconnaissance · History" title="Recon history" description="Every recon task across all modules. Click a task to view its result." actions={<><Link href="/recon/overview" className={primaryButton}><Play className="h-4 w-4" /> New recon</Link>{tasks.length ? <button type="button" className={secondaryButton} onClick={onClear}><Trash2 className="h-4 w-4" /> Clear history</button> : null}</>}>
      <SectionCard title="All recon tasks" description={`${tasks.length} total · newest first`}>
        {tasks.length ? <DataTable data={tasks} keyField="id" columns={taskColumns(onDelete)} /> : <EmptyState icon={Radar} title="No recon tasks yet" description="Run a recon module on a single target to build history." action={<Link href="/recon/overview" className={primaryButton}>Go to recon</Link>} />}
      </SectionCard>
    </AppPage>
  );
}

const TECH_LOGO: Record<string, { mark: string; color: string }> = {
  nginx: { mark: "NG", color: "#269539" },
  cloudflare: { mark: "CF", color: "#f6821f" },
  react: { mark: "RE", color: "#61dafb" },
  "next.js": { mark: "NX", color: "#ffffff" },
  node: { mark: "NO", color: "#339933" },
  python: { mark: "PY", color: "#3776ab" },
  wordpress: { mark: "WP", color: "#21759b" },
  apache: { mark: "AP", color: "#d22128" },
  django: { mark: "DJ", color: "#092e20" },
  go: { mark: "GO", color: "#00add8" },
  kubernetes: { mark: "K8", color: "#326ce5" },
  envoy: { mark: "EV", color: "#ac6199" },
  fastapi: { mark: "FA", color: "#05998b" },
  laravel: { mark: "LA", color: "#ff2d20" },
  vue: { mark: "VU", color: "#42b883" },
  angular: { mark: "AN", color: "#dd0031" },
  elasticsearch: { mark: "ES", color: "#fec514" },
  redis: { mark: "RD", color: "#d82c20" },
  postgres: { mark: "PG", color: "#336791" },
};

function techStyle(name: string) {
  const lower = name.toLowerCase();
  const key = Object.keys(TECH_LOGO).find((k) => lower.includes(k));
  return TECH_LOGO[key ?? ""] ?? { mark: "TC", color: "#7dd3fc" };
}

function TechnologiesPanel({ items }: { items: Array<Record<string, unknown>> }) {
  const techs = Array.from(new Set(items.flatMap((item) => (Array.isArray(item.techs) ? item.techs : [])).map((t) => String(t))));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {techs.map((tech) => {
          const logo = techStyle(tech);
          return <span key={tech} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"><span>{logo.mark}</span><span className="font-semibold text-slate-200">{tech}</span></span>;
        })}
      </div>
      <div className="grid gap-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm text-slate-100">{String(item.host)}</span>
              <span className="shrink-0 font-mono text-xs text-slate-500">HTTP {String(item.status ?? "")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(item.techs) ? item.techs : []).map((tech) => {
                const logo = techStyle(String(tech));
                return <span key={String(tech)} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300"><span>{logo.mark}</span>{String(tech)}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReconTaskDetail({ id }: { id: string }) {
  const task = getReconTask(id);
  if (!task) {
    return <AppPage eyebrow="Recon · task" title="Task not found" description="This recon task does not exist."><EmptyState icon={Radar} title="Task not found" description="It may have been deleted." action={<Link href="/recon/history" className={primaryButton}>Back to history</Link>} /></AppPage>;
  }
  const rawItems: unknown[] = Array.isArray(task.result?.items) ? task.result.items : [];
  return (
    <AppPage eyebrow={`Recon · ${task.module}`} title={task.url} description={`${task.module} · started ${task.started}`} actions={<Link href={`/recon/${task.module}`} className={secondaryButton}><ArrowLeft className="h-4 w-4" /> Back to {task.module}</Link>}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge value={task.status} />{task.status === "completed" ? <StatusBadge value={`${rawItems.length} items`} tone="purple" /> : null}<span className="ml-auto text-xs text-slate-500">completed {task.completed ?? "—"}</span></div>
      {task.status === "running" ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-teal-300/20 bg-teal-300/[0.05] p-5"><span className="scan-pulse" /><span className="font-mono text-sm text-teal-200">Scanning {task.url}…</span><div className="scan-progress-track flex-1"><div className="scan-progress-fill indeterminate" /></div></div>
      ) : null}
      <SectionCard title="Result" description={task.result?.summary ? String(task.result.summary) : `Results for ${task.url}`}>
        {task.module === "technologies" && rawItems.length ? (
          <TechnologiesPanel items={rawItems as Array<Record<string, unknown>>} />
        ) : rawItems.length ? (
          <div className="grid max-h-[480px] gap-2 overflow-y-auto pr-1">
            {rawItems.map((raw, i) => {
              const isStr = typeof raw === "string";
              const item = isStr ? ({} as Record<string, unknown>) : (raw as Record<string, unknown>);
              const label = isStr
                ? String(raw)
                : String(item.hostname ?? item.url ?? item.name ?? item.route ?? item.port ?? item.host ?? item.service ?? `item ${i + 1}`);
              const sub = isStr ? null : item.ip ? String(item.ip) : item.status !== undefined ? String(item.status) : null;
              return (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <span className="truncate font-mono text-xs text-slate-200">{label}</span>
                  {sub ? <span className="shrink-0 font-mono text-xs text-slate-500">{sub}</span> : null}
                </div>
              );
            })}
          </div>
        ) : task.status === "completed" ? (
          <EmptyState icon={Boxes} title="No items" description="The scan completed but returned no items. The target may be inactive or the source had no data." />
        ) : null}
      </SectionCard>
      <SectionCard title="Task record"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Task ID</dt><dd className="font-mono">{task.id}</dd></div><div><dt className="text-xs text-slate-500">Module</dt><dd>{task.module}</dd></div><div><dt className="text-xs text-slate-500">Target</dt><dd className="font-mono">{task.url}</dd></div><div><dt className="text-xs text-slate-500">Scan record</dt><dd className="font-mono">{task.scanId}</dd></div></dl></SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}
