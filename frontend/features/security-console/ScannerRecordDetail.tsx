"use client";

import Link from "next/link";
import { ArrowLeft, FileSearch, Gauge, Globe2, ScanLine, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { AppPage, EmptyState, MetricCard, SectionCard, StatusBadge } from "@/components/pan";
import type { SurfaceScanResult } from "@/types/pan";
import { DefinitionGrid, SafetyNotice, primaryButton, secondaryButton } from "./FeatureUI";
import { SurfaceGraph } from "./passive/SurfaceGraph";
import { AssetsView, OverviewView, RelationshipsView, SourcesView, TimelineView, TreeView } from "./passive/SurfaceViews";
import { getScannerScan } from "./scans-data";

type SurfaceTab = "overview" | "graph" | "tree" | "assets" | "timeline" | "relationships" | "sources";

const SURFACE_TABS: Array<{ id: SurfaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "graph", label: "Graph" },
  { id: "tree", label: "Tree" },
  { id: "assets", label: "Assets" },
  { id: "timeline", label: "Timeline" },
  { id: "relationships", label: "Relationships" },
  { id: "sources", label: "Sources" },
];

function isSurfaceResult(value: unknown): value is SurfaceScanResult {
  const result = value as Partial<SurfaceScanResult>;
  return Boolean(result && result.domain && Array.isArray(result.assets) && Array.isArray(result.relationships));
}

function SurfaceResultView({ result, scanId }: { result: SurfaceScanResult; scanId: string }) {
  const [tab, setTab] = useState<SurfaceTab>("overview");
  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Assets" value={String(result.summary.assetTotal)} detail={`${result.summary.relationshipCount} relationships`} tone="teal" icon={Globe2} />
        <MetricCard label="Relationships" value={String(result.summary.relationshipCount)} detail="mapped edges" tone="blue" icon={ScanLine} />
        <MetricCard label="Duration" value={`${result.durationSeconds}s`} detail="discovery run" tone="purple" icon={Gauge} />
        <MetricCard label="Findings" value={String(result.findings?.length ?? 0)} detail="normalized" tone="amber" icon={ShieldAlert} />
      </div>
      <nav className="pscan-tabs" aria-label="Surface views">
        {SURFACE_TABS.map((item) => (
          <button key={item.id} type="button" className={`pscan-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
            {item.id === "assets" ? <span className="pscan-tab-count">{result.assets.length}</span> : null}
          </button>
        ))}
      </nav>
      <div className="pscan-view">
        {tab === "overview" ? <OverviewView result={result} /> : null}
        {tab === "graph" ? <SurfaceGraph assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
        {tab === "tree" ? <TreeView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
        {tab === "assets" ? <AssetsView assets={result.assets} /> : null}
        {tab === "timeline" ? <TimelineView timeline={result.timeline} assets={result.assets} /> : null}
        {tab === "relationships" ? <RelationshipsView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
        {tab === "sources" ? <SourcesView result={result} /> : null}
      </div>
      <div className="pscan-actions" style={{ marginTop: 18 }}>
        <span className="pscan-btn-ghost" style={{ cursor: "default", opacity: 0.6 }}>scan {scanId}</span>
      </div>
    </div>
  );
}

/**
 * Live detail view for a frontend-backed scanner scan record (passive/xss/tool/…).
 * Polls while running; renders the full stored result (same UI as the scanner) once done.
 */
export function ScannerRecordDetail({ id }: { id: string }) {
  const scan = getScannerScan(id);
  const running = scan && !["completed", "failed", "cancelled"].includes(scan.status);

  if (!scan) {
    return (
      <AppPage eyebrow="Scan" title="Scan unavailable" description="This scan record could not be found.">
        <EmptyState icon={FileSearch} title="Scan unavailable" description="The scan may have been deleted or the id is invalid." action={<Link href="/scans" className={primaryButton}>Back to scans</Link>} />
      </AppPage>
    );
  }

  const result = scan.result;

  return (
    <AppPage
      eyebrow={`Scanner · ${scan.profile}`}
      title={scan.name}
      description={`${scan.target} · ${scan.profile} profile · ${scan.id}`}
      actions={<Link href="/scans" className={secondaryButton}><ArrowLeft className="h-4 w-4" /> Back to scans</Link>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={scan.status} />
        {running ? <span className="scan-pulse" /> : null}
        <span className="ml-auto text-xs text-slate-500">started {scan.started}</span>
      </div>

      {running ? (
        <div className="mb-5 rounded-xl border border-teal-300/20 bg-teal-300/[0.05] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-teal-200"><span className="scan-pulse" /> Scanning {scan.target}…</span>
            <span className="font-mono text-xs uppercase tracking-wider text-slate-400">{scan.status}</span>
          </div>
          <div className="scan-progress-track"><div className="scan-progress-fill indeterminate" /></div>
        </div>
      ) : !result ? (
        <div className="mb-5 flex items-center gap-4">
          <span className="text-2xl font-bold text-slate-100">{scan.progress}%</span>
          <div className="flex-1"><div className="scan-progress-track"><div className="scan-progress-fill" style={{ width: `${scan.progress}%` }} /></div></div>
        </div>
      ) : null}

      {result && isSurfaceResult(result) ? (
        <SurfaceResultView result={result} scanId={scan.id} />
      ) : result ? (
        <SectionCard title="Result" description={`Stored output for ${scan.id}`}>
          <pre className="max-h-96 overflow-auto rounded-lg bg-white/[0.03] p-4 font-mono text-xs leading-6 text-slate-300">{JSON.stringify(result, null, 2)}</pre>
        </SectionCard>
      ) : null}

      <SectionCard title="Scan record" description={`${scan.id} · created ${scan.started}`}>
        <DefinitionGrid items={[
          { label: "Scan ID", value: <span className="font-mono">{scan.id}</span> },
          { label: "Target", value: scan.target },
          { label: "Profile", value: scan.profile },
          { label: "Status", value: <StatusBadge value={scan.status} /> },
          { label: "Progress", value: `${scan.progress}%` },
          { label: "Findings", value: String(scan.findings) },
          { label: "Started", value: scan.started },
        ]} />
      </SectionCard>
      <SafetyNotice />
    </AppPage>
  );
}