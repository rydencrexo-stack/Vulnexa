"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  Cloud,
  Cpu,
  Database,
  Globe,
  Globe2,
  Layers,
  MapPin,
  Network,
  Plus,
  Search,
  Server,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { AppPage } from "@/components/pan/AppPage";
import { CompanyLogo } from "@/components/pan/CompanyLogo";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { addCustomAsset, getCompany, getCustomAssets, getTopology, MAP_SIZE } from "@/services/company-data";
import type { Company, TopologyKind, TopologyNode } from "@/types/pan";

const KIND_META: Record<TopologyKind, { label: string; color: string; icon: LucideIcon; width: number }> = {
  internet: { label: "Internet", color: "#b9ff2d", icon: Globe, width: 96 },
  domain: { label: "Domain", color: "#4cc9f0", icon: Globe2, width: 128 },
  web: { label: "Web server", color: "#7ee787", icon: Globe, width: 124 },
  api: { label: "API service", color: "#b388ff", icon: Braces, width: 124 },
  waf: { label: "WAF", color: "#ffb020", icon: ShieldCheck, width: 112 },
  server: { label: "Server", color: "#5ec4ff", icon: Server, width: 124 },
  database: { label: "Database", color: "#ff7ad9", icon: Database, width: 124 },
  router: { label: "Router / LB", color: "#ff9f43", icon: Network, width: 128 },
  device: { label: "Device", color: "#a9bac7", icon: Cpu, width: 118 },
  cloud: { label: "Cloud", color: "#63e6be", icon: Cloud, width: 118 },
  vuln: { label: "Vulnerability", color: "#ff6b6b", icon: AlertTriangle, width: 124 },
};

const KIND_ORDER: TopologyKind[] = [
  "internet",
  "domain",
  "web",
  "api",
  "waf",
  "server",
  "database",
  "router",
  "device",
  "cloud",
  "vuln",
];

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function AssetMapView({ companySlug }: { companySlug: string }) {
  const company = getCompany(companySlug);
  if (!company) return null;
  return <AssetMapInner company={company} />;
}

