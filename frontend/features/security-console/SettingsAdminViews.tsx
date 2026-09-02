"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  CloudCog,
  Copy,
  FileClock,
  FileText,
  Gauge,
  HardDrive,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import {
  AppPage,
  DataTable,
  MetricCard,
  SectionCard,
  StatusBadge,
} from "@/components/pan";
import {
  DefinitionGrid,
  Field,
  KeyValueRows,
  PageTabs,
  ProgressBar,
  SafetyNotice,
  ToggleRow,
  inputClass,
  primaryButton,
  secondaryButton,
  dangerButton,
} from "./FeatureUI";
import type { RouteViewProps } from "./types";

const settingsTabs = [
  { label: "General", value: "general" },
  { label: "Workspace", value: "workspace" },
  { label: "Scan settings", value: "scan-settings" },
  { label: "AI provider", value: "ai-provider" },
  { label: "API keys", value: "api-keys" },
  { label: "Notifications", value: "notifications" },
  { label: "Data retention", value: "data-retention" },
];

export function SettingsView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "general";
  if (page === "workspace") return <WorkspaceSettings />;
  if (page === "scan-settings") return <ScanSettings />;
  if (page === "ai-provider") return <AiProviderSettings />;
  if (page === "api-keys") return <ApiKeySettings />;
  if (page === "notifications") return <NotificationSettings />;
  if (page === "data-retention") return <RetentionSettings />;
  return <GeneralSettings />;
}

function SettingsHeader({ active }: { active: string }) {
  return <PageTabs basePath="/settings" active={active} items={settingsTabs} />;
}

function SaveBar({ saved, text = "Changes saved" }: { saved: boolean; text?: string }) {
  return saved ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-300"><CheckCircle2 className="h-4 w-4" /> {text}</span> : null;
}

function GeneralSettings() {
  const [saved, setSaved] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="General settings" description="Configure display, time, locale, and default application behavior for your account.">
      <SettingsHeader active="general" />
      <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="grid gap-5">
        <SectionCard title="Display and locale">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name"><input className={inputClass} defaultValue="Maya Chen" /></Field>
            <Field label="Time zone"><select className={inputClass} defaultValue="asia-calcutta"><option value="asia-calcutta">Asia/Kolkata · IST</option><option value="utc">UTC</option><option value="america-new-york">America/New York</option></select></Field>
            <Field label="Date format"><select className={inputClass}><option>27 Aug 2026</option><option>2026-08-27</option><option>Aug 27, 2026</option></select></Field>
            <Field label="Default landing view"><select className={inputClass}><option>Dashboard</option><option>Running scans</option><option>Findings</option></select></Field>
          </div>
        </SectionCard>
        <SectionCard title="Security display">
          <div className="grid gap-3">
            <ToggleRow label="Mask sensitive evidence by default" description="Require an explicit reveal action for sanitized values that may still be sensitive." checked={true} onChange={() => undefined} />
            <ToggleRow label="Show authorization reminders" description="Display the verified-target warning before every new recon or scan job." checked={true} onChange={() => undefined} />
          </div>
        </SectionCard>
        <div className="flex items-center justify-end gap-3"><SaveBar saved={saved} /><button type="submit" className={primaryButton}><Save className="h-4 w-4" /> Save changes</button></div>
      </form>
    </AppPage>
  );
}

function WorkspaceSettings() {
  const [saved, setSaved] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="Workspace settings" description="Manage the shared security workspace, defaults, and member-facing context.">
      <SettingsHeader active="workspace" />
      <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="grid gap-5">
        <SectionCard title="Northstar Cloud workspace" action={<StatusBadge value="analyst workspace" tone="purple" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Workspace name"><input className={inputClass} defaultValue="Northstar Cloud" /></Field>
            <Field label="Workspace slug"><input className={inputClass} defaultValue="pan-demo" /></Field>
            <Field label="Default environment"><select className={inputClass}><option>Staging</option><option>Development</option><option>Production</option></select></Field>
            <Field label="Default assignee"><select className={inputClass}><option>Maya Chen</option><option>Unassigned</option><option>Ravi Kumar</option></select></Field>
          </div>
        </SectionCard>
        <SectionCard title="Workspace membership"><DataTable data={[
          { id: "user_01", name: "Maya Chen", email: "analyst@pan.local", role: "analyst", status: "active" },
          { id: "user_02", name: "Ravi Kumar", email: "user@pan.local", role: "user", status: "active" },
        ]} keyField="id" columns={[
          { key: "name", header: "Member" }, { key: "email", header: "Email" }, { key: "role", header: "Role", render: (member: {role: string}) => <StatusBadge value={member.role} /> }, { key: "status", header: "Status", render: (member: {status: string}) => <StatusBadge value={member.status} /> },
        ]} /></SectionCard>
        <div className="flex items-center justify-end gap-3"><SaveBar saved={saved} /><button type="submit" className={primaryButton}><Save className="h-4 w-4" /> Save workspace</button></div>
      </form>
    </AppPage>
  );
}

