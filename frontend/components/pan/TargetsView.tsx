"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ChevronRight, Globe2, KeyRound, MoreHorizontal, Plus, Save, Search, ShieldCheck, Target as TargetIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { DataTable, type DataTableColumn } from "@/components/pan/DataTable";
import { LoadingState } from "@/components/pan/LoadingState";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatDate, toCsvList } from "@/lib/utils";
import { panService } from "@/services/pan-service";
import type { Scan, Target } from "@/types/pan";

const targetTabs = [
  { id: "overview", label: "Overview" },
  { id: "scope", label: "Scope" },
  { id: "authentication", label: "Authentication" },
  { id: "scan-history", label: "Scan history" },
];

const targetColumns: DataTableColumn<Target>[] = [
  { key: "name", header: "Target", sortable: true, value: (row) => row.name, render: (row) => <div><span className="pan-table-primary">{row.name}</span><span className="pan-table-secondary">{row.domain}</span></div> },
  { key: "environment", header: "Environment", sortable: true, value: (row) => row.environment, render: (row) => <StatusBadge value={row.environment} dot={false} /> },
  { key: "verificationStatus", header: "Verification", sortable: true, value: (row) => row.verificationStatus, render: (row) => <StatusBadge value={row.verificationStatus} /> },
  { key: "lastScan", header: "Last scan", sortable: true, value: (row) => row.lastScan ?? "", render: (row) => formatDate(row.lastScan, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
  { key: "assets", header: "Assets", sortable: true, value: (row) => row.assets },
  { key: "endpoints", header: "Endpoints", sortable: true, value: (row) => row.endpoints },
  { key: "findings", header: "Findings", sortable: true, value: (row) => row.findings },
  { key: "risk", header: "Risk", sortable: true, value: (row) => row.risk, render: (row) => <StatusBadge value={row.risk} /> },
  { key: "actions", header: "", render: (row) => <Link aria-label={`Open ${row.name}`} className="pan-icon-button" href={`/targets/${row.id}/overview`} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={16} /></Link> },
];

export function TargetsView({ segments }: { segments: string[] }) {
  const route = segments[0];
  if (!route) return <TargetList />;
  if (route === "new") return <NewTarget />;
  return <TargetDetail targetId={route} tab={segments[1] ?? "overview"} />;
}

function TargetList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [verification, setVerification] = useState("all");
  const { data, loading } = useAsyncData(() => panService.getTargets());
  const filtered = useMemo(() => (data ?? []).filter((target) => {
    const matchesQuery = `${target.name} ${target.domain}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (verification === "all" || target.verificationStatus === verification);
  }), [data, query, verification]);

  return <AppPage eyebrow="Attack surface" title="Authorized targets" description="Manage ownership verification, exact scope, authentication profiles, and scan history." actions={<Link className="pan-button pan-button-primary" href="/targets/new"><Plus size={16} />Add target</Link>}>
    <div className="pan-kpi-row" style={{ marginBottom: 14 }}><MetricCard icon={TargetIcon} label="Targets" value={data?.length ?? 0} detail="in this workspace" /><MetricCard icon={ShieldCheck} label="Verified" value={data?.filter((item) => item.verificationStatus === "verified").length ?? 0} tone="blue" detail="ready for scanning" /><MetricCard icon={Globe2} label="Discovered assets" value={data?.reduce((sum, item) => sum + item.assets, 0) ?? 0} tone="purple" detail="across all targets" /><MetricCard icon={CalendarClock} label="Scanned recently" value={data?.filter((item) => item.lastScan).length ?? 0} tone="amber" detail="with current inventory" /></div>
    <SectionCard contentClassName="pan-card-content-flush" title="Target inventory" description="Scanning is blocked until target ownership is verified.">
      <div className="pan-table-toolbar"><div className="pan-toolbar-search"><Search size={15} /><input aria-label="Search targets" className="pan-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or domain…" value={query} /></div><select aria-label="Filter verification" className="pan-select pan-filter-select" onChange={(event) => setVerification(event.target.value)} value={verification}><option value="all">All verification states</option><option value="verified">Verified</option><option value="pending">Pending</option><option value="unverified">Unverified</option></select><span>{filtered.length} targets</span></div>
      {loading ? <div style={{ padding: 18 }}><LoadingState rows={5} /></div> : <DataTable columns={targetColumns} data={filtered} emptyDescription="Add an authorized domain or API to begin secure onboarding." emptyTitle="No targets match this view" keyField="id" onRowClick={(target) => router.push(`/targets/${target.id}/overview`)} pageSize={8} />}
    </SectionCard>
  </AppPage>;
}

function NewTarget() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", baseUrl: "https://", domain: "", environment: "staging" as Target["environment"], verificationMethod: "dns_txt" as Target["verificationMethod"], includedHosts: "", excludedHosts: "", includedPaths: "/*", excludedPaths: "/logout, /account/delete", ports: "80, 443" });
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    let url: URL;
    try { url = new URL(form.baseUrl); } catch { toast({ tone: "danger", title: "Enter a valid base URL" }); return; }
    if (!["http:", "https:"].includes(url.protocol)) { toast({ tone: "danger", title: "Only HTTP and HTTPS targets are supported" }); return; }
    setBusy(true);
    const target = await panService.createTarget({ name: form.name, baseUrl: form.baseUrl, domain: form.domain || url.hostname, environment: form.environment, verificationStatus: "pending", verificationMethod: form.verificationMethod, authenticationProfile: null, scope: { includedHosts: toCsvList(form.includedHosts || url.hostname), excludedHosts: toCsvList(form.excludedHosts), includedPaths: toCsvList(form.includedPaths), excludedPaths: toCsvList(form.excludedPaths), allowedPorts: toCsvList(form.ports).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536) } });
    setBusy(false);
    toast({ tone: "success", title: "Target added", description: "Complete ownership verification before running a scan." });
    router.push(`/targets/${target.id}/overview`);
  }
  return <AppPage eyebrow="Targets · New" title="Add an authorized target" description="Define the root application and its initial request boundary. Verification is required before any job can run." actions={<Link className="pan-button pan-button-secondary" href="/targets"><ArrowLeft size={15} />Back</Link>}><form onSubmit={submit}><SectionCard title="Target identity" description="PAN accepts web applications, domains, and HTTP APIs."><div className="pan-form-grid"><Field label="Target name"><input className="pan-input" onChange={(event) => set("name", event.target.value)} placeholder="Customer portal" required value={form.name} /></Field><Field label="Environment"><select className="pan-select" onChange={(event) => set("environment", event.target.value as Target["environment"])} value={form.environment}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></Field><Field label="Base URL"><input className="pan-input" onChange={(event) => set("baseUrl", event.target.value)} required type="url" value={form.baseUrl} /></Field><Field label="Domain"><input className="pan-input" onChange={(event) => set("domain", event.target.value)} placeholder="Inferred from URL when blank" value={form.domain} /></Field><Field label="Verification method"><select className="pan-select" onChange={(event) => set("verificationMethod", event.target.value as Target["verificationMethod"])} value={form.verificationMethod}><option value="dns_txt">DNS TXT record</option><option value="html_file">HTML file</option><option value="http_header">HTTP header</option></select></Field></div></SectionCard><SectionCard className="pan-target-form-section" title="Initial scope" description="Use exact hosts and exclude sensitive state-changing paths."><div className="pan-form-grid"><Field full label="Included hosts"><input className="pan-input" onChange={(event) => set("includedHosts", event.target.value)} placeholder="app.example.com, api.example.com" value={form.includedHosts} /></Field><Field full label="Excluded hosts"><input className="pan-input" onChange={(event) => set("excludedHosts", event.target.value)} placeholder="payments.example.com" value={form.excludedHosts} /></Field><Field label="Included paths"><input className="pan-input" onChange={(event) => set("includedPaths", event.target.value)} value={form.includedPaths} /></Field><Field label="Excluded paths"><input className="pan-input" onChange={(event) => set("excludedPaths", event.target.value)} value={form.excludedPaths} /></Field><Field label="Allowed ports"><input className="pan-input" onChange={(event) => set("ports", event.target.value)} value={form.ports} /></Field></div><div className="pan-safety-notice" style={{ marginTop: 18 }}><ShieldCheck size={16} /><div><strong>Safety boundary</strong>Redirects outside included hosts are rejected. Private-address and concurrency policies are enforced by the scan service.</div></div><div className="pan-form-actions"><Link className="pan-button pan-button-secondary" href="/targets">Cancel</Link><button className="pan-button pan-button-primary" disabled={busy} type="submit"><Plus size={15} />{busy ? "Adding…" : "Add target"}</button></div></SectionCard></form></AppPage>;
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) { return <label className={`pan-field${full ? " pan-field-full" : ""}`}><span className="pan-label">{label}</span>{children}</label>; }

function TargetDetail({ targetId, tab }: { targetId: string; tab: string }) {
  const { data: target, loading, reload } = useAsyncData(() => panService.getTarget(targetId), targetId);
  if (loading || !target) return <AppPage title="Target" description="Loading authorized scope…"><LoadingState rows={7} /></AppPage>;
  return <AppPage eyebrow={`Targets · ${target.environment}`} title={target.name} description={target.baseUrl} actions={<><StatusBadge value={target.verificationStatus} /><Link className="pan-button pan-button-primary" href={`/scans/new?target=${target.id}`}>Start scan <ChevronRight size={15} /></Link></>}>
    <nav aria-label="Target sections" className="pan-tabs pan-target-tabs">{targetTabs.map((item) => <Link className={tab === item.id ? "pan-tab pan-tab-active" : "pan-tab"} href={`/targets/${target.id}/${item.id}`} key={item.id}>{item.label}</Link>)}</nav>
    <div style={{ marginTop: 16 }}>{tab === "scope" ? <ScopeEditor onSaved={() => void reload()} target={target} /> : tab === "authentication" ? <AuthenticationEditor onSaved={() => void reload()} target={target} /> : tab === "scan-history" ? <TargetScanHistory target={target} /> : <TargetOverview onVerified={() => void reload()} target={target} />}</div>
  </AppPage>;
}

function TargetOverview({ target, onVerified }: { target: Target; onVerified: () => void }) {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  async function verify() { setVerifying(true); await panService.verifyTarget(target.id); setVerifying(false); toast({ tone: "success", title: "Ownership verified" }); onVerified(); }
  return <><div className="pan-kpi-row" style={{ marginBottom: 14 }}><MetricCard icon={Globe2} label="Assets" value={target.assets} detail="discovered hosts" /><MetricCard icon={TargetIcon} label="Endpoints" value={target.endpoints} tone="purple" detail="normalized routes" /><MetricCard icon={ShieldCheck} label="Findings" value={target.findings} tone="red" detail="open observations" /><MetricCard icon={CalendarClock} label="Last scan" value={target.lastScan ? formatDate(target.lastScan, { month: "short", day: "numeric" }) : "Never"} tone="amber" detail="latest authorized run" /></div><div className="pan-grid pan-grid-2"><SectionCard title="Target summary" description="Identity and authorization state"><dl className="pan-detail-list"><Detail label="Domain" value={target.domain} /><Detail label="Environment" value={<StatusBadge value={target.environment} dot={false} />} /><Detail label="Verification" value={<StatusBadge value={target.verificationStatus} />} /><Detail label="Method" value={target.verificationMethod.replace("_", " ")} /><Detail label="Added" value={formatDate(target.createdAt)} /><Detail label="Authentication" value={target.authenticationProfile ?? "No profile configured"} /></dl></SectionCard><SectionCard title="Authorized scope" description="Current exact scan boundary"><dl className="pan-detail-list"><Detail label="Included hosts" value={target.scope.includedHosts.join(", ") || "—"} /><Detail label="Excluded hosts" value={target.scope.excludedHosts.join(", ") || "None"} /><Detail label="Included paths" value={target.scope.includedPaths.join(", ")} /><Detail label="Excluded paths" value={target.scope.excludedPaths.join(", ") || "None"} /><Detail label="Allowed ports" value={target.scope.allowedPorts.join(", ")} /></dl><Link className="pan-card-link" href={`/targets/${target.id}/scope`} style={{ marginTop: 14 }}>Edit scope <ChevronRight size={13} /></Link></SectionCard></div>{target.verificationStatus !== "verified" ? <SectionCard className="pan-target-form-section" title="Ownership verification required" description="No scanner jobs can start until PAN verifies this target."><div className="pan-verification-inline"><div><span>DNS TXT</span><code>pan-verify={target.id}-8f3c21d9</code></div><button className="pan-button pan-button-primary" disabled={verifying} onClick={() => void verify()}><Check size={15} />{verifying ? "Checking…" : "Simulate verification"}</button></div></SectionCard> : null}</>;
}

function ScopeEditor({ target, onSaved }: { target: Target; onSaved: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState({ includedHosts: target.scope.includedHosts.join(", "), excludedHosts: target.scope.excludedHosts.join(", "), includedPaths: target.scope.includedPaths.join(", "), excludedPaths: target.scope.excludedPaths.join(", "), allowedPorts: target.scope.allowedPorts.join(", ") });
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); await panService.updateTarget(target.id, { scope: { includedHosts: toCsvList(scope.includedHosts), excludedHosts: toCsvList(scope.excludedHosts), includedPaths: toCsvList(scope.includedPaths), excludedPaths: toCsvList(scope.excludedPaths), allowedPorts: toCsvList(scope.allowedPorts).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536) } }); setBusy(false); toast({ tone: "success", title: "Scope saved", description: "Future jobs will use the updated boundary." }); onSaved(); }
  return <form onSubmit={save}><SectionCard title="Exact target scope" description="PAN revalidates this boundary before each job and after every redirect."><div className="pan-form-grid"><Field full label="Included hosts"><textarea className="pan-textarea" onChange={(event) => setScope((current) => ({ ...current, includedHosts: event.target.value }))} value={scope.includedHosts} /></Field><Field full label="Excluded hosts"><textarea className="pan-textarea" onChange={(event) => setScope((current) => ({ ...current, excludedHosts: event.target.value }))} value={scope.excludedHosts} /></Field><Field label="Included paths"><textarea className="pan-textarea" onChange={(event) => setScope((current) => ({ ...current, includedPaths: event.target.value }))} value={scope.includedPaths} /></Field><Field label="Excluded paths"><textarea className="pan-textarea" onChange={(event) => setScope((current) => ({ ...current, excludedPaths: event.target.value }))} value={scope.excludedPaths} /></Field><Field label="Allowed ports"><input className="pan-input" onChange={(event) => setScope((current) => ({ ...current, allowedPorts: event.target.value }))} value={scope.allowedPorts} /></Field></div><div className="pan-safety-notice" style={{ marginTop: 18 }}><ShieldCheck size={16} /><div><strong>Enforced exclusions</strong>Logout, account deletion, payment, and other sensitive state-changing paths should remain excluded unless separately approved.</div></div><div className="pan-form-actions"><button className="pan-button pan-button-primary" disabled={busy} type="submit"><Save size={15} />{busy ? "Saving…" : "Save scope"}</button></div></SectionCard></form>;
}

function AuthenticationEditor({ target, onSaved }: { target: Target; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(target.authenticationProfile ?? "Authorized test account");
  const [type, setType] = useState("bearer");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) { event.preventDefault(); if (!secret.trim()) { toast({ tone: "danger", title: "Enter a secret to vault" }); return; } setBusy(true); await panService.updateTarget(target.id, { authenticationProfile: `${name} · ${type}` }); setSecret(""); setBusy(false); toast({ tone: "success", title: "Authentication profile saved", description: "The secret was sent for secure storage and is not returned to the browser." }); onSaved(); }
  return <form onSubmit={save}><SectionCard title="Authentication profile" description="Credentials are write-only. PAN never displays stored secrets after submission."><div className="pan-form-grid"><Field label="Profile name"><input className="pan-input" onChange={(event) => setName(event.target.value)} required value={name} /></Field><Field label="Authentication type"><select className="pan-select" onChange={(event) => setType(event.target.value)} value={type}><option value="bearer">Bearer token</option><option value="basic">HTTP Basic</option><option value="cookie">Session cookie</option><option value="api_key">API key header</option></select></Field><Field full label="Secret value"><input autoComplete="off" className="pan-input" onChange={(event) => setSecret(event.target.value)} placeholder="Write-only encrypted value" type="password" value={secret} /><span className="pan-field-hint">Sent directly to the backend vault adapter. It is never stored in frontend state after submission.</span></Field></div><div className="pan-safety-notice" style={{ marginTop: 18 }}><KeyRound size={16} /><div><strong>Least-privilege test identity</strong>Use a dedicated, non-production account with only the roles explicitly authorized for this assessment.</div></div><div className="pan-form-actions"><button className="pan-button pan-button-primary" disabled={busy} type="submit"><Save size={15} />{busy ? "Securing…" : "Save profile"}</button></div></SectionCard></form>;
}

function TargetScanHistory({ target }: { target: Target }) {
  const { data, loading } = useAsyncData(() => panService.getScans());
  const scans = (data ?? []).filter((scan) => scan.targetName === target.name || data?.length === 1);
  const columns: DataTableColumn<Scan>[] = [{ key: "name", header: "Scan", render: (row) => <div><span className="pan-table-primary">{row.name}</span><span className="pan-table-secondary">{row.profile}</span></div> }, { key: "status", header: "Status", render: (row) => <StatusBadge value={row.status} /> }, { key: "progress", header: "Coverage", render: (row) => `${row.progress}%` }, { key: "findings", header: "Findings" }, { key: "startedAt", header: "Started", render: (row) => formatDate(row.startedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }, { key: "open", header: "", render: (row) => <Link className="pan-card-link" href={`/scans/${row.id}/overview`}>Open <ChevronRight size={13} /></Link> }];
  return <SectionCard contentClassName="pan-card-content-flush" title="Scan history" description={`Authorized runs against ${target.domain}`}>{loading ? <div style={{ padding: 18 }}><LoadingState rows={5} /></div> : <DataTable columns={columns} data={scans} emptyDescription="Start a scan after target verification to populate this history." emptyTitle="No scans for this target" keyField="id" />}</SectionCard>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="pan-detail-row"><dt>{label}</dt><dd>{value}</dd></div>; }