function AssetMapInner({ company }: { company: Company }) {
  const { toast } = useToast();
  const topology = getTopology(company.slug);
  const [custom, setCustom] = useState<TopologyNode[]>(() => getCustomAssets(company.slug));
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hiddenKinds, setHiddenKinds] = useState<Set<TopologyKind>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const positionedCustom = useMemo(
    () => custom.map((node, index) => ({ ...node, x: 70 + index * 148, y: 598 })),
    [custom],
  );

  const nodes = useMemo(() => [...topology.nodes, ...positionedCustom], [topology.nodes, positionedCustom]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((node) => {
      if (hiddenKinds.has(node.kind)) return false;
      if (!q) return true;
      return `${node.label} ${node.ip ?? ""} ${(node.services ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [nodes, hiddenKinds, query]);

  const visibleIds = useMemo(() => new Set(filtered.map((node) => node.id)), [filtered]);
  const links = useMemo(
    () => topology.links.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to)),
    [topology.links, visibleIds],
  );

  const selectedNode = nodes.find((node) => node.id === selected) ?? null;

  function toggleKind(kind: TopologyKind) {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function handleAdd(input: Omit<TopologyNode, "id" | "x" | "y">) {
    const node: TopologyNode = {
      ...input,
      id: `custom_${Date.now()}`,
      x: 0,
      y: 0,
    };
    const next = addCustomAsset(company.slug, node);
    setCustom(next);
    setAddOpen(false);
    toast({ tone: "success", title: "Asset mapped", description: `${node.label} added to the ${company.name} topology.` });
  }

  return (
    <AppPage
      eyebrow="Assets · Company map"
      title={company.name}
      description={`${company.tagline} — interactive network topology with asset chains and mapping.`}
      actions={
        <>
          <Link className="pan-button pan-button-secondary" href="/assets/all"><ArrowLeft size={15} />Companies</Link>
          <button className="pan-button pan-button-primary" onClick={() => setAddOpen(true)}><Plus size={16} />Add asset</button>
        </>
      }
    >
      <div className="pan-map-head">
        <div className="pan-map-head-title">
          <CompanyLogo company={company} size={42} />
          <div className="min-w-0">
            <p className="pan-map-head-name">{company.name}</p>
            <p className="pan-map-head-meta">{company.industry} · {company.location} · <span className="pan-table-mono">{company.domain}</span></p>
          </div>
        </div>
        <div className="pan-map-controls">
          <div className="pan-toolbar-search"><Search size={15} /><input className="pan-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search assets…" value={query} /></div>
          <button className="pan-icon-button pan-icon-button-border" onClick={() => setZoom((value) => Math.max(0.6, value - 0.15))} aria-label="Zoom out"><ZoomOut size={16} /></button>
          <button className="pan-icon-button pan-icon-button-border" onClick={() => setZoom((value) => Math.min(1.6, value + 0.15))} aria-label="Zoom in"><ZoomIn size={16} /></button>
        </div>
      </div>

      <div className="pan-map-layout">
        <aside className="pan-map-legend">
          <div className="pan-map-legend-head"><Layers size={14} /><span>Asset types</span><span className="pan-map-counts"><span><span className="pan-count-dot pan-dot-teal" />{nodes.length} assets</span><span><span className="pan-count-dot pan-dot-red" />{nodes.filter((node) => node.kind === "vuln").length} vulns</span></span></div>
          <div className="pan-map-legend-list">
            {KIND_ORDER.map((kind) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              const hidden = hiddenKinds.has(kind);
              return (
                <button aria-pressed={!hidden} className="pan-map-kind" key={kind} onClick={() => toggleKind(kind)} title={hidden ? "Show" : "Hide"}>
                  <span className="pan-map-kind-swatch" style={{ background: meta.color }} />
                  <Icon size={14} style={{ color: hidden ? "#5b6d7e" : meta.color }} />
                  <span>{meta.label}</span>
                  <input readOnly type="checkbox" checked={!hidden} />
                </button>
              );
            })}
          </div>
        </aside>

        <div className="pan-map-canvas-wrap">
          <div className="pan-map-canvas" style={{ "--map-accent": company.color } as CSSProperties}>
            <svg aria-label={`${company.name} network topology`} height={MAP_SIZE.height} role="img" viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} width={MAP_SIZE.width}>
              <g transform={`translate(${((1 - zoom) * MAP_SIZE.width) / 2} ${((1 - zoom) * MAP_SIZE.height) / 2}) scale(${zoom})`}>
                <defs>
                  <filter id="pan-vuln-glow"><feGaussianBlur result="blur" stdDeviation="6" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <marker id="pan-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#2c4056" />
                  </marker>
                </defs>

                {links.map((link, index) => {
                  const from = nodes.find((node) => node.id === link.from);
                  const to = nodes.find((node) => node.id === link.to);
                  if (!from || !to) return null;
                  const fx = from.x + KIND_META[from.kind].width / 2;
                  const fy = from.y + 22;
                  const tx = to.x + KIND_META[to.kind].width / 2;
                  const ty = to.y + 22;
                  const bend = from.kind === "vuln" || to.kind === "vuln" ? 0 : 0.18;
                  const mx = (fx + tx) / 2 + (ty - fy) * bend;
                  const my = (fy + ty) / 2 - (tx - fx) * bend;
                  const path = `M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`;
                  const isVuln = from.kind === "vuln" || to.kind === "vuln";
                  return (
                    <g key={`${link.from}-${link.to}-${index}`}>
                      <path className={isVuln ? "pan-map-link is-vuln" : "pan-map-link"} d={path} markerEnd="url(#pan-arrow)" />
                      {link.label ? (
                        <g className="pan-map-link-label"><text dy="-4" textAnchor="middle" x={(fx + tx) / 2}>{link.label}</text></g>
                      ) : null}
                    </g>
                  );
                })}

                {filtered.map((node) => {
                  const meta = KIND_META[node.kind];
                  const isSelected = selected === node.id;
                  return (
                    <g className={`pan-map-node-group${isSelected ? " is-selected" : ""}`} key={node.id} transform={`translate(${node.x},${node.y})`}>
                      <foreignObject height="44" width={meta.width}>
                        <div
                          className={`pan-map-node${node.kind === "vuln" ? " is-vuln" : ""}`}
                          onClick={() => setSelected(node.id)}
                          style={{ borderColor: meta.color, background: isSelected ? `${meta.color}22` : undefined }}
                        >
                          <span className="pan-map-node-icon" style={{ color: meta.color, background: `${meta.color}1c` }}>
                            <meta.icon size={15} />
                          </span>
                          <span className="pan-map-node-text">
                            <strong>{truncate(node.label, 15)}</strong>
                            <small>{node.ip ? truncate(node.ip, 14) : meta.label}</small>
                          </span>
                          {node.risk ? <em className={`pan-map-risk pan-risk-${node.risk}`} /> : null}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="pan-map-canvas-hint">Select a node to inspect it · use the zoom controls to focus a chain</div>
        </div>

        <aside className="pan-map-panel">
          <div className="pan-map-panel-head"><MapPin size={14} /><span>Selected asset</span></div>
          {selectedNode ? (
            <div className="pan-map-inspector">
              <div className="pan-map-inspector-top">
                <span className="pan-map-kind-swatch pan-map-kind-swatch-lg" style={{ background: KIND_META[selectedNode.kind].color }} />
                <div className="min-w-0">
                  <strong>{selectedNode.label}</strong>
                  <StatusBadge value={KIND_META[selectedNode.kind].label} />
                </div>
              </div>
              <dl className="pan-detail-list">
                {selectedNode.ip ? <div className="pan-detail-row"><dt>IP address</dt><dd className="pan-table-mono">{selectedNode.ip}</dd></div> : null}
                {selectedNode.port ? <div className="pan-detail-row"><dt>Port</dt><dd className="pan-table-mono">{selectedNode.port}</dd></div> : null}
                {selectedNode.services?.length ? <div className="pan-detail-row"><dt>Services</dt><dd><div className="pan-tag-list">{selectedNode.services.map((service) => <span key={service}>{service}</span>)}</div></dd></div> : null}
                {selectedNode.tech?.length ? <div className="pan-detail-row"><dt>Technology</dt><dd><div className="pan-tag-list">{selectedNode.tech.map((tech) => <span key={tech}>{tech}</span>)}</div></dd></div> : null}
                {selectedNode.risk ? <div className="pan-detail-row"><dt>Risk</dt><dd><StatusBadge value={selectedNode.risk} /></dd></div> : null}
                {selectedNode.note ? <div className="pan-detail-row"><dt>Note</dt><dd>{selectedNode.note}</dd></div> : null}
              </dl>
              <div className="pan-map-inspector-actions">
                <button className="pan-button pan-button-ghost pan-button-sm" onClick={() => setSelected(null)}><X size={14} />Deselect</button>
              </div>
            </div>
          ) : (
            <div className="pan-map-inspector-empty">
              <Cpu size={22} />
              <strong>No asset selected</strong>
              <span>Click any node on the map to see its details, services, and risk.</span>
            </div>
          )}

          <div className="pan-map-panel-head"><Network size={14} /><span>All assets ({nodes.length})</span></div>
          <div className="pan-map-node-list">
            {nodes.map((node) => (
              <button className={selected === node.id ? "is-selected" : ""} key={node.id} onClick={() => setSelected(node.id)}>
                <span className="pan-map-kind-swatch" style={{ background: KIND_META[node.kind].color }} />
                <span className="min-w-0"><strong>{node.label}</strong><small>{node.kind === "vuln" ? KIND_META[node.kind].label : node.ip}</small></span>
                {node.risk ? <em className={`pan-map-risk pan-risk-${node.risk}`} /> : null}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {addOpen ? <AddAssetModal company={company} onClose={() => setAddOpen(false)} onAdd={handleAdd} /> : null}
    </AppPage>
  );
}

function AddAssetModal({ company, onAdd, onClose }: { company: Company; onAdd: (input: Omit<TopologyNode, "id" | "x" | "y">) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TopologyKind>("server");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [services, setServices] = useState("");
  const [risk, setRisk] = useState<TopologyNode["risk"]>(undefined);
  const [note, setNote] = useState("");

  function submit() {
    if (!label.trim()) return;
    onAdd({
      label: label.trim(),
      kind,
      ip: ip.trim() || undefined,
      port: port ? Number(port) : undefined,
      services: services.split(",").map((item) => item.trim()).filter(Boolean),
      risk,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="pan-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div aria-label="Add asset" aria-modal="true" className="pan-modal" role="dialog">
        <header className="pan-modal-head">
          <div>
            <h3>Add asset to map</h3>
            <p>Map a new node into the {company.name} topology. It is stored locally in this browser session.</p>
          </div>
          <button aria-label="Close" className="pan-icon-button" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="pan-form-grid">
          <div className="pan-field"><label>Asset name / host</label><input autoFocus className="pan-input" onChange={(event) => setLabel(event.target.value)} placeholder="e.g. payments-02" value={label} /></div>
          <div className="pan-field"><label>Type</label><select className="pan-select" onChange={(event) => setKind(event.target.value as TopologyKind)} value={kind}>{KIND_ORDER.filter((item) => item !== "internet").map((item) => <option key={item} value={item}>{KIND_META[item].label}</option>)}</select></div>
          <div className="pan-field"><label>IP address</label><input className="pan-input pan-table-mono" onChange={(event) => setIp(event.target.value)} placeholder="10.0.0.0" value={ip} /></div>
          <div className="pan-field"><label>Port</label><input className="pan-input" onChange={(event) => setPort(event.target.value)} placeholder="443" type="number" value={port} /></div>
          <div className="pan-field"><label>Services (comma separated)</label><input className="pan-input pan-table-mono" onChange={(event) => setServices(event.target.value)} placeholder="443/tcp, 22/tcp" value={services} /></div>
          <div className="pan-field"><label>Risk</label><select className="pan-select" onChange={(event) => setRisk((event.target.value || undefined) as TopologyNode["risk"])} value={risk ?? ""}><option value="">None</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          <div className="pan-field pan-field-full"><label>Note</label><textarea className="pan-textarea" onChange={(event) => setNote(event.target.value)} placeholder="Optional context for this asset…" value={note} /></div>
        </div>
        <footer className="pan-form-actions">
          <button className="pan-button pan-button-ghost" onClick={onClose}>Cancel</button>
          <button className="pan-button pan-button-primary" disabled={!label.trim()} onClick={submit}><Plus size={16} />Map asset</button>
        </footer>
      </div>
    </div>
  );
}

export default AssetMapView;