function ScanSettings() {
  const [saved, setSaved] = useState(false);
  const [autoCancel, setAutoCancel] = useState(true);
  const [privateBlock, setPrivateBlock] = useState(true);
  const [redirectBlock, setRedirectBlock] = useState(true);
  return (
    <AppPage eyebrow="Workspace preferences" title="Scan settings" description="Set workspace ceilings. Individual scans can choose stricter values but cannot exceed these controls.">
      <SettingsHeader active="scan-settings" />
      <form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="grid gap-5">
        <SectionCard title="Default execution limits" description="Applied after target-specific scope and exclusions.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Requests / second"><input className={inputClass} type="number" defaultValue={4} min={1} max={20} /></Field>
            <Field label="Concurrency"><input className={inputClass} type="number" defaultValue={4} min={1} max={10} /></Field>
            <Field label="Request ceiling"><input className={inputClass} type="number" defaultValue={2500} min={1} max={10000} /></Field>
            <Field label="Scanner timeout"><select className={inputClass}><option>30 minutes</option><option>60 minutes</option><option>120 minutes</option></select></Field>
          </div>
        </SectionCard>
        <SectionCard title="Mandatory safety controls"><div className="grid gap-3">
          <ToggleRow label="Block private and metadata addresses" description="Reject cloud metadata, loopback, link-local, and private network targets in cloud mode." checked={privateBlock} onChange={setPrivateBlock} />
          <ToggleRow label="Revalidate every redirect" description="Stop requests when a redirect leaves the approved host, path, or port scope." checked={redirectBlock} onChange={setRedirectBlock} />
          <ToggleRow label="Auto-cancel on repeated scope violations" description="Stop a job after three rejected out-of-scope dispatch attempts." checked={autoCancel} onChange={setAutoCancel} />
        </div></SectionCard>
        <SafetyNotice />
        <div className="flex items-center justify-end gap-3"><SaveBar saved={saved} /><button type="submit" className={primaryButton}><Save className="h-4 w-4" /> Save scan policy</button></div>
      </form>
    </AppPage>
  );
}

function AiProviderSettings() {
  const [tested, setTested] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="AI provider" description="PAN uses a provider-neutral backend adapter. API keys stay in environment variables and never enter workspace JSON or browser state.">
      <SettingsHeader active="ai-provider" />
      <SafetyNotice variant="info">Configure AI_PROVIDER, AI_BASE_URL, AI_API_KEY, and AI_MODEL on the backend. The browser receives capability status only.</SafetyNotice>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <SectionCard title="Provider status" action={<StatusBadge value="demo adapter" tone="purple" />}>
          <DefinitionGrid items={[
            { label: "Provider", value: "demo" }, { label: "Model", value: "pan-analyst-demo" }, { label: "Base URL", value: "Configured server-side" }, { label: "API key", value: "Not exposed" }, { label: "Structured output", value: "Pydantic validated" }, { label: "Last health check", value: tested ? "just now" : "8 min ago" },
          ]} />
          <div className="mt-5 flex items-center gap-3"><button type="button" className={secondaryButton} onClick={() => setTested(true)}><RefreshCw className="h-4 w-4" /> Test provider</button>{tested ? <span className="text-sm font-semibold text-teal-300">Demo provider healthy</span> : null}</div>
        </SectionCard>
        <SectionCard title="Hard restrictions"><ul className="space-y-3 text-sm leading-6 text-slate-300">{["No scanner execution", "No arbitrary requests", "No scope changes", "No secret disclosure", "No automatic confirmation", "Evidence IDs required"].map((item) => <li key={item} className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-teal-300" />{item}</li>)}</ul></SectionCard>
      </div>
    </AppPage>
  );
}

function ApiKeySettings() {
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="API keys" description="Create revocable workspace keys for automation. PAN shows the secret once and stores only a secure hash.">
      <SettingsHeader active="api-keys" />
      {created ? <SafetyNotice variant="success"><div className="grid gap-2"><strong>Copy this development key now; it will not be shown again.</strong><span className="break-all rounded-lg bg-black/20 px-3 py-2 font-mono text-xs">pan_demo_sk_83JvP2mQ7xL4Yf9</span><button type="button" className={`${secondaryButton} w-fit`} onClick={() => setCopied(true)}><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy key"}</button></div></SafetyNotice> : null}
      <SectionCard title="Workspace API keys" action={<button type="button" className={primaryButton} onClick={() => setCreated(true)}><Plus className="h-4 w-4" /> Create key</button>}>
        <DataTable data={[
          { id: "key_01", name: "CI report export", prefix: "pan_••••7Qm", scopes: "reports:read", lastUsed: "2 days ago", status: "active" },
          { id: "key_02", name: "Security automation", prefix: "pan_••••1Ka", scopes: "targets:read, scans:write", lastUsed: "12 min ago", status: "active" },
        ]} keyField="id" columns={[
          { key: "name", header: "Name" }, { key: "prefix", header: "Key" }, { key: "scopes", header: "Scopes" }, { key: "lastUsed", header: "Last used" }, { key: "status", header: "Status", render: (key: {status: string}) => <StatusBadge value={key.status} /> },
        ]} />
      </SectionCard>
    </AppPage>
  );
}

function NotificationSettings() {
  const [scanAlerts, setScanAlerts] = useState(true);
  const [findings, setFindings] = useState(true);
  const [assetChanges, setAssetChanges] = useState(true);
  const [weekly, setWeekly] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="Notification settings" description="Choose which security events reach you and how often PAN groups lower-priority updates.">
      <SettingsHeader active="notifications" />
      <SectionCard title="Security notifications"><div className="grid gap-3">
        <ToggleRow label="Scan alerts" description="Failures, pauses, worker loss, repeated scope blocks, and completion." checked={scanAlerts} onChange={setScanAlerts} />
        <ToggleRow label="New confirmed findings" description="Immediate notification when deterministic evidence or an analyst confirms a finding." checked={findings} onChange={setFindings} />
        <ToggleRow label="Attack-surface changes" description="New assets, services, technologies, and endpoint changes from recon." checked={assetChanges} onChange={setAssetChanges} />
        <ToggleRow label="Weekly security digest" description="One weekly summary of scan coverage, risk movement, and overdue remediation." checked={weekly} onChange={setWeekly} />
      </div></SectionCard>
      <SectionCard title="Delivery"><div className="grid gap-4 md:grid-cols-2"><Field label="Email"><input className={inputClass} defaultValue="analyst@pan.local" /></Field><Field label="Quiet hours"><select className={inputClass}><option>22:00–07:00 · urgent only</option><option>Disabled</option></select></Field></div></SectionCard>
      <div className="flex items-center justify-end gap-3"><SaveBar saved={saved} /><button type="button" className={primaryButton} onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Save notifications</button></div>
    </AppPage>
  );
}

