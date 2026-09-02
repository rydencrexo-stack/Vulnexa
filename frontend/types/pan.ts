export type Role = "user" | "analyst" | "admin";

export type Severity = "critical" | "high" | "medium" | "low" | "informational";
export type ScanStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type VerificationStatus = "verified" | "pending" | "failed" | "unverified";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  organization: string;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  targetCount: number;
  memberCount: number;
}

export interface TargetScope {
  includedHosts: string[];
  excludedHosts: string[];
  includedPaths: string[];
  excludedPaths: string[];
  allowedPorts: number[];
}

export interface Target {
  id: string;
  name: string;
  baseUrl: string;
  domain: string;
  environment: "production" | "staging" | "development" | "other";
  verificationStatus: VerificationStatus;
  verificationMethod: "dns_txt" | "file" | "meta_tag" | "mock" | "html_file" | "http_header";
  lastScan: string | null;
  assets: number;
  endpoints: number;
  findings: number;
  risk: Severity | "none";
  scope: TargetScope;
  authenticationProfile: string | null;
  createdAt: string;
}

export interface Asset {
  id: string;
  targetId: string;
  targetName: string;
  hostname: string;
  domain: string;
  ip: string;
  port: number;
  protocol: "https" | "http";
  httpStatus: number;
  pageTitle: string;
  technologies: string[];
  tls: string;
  firstSeen: string;
  lastSeen: string;
  discoverySource: string;
  risk: Severity | "none";
  type: "subdomain" | "live_host";
  company?: string;
  kind?: string;
}

export type TopologyKind =
  | "internet"
  | "domain"
  | "web"
  | "api"
  | "waf"
  | "server"
  | "database"
  | "router"
  | "device"
  | "cloud"
  | "vuln";

export interface TopologyNode {
  id: string;
  label: string;
  kind: TopologyKind;
  x: number;
  y: number;
  ip?: string;
  port?: number;
  services?: string[];
  tech?: string[];
  risk?: Severity;
  note?: string;
}

export interface TopologyLink {
  from: string;
  to: string;
  label?: string;
  kind?: "edge" | "wan" | "lan";
}

export interface Company {
  slug: string;
  name: string;
  tagline: string;
  industry: string;
  location: string;
  color: string;
  soft: string;
  mark: string;
  assetCount: number;
  endpointCount: number;
  findingCount: number;
  risk: Severity | "none";
  domain: string;
  securityScore: number;
}

export interface CompanyTopology {
  companySlug: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
}

export interface EndpointParameter {
  name: string;
  location: "query" | "path" | "header" | "body" | "cookie";
  type: string;
  required: boolean;
}

export interface Endpoint {
  id: string;
  targetId: string;
  targetName: string;
  assetId: string;
  url: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  contentType: string;
  parameters: EndpointParameter[];
  authenticationRequired: boolean;
  observedRole: string;
  discoverySource: string;
  statusCode: number;
  fingerprint: string;
  testsCompleted: number;
  relatedFindings: number;
  firstSeen: string;
  lastSeen: string;
  kind: "web" | "api" | "javascript" | "historical";
}

