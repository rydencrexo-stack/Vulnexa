"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe2, Network, Search, Server, ShieldCheck, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { DataTable, type DataTableColumn } from "@/components/pan/DataTable";
import { LoadingState } from "@/components/pan/LoadingState";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { AssetMapView } from "@/components/pan/AssetMapView";
import { CompaniesOverview } from "@/components/pan/CompaniesOverview";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate } from "@/lib/utils";
import { getCompany } from "@/services/company-data";
import { panService } from "@/services/pan-service";
import type { Asset } from "@/types/pan";

const categoryIds = ["subdomains", "live-hosts", "technologies"];

const columns: DataTableColumn<Asset>[] = [
  { key: "hostname", header: "Host", value: (row) => row.hostname, sortable: true, render: (row) => <div><span className="pan-table-primary">{row.hostname}</span><span className="pan-table-secondary">{row.targetName}</span></div> },
  { key: "ip", header: "IP / Port", value: (row) => row.ip, sortable: true, render: (row) => <span className="pan-table-mono">{row.ip}:{row.port}</span> },
  { key: "httpStatus", header: "HTTP", value: (row) => row.httpStatus, sortable: true, render: (row) => <StatusBadge value={row.httpStatus < 400 ? "live" : "warning"} label={String(row.httpStatus)} /> },
  { key: "pageTitle", header: "Page title", value: (row) => row.pageTitle, sortable: true },
  { key: "technologies", header: "Technology", value: (row) => row.technologies.join(", "), render: (row) => <div className="pan-tag-list">{row.technologies.slice(0, 2).map((tech) => <span key={tech}>{tech}</span>)}</div> },
  { key: "risk", header: "Risk", value: (row) => row.risk, sortable: true, render: (row) => <StatusBadge value={row.risk} /> },
  { key: "lastSeen", header: "Last seen", value: (row) => row.lastSeen, sortable: true, render: (row) => formatDate(row.lastSeen, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
];

export function AssetsView({ segments }: { segments: string[] }) {
  const first = segments[0] ?? "all";
  if (getCompany(first)) return <AssetMapView companySlug={first} />;
  if (first === "all") return <CompaniesOverview />;
  if (categoryIds.includes(first)) return <AssetList category={first} />;
  return <AssetDetail assetId={first} />;
}

function AssetList({ category }: { category: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [target, setTarget] = useState("all");
  const { data, loading } = useAsyncData(() => panService.getAssets());
  const targets = useMemo(() => Array.from(new Set((data ?? []).map((item) => item.targetName))), [data]);
  const filtered = useMemo(() => (data ?? []).filter((asset) => {
    const categoryMatch = category === "all" || category === "technologies" || (category === "subdomains" && asset.type === "subdomain") || (category === "live-hosts" && asset.type === "live_host");
    const queryMatch = `${asset.hostname} ${asset.ip} ${asset.technologies.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch && (risk === "all" || asset.risk === risk) && (target === "all" || asset.targetName === target);
  }), [category, data, query, risk, target]);
  const technologies = useMemo(() => Object.entries((data ?? []).flatMap((item) => item.technologies).reduce<Record<string, number>>((acc, tech) => ({ ...acc, [tech]: (acc[tech] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [data]);
  const title = category === "subdomains" ? "Subdomains" : category === "live-hosts" ? "Live hosts" : category === "technologies" ? "Technology inventory" : "All assets";
  return <AppPage eyebrow="Attack surface · Assets" title={title} description="Search, filter, and inspect hosts discovered within verified target scope." actions={<Link className="pan-button pan-button-primary" href="/recon/new"><Waypoints size={16} />Run discovery</Link>}>
    <nav className="pan-tabs" aria-label="Asset views"><Link className="pan-tab" href="/assets/all">Companies</Link><Link className={category === "subdomains" ? "pan-tab pan-tab-active" : "pan-tab"} href="/assets/subdomains">Subdomains</Link><Link className={category === "live-hosts" ? "pan-tab pan-tab-active" : "pan-tab"} href="/assets/live-hosts">Live hosts</Link><Link className={category === "technologies" ? "pan-tab pan-tab-active" : "pan-tab"} href="/assets/technologies">Technologies</Link></nav>
    <div className="pan-kpi-row" style={{ margin: "14px 0" }}><MetricCard icon={Network} label="Assets" value={data?.length ?? 0} detail="in verified scope" /><MetricCard icon={Globe2} label="Subdomains" value={data?.filter((item) => item.type === "subdomain").length ?? 0} tone="blue" detail="DNS names observed" /><MetricCard icon={Server} label="Live hosts" value={data?.filter((item) => item.httpStatus < 500).length ?? 0} tone="purple" detail="responding over HTTP" /><MetricCard icon={ShieldCheck} label="Elevated risk" value={data?.filter((item) => ["critical", "high"].includes(item.risk)).length ?? 0} tone="red" detail="needs review" /></div>
    {category === "technologies" ? <SectionCard className="pan-inventory-summary" title="Observed technologies" description="Fingerprints are observations, not definitive software inventories."><div className="pan-tech-grid">{technologies.map(([tech, count]) => <div key={tech}><span>{tech}</span><strong>{count}</strong><small>{count === 1 ? "host" : "hosts"}</small></div>)}</div></SectionCard> : null}
    <SectionCard contentClassName="pan-card-content-flush" title="Asset inventory" description={`${filtered.length} hosts match the current view`}><div className="pan-table-toolbar"><div className="pan-toolbar-search"><Search size={15} /><input className="pan-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search host, IP, or technology…" value={query} /></div><select className="pan-select pan-filter-select" onChange={(event) => setTarget(event.target.value)} value={target}><option value="all">All targets</option>{targets.map((item) => <option key={item}>{item}</option>)}</select><select className="pan-select pan-filter-select" onChange={(event) => setRisk(event.target.value)} value={risk}><option value="all">All risk states</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No known risk</option></select></div>{loading ? <div style={{ padding: 18 }}><LoadingState rows={6} /></div> : <DataTable columns={columns} data={filtered} emptyDescription="Adjust filters or run authorized reconnaissance." emptyTitle="No assets match this view" keyField="id" onRowClick={(asset) => router.push(`/assets/${asset.id}`)} />}</SectionCard>
  </AppPage>;
}

function AssetDetail({ assetId }: { assetId: string }) {
  const { data: asset, loading } = useAsyncData(() => panService.getAsset(assetId), assetId);
  if (loading || !asset) return <AppPage title="Asset" description="Loading discovered host…"><LoadingState rows={6} /></AppPage>;
  return <AppPage eyebrow={`Assets · ${asset.targetName}`} title={asset.hostname} description={`${asset.protocol}://${asset.hostname}:${asset.port}`} actions={<><Link className="pan-button pan-button-secondary" href="/assets/all"><ArrowLeft size={15} />Inventory</Link><a className="pan-button pan-button-primary" href={`${asset.protocol}://${asset.hostname}`} rel="noreferrer" target="_blank">Open host <ExternalLink size={15} /></a></>}>
    <div className="pan-kpi-row" style={{ marginBottom: 14 }}><MetricCard icon={Server} label="HTTP status" value={asset.httpStatus} detail={asset.pageTitle} /><MetricCard icon={Globe2} label="Port" value={asset.port} tone="blue" detail={asset.protocol.toUpperCase()} /><MetricCard icon={ShieldCheck} label="Risk state" value={asset.risk.toUpperCase()} tone={asset.risk === "high" ? "red" : "amber"} detail="highest related severity" /><MetricCard icon={Waypoints} label="Source" value={asset.discoverySource} tone="purple" detail="first observation" /></div>
    <div className="pan-grid pan-grid-2"><SectionCard title="Host details" description="Latest normalized observation"><dl className="pan-detail-list"><Detail label="Hostname" value={asset.hostname} /><Detail label="IP address" value={<span className="pan-table-mono">{asset.ip}</span>} /><Detail label="Domain" value={asset.domain} /><Detail label="Protocol / port" value={`${asset.protocol.toUpperCase()} · ${asset.port}`} /><Detail label="Page title" value={asset.pageTitle} /><Detail label="Related target" value={<Link className="pan-card-link" href={`/targets/${asset.targetId}/overview`}>{asset.targetName}</Link>} /></dl></SectionCard><SectionCard title="TLS and technology" description="Passive fingerprints and connection metadata"><div className="pan-asset-tech"><p>TLS connection</p><strong>{asset.tls}</strong><p>Technology fingerprints</p><div className="pan-tag-list">{asset.technologies.map((tech) => <span key={tech}>{tech}</span>)}</div></div><div className="pan-safety-notice" style={{ marginTop: 16 }}><ShieldCheck size={16} /><div><strong>Observation confidence</strong>Technology fingerprints can be ambiguous and should be validated before remediation decisions.</div></div></SectionCard><SectionCard title="Discovery timeline" description="Inventory provenance"><dl className="pan-detail-list"><Detail label="First seen" value={formatDate(asset.firstSeen, { dateStyle: "medium", timeStyle: "short" })} /><Detail label="Last seen" value={formatDate(asset.lastSeen, { dateStyle: "medium", timeStyle: "short" })} /><Detail label="Discovery source" value={asset.discoverySource} /><Detail label="Asset type" value={asset.type.replace("_", " ")} /></dl></SectionCard><SectionCard title="Screenshot" description="Safe visual inventory capture"><div className="pan-screenshot-placeholder"><Globe2 size={27} /><strong>{asset.pageTitle}</strong><span>Screenshot capture available after the next recon run.</span></div></SectionCard></div>
  </AppPage>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="pan-detail-row"><dt>{label}</dt><dd>{value}</dd></div>; }
