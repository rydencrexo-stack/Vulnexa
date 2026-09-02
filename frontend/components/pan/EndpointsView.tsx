"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Fingerprint,
  Globe2,
  History,
  KeyRound,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { DataTable, type DataTableColumn } from "@/components/pan/DataTable";
import { LoadingState } from "@/components/pan/LoadingState";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate } from "@/lib/utils";
import { panService } from "@/services/pan-service";
import type { Endpoint } from "@/types/pan";

const endpointViews = [
  { id: "all", label: "All endpoints", icon: Braces },
  { id: "web", label: "Web", icon: Globe2 },
  { id: "api", label: "API", icon: Braces },
  { id: "javascript", label: "JavaScript", icon: FileCode2 },
  { id: "historical", label: "Historical", icon: History },
];

const wanderPaths = ["/api/v1/users", "/api/v1/orders", "/api/v1/products", "/api/v1/auth/login", "/api/v1/search", "/api/v1/profile", "/api/v1/payments", "/graphql", "/admin", "/dashboard", "/account/reset", "/checkout", "/download", "/export", "/status", "/health", "/docs/swagger", "/v2/orders", "/callback", "/webhook", "/sitemap.xml", "/api/v1/cart", "/login", "/register", "/blog", "/api/v1/inventory"];
const wanderMethods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

const fakeWanderEndpoints: Endpoint[] = Array.from({ length: 26 }, (_, i) => {
  const method = wanderMethods[i % wanderMethods.length] as Endpoint["method"];
  const path = wanderPaths[i % wanderPaths.length];
  return {
    id: `wander_ep_${1000 + i}`,
    targetId: "target_wander",
    targetName: "wander.com",
    assetId: "asset_wander",
    url: `https://wander.com${path}`,
    path,
    method,
    contentType: method === "GET" ? "text/html" : "application/json",
    parameters: method === "GET" ? [] : [{ name: ["id", "q", "token", "limit", "page", "email"][i % 6], location: "query", type: "string", required: i % 3 === 0 }],
    authenticationRequired: i % 2 === 0,
    observedRole: i % 2 === 0 ? "customer" : "public",
    discoverySource: "Wayback CDX",
    statusCode: method === "POST" ? 201 : 200,
    fingerprint: `sha256:${(i * 2654435761).toString(16).slice(0, 12)}…`,
    testsCompleted: i % 5,
    relatedFindings: i % 4,
    firstSeen: "2026-08-20T10:00:00Z",
    lastSeen: "2026-08-30T11:00:00Z",
    kind: path.startsWith("/api") || path === "/graphql" ? "api" : i % 3 === 0 ? "javascript" : "web",
  };
});

const columns: DataTableColumn<Endpoint>[] = [
  {
    key: "endpoint",
    header: "Endpoint",
    sortable: true,
    value: (row) => row.path,
    render: (row) => <div><span className="pan-table-primary"><span className="pan-table-mono">{row.method}</span> {row.path}</span><span className="pan-table-secondary">{row.targetName}</span></div>,
  },
  { key: "kind", header: "Type", sortable: true, value: (row) => row.kind, render: (row) => <StatusBadge value={row.kind} dot={false} /> },
  { key: "status", header: "HTTP", sortable: true, value: (row) => row.statusCode, render: (row) => <StatusBadge value={row.statusCode < 400 ? "live" : "warning"} label={row.statusCode ? String(row.statusCode) : "—"} /> },
  { key: "parameters", header: "Parameters", sortable: true, value: (row) => row.parameters.length },
  { key: "auth", header: "Authentication", value: (row) => row.authenticationRequired, render: (row) => <StatusBadge value={row.authenticationRequired ? "required" : "public"} tone={row.authenticationRequired ? "purple" : "neutral"} dot={false} /> },
  { key: "tests", header: "Tests", sortable: true, value: (row) => row.testsCompleted, render: (row) => `${row.testsCompleted} complete` },
  { key: "findings", header: "Findings", sortable: true, value: (row) => row.relatedFindings },
];

export function EndpointsView({ segments }: { segments: string[] }) {
  const route = segments[0] ?? "all";
  if (endpointViews.some((item) => item.id === route)) return <EndpointList view={route} />;
  return <EndpointDetail endpointId={route} />;
}

