"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cpu,
  FileBarChart,
  Globe2,
  Network,
  Play,
  Radar,
  ScanSearch,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppPage } from "@/components/pan/AppPage";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";

import styles from "./LightDashboard.module.css";

const STATUS_STRIP: Array<{
  label: string;
  value: string;
  tone: "live" | "healthy" | "info" | "warning" | "operational";
  icon: LucideIcon;
}> = [
  { label: "Workers", value: "8 / 8 online", tone: "healthy", icon: Cpu },
  { label: "Queue", value: "3 jobs", tone: "info", icon: Workflow },
  { label: "Last scan", value: "4m ago", tone: "operational", icon: Clock3 },
  { label: "Exposure", value: "Elevated", tone: "warning", icon: CircleAlert },
];

const METRICS = [
  { label: "Total targets", value: "24", detail: "+3 this month", icon: Target },
  { label: "Verified assets", value: "1,284", detail: "92% confidence", icon: Globe2, tone: "blue" },
  { label: "Endpoints", value: "8,492", detail: "1,106 newly indexed", icon: Braces, tone: "purple" },
  { label: "Running scans", value: "2", detail: "3 jobs queued", icon: ScanSearch },
  { label: "Confirmed", value: "12", detail: "1 critical finding", icon: TriangleAlert, tone: "red" },
  { label: "Candidates", value: "37", detail: "Awaiting verification", icon: Sparkles, tone: "amber" },
] as const;

const TREND = [
  { day: "Mon", high: 7, resolved: 2 },
  { day: "Tue", high: 9, resolved: 4 },
  { day: "Wed", high: 8, resolved: 5 },
  { day: "Thu", high: 13, resolved: 6 },
  { day: "Fri", high: 11, resolved: 8 },
  { day: "Sat", high: 15, resolved: 9 },
  { day: "Sun", high: 12, resolved: 11 },
];

const SEVERITY = [
  { name: "Critical", value: 1, color: "#d03b3b" },
  { name: "High", value: 4, color: "#d95926" },
  { name: "Medium", value: 7, color: "#c98500" },
  { name: "Low", value: 6, color: "#3987e5" },
  { name: "Info", value: 3, color: "#8a9683" },
];

const RUNNING_SCANS = [
  {
    target: "api.northstar.dev",
    mode: "Full exposure scan",
    progress: 68,
    eta: "9 min",
    stage: "Active",
  },
  {
    target: "app.northstar.dev",
    mode: "API discovery",
    progress: 42,
    eta: "14 min",
    stage: "Endpoints",
  },
];

const PIPELINE = ["Scope", "Recon", "Endpoints", "Passive", "Active", "Verify", "AI"];

const ATTENTION = [
  {
    title: "Authentication bypass candidate",
    asset: "api.northstar.dev /v2/admin/session",
    severity: "critical",
    state: "Needs review",
    confidence: "96%",
    icon: ShieldCheck,
  },
  {
    title: "Exposed internal GraphQL schema",
    asset: "gateway.northstar.dev/graphql",
    severity: "high",
    state: "Confirmed",
    confidence: "91%",
    icon: Braces,
  },
  {
    title: "Cloud storage policy drift",
    asset: "assets-eu.northstar.dev",
    severity: "medium",
    state: "Triaged",
    confidence: "88%",
    icon: Server,
  },
  {
    title: "Stale administrative endpoint",
    asset: "legacy.northstar.dev/control",
    severity: "high",
    state: "New",
    confidence: "84%",
    icon: Network,
  },
];

const ACTIVITY = [
  { title: "Scan completed", meta: "portal.northstar.dev · 4m ago", icon: CheckCircle2, tone: "success" },
  { title: "AI verification finished", meta: "7 candidates reviewed · 11m ago", icon: Bot, tone: "purple" },
  { title: "New asset discovered", meta: "cdn-preview.northstar.dev · 18m ago", icon: Radar, tone: "info" },
  { title: "Critical finding opened", meta: "api.northstar.dev · 32m ago", icon: TriangleAlert, tone: "warning" },
  { title: "Scope policy updated", meta: "Northstar Cloud · 1h ago", icon: ShieldCheck, tone: "success" },
];

const WORKERS = [
  { name: "Recon cluster", jobs: "2 active", load: 72, icon: Radar },
  { name: "Scanner pool", jobs: "3 active", load: 58, icon: ScanSearch },
  { name: "Verifier", jobs: "1 active", load: 34, icon: ShieldCheck },
  { name: "DeltaAI", jobs: "2 active", load: 47, icon: Bot },
];

const RECON = [
  { value: "148", label: "Subdomains", icon: Globe2 },
  { value: "32", label: "Live hosts", icon: Server },
  { value: "17", label: "Open services", icon: Network },
  { value: "46", label: "Technologies", icon: Braces },
  { value: "9", label: "Cloud assets", icon: Sparkles },
  { value: "6", label: "Takeover leads", icon: CircleAlert },
];