function RetentionSettings() {
  const [saved, setSaved] = useState(false);
  return (
    <AppPage eyebrow="Workspace preferences" title="Data retention" description="Control how long PAN keeps scan events, sanitized evidence, AI conversations, and generated reports.">
      <SettingsHeader active="data-retention" />
      <SectionCard title="Retention windows">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sanitized evidence"><select className={inputClass}><option>30 days</option><option>14 days</option><option>90 days</option></select></Field>
          <Field label="Scan events and logs"><select className={inputClass}><option>90 days</option><option>30 days</option><option>180 days</option></select></Field>
          <Field label="AI conversation messages"><select className={inputClass}><option>30 days</option><option>7 days</option><option>Metadata only</option></select></Field>
          <Field label="Generated reports"><select className={inputClass}><option>1 year</option><option>180 days</option><option>Until manually deleted</option></select></Field>
        </div>
      </SectionCard>
      <SectionCard title="Current storage"><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Evidence" value="1.8 GB" detail="48% of usage" tone="teal" icon={ShieldAlert} /><MetricCard label="Reports" value="640 MB" detail="17% of usage" tone="blue" icon={FileText} /><MetricCard label="Logs" value="1.1 GB" detail="29% of usage" tone="purple" icon={FileClock} /><MetricCard label="Other" value="221 MB" detail="6% of usage" tone="amber" icon={HardDrive} /></div></SectionCard>
      <SafetyNotice variant="info">Retention cleanup removes expired artifacts through audited background jobs. Finding metadata and audit events follow separate compliance policy.</SafetyNotice>
      <div className="flex items-center justify-end gap-3"><SaveBar saved={saved} /><button type="button" className={primaryButton} onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Save retention policy</button></div>
    </AppPage>
  );
}

const adminTabs = [
  { label: "Overview", value: "overview" },
  { label: "Users", value: "users" },
  { label: "Organizations", value: "organizations" },
  { label: "Plans", value: "plans" },
  { label: "Workers", value: "scan-workers" },
  { label: "Tools", value: "scanner-tools" },
  { label: "Templates", value: "templates" },
  { label: "Health", value: "system-health" },
  { label: "Abuse", value: "abuse-monitoring" },
  { label: "Audit logs", value: "audit-logs" },
];

export function AdminView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "overview";
  const child = segments[1];
  if (page === "users") return child ? <AdminUserDetail id={child} /> : <AdminUsers />;
  if (page === "organizations") return child ? <AdminOrganizationDetail id={child} /> : <AdminOrganizations />;
  if (page === "plans") return child === "new" ? <AdminPlanEditor mode="new" /> : child ? <AdminPlanEditor mode="edit" id={child} /> : <AdminPlans />;
  if (page === "scan-workers") return child ? <AdminWorkerDetail id={child} /> : <AdminWorkers />;
  if (page === "scanner-tools") return child ? <AdminToolDetail id={child} /> : <AdminTools />;
  if (page === "templates") return child === "new" ? <AdminTemplateEditor mode="new" /> : child ? <AdminTemplateEditor mode="edit" id={child} /> : <AdminTemplates />;
  if (page === "system-health") return <AdminHealth view={child ?? "overview"} />;
  if (page === "abuse-monitoring") return <AdminAbuse view={child ?? "overview"} />;
  if (page === "audit-logs") return <AdminAuditLogs />;
  return <AdminOverview />;
}

function AdminPage({
  active,
  title,
  description,
  actions,
  children,
}: {
  active: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppPage eyebrow="Administrator panel" title={title} description={description} actions={actions}>
      <PageTabs basePath="/admin" active={active} items={adminTabs} />
      <SafetyNotice variant="info"><strong>Administrator access.</strong> The frontend session guard and backend role dependency protect this route. Every administrative read and mutation is audit logged.</SafetyNotice>
      {children}
    </AppPage>
  );
}

type AuditEvent = { id: string; actor: string; action: string; resource: string; result: string; ip: string; time: string };
const auditEvents: AuditEvent[] = [
  { id: "audit_201", actor: "admin@pan.local", action: "scanner_tool.updated", resource: "tool_nuclei", result: "success", ip: "10.2.4.18", time: "2 min ago" },
  { id: "audit_200", actor: "system", action: "scope.request_blocked", resource: "scan_01", result: "blocked", ip: "worker-02", time: "8 min ago" },
  { id: "audit_199", actor: "analyst@pan.local", action: "finding.confirmed", resource: "finding_01", result: "success", ip: "10.2.4.21", time: "14 min ago" },
  { id: "audit_198", actor: "admin@pan.local", action: "user.role_changed", resource: "user_02", result: "success", ip: "10.2.4.18", time: "Yesterday" },
];

function AuditTable({ data = auditEvents }: { data?: AuditEvent[] }) {
  return <DataTable data={data} keyField="id" columns={[
    { key: "time", header: "Time" }, { key: "actor", header: "Actor" }, { key: "action", header: "Event" }, { key: "resource", header: "Resource" }, { key: "ip", header: "Origin" }, { key: "result", header: "Result", render: (event: AuditEvent) => <StatusBadge value={event.result} /> },
  ]} />;
}