function EndpointList({ view }: { view: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [auth, setAuth] = useState("all");
  const { data, loading } = useAsyncData(() => panService.getEndpoints());
  const all = useMemo(() => [...fakeWanderEndpoints, ...(data ?? [])], [data]);
  const filtered = useMemo(() => all.filter((endpoint) => {
    const matchesView = view === "all" || endpoint.kind === view;
    const matchesMethod = method === "all" || endpoint.method === method;
    const matchesAuth = auth === "all" || String(endpoint.authenticationRequired) === auth;
    const haystack = `${endpoint.method} ${endpoint.path} ${endpoint.url} ${endpoint.targetName} ${endpoint.parameters.map((item) => item.name).join(" ")}`.toLowerCase();
    return matchesView && matchesMethod && matchesAuth && haystack.includes(query.toLowerCase());
  }), [auth, data, method, query, view]);

  const methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

  // Burp-style Repeater
  const [rep, setRep] = useState<{ method: string; url: string; body: string }>({ method: "GET", url: "", body: "" });
  const [resp, setResp] = useState<{ status: number; headers: Array<[string, string]>; body: string } | null>(null);
  function sendRepeater() {
    const status = rep.method === "POST" ? 201 : rep.method === "PATCH" ? 200 : rep.method === "DELETE" ? 204 : 200;
    setResp({
      status,
      headers: [["Content-Type", rep.method === "GET" ? "text/html" : "application/json"], ["Server", "nginx/1.24"], ["X-Request-Id", `req_${Date.now()}`]],
      body: rep.method === "GET"
        ? `<!doctype html><html><body><h1>Example Domain</h1><p>Response for ${rep.url || "target"}.</p></body></html>`
        : `{ "ok": true, "method": "${rep.method}", "echo": "${rep.body.slice(0, 80) || "(empty body)"}" }`,
    });
  }

  return <AppPage eyebrow="Attack surface · Request inventory" title="Discovered endpoints" description="Review normalized web, API, JavaScript, and historical routes observed inside verified target scope.">
    <nav aria-label="Endpoint views" className="pan-tabs">{endpointViews.map((item) => { const Icon = item.icon; return <Link className={view === item.id ? "pan-tab pan-tab-active" : "pan-tab"} href={`/endpoints/${item.id}`} key={item.id}><Icon size={14} />{item.label}</Link>; })}</nav>
    <div className="pan-kpi-row" style={{ marginBlock: 16 }}>
      <MetricCard icon={Braces} label="Endpoints" value={all.length} detail="normalized routes" />
      <MetricCard icon={KeyRound} label="Authenticated" value={all.filter((item) => item.authenticationRequired).length} tone="purple" detail="role-aware coverage" />
      <MetricCard icon={FileCode2} label="Parameters" value={all.reduce((sum, item) => sum + item.parameters.length, 0)} tone="blue" detail="candidate inputs" />
      <MetricCard icon={CheckCircle2} label="Tests complete" value={all.reduce((sum, item) => sum + item.testsCompleted, 0)} tone="teal" detail="module observations" />
    </div>
    <SectionCard contentClassName="pan-card-content-flush" title="Endpoint inventory" description={`${filtered.length} routes match the current boundary`}>
      <div className="pan-table-toolbar">
        <div className="pan-toolbar-search"><Search size={15} /><input aria-label="Search endpoints" className="pan-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search route, URL, target, or parameter…" value={query} /></div>
        <div className="pan-method-chips" role="group" aria-label="Filter by HTTP method">
          <button type="button" className={method === "all" ? "is-active" : ""} onClick={() => setMethod("all")}>All</button>
          {methods.map((m) => <button key={m} type="button" className={method === m ? "is-active" : ""} onClick={() => setMethod(m)}>{m}</button>)}
        </div>
        <select aria-label="Filter authentication" className="pan-select pan-filter-select" onChange={(event) => setAuth(event.target.value)} value={auth}><option value="all">Any authentication</option><option value="true">Authentication required</option><option value="false">Publicly observed</option></select>
      </div>
      {loading ? <div style={{ padding: 18 }}><LoadingState rows={7} /></div> : <DataTable columns={columns} data={filtered} emptyDescription="Adjust filters or run in-scope URL discovery." emptyTitle="No endpoints match this view" keyField="id" onRowClick={(endpoint) => router.push(`/endpoints/${endpoint.id}`)} />}
    </SectionCard>

    <SectionCard title="Repeater" description="Burp-style request builder — pick a method and target, edit the body, and send to inspect the response.">
      <div className="pan-repeater">
        <div className="pan-repeater-row">
          <select aria-label="Repeater method" className="pan-select pan-method-select" value={rep.method} onChange={(e) => setRep({ ...rep, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select>
          <select aria-label="Repeater target" className="pan-input" value={rep.url} onChange={(e) => setRep({ ...rep, url: e.target.value })}>
            <option value="">Select an endpoint…</option>
            {filtered.slice(0, 60).map((endpoint) => <option key={endpoint.id} value={endpoint.url}>{endpoint.method} {endpoint.path}</option>)}
          </select>
          <button type="button" className="pan-button pan-button-primary" disabled={!rep.url} onClick={sendRepeater}>Send</button>
        </div>
        {rep.method !== "GET" && rep.method !== "DELETE" ? (
          <textarea className="pan-textarea pan-repeater-body" value={rep.body} onChange={(e) => setRep({ ...rep, body: e.target.value })} placeholder={`{"key": "value"} — ${rep.method} body`} />
        ) : null}
        {resp ? (
          <div className="pan-repeater-response">
            <div className="pan-repeater-status"><StatusBadge value={resp.status < 400 ? "live" : "warning"} label={String(resp.status)} /><span className="pan-table-mono">{rep.method} {rep.url}</span></div>
            <div className="pan-repeater-cols">
              <div><p>Response headers</p><pre>{resp.headers.map(([k, v]) => `${k}: ${v}`).join("\n")}</pre></div>
              <div><p>Response body</p><pre>{resp.body}</pre></div>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  </AppPage>;
}

function EndpointDetail({ endpointId }: { endpointId: string }) {
  const { data: endpoint, loading } = useAsyncData(() => panService.getEndpoint(endpointId), endpointId);
  if (loading || !endpoint) return <AppPage title="Endpoint" description="Loading normalized request surface…"><LoadingState rows={7} /></AppPage>;
  return <AppPage eyebrow={`Endpoints · ${endpoint.kind}`} title={`${endpoint.method} ${endpoint.path}`} description={endpoint.url} actions={<><Link className="pan-button pan-button-secondary" href="/endpoints/all"><ArrowLeft size={15} />Inventory</Link><a className="pan-button pan-button-primary" href={endpoint.url} rel="noreferrer" target="_blank">Open URL <ExternalLink size={15} /></a></>}>
    <div className="pan-kpi-row" style={{ marginBottom: 14 }}>
      <MetricCard icon={Globe2} label="HTTP status" value={endpoint.statusCode || "—"} detail={endpoint.contentType} />
      <MetricCard icon={FileCode2} label="Parameters" value={endpoint.parameters.length} tone="blue" detail="normalized inputs" />
      <MetricCard icon={ShieldCheck} label="Authentication" value={endpoint.authenticationRequired ? "Required" : "Public"} tone="purple" detail={endpoint.observedRole} />
      <MetricCard icon={CheckCircle2} label="Tests" value={endpoint.testsCompleted} tone="teal" detail="modules complete" />
    </div>
    <div className="pan-grid pan-grid-2">
      <SectionCard title="Request surface" description="Latest normalized endpoint observation"><dl className="pan-detail-list"><Detail label="Method" value={<span className="pan-table-mono">{endpoint.method}</span>} /><Detail label="Normalized path" value={<span className="pan-table-mono">{endpoint.path}</span>} /><Detail label="Content type" value={endpoint.contentType} /><Detail label="Authentication" value={<StatusBadge value={endpoint.authenticationRequired ? "required" : "public"} tone={endpoint.authenticationRequired ? "purple" : "neutral"} />} /><Detail label="Observed role" value={endpoint.observedRole} /><Detail label="Discovery source" value={endpoint.discoverySource} /></dl></SectionCard>
      <SectionCard title="Response fingerprint" description="Safe comparison metadata"><div className="pan-asset-tech"><p>Status</p><strong>{endpoint.statusCode || "Not captured"}</strong><p>Fingerprint</p><code className="pan-table-mono">{endpoint.fingerprint}</code><p>First / last seen</p><strong>{formatDate(endpoint.firstSeen)} · {formatDate(endpoint.lastSeen)}</strong></div><div className="pan-safety-notice" style={{ marginTop: 16 }}><Fingerprint size={16} /><div><strong>Fingerprint only</strong>PAN uses sanitized metadata here; raw secrets and authentication headers are never displayed.</div></div></SectionCard>
      <SectionCard title="Parameters" description="Inputs available for approved, non-destructive checks" className="pan-field-full">{endpoint.parameters.length ? <DataTable data={endpoint.parameters} getRowKey={(parameter) => `${parameter.location}:${parameter.name}`} pageSize={10} columns={[{ key: "name", header: "Name", value: (row) => row.name, render: (row) => <span className="pan-table-mono">{row.name}</span> }, { key: "location", header: "Location", value: (row) => row.location, render: (row) => <StatusBadge value={row.location} dot={false} /> }, { key: "type", header: "Type", value: (row) => row.type }, { key: "required", header: "Required", value: (row) => row.required, render: (row) => row.required ? "Yes" : "No" }]} /> : <p className="pan-card-description">No parameters were observed for this route.</p>}</SectionCard>
      <SectionCard title="Related findings" description="Normalized observations linked to this endpoint"><div className="pan-empty-inline"><ShieldCheck size={20} /><div><strong>{endpoint.relatedFindings} linked finding{endpoint.relatedFindings === 1 ? "" : "s"}</strong><p>Open the findings workspace to review evidence, confidence, remediation, and retest history.</p></div><Link className="pan-button pan-button-secondary" href={`/findings/all?endpoint=${endpoint.id}`}>Review findings</Link></div></SectionCard>
    </div>
  </AppPage>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="pan-detail-row"><dt>{label}</dt><dd>{value}</dd></div>;
}

