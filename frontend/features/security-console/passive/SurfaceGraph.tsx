"use client";

import { useMemo, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { SurfaceAsset, SurfaceRelationship } from "@/types/pan";

const NODE_COLORS: Record<string, string> = {
  organization: "#b39dff",
  domain: "#38bdf8",
  subdomain: "#22ffb0",
  ip: "#ffb020",
  certificate: "#ff5470",
  url: "#8b9aa8",
  repository: "#ff9f43",
  technology: "#2dd4bf",
  cloud_provider: "#c084fc",
  documentation: "#f472b6",
};

const MAX_DISPLAYED = 260;
const MAX_DEPTH = 6;
const MAX_CHILDREN = 16;
const NODE_R = 24;
const LEVEL_H = 96;
const COL_W = 132;

interface TNode {
  id: string;
  depth: number;
  x: number;
  y: number;
  children: TNode[];
  hasMore: boolean;
}

const TYPE_PRIORITY: Record<string, number> = {
  subdomain: 0,
  domain: 0,
  ip: 1,
  certificate: 1,
  cloud_provider: 2,
  technology: 2,
  repository: 2,
  documentation: 3,
  url: 4,
  organization: 5,
};

function buildTree(rootId: string, assets: SurfaceAsset[], relationships: SurfaceRelationship[], expanded: Set<string>): TNode {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const count = { value: 0 };
  const path = new Set<string>([rootId]);
  const rendered = new Set<string>([rootId]);

  function rank(id: string): number {
    const asset = byId.get(id);
    if (!asset) return 99;
    return (TYPE_PRIORITY[asset.type] ?? 3) * 1000 - asset.score;
  }

  function visit(id: string, depth: number): TNode {
    count.value += 1;
    const children: TNode[] = [];
    let hasMore = false;
    if (expanded.has(id) && depth < MAX_DEPTH && count.value < MAX_DISPLAYED) {
      const candidateIds: string[] = [];
      for (const rel of relationships) {
        const other = rel.source === id ? rel.target : rel.target === id ? rel.source : null;
        if (!other || other === id || path.has(other) || rendered.has(other)) continue;
        candidateIds.push(other);
      }
      candidateIds.sort((a, b) => rank(a) - rank(b));
      const picked = candidateIds.slice(0, MAX_CHILDREN);
      hasMore = candidateIds.length > picked.length;
      for (const other of picked) {
        if (count.value >= MAX_DISPLAYED) {
          hasMore = true;
          break;
        }
        path.add(other);
        rendered.add(other);
        children.push(visit(other, depth + 1));
        path.delete(other);
      }
    }
    return { id, depth, x: 0, y: 0, children, hasMore };
  }

  const tree = visit(rootId, 0);
  const leafIndex = { value: 0 };
  function layout(node: TNode): void {
    if (node.children.length === 0) {
      node.x = leafIndex.value * COL_W;
      leafIndex.value += 1;
    } else {
      for (const child of node.children) layout(child);
      node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
    }
    node.y = node.depth * LEVEL_H;
  }
  layout(tree);
  return tree;
}

function collectNodes(root: TNode, out: TNode[] = []): TNode[] {
  out.push(root);
  for (const child of root.children) collectNodes(child, out);
  return out;
}

function collectEdges(root: TNode, out: Array<{ from: TNode; to: TNode }> = []): Array<{ from: TNode; to: TNode }> {
  for (const child of root.children) {
    out.push({ from: root, to: child });
    collectEdges(child, out);
  }
  return out;
}

function shortLabel(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 17)}…`;
}

function friendlyType(type: string): string {
  return type.replaceAll("_", " ");
}

export function SurfaceGraph({
  assets,
  relationships,
  rootValue,
}: {
  assets: SurfaceAsset[];
  relationships: SurfaceRelationship[];
  rootValue: string;
}) {
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const rootId = useMemo(() => {
    const domain = assets.find((asset) => asset.type === "domain" && asset.value === rootValue);
    if (domain) return domain.id;
    const organization = assets.find((asset) => asset.type === "organization");
    if (organization) return organization.id;
    return assets[0]?.id ?? "";
  }, [assets, rootValue]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootId]));
  const [zoom, setZoom] = useState(0.9);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tree = useMemo(() => {
    if (!rootId) return null;
    return buildTree(rootId, assets, relationships, expanded);
  }, [rootId, assets, relationships, expanded]);

  if (!tree) return <div className="pscan-empty">No graph available.</div>;

  const nodes = collectNodes(tree);
  const edges = collectEdges(tree);
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(520, (maxX - minX + COL_W) * zoom + 220);
  const height = Math.max(320, (maxY + LEVEL_H) * zoom + 140);
  const offsetX = width / 2 - ((minX + maxX) / 2) * zoom;
  const offsetY = 40;

  return (
    <div className="pscan-graph">
      <div className="pscan-graph-toolbar">
        <span className="pscan-graph-hint">
          Click a node to expand / collapse its connections · graph pivots follow every relationship
        </span>
        <div className="pscan-graph-zoom">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.4, value - 0.15))}><Minus size={15} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2, value + 0.15))}><Plus size={15} /></button>
          <button type="button" aria-label="Reset view" onClick={() => setZoom(0.9)}><Maximize2 size={15} /></button>
        </div>
      </div>
      <div className="pscan-graph-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Attack surface graph">
          <g transform={`translate(${offsetX} ${offsetY})`}>
            {edges.map((edge, index) => {
              const sx = edge.from.x * zoom;
              const sy = edge.from.y * zoom + NODE_R;
              const tx = edge.to.x * zoom;
              const ty = edge.to.y * zoom - NODE_R;
              const midY = (sy + ty) / 2;
              return (
                <path
                  key={`${edge.from.id}-${edge.to.id}-${index}`}
                  d={`M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
                  fill="none"
                  stroke="rgba(125, 211, 252, 0.22)"
                  strokeWidth={1}
                />
              );
            })}
            {nodes.map((node) => {
              const asset = byId.get(node.id);
              if (!asset) return null;
              const color = NODE_COLORS[asset.type] ?? "#7d8a94";
              const cx = node.x * zoom;
              const cy = node.y * zoom;
              const isOpen = expanded.has(node.id);
              return (
                <g key={node.id} className="pscan-graph-node" onClick={() => toggle(node.id)} role="button" tabIndex={0} aria-label={`${friendlyType(asset.type)} ${asset.value}`} onKeyDown={(event) => { if (event.key === "Enter") toggle(node.id); }}>
                  <circle cx={cx} cy={cy} r={NODE_R} fill={color} opacity={0.16} stroke={color} strokeWidth={1.6} />
                  {node.children.length ? (
                    <circle cx={cx} cy={cy} r={NODE_R + 5} fill="none" stroke="rgba(233, 242, 227, 0.18)" strokeWidth={1} strokeDasharray="3 3" />
                  ) : null}
                  {node.hasMore ? (
                    <circle cx={cx + NODE_R - 4} cy={cy - NODE_R + 4} r={7} fill={color} stroke="#05070d" strokeWidth={1.5}>
                      <title>More connections — expand this node</title>
                    </circle>
                  ) : null}
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#e6f1f7">
                    {asset.type === "organization" ? asset.value.slice(0, 2).toUpperCase() : String(asset.score)}
                  </text>
                  <text x={cx} y={cy + NODE_R + 16} textAnchor="middle" fontSize={10.5} fill="#aebac4">
                    {shortLabel(asset.value)}
                  </text>
                  <text x={cx} y={cy + NODE_R + 30} textAnchor="middle" fontSize={8} fill="#5c6a76" letterSpacing={1}>
                    {friendlyType(asset.type).toUpperCase()}
                  </text>
                  <title>{`${friendlyType(asset.type)} · ${asset.value}\nscope: ${asset.scope} · confidence: ${asset.confidence}\nsources: ${asset.sources.join(", ") || "—"}\nscore: ${asset.score}\nclick to ${isOpen ? "collapse" : "expand"}`}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="pscan-graph-legend">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type}><i style={{ background: color }} />{friendlyType(type)}</span>
        ))}
      </div>
    </div>
  );
}