function AdminOverview() {
  return (
    <AdminPage active="overview" title="Platform overview" description="Monitor tenant activity, scan capacity, integration posture, storage, AI usage, abuse signals, and audit events.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total users" value="128" detail="+9 this month" tone="teal" icon={Users} />
        <MetricCard label="Organizations" value="18" detail="15 active plans" tone="blue" icon={Building2} />
        <MetricCard label="Running scans" value="7" detail="Across 5 tenants" tone="purple" icon={ScanLine} />
        <MetricCard label="Queue size" value="12" detail="Oldest: 42 sec" tone="amber" icon={ClipboardList} />
        <MetricCard label="Healthy workers" value="9" detail="90% capacity" tone="teal" icon={Server} />
        <MetricCard label="Failed workers" value="1" detail="Timeout under review" tone="red" icon={XCircle} />
        <MetricCard label="Storage usage" value="63%" detail="126 GB / 200 GB" tone="blue" icon={HardDrive} />
        <MetricCard label="AI usage" value="72%" detail="432k / 600k tokens" tone="purple" icon={Bot} />
        <MetricCard label="Acunetix" value="Offline" detail="Mock mode available" tone="amber" icon={CloudCog} />
        <MetricCard label="Abuse alerts" value="3" detail="1 high priority" tone="red" icon={AlertOctagon} />
        <MetricCard label="API latency" value="84 ms" detail="p95 · healthy" tone="teal" icon={Activity} />
        <MetricCard label="Job success" value="98.7%" detail="Last 24 hours" tone="blue" icon={CheckCircle2} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <SectionCard title="Recent audit events" action={<Link href="/admin/audit-logs" className={secondaryButton}>View all</Link>}><AuditTable /></SectionCard>
        <SectionCard title="Service posture"><KeyValueRows rows={[
          { label: "Frontend", value: <StatusBadge value="healthy" /> }, { label: "API", value: <StatusBadge value="healthy" /> }, { label: "JSON repositories", value: <StatusBadge value="healthy" /> }, { label: "Scan queues", value: <StatusBadge value="healthy" /> }, { label: "Acunetix", value: <StatusBadge value="disconnected" /> }, { label: "AI adapter", value: <StatusBadge value="demo mode" tone="purple" /> },
        ]} /></SectionCard>
      </div>
    </AdminPage>
  );
}

type AdminUser = { id: string; name: string; email: string; organization: string; role: string; status: string; lastSeen: string };
const adminUsers: AdminUser[] = [
  { id: "user_admin", name: "Maya Rao", email: "admin@pan.local", organization: "PAN Platform", role: "admin", status: "active", lastSeen: "now" },
  { id: "user_01", name: "Maya Chen", email: "analyst@pan.local", organization: "Demo Labs", role: "analyst", status: "active", lastSeen: "8 min ago" },
  { id: "user_02", name: "Ravi Kumar", email: "user@pan.local", organization: "Demo Labs", role: "user", status: "active", lastSeen: "Yesterday" },
  { id: "user_03", name: "Lena West", email: "lena@example.test", organization: "Acme Security", role: "analyst", status: "invited", lastSeen: "Never" },
];

function AdminUsers() {
  return (
    <AdminPage active="users" title="Users" description="Manage account state and role assignments. Backend authorization remains authoritative." actions={<button type="button" className={primaryButton}><Plus className="h-4 w-4" /> Invite user</button>}>
      <SectionCard title="Platform users" description="128 users · 117 active"><DataTable data={adminUsers} keyField="id" columns={[
        { key: "name", header: "User", render: (user: AdminUser) => <Link href={`/admin/users/${user.id}`} className="font-semibold text-slate-100 hover:text-teal-300">{user.name}<span className="mt-0.5 block text-xs font-normal text-slate-500">{user.email}</span></Link> }, { key: "organization", header: "Organization" }, { key: "role", header: "Role", render: (user: AdminUser) => <StatusBadge value={user.role} /> }, { key: "status", header: "Status", render: (user: AdminUser) => <StatusBadge value={user.status} /> }, { key: "lastSeen", header: "Last seen" },
      ]} /></SectionCard>
    </AdminPage>
  );
}

function AdminUserDetail({ id }: { id: string }) {
  const [status, setStatus] = useState("active");
  const [saved, setSaved] = useState(false);
  return (
    <AdminPage active="users" title="Maya Chen" description={`User detail · ${id}`} actions={<button type="button" className={dangerButton} onClick={() => setStatus(status === "active" ? "suspended" : "active")}>{status === "active" ? "Suspend user" : "Restore user"}</button>}>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <SectionCard title="Account and access" action={<StatusBadge value={status} />}>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className={inputClass} defaultValue="Maya Chen" /></Field><Field label="Email"><input className={inputClass} defaultValue="analyst@pan.local" /></Field><Field label="Role"><select className={inputClass}><option>Analyst</option><option>Standard user</option><option>Administrator</option></select></Field><Field label="Organization"><select className={inputClass}><option>Demo Labs</option><option>PAN Platform</option></select></Field></div>
          <div className="mt-5 flex items-center gap-3"><button type="button" className={primaryButton} onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Save access</button><SaveBar saved={saved} text="Access updated and audited" /></div>
        </SectionCard>
        <SectionCard title="User activity"><KeyValueRows rows={[
          { label: "Created", value: "Aug 18, 2026" }, { label: "Last seen", value: "8 min ago" }, { label: "Active sessions", value: "2" }, { label: "Scans created", value: "17" }, { label: "Findings confirmed", value: "9" }, { label: "MFA", value: "Enabled" },
        ]} /></SectionCard>
      </div>
      <SectionCard title="Recent administrative events"><AuditTable data={auditEvents.filter((event) => event.actor.includes("analyst") || event.resource === id)} /></SectionCard>
    </AdminPage>
  );
}

type Organization = { id: string; name: string; plan: string; users: number; targets: number; scans: number; status: string };
const organizations: Organization[] = [
  { id: "org_01", name: "Demo Labs", plan: "Team", users: 12, targets: 8, scans: 42, status: "active" },
  { id: "org_02", name: "Acme Security", plan: "Enterprise", users: 48, targets: 35, scans: 316, status: "active" },
  { id: "org_03", name: "Sample Studio", plan: "Starter", users: 3, targets: 2, scans: 7, status: "trial" },
];

function AdminOrganizations() {
  return (
    <AdminPage active="organizations" title="Organizations" description="Manage tenant status, plans, membership, and resource usage." actions={<button type="button" className={primaryButton}><Plus className="h-4 w-4" /> New organization</button>}>
      <SectionCard title="Organizations" description="18 total · 15 active"><DataTable data={organizations} keyField="id" columns={[
        { key: "name", header: "Organization", render: (organization: Organization) => <Link href={`/admin/organizations/${organization.id}`} className="font-semibold text-teal-300">{organization.name}</Link> }, { key: "plan", header: "Plan" }, { key: "users", header: "Users" }, { key: "targets", header: "Targets" }, { key: "scans", header: "Scans" }, { key: "status", header: "Status", render: (organization: Organization) => <StatusBadge value={organization.status} /> },
      ]} /></SectionCard>
    </AdminPage>
  );
}

