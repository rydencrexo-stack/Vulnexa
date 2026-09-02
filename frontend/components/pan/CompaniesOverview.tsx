"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, Network, Search, Server, ShieldCheck, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { CompanyLogo } from "@/components/pan/CompanyLogo";
import { DataTable, type DataTableColumn } from "@/components/pan/DataTable";
import { LoadingState } from "@/components/pan/LoadingState";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate } from "@/lib/utils";
import { getCompanies, getTopology } from "@/services/company-data";
import { panService } from "@/services/pan-service";
import type { Asset, Company } from "@/types/pan";

const columns: DataTableColumn<Asset>[] = [
  { key: "hostname", header: "Host", value: (row) => row.hostname, sortable: true, render: (row) => <div><span className="pan-table-primary">{row.hostname}</span><span className="pan-table-secondary">{row.targetName}</span></div> },
  { key: "ip", header: "IP / Port", value: (row) => row.ip, sortable: true, render: (row) => <span className="pan-table-mono">{row.ip}:{row.port}</span> },
  { key: "httpStatus", header: "HTTP", value: (row) => row.httpStatus, sortable: true, render: (row) => <StatusBadge value={row.httpStatus < 400 ? "live" : "warning"} label={String(row.httpStatus)} /> },
  { key: "pageTitle", header: "Page title", value: (row) => row.pageTitle, sortable: true },
  { key: "technologies", header: "Technology", value: (row) => row.technologies.join(", "), render: (row) => <div className="pan-tag-list">{row.technologies.slice(0, 2).map((tech) => <span key={tech}>{tech}</span>)}</div> },
  { key: "risk", header: "Risk", value: (row) => row.risk, sortable: true, render: (row) => <StatusBadge value={row.risk} /> },
  { key: "lastSeen", header: "Last seen", value: (row) => row.lastSeen, sortable: true, render: (row) => formatDate(row.lastSeen, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
];

function MiniMap({ company }: { company: Company }) {
  const nodes = getTopology(company.slug).nodes;
  return (
    <div className="pan-company-minimap" aria-hidden="true">
      {nodes.map((node) => (
        <span key={node.id} className={`pan-map-dot pan-map-dot-${node.kind}${node.kind === "vuln" ? " is-vuln" : ""}`} />
      ))}
      <div className="pan-company-minimap-note">Interactive topology · {nodes.length} assets</div>
    </div>
  );
}

export function CompaniesOverview() {
  const router = useRouter();
  const companies = getCompanies();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [target, setTarget] = useState("all");
  const { data, loading } = useAsyncData(() => panService.getAssets());
  const targets = useMemo(() => Array.from(new Set((data ?? []).map((item) => item.targetName))), [data]);
  const filtered = useMemo(() => (data ?? []).filter((asset) => {
    const queryMatch = `${asset.hostname} ${asset.ip} ${asset.technologies.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return queryMatch && (risk === "all" || asset.risk === risk) && (target === "all" || asset.targetName === target);
  }), [data, query, risk, target]);

  return (
    <AppPage eyebrow="Attack surface · Assets" title="Company asset map" description="Grouped attack surface per company with branded network topology, chains, and live inventory." actions={<Link className="pan-button pan-button-primary" href="/recon/new"><Waypoints size={16} />Run discovery</Link>}>
      <nav className="pan-tabs" aria-label="Asset views"><Link className="pan-tab pan-tab-active" href="/assets/all">Companies</Link><Link className="pan-tab" href="/assets/subdomains">Subdomains</Link><Link className="pan-tab" href="/assets/live-hosts">Live hosts</Link><Link className="pan-tab" href="/assets/technologies">Technologies</Link></nav>
      <div className="pan-kpi-row" style={{ margin: "14px 0" }}><MetricCard icon={Network} label="Companies" value={companies.length} detail="mapped attack surfaces" /><MetricCard icon={Globe2} label="Assets" value={data?.length ?? 0} tone="blue" detail="in verified scope" /><MetricCard icon={Server} label="Live hosts" value={data?.filter((item) => item.httpStatus < 500).length ?? 0} tone="purple" detail="responding over HTTP" /><MetricCard icon={ShieldCheck} label="Elevated risk" value={data?.filter((item) => ["critical", "high"].includes(item.risk)).length ?? 0} tone="red" detail="needs review" /></div>

      <div className="pan-company-grid">
        {companies.map((company) => {
          return (
            <SectionCard key={company.slug} contentClassName="pan-company-card" className="pan-company-card-wrap">
              <div className="pan-company-head">
                <CompanyLogo company={company} size={46} />
                <div className="min-w-0">
                  <h3 className="pan-company-name">{company.name}</h3>
                  <p className="pan-company-meta">{company.industry} · {company.location}</p>
                </div>
                <span className="pan-company-score" style={{ color: company.color }}>{company.securityScore}<small>/100</small></span>
              </div>
              <p className="pan-company-tagline">{company.tagline}</p>
              <div className="pan-company-stats">
                <div><strong>{company.assetCount}</strong><span>assets</span></div>
                <div><strong>{company.endpointCount}</strong><span>endpoints</span></div>
                <div><strong>{company.findingCount}</strong><span>findings</span></div>
                <div><StatusBadge value={company.risk} /></div>
              </div>
              <MiniMap company={company} />
              <div className="pan-company-actions">
                <span className="pan-company-domain pan-table-mono">{company.domain}</span>
                <Link className="pan-button pan-button-secondary pan-button-sm" href={`/assets/${company.slug}`}>Open map <ArrowRight size={14} /></Link>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard contentClassName="pan-card-content-flush" title="Asset inventory" description={`${filtered.length} hosts match the current view across all companies`}>
        <div className="pan-table-toolbar">
          <div className="pan-toolbar-search"><Search size={15} /><input className="pan-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search host, IP, or technology…" value={query} /></div>
          <select className="pan-select pan-filter-select" onChange={(event) => setTarget(event.target.value)} value={target}><option value="all">All targets</option>{targets.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="pan-select pan-filter-select" onChange={(event) => setRisk(event.target.value)} value={risk}><option value="all">All risk states</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">No known risk</option></select>
        </div>
        {loading ? <div style={{ padding: 18 }}><LoadingState rows={6} /></div> : <DataTable columns={columns} data={filtered} emptyDescription="Adjust filters or run authorized reconnaissance." emptyTitle="No assets match this view" keyField="id" onRowClick={(asset) => router.push(`/assets/${asset.id}`)} />}
      </SectionCard>
    </AppPage>
  );
}

export default CompaniesOverview;