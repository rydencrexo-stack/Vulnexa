"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, Search, ShieldAlert } from "lucide-react";
import type { SurfaceAsset, SurfaceRelationship, SurfaceScanResult } from "@/types/pan";

const TYPE_LABELS: Record<string, string> = {
  organization: "Organization",
  domain: "Domain",
  subdomain: "Subdomain",
  ip: "IP",
  certificate: "Certificate",
  url: "URL",
  repository: "Repository",
  technology: "Technology",
  cloud_provider: "Cloud Provider",
  documentation: "Documentation",
};

const SCOPE_LABELS: Record<string, { label: string; dot: string }> = {
  in_scope: { label: "In scope", dot: "#22ffb0" },
  needs_review: { label: "Needs review", dot: "#ffb020" },
  out_of_scope: { label: "Out of scope", dot: "#ff5470" },
  unknown: { label: "Unknown", dot: "#7d8a94" },
};

const CONFIDENCE_LABELS: Record<string, { label: string; dot: string }> = {
  high: { label: "HIGH", dot: "#22ffb0" },
  medium: { label: "MEDIUM", dot: "#38bdf8" },
  low: { label: "LOW", dot: "#ffb020" },
  historical: { label: "HISTORICAL", dot: "#7d8a94" },
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "🔥 HIGH PRIORITY",
  review: "⚠️ REVIEW",
  historical: "🕐 HISTORICAL",
  informational: "ℹ️ INFORMATIONAL",
};