export interface Scan {
  id: string;
  name: string;
  targetName: string;
  status: ScanStatus;
  progress: number;
  phase: string;
  profile: string;
  findings: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ScanEvent {
  id: string;
  level: string;
  phase: string;
  message: string;
  progress: number;
  createdAt: string;
}

export interface ScanStatistics {
  assetsFound: number;
  endpointsFound: number;
  parametersTested: number;
  requestsSent: number;
  candidateFindings: number;
  confirmedFindings: number;
}

export interface ScanDetail extends Scan {
  targetId: string;
  modules: string[];
  speed: string;
  requestLimit: number;
  concurrency: number;
  currentPhase: string;
  statistics: ScanStatistics;
  warnings: string[];
  events: ScanEvent[];
  externalReference?: {
    kind?: string;
    domain?: string | null;
    assetTotal?: number;
    relationshipCount?: number;
    riskScore?: number;
    findingCount?: number;
  } | null;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  confidence: number;
  verificationState: string;
  targetName: string;
  endpoint: string;
  source: string;
  createdAt: string;
}

export interface FindingDetail extends Finding {
  targetId: string;
  scanId: string | null;
  assetId: string | null;
  endpointId: string | null;
  type: string;
  status: string;
  method: string;
  parameter: string | null;
  cwe: string | null;
  owasp: string | null;
  cvss: { version: string; score: number; vector: string };
  description: string;
  impact: string;
  evidence: {
    requestId?: string | null;
    responseId?: string | null;
    references: string[];
    screenshot?: string | null;
    browserVerified: boolean;
    summary?: string | null;
  };
  sanitizedRequest: string | null;
  sanitizedResponse: string | null;
  reproductionSteps: string[];
  aiAnalysis: AIAnalysisResult | null;
  remediation: string;
  assignedTo: string | null;
  timeline: Array<{ timestamp: string; actorId: string; action: string; note?: string | null }>;
  retestHistory: Array<{ id: string; requestedAt: string; requestedBy: string; status: string; completedAt?: string | null; outcome?: string | null }>;
}

export interface AIAnalysisResult {
  summary: string;
  vulnerabilityType: string;
  confidence: number;
  verificationRecommendation: string;
  evidenceUsed: string[];
  impact: string;
  remediation: string[];
  safeNextSteps: string[];
  limitations: string[];
}

export interface ReconJob {
  id: string;
  targetId: string;
  name: string;
  modules: string[];
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  currentModule: string | null;
  statistics: { assetsFound?: number; endpointsFound?: number };
  logs: string[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface ReportRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  formats: string[];
  files: Record<string, string>;
  generatedAt: string | null;
  createdAt: string;
}

export interface AgentFinding {
  title: string;
  severity: Severity | string;
  confidence: number;
  source?: string;
  endpoint?: string;
  rationale?: string;
}

export interface AiTriageResult {
  summary: string;
  confidence: number;
  prioritised: Array<{ title: string; rationale: string }>;
  raw?: string;
}

export interface AgentRunResult {
  status: string;
  reportId: string;
  name: string;
  target: { host: string; domain: string };
  auth: string;
  phases: string[];
  skills: string[];
  assets: Array<{ hostname: string; url: string; status: number; title: string; technologies: string[] }>;
  endpoints: Array<{ url: string; method: string; kind: string; source: string }>;
  findings: AgentFinding[];
  evidenceSummary: { subdomains: number; archiveUrls: number; paths: number; jsBundles: number; emails: number; github: Array<{ repo?: string; path?: string }> | null; virustotal: { status: string; malicious?: number; suspicious?: number; harmless?: number; subdomains?: number } | null };
  artifacts: Record<string, string>;
  generatedAt: string;
}

export interface Notification {
  id: string;
  category: "scan" | "finding" | "asset" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  severity: "info" | "success" | "warning" | "danger";
  href: string;
}

export interface TrendPoint {
  label: string;
  critical: number;
  high: number;
  medium: number;
  resolved: number;
}

export interface DashboardSummary {
  metrics: {
    targets: number;
    verifiedAssets: number;
    endpoints: number;
    runningScans: number;
    confirmedFindings: number;
    candidateFindings: number;
  };
  severity: Record<Severity, number>;
  trend: TrendPoint[];
  recentAssets: Asset[];
  recentScans: Scan[];
  recentFindings: Finding[];
  securityScore: number;
  coverage: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorShape {
  detail?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

export type PassiveFindingSeverity = "critical" | "high" | "medium" | "low" | "informational";

export interface PassiveFinding {
  id: string;
  title: string;
  severity: PassiveFindingSeverity;
  category: string;
  description: string;
  evidence: string;
  recommendation: string;
  url: string;
}

export interface PassiveCheck {
  category: string;
  name: string;
  status: "pass" | "warn" | "fail" | "info";
  evidence: string;
  recommendation: string;
}

export interface PassiveAsset {
  hostname: string;
  ip: string;
  ips?: string[];
  kind: string;
  cname?: string | null;
  httpStatus?: number | null;
  url?: string;
  technologies?: string[];
}

export interface ComboSearchResponse {
  format: string;
  searchType: "domain" | "login" | "password" | "mail" | "keyword";
  query: string;
  premium: boolean;
  total: number;
  shown: number;
  freeSample: number;
  premiumSample: number;
  linesScanned: number;
  filesScanned: number;
  logins: string[];
  preview: string[];
  results: string[];
}

export interface PassiveScanResult {
  domain: string;
  scannedAt: string;
  durationSeconds: number;
  url: string;
  errors: string[];
  tls?: { version?: string; daysLeft?: number | null; issuer?: unknown; error?: string | null };
  summary: {
    riskScore: number;
    counts: Record<PassiveFindingSeverity, number>;
    severityBreakdown: Record<PassiveFindingSeverity, number>;
    checksPassed: number;
    checksFailed: number;
    checksWarned: number;
    assets: number;
    technologies: number;
  };
  findings: PassiveFinding[];
  checks: PassiveCheck[];
  assets: PassiveAsset[];
  technologies: string[];
  log: string[];
}

export interface SurfaceAsset {
  id: string;
  type: string;
  value: string;
  scope: "in_scope" | "needs_review" | "out_of_scope" | "unknown";
  confidence: "high" | "medium" | "low" | "historical";
  firstSeen?: string | null;
  lastSeen?: string | null;
  sources: string[];
  metadata: Record<string, unknown>;
  evidence: Array<{ source: string; detail: string; observedAt: string }>;
  score: number;
  priority: "high" | "review" | "historical" | "informational";
  historical?: boolean;
  resolves?: boolean;
  httpStatus?: number;
  urlCount?: number;
}

export interface SurfaceRelationship {
  source: string;
  target: string;
  type: string;
  sources: string[];
  confidence: string;
  observedAt: string;
  evidence: Array<{ source: string; detail: string; observedAt: string }>;
}

export interface SurfaceTimelineEntry {
  date: string;
  event: string;
  asset: string;
  source: string;
}

export interface SurfaceScanResult {
  domain: string;
  scannedAt: string;
  durationSeconds: number;
  errors: string[];
  sourcesUsed: string[];
  sourceCounts: Record<string, number>;
  checks: PassiveCheck[];
  findings: PassiveFinding[];
  technologies: string[];
  tls?: { version?: string; daysLeft?: number | null; issuer?: unknown; error?: string | null };
  assets: SurfaceAsset[];
  relationships: SurfaceRelationship[];
  timeline: SurfaceTimelineEntry[];
  summary: {
    riskScore: number;
    assetCounts: Record<string, number>;
    assetTotal: number;
    relationshipCount: number;
    inScopeAssets: number;
    highConfidenceAssets: number;
    resolvingHosts: number;
    priorityTiers: { high: string[]; review: string[]; historical: string[]; informational: string[] };
    findingCounts: Record<PassiveFindingSeverity, number>;
    sourcesUsed: string[];
    rootDomain: string;
  };
  log: string[];
}

export interface ScanSurfaceResponse {
  scanId: string;
  status: string;
  stored: boolean;
  surface: SurfaceScanResult | null;
}

export interface XssFinding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  type: string;
  typeLabel: string;
  confidence: string;
  confidenceReason: string;
  cwe: string;
  method: string;
  param: string;
  payload: string;
  injectType: string;
  location: string;
  detectionMethod: string;
  evidence: string;
  url: string;
  pocCurl: string;
}

export interface XssScanResult {
  target: string;
  scannedAt: string;
  durationSeconds: number;
  cliInstalled: boolean;
  cli: {
    binary: string | null;
    command: string[];
    commandString: string;
    version: string | null;
    output: string[];
    exitCode: number | null;
  };
  summary: {
    findingsCount: number;
    totalRequests: number;
    scanDurationMs: number;
    incomplete: boolean;
    status: string;
    targetSummary?: Array<{ findings_count?: number; status?: string; target?: string }>;
  };
  findings: XssFinding[];
  errors: string[];
}

export interface ToolFinding {
  id: string;
  title: string;
  severity: string;
  param?: string;
  payload?: string;
  url?: string;
  evidence?: string;
  pocCurl?: string;
  location?: string;
  detection?: string;
  statusCode?: number;
  source?: string;
  value?: string;
  entropy?: number;
  engine?: string;
  type?: string;
  templateId?: string;
  matchedAt?: string;
  curl?: string;
  cwe?: string;
  confidence?: string;
  [key: string]: unknown;
}

export interface ToolScanResult {
  tool: string;
  target: string;
  scannedAt: string;
  durationSeconds: number;
  cliInstalled: boolean;
  cli: {
    binary: string | null;
    installed: boolean;
    command: string[];
    commandString: string;
    exitCode: number | null;
    rawOutput?: string;
    output?: string[];
    timedOut?: boolean;
  };
  summary: Record<string, unknown> & { findingsCount: number; status?: string };
  findings: ToolFinding[];
  errors: string[];
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
  fieldErrors?: Record<string, string>;
}
