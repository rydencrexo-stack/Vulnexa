"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, ArrowLeft, Boxes, Globe2, Link2, Play, Radar, Route, Server, Waypoints } from "lucide-react";
import { AppPage, DataTable, EmptyState, MetricCard, SectionCard, StatusBadge } from "@/components/pan";
import { DefinitionGrid, KeyValueRows, SafetyNotice, primaryButton, secondaryButton, inputClass } from "./FeatureUI";
import {
  createReconJob,
  failReconJob,
  finalizeReconJob,
  getReconJob,
  getReconJobs,
  type ReconResult,
  type ReconStage,
  type SubdomainAsset,
} from "./recon-data";
import { panService } from "@/services/pan-service";

const STAGES: Array<{ id: ReconStage; label: string; icon: typeof Boxes }> = [
  { id: "subdomains", label: "Subdomains / Asset Discovery", icon: Boxes },
  { id: "live-hosts", label: "Live Hosts", icon: Server },
  { id: "url-discovery", label: "URL / Endpoint Discovery", icon: Route },
];

export function ReconPipelineOverview({ modules }: { modules?: Array<{ slug: string; name: string; adapter: string; description: string; output: string }> }) {
  const router = useRouter();
  const [domains, setDomains] = useState("");
  const [stages, setStages] = useState<ReconStage[]>(["subdomains", "live-hosts", "url-discovery"]);
  const [running, setRunning] = useState<ReconResult | null>(null);
  const [error, setError] = useState("");

  function toggleStage(id: ReconStage) {
    setStages((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  }

  async function runRecon() {
    const list = domains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter((d) => /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d));
    if (!list.length) {
      setError("Enter at least one valid domain (e.g. example.com). Separate multiple with spaces or commas.");
      return;
    }
    if (!stages.length) {
      setError("Select at least one recon stage.");
      return;
    }
    setError("");
    const job = createReconJob(list, stages);
    setRunning(job);
    const subdomains: SubdomainAsset[] = [];
    const liveHosts: SubdomainAsset[] = [];
    const urls: string[] = [];
    let successfulModules = 0;

    try {
      for (let domainIndex = 0; domainIndex < list.length; domainIndex += 1) {
        const domain = list[domainIndex];
        let hosts = [domain];

        if (stages.includes("subdomains")) {
          const result = await panService.runReconModule("subdomains", domain);
          if (result) {
            successfulModules += 1;
            hosts = (result.items as Array<{ hostname?: string }>).map((item) => item.hostname ?? "").filter(Boolean);
            for (const hostname of hosts) subdomains.push({ hostname, tech: [], routes: [], links: [], live: false });
          }
          setRunning((current) => current ? { ...current, progress: Math.max(current.progress, 28) } : current);
        }

        if (stages.includes("live-hosts")) {
          const result = await panService.runReconModule("live-hosts", hosts.join(" "));
          if (result) {
            successfulModules += 1;
            for (const item of result.items as Array<{ url?: string; hostname?: string; status?: number; title?: string; tech?: string[]; live?: boolean }>) {
              const hostname = item.hostname ?? (() => { try { return new URL(item.url ?? "").hostname; } catch { return item.url ?? ""; } })();
              if (!hostname) continue;
              const asset: SubdomainAsset = { hostname, status: item.status, title: item.title, tech: item.tech ?? [], routes: [], links: [], live: Boolean(item.live) };
              const existing = subdomains.find((candidate) => candidate.hostname === hostname);
              if (existing) Object.assign(existing, asset);
              else subdomains.push(asset);
              if (asset.live) liveHosts.push(asset);
            }
          }
          setRunning((current) => current ? { ...current, progress: Math.max(current.progress, 64) } : current);
        }

        if (stages.includes("url-discovery")) {
          const result = await panService.runReconModule("url-discovery", domain);
          if (result) {
            successfulModules += 1;
            urls.push(...(result.items as unknown[]).filter((item): item is string => typeof item === "string"));
          }
          setRunning((current) => current ? { ...current, progress: Math.max(current.progress, 88) } : current);
        }

        setRunning((current) => current ? { ...current, progress: Math.max(current.progress, Math.round(((domainIndex + 1) / list.length) * 92)) } : current);
      }

      if (successfulModules === 0) throw new Error("Recon services were unavailable.");
      const done = finalizeReconJob(job.id, { subdomains, liveHosts, urls });
      if (done) {
        setRunning(done);
        window.setTimeout(() => router.push("/recon/history"), 900);
      }
    } catch (runError) {
      const failed = failReconJob(job.id);
      if (failed) setRunning(failed);
      setError(runError instanceof Error ? runError.message : "Recon failed.");
    }
  }

  return (
    <AppPage
      eyebrow="Reconnaissance · Complete pipeline"
      title="Complete recon engine"
      description="Run a full passive discovery sweep for one or many domains — subdomains, live hosts, and URL/endpoint extraction — all stored to history and the Scans list."
      actions={<Link href="/recon/history" className={secondaryButton}>History</Link>}
    >
      {running ? (
        <ReconRunningCard job={running} />
      ) : (
        <SectionCard title="1 · Targets" description="Enter one or more domains. Every stage runs against each domain.">
          <textarea
            className={`${inputClass} min-h-24 resize-y font-mono`}
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder={"example.com\npartner.example.com  api.example.net"}
            spellCheck={false}
          />
          {error ? <p className="mt-2 text-sm font-semibold text-red-300">{error}</p> : null}
        </SectionCard>
      )}

      {!running ? (
        <>
          <SectionCard title="2 · Stages" description="Choose which discovery stages to run. Results are stored and viewable from history and Scans.">
            <div className="grid gap-3 sm:grid-cols-3">
              {STAGES.map((stage) => {
                const Icon = stage.icon;
                const active = stages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => toggleStage(stage.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${active ? "border-teal-300/30 bg-teal-300/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-teal-300" : "text-slate-500"}`} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-200">{stage.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{active ? "enabled" : "disabled"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
          <div className="flex items-center justify-end gap-3">
            <button type="button" className={primaryButton} onClick={() => void runRecon()}><Play className="h-4 w-4" /> Run complete recon</button>
          </div>
          <SafetyNotice>Only run this against domains you own or are explicitly authorized to test. All stages are passive.</SafetyNotice>
        </>
      ) : null}

      {modules && modules.length ? (
        <SectionCard title="Discovery modules" description="Focused, adapter-backed recon modules for any verified target." action={<Link href="/recon/new" className={secondaryButton}>New recon</Link>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => (
              <Link key={module.slug} href={`/recon/${module.slug}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-teal-300/30 hover:bg-white/[0.04]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">{module.adapter}</span>
                <span className="mt-1 block text-sm font-semibold text-slate-200">{module.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{module.description}</span>
                <span className="mt-2 block font-mono text-xs text-slate-400">{module.output}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </AppPage>
  );
}

function ReconRunningCard({ job }: { job: ReconResult }) {
  const running = job.status === "running";
  const failed = job.status === "failed";
  return (
    <SectionCard title={running ? "Recon in progress" : failed ? "Recon failed" : "Recon complete"} description={`${job.domains.join(", ")} · ${job.stages.length} stages`}>
      {running ? (
        <div className="flex items-center gap-4">
          <span className="relative grid h-28 w-28 shrink-0 place-items-center"><span className="scan-pulse" /><Radar className="h-7 w-7 text-teal-300" /></span>
          <div className="flex-1">
            <p className="font-semibold text-teal-200">Scanning {job.domains.join(", ")}…</p>
            <div className="mt-3 scan-progress-track"><div className="scan-progress-fill indeterminate" /></div>
            <p className="mt-2 text-sm text-slate-400">{job.stages.map((s) => s.replace("-", " ")).join(" · ")}</p>
          </div>
        </div>
      ) : failed ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-300/20 bg-red-300/[0.05] p-5">
          <div><p className="font-bold text-red-200">The real recon adapters did not complete.</p><p className="mt-1 text-sm text-slate-400">No synthetic results were generated. Check authentication, backend connectivity, and upstream availability.</p></div>
          <Link href="/recon/overview" className={secondaryButton}>Try again</Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-300/20 bg-teal-300/[0.05] p-5">
          <div>
            <p className="font-bold text-teal-100">{job.subdomains.length} subdomains · {job.liveHosts.length} live · {job.urls.length} URLs</p>
            <p className="mt-1 text-sm text-slate-400">Stored to recon history and the Scans list.</p>
          </div>
          <Link href="/recon/history" className={primaryButton}>View history</Link>
        </div>
      )}
    </SectionCard>
  );
}

const RECON_HISTORY_COLUMNS = [
  { key: "name", header: "Recon", render: (job: ReconResult) => <Link href={`/recon/${job.id}`} className="font-semibold text-slate-100 hover:text-teal-300">{job.domains[0]}{job.domains.length > 1 ? ` (+${job.domains.length - 1})` : ""}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{job.id}</span></Link> },
  { key: "stages", header: "Stages", render: (job: ReconResult) => <span className="font-mono text-xs">{job.stages.length} stages</span> },
  { key: "subdomains", header: "Subdomains", render: (job: ReconResult) => <span className="font-mono">{job.subdomains.length}</span> },
  { key: "live", header: "Live", render: (job: ReconResult) => <span className="font-mono">{job.liveHosts.length}</span> },
  { key: "urls", header: "URLs", render: (job: ReconResult) => <span className="font-mono">{job.urls.length}</span> },
  { key: "status", header: "Status", render: (job: ReconResult) => <StatusBadge value={job.status} /> },
  { key: "started", header: "Started", render: (job: ReconResult) => <span className="text-xs text-slate-400">{job.started}</span> },
];

export function ReconPipelineHistory() {
  const jobs = getReconJobs();
  const totals = jobs.reduce(
    (acc, j) => ({ subs: acc.subs + j.subdomains.length, live: acc.live + j.liveHosts.length, urls: acc.urls + j.urls.length }),
    { subs: 0, live: 0, urls: 0 },
  );
  return (
    <AppPage eyebrow="Reconnaissance · History" title="Recon history" description="Every recon run, its stage output, and its status. Results are also visible under Scans." actions={<Link href="/recon/overview" className={primaryButton}><Play className="h-4 w-4" /> New recon</Link>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Recon runs" value={String(jobs.length)} detail="stored" tone="teal" icon={Activity} />
        <MetricCard label="Subdomains found" value={String(totals.subs)} detail="across runs" tone="blue" icon={Boxes} />
        <MetricCard label="URLs collected" value={String(totals.urls)} detail="endpoint surface" tone="purple" icon={Route} />
      </div>
      <SectionCard title="Recon runs" description={`${jobs.length} total · newest first`}>
        {jobs.length ? <DataTable data={jobs} keyField="id" columns={RECON_HISTORY_COLUMNS} /> : <EmptyState icon={Radar} title="No recon runs yet" description="Run a complete recon from the overview to build history." action={<Link href="/recon/overview" className={primaryButton}>Run recon</Link>} />}
      </SectionCard>
    </AppPage>
  );
}

function allAssets(kind: "subdomains" | "liveHosts"): SubdomainAsset[] {
  const out: SubdomainAsset[] = [];
  for (const job of getReconJobs()) out.push(...job[kind]);
  return out;
}
function allUrls(): string[] {
  const out: string[] = [];
  for (const job of getReconJobs()) out.push(...job.urls);
  return [...new Set(out)];
}

export function ReconSubdomains() {
  const assets = allAssets("subdomains");
  return <AssetList title="Subdomains" description="Every host discovered across recon runs. Click a row for tech, routes, and links." assets={assets} />;
}
export function ReconLiveHosts() {
  const assets = allAssets("liveHosts");
  return <AssetList title="Live hosts" description="Hosts that responded during recon. Click a row for tech, routes, and links." assets={assets} />;
}

function AssetList({ title, description, assets }: { title: string; description: string; assets: SubdomainAsset[] }) {
  const [selected, setSelected] = useState<SubdomainAsset | null>(assets[0] ?? null);
  return (
    <AppPage eyebrow={`Reconnaissance · ${title}`} title={title} description={description} actions={<Link href="/recon/history" className={secondaryButton}><ArrowLeft className="h-4 w-4" /> History</Link>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <SectionCard contentClassName="pan-card-content-flush" title={`${assets.length} ${title.toLowerCase()}`}>
          {assets.length ? (
            <DataTable
              data={assets}
              keyField="hostname"
              onRowClick={(row) => setSelected(row)}
              columns={[
                { key: "hostname", header: "Host", render: (a: SubdomainAsset) => <span className="font-mono text-sm text-slate-100">{a.hostname}</span> },
                { key: "ip", header: "IP", render: (a: SubdomainAsset) => <span className="font-mono text-xs text-slate-400">{a.ip}</span> },
                { key: "status", header: "HTTP", render: (a: SubdomainAsset) => a.status ? <StatusBadge value={a.status < 400 ? "live" : "warning"} label={String(a.status)} /> : <span className="text-slate-600">—</span> },
                { key: "tech", header: "Tech", render: (a: SubdomainAsset) => <span className="text-xs text-slate-400">{a.tech.slice(0, 2).join(" · ") || "—"}</span> },
              ]}
            />
          ) : (
            <EmptyState icon={Boxes} title="No assets yet" description="Run a complete recon to discover subdomains and live hosts." action={<Link href="/recon/overview" className={primaryButton}>Run recon</Link>} />
          )}
        </SectionCard>
        <AssetDetailPanel asset={selected} />
      </div>
    </AppPage>
  );
}

function AssetDetailPanel({ asset }: { asset: SubdomainAsset | null }) {
  if (!asset) return <SectionCard title="Asset detail"><p className="text-sm text-slate-500">Select a row to inspect it.</p></SectionCard>;
  return (
    <div className="grid content-start gap-5">
      <SectionCard title={asset.hostname} description={`${asset.ip ?? "—"} · ${asset.live ? "live" : "not responding"}`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <StatusBadge value={asset.live ? "live" : "offline"} tone={asset.live ? "success" : "neutral"} />
          {asset.status ? <StatusBadge value={String(asset.status)} /> : null}
        </div>
        <DefinitionGrid items={[
          { label: "Hostname", value: <span className="font-mono">{asset.hostname}</span> },
          { label: "IP address", value: <span className="font-mono">{asset.ip ?? "—"}</span> },
          { label: "Page title", value: asset.title ?? "—" },
        ]} />
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Technology</p>
          <div className="flex flex-wrap gap-2">{asset.tech.map((t) => <span key={t} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-200">{t}</span>)}</div>
        </div>
      </SectionCard>
      <SectionCard title="Routes" description="Extracted endpoint paths">
        <ul className="space-y-1.5">{asset.routes.map((r) => <li key={r} className="flex items-center gap-2 font-mono text-xs text-slate-300"><Route className="h-3 w-3 text-teal-300" />{r}</li>)}</ul>
      </SectionCard>
      <SectionCard title="Links" description="In-page links observed">
        <div className="flex flex-wrap gap-2">{asset.links.map((l) => <Link key={l} href={`${asset.hostname}${l}`} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-teal-300"><Link2 className="h-3 w-3" />{l}</Link>)}</div>
      </SectionCard>
    </div>
  );
}

export function ReconUrls() {
  const urls = allUrls();
  return (
    <AppPage eyebrow="Reconnaissance · URLs" title="URL / endpoint discovery" description="Collected URLs and endpoints across recon runs." actions={<Link href="/recon/history" className={secondaryButton}><ArrowLeft className="h-4 w-4" /> History</Link>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="URLs collected" value={String(urls.length)} detail="deduplicated" tone="teal" icon={Route} />
        <MetricCard label="Sources" value="Wayback · Common Crawl · crawl" detail="web archive + live" tone="blue" icon={Waypoints} />
      </div>
      <SectionCard title="Discovered URLs" description="Click to open (authorized targets only).">
        {urls.length ? (
          <div className="grid gap-2">
            {urls.map((url) => (
              <a key={url} href={url} rel="noreferrer" target="_blank" className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 font-mono text-xs text-slate-300 transition hover:border-teal-300/30 hover:bg-white/[0.04]">
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-teal-300" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState icon={Route} title="No URLs yet" description="Run a complete recon to collect URLs and endpoints." action={<Link href="/recon/overview" className={primaryButton}>Run recon</Link>} />
        )}
      </SectionCard>
    </AppPage>
  );
}

export function ReconJobDetailView({ id }: { id: string }) {
  const job = getReconJob(id);
  if (!job) {
    return <AppPage eyebrow="Recon · job" title="Recon not found" description="This recon job does not exist."><EmptyState icon={Radar} title="Recon not found" description="The job may have been deleted." action={<Link href="/recon/history" className={primaryButton}>Back to history</Link>} /></AppPage>;
  }
  return (
    <AppPage eyebrow={`Recon · ${job.id}`} title={job.domains.join(", ")} description={`${job.stages.length} stages · started ${job.started}`} actions={<Link href="/recon/history" className={secondaryButton}><ArrowLeft className="h-4 w-4" /> History</Link>}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge value={job.status} /><span className="ml-auto text-xs text-slate-500">completed {job.completed}</span></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Subdomains" value={String(job.subdomains.length)} detail="discovered" tone="teal" icon={Boxes} />
        <MetricCard label="Live hosts" value={String(job.liveHosts.length)} detail="responding" tone="blue" icon={Server} />
        <MetricCard label="URLs" value={String(job.urls.length)} detail="collected" tone="purple" icon={Route} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Subdomains" action={<Link href="/recon/subdomains" className={secondaryButton}>View all</Link>}>
          <ul className="space-y-1.5">{job.subdomains.slice(0, 12).map((s) => <li key={s.hostname} className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-300">{s.hostname}</span><span className="font-mono text-xs text-slate-500">{s.ip}</span></li>)}</ul>
        </SectionCard>
        <SectionCard title="URLs" action={<Link href="/recon/url-discovery" className={secondaryButton}>View all</Link>}>
          <ul className="space-y-1.5">{job.urls.slice(0, 12).map((url) => <li key={url} className="truncate font-mono text-xs text-slate-300">{url}</li>)}</ul>
        </SectionCard>
      </div>
      <KeyValueRows rows={[{ label: "Scan record", value: job.scanId }, { label: "Domains", value: job.domains.join(", ") }, { label: "Stages", value: job.stages.join(", ") }]} />
    </AppPage>
  );
}