export function OverviewView({ result }: { result: SurfaceScanResult }) {
  const { summary } = result;
  const tiers = summary.priorityTiers;
  return (
    <div>
      <div className="pscan-summary">
        <div className="pscan-metric pscan-risk">
          <div>
            <div className="pscan-risk-label">Assets</div>
            <div className="pscan-risk-num">{summary.assetTotal}</div>
            <div className="pscan-risk-band" style={{ color: "var(--ps-cyan)" }}>{summary.relationshipCount} relationships</div>
          </div>
        </div>
        <div className="pscan-metric">
          <div className="label">In scope</div>
          <div className="value" style={{ color: "var(--ps-green)" }}>{summary.inScopeAssets}</div>
          <div className="sub">assets</div>
        </div>
        <div className="pscan-metric">
          <div className="label">High confidence</div>
          <div className="value" style={{ color: "var(--ps-acid)" }}>{summary.highConfidenceAssets}</div>
          <div className="sub">assets</div>
        </div>
        <div className="pscan-metric">
          <div className="label">Resolving hosts</div>
          <div className="value" style={{ color: "var(--ps-cyan)" }}>{summary.resolvingHosts}</div>
          <div className="sub">currently live</div>
        </div>
        <div className="pscan-metric">
          <div className="label">Sources</div>
          <div className="value" style={{ fontSize: 18, color: "var(--ps-amber)" }}>{result.sourcesUsed.length}</div>
          <div className="sub">{result.sourcesUsed.join(" · ") || "—"}</div>
        </div>
      </div>

      <div className="pscan-section">
        <div className="pscan-section-head">
          <h2 className="pscan-section-title">Prioritization</h2>
          <span className="pscan-section-meta">Prioritization signal — not vulnerability claims</span>
        </div>
        <div className="pscan-tier-grid">
          {(["high", "review", "historical", "informational"] as const).map((tier) => (
            <div className="pscan-tier" key={tier}>
              <div className="pscan-tier-head">{PRIORITY_LABELS[tier]} <span>{tiers[tier].length}</span></div>
              <div className="pscan-tier-body">
                {tiers[tier].length === 0 ? <span className="pscan-tier-empty">none</span> : tiers[tier].slice(0, 40).map((value) => <span className="pscan-tier-item" key={value}>{value}</span>)}
                {tiers[tier].length > 40 ? <span className="pscan-tier-more">+ {tiers[tier].length - 40} more</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pscan-section">
        <div className="pscan-section-head">
          <h2 className="pscan-section-title">Discovered layers</h2>
        </div>
        <div className="pscan-layer-grid">
          {Object.entries(summary.assetCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div className="pscan-layer" key={type}>
              <span>{TYPE_LABELS[type] ?? type}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TreeView({ assets, relationships, rootValue }: { assets: SurfaceAsset[]; relationships: SurfaceRelationship[]; rootValue: string }) {
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const rootId = useMemo(() => {
    const domain = assets.find((asset) => asset.type === "domain" && asset.value === rootValue);
    return (domain ?? assets.find((asset) => asset.type === "organization") ?? assets[0])?.id ?? "";
  }, [assets, rootValue]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childrenOf = (id: string, seen: Set<string>): SurfaceAsset[] => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      if (rel.source === id) ids.add(rel.target);
      if (rel.target === id) ids.add(rel.source);
    }
    ids.delete(id);
    return Array.from(ids)
      .map((assetId) => byId.get(assetId))
      .filter((asset): asset is SurfaceAsset => Boolean(asset))
      .filter((asset) => !seen.has(asset.id))
      .sort((a, b) => {
        const rank = (asset: SurfaceAsset) => (asset.type === "subdomain" || asset.type === "domain" || asset.type === "ip" || asset.type === "certificate" ? 1 : asset.type === "technology" || asset.type === "cloud_provider" ? 2 : 3);
        return rank(a) - rank(b) || b.score - a.score || a.value.localeCompare(b.value);
      })
      .slice(0, 40);
  };

  const renderNode = (asset: SurfaceAsset, depth: number, isLast: boolean, prefix: string, ancestors: Set<string>, seen: Set<string>, counter: { value: number }): React.ReactNode => {
    if (depth > 8 || counter.value > 700) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(asset.id);
    const kids = childrenOf(asset.id, nextAncestors).filter((kid) => !seen.has(kid.id));
    const isCollapsed = collapsed.has(asset.id);
    const hasKids = kids.length > 0;
    const branch = depth === 0 ? "" : isLast ? "└── " : "├── ";
    counter.value += 1;
    const nextSeen = new Set(seen);
    nextSeen.add(asset.id);
    return (
      <div key={asset.id}>
        <div
          className="pscan-tree-line"
          style={{ paddingLeft: depth * 22 }}
          onClick={() => hasKids && setCollapsed((current) => { const next = new Set(current); if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id); return next; })}
          role={hasKids ? "button" : undefined}
        >
          <span className="pscan-tree-guide">{prefix}{branch}</span>
          {hasKids ? (isCollapsed ? <ChevronRight size={13} className="pscan-tree-caret" /> : <ChevronDown size={13} className="pscan-tree-caret" />) : <span className="pscan-tree-caret" style={{ width: 13 }} />}
          <span className={`pscan-tree-type pscan-tree-type-${asset.type}`}>{asset.type}</span>
          <span className="pscan-tree-value">{asset.value}</span>
          <span className="pscan-tree-meta">{asset.scope.replaceAll("_", " ")} · {asset.confidence}</span>
        </div>
        {hasKids && !isCollapsed ? (
          <div>
            {kids.map((kid, index) => renderNode(kid, depth + 1, index === kids.length - 1, `${prefix}${isLast ? "    " : "│   "}`, nextAncestors, nextSeen, counter))}
          </div>
        ) : null}
      </div>
    );
  };

  const root = rootId ? byId.get(rootId) : undefined;
  return (
    <div className="pscan-console" style={{ overflow: "hidden" }}>
      <div className="pscan-tree">{root ? renderNode(root, 0, true, "", new Set(), new Set(), { value: 0 }) : <div className="pscan-empty">No tree available.</div>}</div>
      <p className="pscan-hint" style={{ padding: "10px 16px", borderTop: "1px solid var(--ps-line)", margin: 0 }}>
        Click a node to collapse / expand its subtree.
      </p>
    </div>
  );
}

export function AssetsView({ assets }: { assets: SurfaceAsset[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (typeFilter !== "all" && asset.type !== typeFilter) return false;
      if (priorityFilter !== "all" && asset.priority !== priorityFilter) return false;
      if (needle && !`${asset.value} ${asset.sources.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [assets, query, typeFilter, priorityFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      <div className="pscan-filter-row">
        <div className="pscan-search">
          <Search size={15} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Filter assets, sources…" />
        </div>
        <select className="pscan-select" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(0); }}>
          <option value="all">All types</option>
          {Object.keys(TYPE_LABELS).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
        </select>
        <select className="pscan-select" value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(0); }}>
          <option value="all">All priorities</option>
          <option value="high">🔥 High priority</option>
          <option value="review">⚠️ Review</option>
          <option value="historical">🕐 Historical</option>
          <option value="informational">ℹ️ Informational</option>
        </select>
        <span className="pscan-filter-count">{filtered.length} of {assets.length}</span>
      </div>
      <div className="pscan-console" style={{ overflow: "hidden" }}>
        <table className="pscan-table">
          <thead>
            <tr><th>Asset</th><th>Type</th><th>Scope</th><th>Confidence</th><th>Sources</th><th>Priority</th><th>Score</th></tr>
          </thead>
          <tbody>
            {visible.map((asset) => {
              const scope = SCOPE_LABELS[asset.scope] ?? SCOPE_LABELS.unknown;
              const conf = CONFIDENCE_LABELS[asset.confidence] ?? CONFIDENCE_LABELS.medium;
              return (
                <tr key={asset.id}>
                  <td className="mono">{asset.value}</td>
                  <td>{TYPE_LABELS[asset.type] ?? asset.type}</td>
                  <td><span className="pscan-dot" style={{ background: scope.dot }} />{scope.label}</td>
                  <td><span className="pscan-dot" style={{ background: conf.dot }} />{conf.label}</td>
                  <td className="pscan-cell-muted">{asset.sources.join(", ") || "—"}</td>
                  <td>{asset.priority}</td>
                  <td className="mono">{asset.score}</td>
                </tr>
              );
            })}
            {visible.length === 0 ? <tr><td colSpan={7} className="pscan-empty-cell">No assets match the current filters.</td></tr> : null}
          </tbody>
        </table>
        <div className="pscan-pager">
          <button type="button" className="pscan-btn-ghost" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" className="pscan-btn-ghost" disabled={page >= pages - 1} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}

export function TimelineView({ timeline, assets }: { timeline: SurfaceScanResult["timeline"]; assets: SurfaceAsset[] }) {
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const grouped = useMemo(() => {
    const years = new Map<string, typeof timeline>();
    for (const entry of timeline) {
      const year = entry.date.slice(0, 4) || "unknown";
      if (!years.has(year)) years.set(year, []);
      years.get(year)!.push(entry);
    }
    return Array.from(years.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [timeline]);

  return (
    <div>
      <div className="pscan-section-head">
        <h2 className="pscan-section-title">How the surface changed</h2>
        <span className="pscan-section-meta">{timeline.length} observations</span>
      </div>
      {grouped.length === 0 ? <div className="pscan-empty">No timeline observations yet.</div> : grouped.map(([year, entries]) => (
        <div className="pscan-timeline-year" key={year}>
          <div className="pscan-timeline-year-label">{year}</div>
          <div className="pscan-timeline-list">
            {entries.slice(0, 120).map((entry, index) => {
              const asset = byId.get(entry.asset);
              return (
                <div className="pscan-timeline-entry" key={`${entry.asset}-${entry.date}-${index}`}>
                  <span className="pscan-timeline-date">{entry.date}</span>
                  <span className="pscan-timeline-event">{entry.event}</span>
                  <span className="pscan-timeline-asset">{asset ? asset.value : entry.asset}</span>
                  <span className="pscan-timeline-source">{entry.source}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelationshipsView({ assets, relationships, rootValue }: { assets: SurfaceAsset[]; relationships: SurfaceRelationship[]; rootValue: string }) {
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const [selectedId, setSelectedId] = useState<string>(() => {
    const domain = assets.find((asset) => asset.type === "domain" && asset.value === rootValue);
    return (domain ?? assets[0])?.id ?? "";
  });
  const [query, setQuery] = useState("");

  const selected = selectedId ? byId.get(selectedId) : undefined;

  const interesting = useMemo(() => assets.filter((asset) => ["subdomain", "domain", "ip", "certificate", "repository", "cloud_provider"].includes(asset.type)).sort((a, b) => b.score - a.score), [assets]);
  const filteredInteresting = interesting.filter((asset) => !query || asset.value.toLowerCase().includes(query.toLowerCase())).slice(0, 120);

  const related = useMemo(() => {
    if (!selected) return [];
    return relationships.filter((rel) => rel.source === selected.id || rel.target === selected.id);
  }, [relationships, selected]);

  return (
    <div className="pscan-rel-grid">
      <div className="pscan-rel-picker">
        <div className="pscan-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an asset…" />
        </div>
        <div className="pscan-rel-list">
          {filteredInteresting.map((asset) => (
            <button
              type="button"
              key={asset.id}
              className={`pscan-rel-item${selected?.id === asset.id ? " is-active" : ""}`}
              onClick={() => setSelectedId(asset.id)}
            >
              <span className={`pscan-rel-type pscan-tree-type-${asset.type}`}>{asset.type}</span>
              <span className="pscan-rel-value">{asset.value}</span>
              <span className="pscan-rel-score">{asset.score}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="pscan-rel-detail">
        {!selected ? (
          <div className="pscan-empty">Select an asset to inspect its relationships.</div>
        ) : (
          <>
            <div className="pscan-rel-head">
              <div>
                <div className="pscan-rel-name">{selected.value}</div>
                <div className="pscan-rel-sub">
                  {TYPE_LABELS[selected.type] ?? selected.type} · <span className="pscan-dot" style={{ background: (SCOPE_LABELS[selected.scope] ?? SCOPE_LABELS.unknown).dot }} />{(SCOPE_LABELS[selected.scope] ?? SCOPE_LABELS.unknown).label} · confidence {(CONFIDENCE_LABELS[selected.confidence] ?? CONFIDENCE_LABELS.medium).label}
                </div>
              </div>
              <div className="pscan-rel-score-big">score {selected.score}</div>
            </div>
            {selected.evidence.length ? (
              <div className="pscan-section-head" style={{ marginTop: 18 }}>
                <h3 className="pscan-section-title">Why is this connected?</h3>
              </div>
            ) : null}
            <div className="pscan-evidence-list">
              {selected.evidence.map((item, index) => (
                <div className="pscan-evidence-item" key={`${item.source}-${index}`}>
                  <span className="pscan-evidence-src">{item.source}</span>
                  <span className="pscan-evidence-detail">{item.detail}</span>
                  <span className="pscan-evidence-date">{item.observedAt?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
            <div className="pscan-section-head" style={{ marginTop: 18 }}>
              <h3 className="pscan-section-title">Relationships ({related.length})</h3>
            </div>
            <div className="pscan-rel-edges">
              {related.length === 0 ? <div className="pscan-empty">No direct relationships.</div> : related.map((rel, index) => {
                const otherId = rel.source === selected.id ? rel.target : rel.source;
                const other = byId.get(otherId);
                const direction = rel.source === selected.id ? "→" : "←";
                return (
                  <div className="pscan-rel-edge" key={`${rel.source}-${rel.target}-${rel.type}-${index}`}>
                    <span className="pscan-rel-edge-type">{rel.type}</span>
                    <span className="pscan-rel-edge-dir">{direction}</span>
                    <span className="pscan-rel-edge-target">{other ? other.value : otherId}</span>
                    <span className="pscan-rel-edge-conf">{(CONFIDENCE_LABELS[rel.confidence] ?? CONFIDENCE_LABELS.medium).label}</span>
                    <span className="pscan-rel-edge-src">via {rel.sources.join(", ")}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SourcesView({ result }: { result: SurfaceScanResult }) {
  const entries = Object.entries(result.sourceCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="pscan-section-head">
        <h2 className="pscan-section-title">Sources & evidence</h2>
        <span className="pscan-section-meta">every relationship keeps its provenance</span>
      </div>
      <div className="pscan-source-grid">
        {entries.map(([source, count]) => (
          <div className="pscan-source" key={source}>
            <Database size={15} />
            <span className="pscan-source-name">{source}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="pscan-section-head" style={{ marginTop: 26 }}>
        <h3 className="pscan-section-title">Findings from passive checks</h3>
      </div>
      <div className="pscan-sev-chips">
        {(["critical", "high", "medium", "low", "informational"] as const).map((sev) => (
          <span className={`pscan-chip ${sev}`} key={sev}>{sev}: {result.summary.findingCounts[sev] ?? 0}</span>
        ))}
      </div>
      {result.findings.map((finding) => (
        <div className="pscan-finding" style={{ marginTop: 10 }} key={finding.id}>
          <div className="pscan-finding-head">
            <ShieldAlert size={15} style={{ color: "var(--ps-amber)" }} />
            <span className="pscan-finding-title">{finding.title}</span>
            <span className={`pscan-chip ${finding.severity}`} style={{ fontSize: 9 }}>{finding.severity}</span>
          </div>
          <div className="pscan-finding-body" style={{ display: "block", padding: "0 16px 14px" }}>
            <p className="pscan-finding-desc">{finding.description}</p>
            {finding.evidence ? <div className="pscan-evidence"><div className="pscan-evidence-label">evidence</div>{finding.evidence}</div> : null}
          </div>
        </div>
      ))}
      <div className="pscan-section-head" style={{ marginTop: 26 }}>
        <h3 className="pscan-section-title">Control checks</h3>
      </div>
      <div className="pscan-checks">
        {result.checks.map((check) => (
          <div className={`pscan-check ${check.status}`} key={`${check.category}-${check.name}`}>
            <span className="st" />
            <span className="nm">{check.name}</span>
            <span className="cat">{check.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function typeBadge(type: string): string {
  return TYPE_LABELS[type] ?? type;
}