function AdminOrganizationDetail({ id }: { id: string }) {
  return (
    <AdminPage active="organizations" title="Demo Labs" description={`Organization detail · ${id}`}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Members" value="12" detail="4 analysts" tone="teal" icon={Users} /><MetricCard label="Verified targets" value="8" detail="2 environments" tone="blue" icon={ShieldCheck} /><MetricCard label="Scans this month" value="42" detail="58% of plan" tone="purple" icon={ScanLine} /><MetricCard label="Storage" value="18 GB" detail="36% of plan" tone="amber" icon={HardDrive} /></div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><SectionCard title="Organization settings"><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className={inputClass} defaultValue="Demo Labs" /></Field><Field label="Plan"><select className={inputClass}><option>Team</option><option>Enterprise</option><option>Starter</option></select></Field><Field label="Owner"><select className={inputClass}><option>Maya Chen</option></select></Field><Field label="Status"><select className={inputClass}><option>Active</option><option>Suspended</option></select></Field></div></SectionCard><SectionCard title="Resource limits"><KeyValueRows rows={[
        { label: "Users", value: "12 / 25" }, { label: "Targets", value: "8 / 20" }, { label: "Concurrent scans", value: "2 / 4" }, { label: "Monthly requests", value: "182k / 500k" }, { label: "Storage", value: "18 / 50 GB" },
      ]} /></SectionCard></div>
    </AdminPage>
  );
}

type Plan = { id: string; name: string; organizations: number; users: string; targets: string; scans: string; price: string; status: string };
const plans: Plan[] = [
  { id: "plan_starter", name: "Starter", organizations: 6, users: "5", targets: "3", scans: "1 concurrent", price: "₹0 demo", status: "active" },
  { id: "plan_team", name: "Team", organizations: 9, users: "25", targets: "20", scans: "4 concurrent", price: "₹12k / mo", status: "active" },
  { id: "plan_enterprise", name: "Enterprise", organizations: 3, users: "Unlimited", targets: "Unlimited", scans: "10 concurrent", price: "Custom", status: "active" },
];

function AdminPlans() {
  return (
    <AdminPage active="plans" title="Plans" description="Define tenant resource ceilings, feature access, and retention allowances." actions={<Link href="/admin/plans/new" className={primaryButton}><Plus className="h-4 w-4" /> New plan</Link>}>
      <SectionCard title="Platform plans"><DataTable data={plans} keyField="id" columns={[
        { key: "name", header: "Plan", render: (plan: Plan) => <Link href={`/admin/plans/${plan.id}`} className="font-semibold text-teal-300">{plan.name}</Link> }, { key: "organizations", header: "Organizations" }, { key: "users", header: "Users" }, { key: "targets", header: "Targets" }, { key: "scans", header: "Scans" }, { key: "price", header: "Price" }, { key: "status", header: "Status", render: (plan: Plan) => <StatusBadge value={plan.status} /> },
      ]} /></SectionCard>
    </AdminPage>
  );
}

function AdminPlanEditor({ mode, id }: { mode: "new" | "edit"; id?: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <AdminPage active="plans" title={mode === "new" ? "Create plan" : "Team plan"} description={mode === "new" ? "Define a reusable organization entitlement set." : `Edit plan · ${id}`}>
      <SectionCard title="Plan configuration">
        <div className="grid gap-4 md:grid-cols-2"><Field label="Plan name"><input className={inputClass} defaultValue={mode === "edit" ? "Team" : ""} /></Field><Field label="Status"><select className={inputClass}><option>Active</option><option>Archived</option></select></Field><Field label="Maximum users"><input className={inputClass} type="number" defaultValue={25} /></Field><Field label="Maximum targets"><input className={inputClass} type="number" defaultValue={20} /></Field><Field label="Concurrent scans"><input className={inputClass} type="number" defaultValue={4} /></Field><Field label="Storage allowance (GB)"><input className={inputClass} type="number" defaultValue={50} /></Field></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2"><ToggleRow label="AI Analyst" description="Allow provider-neutral evidence analysis." checked={true} onChange={() => undefined} /><ToggleRow label="Acunetix integration" description="Allow active scanner synchronization." checked={true} onChange={() => undefined} /><ToggleRow label="Custom scanner checks" description="Allow approved workspace checks." checked={true} onChange={() => undefined} /><ToggleRow label="API access" description="Allow scoped workspace API keys." checked={true} onChange={() => undefined} /></div>
        <div className="mt-5 flex items-center gap-3"><button type="button" className={primaryButton} onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Save plan</button><SaveBar saved={saved} text="Plan saved and audited" /></div>
      </SectionCard>
    </AdminPage>
  );
}

type Worker = { id: string; name: string; pool: string; health: string; job: string; cpu: string; heartbeat: string };
const workers: Worker[] = [
  { id: "worker_01", name: "recon-worker-01", pool: "Recon", health: "healthy", job: "idle", cpu: "18%", heartbeat: "2 sec ago" },
  { id: "worker_02", name: "scanner-worker-02", pool: "Specialist", health: "healthy", job: "scan_01", cpu: "64%", heartbeat: "now" },
  { id: "worker_03", name: "browser-worker-01", pool: "Verification", health: "healthy", job: "finding_01", cpu: "31%", heartbeat: "4 sec ago" },
  { id: "worker_04", name: "report-worker-01", pool: "Reports", health: "failed", job: "none", cpu: "—", heartbeat: "8 min ago" },
];