const TECHNOLOGIES = [
  { name: "Cloudflare", count: 19, share: 88 },
  { name: "Next.js", count: 14, share: 70 },
  { name: "nginx", count: 11, share: 54 },
  { name: "GraphQL", count: 7, share: 34 },
  { name: "Amazon S3", count: 5, share: 25 },
];

const POSTURE = [
  ["Asset coverage", "92%"],
  ["Scan freshness", "88%"],
  ["Critical SLA", "76%"],
] as const;

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.sectionLink} href={href}>
      {children}
      <ChevronRight size={13} />
    </Link>
  );
}

export function LightDashboard() {
  return (
    <AppPage
      eyebrow="Security operations · Northstar Cloud"
      title="Security overview"
      description="Live exposure, scan health, and prioritized work across your authorized attack surface."
      actions={
        <>
          <Link className="pan-button pan-button-secondary" href="/reports">
            <FileBarChart size={15} /> Reports
          </Link>
          <Link className="pan-button pan-button-primary" href="/scans/new">
            <Play size={15} fill="currentColor" /> New scan
          </Link>
        </>
      }
    >
      <div className={styles.statusBar}>
        <div className={styles.statusIdentity}>
          <span className={styles.liveBadge}>Live</span>
          <strong>Northstar production</strong>
        </div>
        <div className={styles.statusItems}>
          {STATUS_STRIP.map((item) => {
            const Icon = item.icon;
            return (
              <div className={styles.statusItem} key={item.label}>
                <Icon size={14} />
                <span>{item.label}</span>
                <strong className={styles[item.tone]}>{item.value}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.aiBanner}>
        <div className={styles.aiIcon}><Bot size={19} /></div>
        <div>
          <span>DeltaAI analyst</span>
          <strong>3 high-confidence leads are ready for validation</strong>
          <p>Evidence is correlated across endpoints, headers, and prior scan history.</p>
        </div>
        <Link className={styles.aiAction} href="/findings">
          Review leads <ArrowUpRight size={14} />
        </Link>
      </div>

      <section aria-label="Workspace metrics" className={styles.metrics}>
        {METRICS.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <div className={styles.chartGrid}>
        <SectionCard
          title="Finding trend"
          description="High-risk findings opened versus resolved"
          action={<SectionLink href="/findings">All findings</SectionLink>}
          className={styles.section}
        >
          <div className={styles.chartLegend}>
            <span><i className={styles.highLine} /> Opened</span>
            <span><i className={styles.resolvedLine} /> Resolved</span>
          </div>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d95926" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d95926" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b9ff2d" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#b9ff2d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(125,145,120,.14)" strokeDasharray="2 5" vertical={false} />
                <XAxis axisLine={false} dataKey="day" tick={{ fill: "#73806e", fontSize: 11 }} tickLine={false} />
                <YAxis axisLine={false} tick={{ fill: "#73806e", fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#090d09", border: "1px solid #263022", borderRadius: 2, color: "#eef4eb", fontSize: 12 }}
                  cursor={{ stroke: "rgba(185,255,45,.24)" }}
                />
                <Area dataKey="high" fill="url(#openedFill)" stroke="#d95926" strokeWidth={2} type="monotone" />
                <Area dataKey="resolved" fill="url(#resolvedFill)" stroke="#b9ff2d" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Open severity"
          description="21 confirmed findings"
          className={styles.section}
        >
          <div className={styles.severityTop}>
            <div className={styles.donut}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SEVERITY} dataKey="value" innerRadius={53} outerRadius={69} paddingAngle={3} stroke="none">
                    {SEVERITY.map((item) => <Cell fill={item.color} key={item.name} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.score}><strong>21</strong><span>open</span></div>
            </div>
            <div className={styles.severityList}>
              {SEVERITY.map((item) => (
                <div key={item.name}>
                  <span><i style={{ background: item.color }} />{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className={styles.operationsGrid}>
        <SectionCard
          title="Live scans"
          description="Active workflows and current pipeline position"
          action={<SectionLink href="/scans">Open queue</SectionLink>}
          className={styles.section}
        >
          <div className={styles.scanList}>
            {RUNNING_SCANS.map((scan) => (
              <article key={scan.target}>
                <div className={styles.scanHead}>
                  <div><ScanSearch size={16} /><span><strong>{scan.target}</strong><small>{scan.mode}</small></span></div>
                  <StatusBadge value="Running" />
                </div>
                <div className={styles.progress}><i style={{ width: `${scan.progress}%` }} /></div>
                <div className={styles.pipeline}>
                  {PIPELINE.map((stage, index) => (
                    <span className={index <= PIPELINE.indexOf(scan.stage) ? styles.complete : ""} key={stage}>
                      <i />{stage}
                    </span>
                  ))}
                </div>
                <dl>
                  <div><dt>Progress</dt><dd>{scan.progress}%</dd></div>
                  <div><dt>Current stage</dt><dd>{scan.stage}</dd></div>
                  <div><dt>Estimated</dt><dd>{scan.eta}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Security posture" description="Exposure health over the last 30 days" className={styles.section}>
          <div className={styles.postureIntro}>
            <div className={styles.postureRing}><span><strong>78</strong><small>/100</small></span></div>
            <div><StatusBadge tone="warning" value="Elevated risk" /><p>Coverage is strong. Critical remediation velocity needs attention.</p></div>
          </div>
          <div className={styles.postureList}>
            {POSTURE.map(([label, value]) => (
              <div key={label}>
                <span><span>{label}</span><strong>{value}</strong></span>
                <i><b style={{ width: value }} /></i>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className={styles.reviewGrid}>
        <SectionCard
          title="Needs attention"
          description="Prioritized by severity, reachability, and evidence confidence"
          action={<SectionLink href="/findings">View queue</SectionLink>}
          className={`${styles.section} ${styles.flush}`}
        >
          <div className={styles.attentionList}>
            {ATTENTION.map((finding, index) => {
              const Icon = finding.icon;
              return (
                <Link href="/findings" key={finding.title}>
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.findingIcon}><Icon size={16} /></span>
                  <span className={styles.findingCopy}><strong>{finding.title}</strong><small>{finding.asset}</small></span>
                  <StatusBadge value={finding.severity} />
                  <StatusBadge tone="neutral" value={finding.state} />
                  <span className={styles.confidence}>{finding.confidence}</span>
                  <ChevronRight size={15} />
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Recent activity" description="Latest changes across your workspace" className={styles.section}>
          <div className={styles.activityList}>
            {ACTIVITY.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <span className={`${styles.eventIcon} ${styles[item.tone]}`}><Icon size={15} /></span>
                  <span><strong>{item.title}</strong><small>{item.meta}</small></span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Quick actions" description="Common operator workflows" className={styles.section}>
          <div className={styles.quickActions}>
            <Link href="/scans/new"><Play size={16} /><span><strong>Start a scan</strong><small>Run an authorized workflow</small></span><ChevronRight size={14} /></Link>
            <Link href="/targets"><Target size={16} /><span><strong>Manage targets</strong><small>Review scope and ownership</small></span><ChevronRight size={14} /></Link>
            <Link href="/reports"><FileBarChart size={16} /><span><strong>Export report</strong><small>Create an executive summary</small></span><ChevronRight size={14} /></Link>
            <Link href="/findings"><ShieldCheck size={16} /><span><strong>Verify findings</strong><small>Clear the review queue</small></span><ChevronRight size={14} /></Link>
          </div>
        </SectionCard>
      </div>

      <div className={styles.infrastructureGrid}>
        <SectionCard title="Worker health" description="Distributed scanning infrastructure" className={styles.section}>
          <div className={styles.workerList}>
            {WORKERS.map((worker) => {
              const Icon = worker.icon;
              return (
                <div key={worker.name}>
                  <span className={styles.workerIcon}><Icon size={15} /></span>
                  <span><strong>{worker.name}</strong><small>{worker.jobs}</small></span>
                  <span className={styles.workerTrack}><i style={{ width: `${worker.load}%` }} /></span>
                  <b>{worker.load}%</b>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Recon snapshot" description="Latest verified discovery data" className={styles.section}>
          <div className={styles.reconGrid}>
            {RECON.map((item) => {
              const Icon = item.icon;
              return <div key={item.label}><Icon size={16} /><strong>{item.value}</strong><span>{item.label}</span></div>;
            })}
          </div>
        </SectionCard>

        <SectionCard title="Technology surface" description="Most prevalent detected technologies" className={styles.section}>
          <div className={styles.technologyList}>
            {TECHNOLOGIES.map((tech) => (
              <div key={tech.name}>
                <span><strong>{tech.name}</strong><small>{tech.count} assets</small></span>
                <i><b style={{ width: `${tech.share}%` }} /></i>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className={styles.footerGrid}>
        <SectionCard title="Reporting" description="Latest generated security artifacts" className={styles.section}>
          <div className={styles.reportList}>
            <Link href="/reports"><FileBarChart size={17} /><span><strong>Weekly exposure brief</strong><small>Generated today · PDF</small></span><StatusBadge tone="success" value="Ready" /><ChevronRight size={14} /></Link>
            <Link href="/reports"><FileBarChart size={17} /><span><strong>Executive risk summary</strong><small>Generated Aug 27 · PDF</small></span><StatusBadge tone="neutral" value="SOC 2" /><ChevronRight size={14} /></Link>
          </div>
        </SectionCard>

        <SectionCard title="Scope guardrails" description="Controls protecting this workspace" className={styles.section}>
          <div className={styles.scopeState}>
            <span><ShieldCheck size={20} /></span>
            <div><strong>All policies enforced</strong><p>Every active scan is within a verified target boundary.</p></div>
          </div>
          <div className={styles.scopeGrid}>
            <div><strong>24</strong><span>Authorized targets</span></div>
            <div><strong>0</strong><span>Scope violations</span></div>
            <div><strong>100%</strong><span>Ownership verified</span></div>
          </div>
        </SectionCard>
      </div>
    </AppPage>
  );
}