function AdminWorkers() {
  return (
    <AdminPage active="scan-workers" title="Scan workers" description="Monitor worker health, heartbeats, capacity, assigned jobs, and failure state." actions={<button type="button" className={secondaryButton}><RefreshCw className="h-4 w-4" /> Refresh</button>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Healthy" value="9" detail="Across 5 pools" tone="teal" icon={Server} /><MetricCard label="Busy" value="6" detail="67% utilization" tone="blue" icon={Activity} /><MetricCard label="Failed" value="1" detail="Report worker" tone="red" icon={XCircle} /><MetricCard label="Queue" value="12" detail="Oldest 42 sec" tone="amber" icon={ClipboardList} /></div>
      <SectionCard title="Worker inventory"><DataTable data={workers} keyField="id" columns={[
        { key: "name", header: "Worker", render: (worker: Worker) => <Link href={`/admin/scan-workers/${worker.id}`} className="font-semibold text-teal-300">{worker.name}</Link> }, { key: "pool", header: "Pool" }, { key: "health", header: "Health", render: (worker: Worker) => <StatusBadge value={worker.health} /> }, { key: "job", header: "Current job" }, { key: "cpu", header: "CPU" }, { key: "heartbeat", header: "Heartbeat" },
      ]} /></SectionCard>
    </AdminPage>
  );
}

function AdminWorkerDetail({ id }: { id: string }) {
  const [restart, setRestart] = useState(false);
  return (
    <AdminPage active="scan-workers" title="scanner-worker-02" description={`Worker detail · ${id}`} actions={<button type="button" className={secondaryButton} onClick={() => setRestart(true)}><RefreshCw className="h-4 w-4" /> Restart worker</button>}>
      {restart ? <SafetyNotice variant="success">Graceful restart requested. The worker will finish its current safe request and return the job to the queue.</SafetyNotice> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Health" value="Healthy" detail="Heartbeat now" tone="teal" icon={Server} /><MetricCard label="CPU" value="64%" detail="2 vCPU limit" tone="blue" icon={Gauge} /><MetricCard label="Memory" value="1.2 GB" detail="2 GB limit" tone="purple" icon={HardDrive} /><MetricCard label="Jobs today" value="18" detail="100% success" tone="amber" icon={ScanLine} /></div>
      <SectionCard title="Worker runtime"><DefinitionGrid items={[
        { label: "Pool", value: "Specialist scanners" }, { label: "Current job", value: "scan_01" }, { label: "Current adapter", value: "XSS" }, { label: "Started", value: "Aug 27, 08:00" }, { label: "Version", value: "pan-worker 0.1.0" }, { label: "Mode", value: <StatusBadge value="mock mode" tone="info" /> },
      ]} /></SectionCard>
    </AdminPage>
  );
}

type Tool = { id: string; name: string; category: string; adapter: string; version: string; status: string; mode: string };
const tools: Tool[] = [
  { id: "tool_subfinder", name: "Subfinder", category: "Recon", adapter: "Python adapter", version: "mock", status: "enabled", mode: "mock" },
  { id: "tool_nuclei", name: "Nuclei", category: "Misconfigurations / CVEs", adapter: "Python adapter", version: "mock", status: "enabled", mode: "mock" },
  { id: "tool_dalfox", name: "Dalfox", category: "XSS", adapter: "Python adapter", version: "mock", status: "enabled", mode: "mock" },
  { id: "tool_sqlmap", name: "SQLmap", category: "SQLi", adapter: "Python adapter", version: "not installed", status: "disabled", mode: "mock only" },
];

function AdminTools() {
  return (
    <AdminPage active="scanner-tools" title="Scanner tools" description="Enable adapter capabilities, inspect binary readiness, and enforce mock mode without accepting raw commands.">
      <SectionCard title="Tool registry"><DataTable data={tools} keyField="id" columns={[
        { key: "name", header: "Tool", render: (tool: Tool) => <Link href={`/admin/scanner-tools/${tool.id}`} className="font-semibold text-teal-300">{tool.name}</Link> }, { key: "category", header: "Category" }, { key: "adapter", header: "Adapter" }, { key: "version", header: "Version" }, { key: "status", header: "Status", render: (tool: Tool) => <StatusBadge value={tool.status} /> }, { key: "mode", header: "Mode" },
      ]} /></SectionCard>
      <SafetyNotice>Adapters receive validated argument arrays. PAN never interpolates raw user input into a shell command or uses shell execution.</SafetyNotice>
    </AdminPage>
  );
}

function AdminToolDetail({ id }: { id: string }) {
  const [enabled, setEnabled] = useState(true);
  return (
    <AdminPage active="scanner-tools" title="Nuclei adapter" description={`Scanner tool · ${id}`} actions={<button type="button" className={enabled ? dangerButton : primaryButton} onClick={() => setEnabled(!enabled)}>{enabled ? "Disable adapter" : "Enable adapter"}</button>}>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><SectionCard title="Adapter configuration" action={<StatusBadge value={enabled ? "enabled" : "disabled"} />}><DefinitionGrid items={[
        { label: "Tool", value: "Nuclei" }, { label: "Adapter", value: "NucleiScannerAdapter" }, { label: "Binary", value: "Not required in mock mode" }, { label: "Templates", value: "Curated allowlist" }, { label: "Timeout", value: "20 minutes" }, { label: "Shell execution", value: "Disabled" },
      ]} /></SectionCard><SectionCard title="Approved capabilities"><ul className="space-y-3 text-sm text-slate-300">{["Safe HTTP templates", "Curated CVE templates", "Configuration checks", "Validated target arguments", "Structured JSON output"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-teal-300" />{item}</li>)}</ul></SectionCard></div>
    </AdminPage>
  );
}

type AdminTemplate = { id: string; name: string; type: string; owner: string; version: string; status: string; updated: string };
const adminTemplates: AdminTemplate[] = [
  { id: "template_01", name: "PAN professional dark", type: "Report", owner: "System", version: "1.2", status: "active", updated: "Aug 24" },
  { id: "template_02", name: "Executive brief", type: "Report", owner: "System", version: "1.1", status: "active", updated: "Aug 23" },
  { id: "template_03", name: "Balanced scan profile", type: "Scan profile", owner: "System", version: "2.0", status: "active", updated: "Aug 26" },
];

function AdminTemplates() {
  return (
    <AdminPage active="templates" title="Templates" description="Manage reusable report layouts and safe scan profiles." actions={<Link href="/admin/templates/new" className={primaryButton}><Plus className="h-4 w-4" /> New template</Link>}>
      <SectionCard title="Template registry"><DataTable data={adminTemplates} keyField="id" columns={[
        { key: "name", header: "Template", render: (item: AdminTemplate) => <Link href={`/admin/templates/${item.id}`} className="font-semibold text-teal-300">{item.name}</Link> }, { key: "type", header: "Type" }, { key: "owner", header: "Owner" }, { key: "version", header: "Version" }, { key: "status", header: "Status", render: (item: AdminTemplate) => <StatusBadge value={item.status} /> }, { key: "updated", header: "Updated" },
      ]} /></SectionCard>
    </AdminPage>
  );
}

function AdminTemplateEditor({ mode, id }: { mode: "new" | "edit"; id?: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <AdminPage active="templates" title={mode === "new" ? "Create template" : "PAN professional dark"} description={mode === "new" ? "Create a governed report or scan-profile template." : `Template detail · ${id}`}>
      <SectionCard title="Template definition"><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className={inputClass} defaultValue={mode === "edit" ? "PAN professional dark" : ""} /></Field><Field label="Type"><select className={inputClass}><option>Report</option><option>Scan profile</option></select></Field><Field label="Audience"><select className={inputClass}><option>Technical and executive</option><option>Executive</option><option>Engineering</option></select></Field><Field label="Status"><select className={inputClass}><option>Draft</option><option>Active</option></select></Field></div><div className="mt-5"><Field label="Description"><textarea className={inputClass} rows={4} defaultValue="Complete scope, methodology, coverage, findings, evidence, remediation, and limitation sections." /></Field></div><div className="mt-5 flex items-center gap-3"><button type="button" className={primaryButton} onClick={() => setSaved(true)}><Save className="h-4 w-4" /> Save template</button><SaveBar saved={saved} text="Template saved and audited" /></div></SectionCard>
    </AdminPage>
  );
}

const healthTabs = [
  { label: "Overview", value: "overview", href: "/admin/system-health" }, { label: "Services", value: "services" }, { label: "Database", value: "database" }, { label: "Queues", value: "queues" }, { label: "Storage", value: "storage" },
];

function AdminHealth({ view }: { view: string }) {
  const active = healthTabs.some((item) => item.value === view) ? view : "overview";
  return (
    <AdminPage active="system-health" title={`System health${active === "overview" ? "" : ` · ${active}`}`} description="Inspect API, repositories, workers, queues, storage, and integration health." actions={<button type="button" className={secondaryButton}><RefreshCw className="h-4 w-4" /> Refresh</button>}>
      <PageTabs basePath="/admin/system-health" active={active} items={healthTabs} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Overall" value="Operational" detail="1 degraded integration" tone="teal" icon={CheckCircle2} /><MetricCard label="API p95" value="84 ms" detail="0.02% errors" tone="blue" icon={Activity} /><MetricCard label="Queue age" value="42 sec" detail="Within SLO" tone="purple" icon={ClipboardList} /><MetricCard label="Storage" value="63%" detail="74 GB available" tone="amber" icon={HardDrive} /></div>
      {active === "overview" || active === "services" ? <HealthServices /> : null}
      {active === "database" ? <HealthDatabase /> : null}
      {active === "queues" ? <HealthQueues /> : null}
      {active === "storage" ? <HealthStorage /> : null}
    </AdminPage>
  );
}

function HealthServices() {
  type Service = { name: string; status: string; latency: string; version: string; checked: string };
  const services: Service[] = [
    { name: "Frontend", status: "healthy", latency: "31 ms", version: "Next.js 16", checked: "now" }, { name: "FastAPI", status: "healthy", latency: "52 ms", version: "0.1.0", checked: "now" }, { name: "JSON repositories", status: "healthy", latency: "7 ms", version: "v1", checked: "now" }, { name: "Acunetix", status: "disconnected", latency: "—", version: "mock adapter", checked: "1 min ago" }, { name: "AI provider", status: "healthy", latency: "280 ms", version: "demo", checked: "2 min ago" },
  ];
  return <SectionCard title="Service checks"><DataTable data={services} keyField="name" columns={[
    { key: "name", header: "Service" }, { key: "status", header: "Health", render: (service: Service) => <StatusBadge value={service.status} /> }, { key: "latency", header: "Latency" }, { key: "version", header: "Version" }, { key: "checked", header: "Checked" },
  ]} /></SectionCard>;
}

function HealthDatabase() {
  return <SectionCard title="JSON repository health" description="Collection files use per-file locks, atomic replacement, validation, and backups."><DefinitionGrid items={[
    { label: "Collections", value: "20 healthy" }, { label: "Last write", value: "4 sec ago" }, { label: "Lock contention", value: "0.4%" }, { label: "Validation failures", value: "0" }, { label: "Backup age", value: "12 min" }, { label: "Total records", value: "8,412" },
  ]} /><div className="mt-5"><SafetyNotice variant="success">All collection versions are readable and no atomic-write recovery is pending.</SafetyNotice></div></SectionCard>;
}

function HealthQueues() {
  type Queue = { name: string; queued: number; running: number; oldest: string; workers: number; status: string };
  const queues: Queue[] = [
    { name: "Recon", queued: 3, running: 2, oldest: "18 sec", workers: 3, status: "healthy" }, { name: "Scanner", queued: 6, running: 4, oldest: "42 sec", workers: 4, status: "healthy" }, { name: "Browser verification", queued: 2, running: 1, oldest: "21 sec", workers: 1, status: "healthy" }, { name: "Reports", queued: 1, running: 0, oldest: "38 sec", workers: 1, status: "degraded" },
  ];
  return <SectionCard title="Job queues"><DataTable data={queues} keyField="name" columns={[
    { key: "name", header: "Queue" }, { key: "queued", header: "Queued" }, { key: "running", header: "Running" }, { key: "oldest", header: "Oldest job" }, { key: "workers", header: "Workers" }, { key: "status", header: "Status", render: (queue: Queue) => <StatusBadge value={queue.status} /> },
  ]} /></SectionCard>;
}

function HealthStorage() {
  return <SectionCard title="Storage allocation"><div className="grid gap-6"><ProgressBar value={63} label="126 GB of 200 GB" tone="amber" /><DefinitionGrid items={[
    { label: "Evidence", value: "61 GB" }, { label: "Reports", value: "22 GB" }, { label: "Logs", value: "31 GB" }, { label: "JSON collections", value: "4 GB" }, { label: "Backups", value: "8 GB" }, { label: "Cleanup next run", value: "01:00 IST" },
  ]} /></div></SectionCard>;
}

const abuseTabs = [
  { label: "Overview", value: "overview", href: "/admin/abuse-monitoring" }, { label: "Alerts", value: "alerts" }, { label: "Blocked targets", value: "blocked-targets" }, { label: "Suspicious users", value: "suspicious-users" },
];

function AdminAbuse({ view }: { view: string }) {
  const active = abuseTabs.some((item) => item.value === view) ? view : "overview";
  return (
    <AdminPage active="abuse-monitoring" title={`Abuse monitoring${active === "overview" ? "" : ` · ${active.replace("-", " ")}`}`} description="Review target authorization anomalies, repeated scope blocks, suspicious request patterns, and enforcement actions.">
      <PageTabs basePath="/admin/abuse-monitoring" active={active} items={abuseTabs} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Open alerts" value="3" detail="1 high priority" tone="red" icon={AlertOctagon} /><MetricCard label="Blocked targets" value="12" detail="8 private addresses" tone="amber" icon={ShieldAlert} /><MetricCard label="Suspicious users" value="2" detail="Under review" tone="purple" icon={UserCog} /><MetricCard label="Scope blocks today" value="37" detail="Across 4 scans" tone="blue" icon={ShieldCheck} /></div>
      {active === "blocked-targets" ? <BlockedTargets /> : active === "suspicious-users" ? <SuspiciousUsers /> : <AbuseAlerts />}
    </AdminPage>
  );
}

function AbuseAlerts() {
  type Alert = { id: string; signal: string; user: string; target: string; severity: string; state: string; time: string };
  const alerts: Alert[] = [
    { id: "abuse_31", signal: "Repeated private-address target attempts", user: "user_87", target: "169.254.169.254", severity: "high", state: "open", time: "6 min ago" }, { id: "abuse_30", signal: "Scope-block threshold exceeded", user: "user_42", target: "external.example", severity: "medium", state: "investigating", time: "22 min ago" }, { id: "abuse_29", signal: "Unusual scan concurrency", user: "user_53", target: "4 verified targets", severity: "medium", state: "open", time: "1 hour ago" },
  ];
  return <SectionCard title="Abuse alerts"><DataTable data={alerts} keyField="id" columns={[
    { key: "signal", header: "Signal" }, { key: "user", header: "User" }, { key: "target", header: "Target" }, { key: "severity", header: "Severity", render: (alert: Alert) => <StatusBadge value={alert.severity} /> }, { key: "state", header: "State", render: (alert: Alert) => <StatusBadge value={alert.state} /> }, { key: "time", header: "Detected" },
  ]} /></SectionCard>;
}

function BlockedTargets() {
  type Block = { value: string; reason: string; source: string; attempts: number; last: string };
  const blocks: Block[] = [
    { value: "169.254.169.254", reason: "Cloud metadata address", source: "system policy", attempts: 8, last: "6 min ago" }, { value: "127.0.0.1", reason: "Loopback address", source: "system policy", attempts: 3, last: "Yesterday" }, { value: "10.0.0.0/8", reason: "Private network range", source: "cloud mode", attempts: 12, last: "Yesterday" },
  ];
  return <SectionCard title="Blocked target rules"><DataTable data={blocks} keyField="value" columns={[
    { key: "value", header: "Address / range" }, { key: "reason", header: "Reason" }, { key: "source", header: "Policy" }, { key: "attempts", header: "Attempts" }, { key: "last", header: "Last blocked" },
  ]} /></SectionCard>;
}

function SuspiciousUsers() {
  type Suspicious = { user: string; organization: string; signals: number; risk: string; state: string; last: string };
  const rows: Suspicious[] = [
    { user: "user_87", organization: "Trial workspace 14", signals: 8, risk: "high", state: "restricted", last: "6 min ago" }, { user: "user_42", organization: "Sample Studio", signals: 4, risk: "medium", state: "review", last: "22 min ago" },
  ];
  return <SectionCard title="Users under review"><DataTable data={rows} keyField="user" columns={[
    { key: "user", header: "User" }, { key: "organization", header: "Organization" }, { key: "signals", header: "Signals" }, { key: "risk", header: "Risk", render: (row: Suspicious) => <StatusBadge value={row.risk} /> }, { key: "state", header: "Enforcement", render: (row: Suspicious) => <StatusBadge value={row.state} /> }, { key: "last", header: "Last event" },
  ]} /></SectionCard>;
}

function AdminAuditLogs() {
  return (
    <AdminPage active="audit-logs" title="Audit logs" description="Search immutable authentication, authorization, scope, scanner, finding, report, settings, and administration events." actions={<button type="button" className={secondaryButton}>Export JSON</button>}>
      <SectionCard title="Audit event search">
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_190px_190px]"><input className={inputClass} placeholder="Search actor, action, or resource…" /><select className={inputClass}><option>All event types</option><option>Authentication</option><option>Scope enforcement</option><option>Administration</option><option>Finding workflow</option></select><select className={inputClass}><option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option></select></div>
        <AuditTable />
      </SectionCard>
      <SafetyNotice variant="info">Audit events are append-only in the application workflow. Exports omit secrets and preserve event IDs and timestamps.</SafetyNotice>
    </AdminPage>
  );
}
