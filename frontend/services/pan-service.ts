import { ApiError, apiRequest, unwrapItems } from "@/services/api";
import {
  mockAssets,
  mockDashboard,
  mockEndpoints,
  mockFindings,
  mockNotifications,
  mockScans,
  mockTargets,
  mockUser,
  mockWorkspaces,
} from "@/services/mock-data";
import type {
  AgentRunResult,
  Asset,
  ComboSearchResponse,
  DashboardSummary,
  Endpoint,
  Finding,
  FindingDetail,
  AIAnalysisResult,
  Notification,
  PassiveScanResult,
  ScanSurfaceResponse,
  SurfaceScanResult,
  ToolScanResult,
  XssScanResult,
  ReconJob,
  ReportRecord,
  Role,
  Scan,
  ScanDetail,
  ScanStatus,
  Severity,
  Target,
  User,
  VerificationStatus,
  Workspace,
} from "@/types/pan";

const STORAGE = {
  targets: "pan_demo_targets",
  notifications: "pan_demo_notifications",
};

type ApiEnvelope<T> = { items: T[]; total?: number; page?: number; pageSize?: number };

interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId?: string | null;
}

interface ApiWorkspace {
  id: string;
  name: string;
  memberIds?: string[];
}

interface ApiTarget {
  id: string;
  name: string;
  baseUrl: string;
  domain: string;
  environment: Target["environment"];
  verification: { status: VerificationStatus; method: Target["verificationMethod"] };
  scope: Target["scope"];
  authenticationProfileId?: string | null;
  lastScanAt?: string | null;
  risk?: Target["risk"] | "unknown";
  createdAt: string;
  counts?: { assets?: number; endpoints?: number; findings?: number };
}

interface ApiAsset {
  id: string;
  targetId: string;
  hostname: string;
  domain: string;
  ip?: string | null;
  port: number;
  protocol: "http" | "https";
  httpStatus?: number | null;
  pageTitle?: string | null;
  technologies?: string[];
  tls?: Record<string, unknown>;
  firstSeen: string;
  lastSeen: string;
  discoverySource: string;
  riskState?: Severity | "none" | "unknown" | "review";
  kind?: Asset["type"];
}

interface ApiEndpointParameter {
  name: string;
  location: Endpoint["parameters"][number]["location"];
  dataType?: string;
  type?: string;
  required?: boolean;
}

interface ApiEndpoint {
  id: string;
  targetId: string;
  assetId: string;
  url: string;
  normalizedPath: string;
  method: Endpoint["method"];
  contentType?: string | null;
  parameters?: ApiEndpointParameter[];
  authenticationRequired?: boolean;
  observedRole?: string | null;
  discoverySource: string;
  statusCode?: number | null;
  responseFingerprint?: string | null;
  testsCompleted?: string[];
  findings?: unknown[];
  firstSeen: string;
  lastSeen: string;
  kind?: Endpoint["kind"];
}

interface ApiScan {
  id: string;
  targetId: string;
  name: string;
  status: ScanStatus;
  progress: number;
  currentPhase: string;
  profile: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  findings?: unknown[];
  statistics?: { candidateFindings?: number; confirmedFindings?: number };
}

interface ApiFinding {
  id: string;
  targetId: string;
  endpointId?: string | null;
  title: string;
  severity: Severity;
  confidence: number;
  verificationState: string;
  method?: string;
  parameter?: string | null;
  source: string;
  createdAt: string;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  severity: string;
  link?: string | null;
}

interface ApiDashboard {
  totals: {
    targets: number;
    verifiedAssets: number;
    endpoints: number;
    runningScans: number;
    confirmedFindings: number;
    candidateFindings: number;
  };
  findingsBySeverity: Record<Severity, number>;
  findingsTrend: Array<{ date: string; count: number }>;
  recentAssets: ApiAsset[];
  recentScans: ApiScan[];
  recentFindings: ApiFinding[];
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

function unavailable(error: unknown): boolean {
  // Fall back to demo data when the request is non-ApiError OR the backend
  // refused us for lack of auth (401/403) — so demo mode still renders.
  // Genuine server errors (500, 422, network misconfig) still surface.
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  return true;
}

async function fallbackOnUnavailable<T>(request: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!unavailable(error)) throw error;
    return fallback();
  }
}

function targetMap(targets: Target[]): Map<string, Target> {
  return new Map(targets.map((target) => [target.id, target]));
}

function normalizeUser(value: ApiUser): User {
  return {
    id: value.id,
    name: value.fullName,
    email: value.email,
    role: value.role,
    organization: value.organizationId ? "Authorized Demo Lab" : "Personal workspace",
  };
}

function normalizeWorkspace(value: ApiWorkspace): Workspace {
  return {
    id: value.id,
    name: value.name,
    plan: "Hackathon Pro",
    targetCount: 0,
    memberCount: value.memberIds?.length ?? 1,
  };
}

function normalizeTarget(value: ApiTarget): Target {
  return {
    id: value.id,
    name: value.name,
    baseUrl: value.baseUrl,
    domain: value.domain,
    environment: value.environment,
    verificationStatus: value.verification.status,
    verificationMethod: value.verification.method,
    lastScan: value.lastScanAt ?? null,
    assets: value.counts?.assets ?? 0,
    endpoints: value.counts?.endpoints ?? 0,
    findings: value.counts?.findings ?? 0,
    risk: value.risk && value.risk !== "unknown" ? value.risk : "none",
    scope: value.scope,
    authenticationProfile: value.authenticationProfileId ?? null,
    createdAt: value.createdAt,
  };
}

function normalizeAsset(value: ApiAsset, targets: Map<string, Target>): Asset {
  const tls = value.tls ?? {};
  const tlsLabel = Object.keys(tls).length
    ? [
        tls.valid === true ? "valid" : tls.valid === false ? "invalid" : null,
        typeof tls.issuer === "string" ? tls.issuer : null,
        typeof tls.expiresInDays === "number" ? `${tls.expiresInDays}d` : null,
      ].filter(Boolean).join(" · ")
    : "Not observed";
  const risk = value.riskState;
  return {
    id: value.id,
    targetId: value.targetId,
    targetName: targets.get(value.targetId)?.name ?? "Authorized target",
    hostname: value.hostname,
    domain: value.domain,
    ip: value.ip ?? "Not resolved",
    port: value.port,
    protocol: value.protocol,
    httpStatus: value.httpStatus ?? 0,
    pageTitle: value.pageTitle ?? "Untitled service",
    technologies: value.technologies ?? [],
    tls: tlsLabel || "Observed",
    firstSeen: value.firstSeen,
    lastSeen: value.lastSeen,
    discoverySource: value.discoverySource,
    risk: risk === "critical" || risk === "high" || risk === "medium" || risk === "low" || risk === "informational" ? risk : "none",
    type: value.kind ?? (value.httpStatus ? "live_host" : "subdomain"),
  };
}

function normalizeEndpoint(value: ApiEndpoint, targets: Map<string, Target>): Endpoint {
  return {
    id: value.id,
    targetId: value.targetId,
    targetName: targets.get(value.targetId)?.name ?? "Authorized target",
    assetId: value.assetId,
    url: value.url,
    path: value.normalizedPath,
    method: value.method,
    contentType: value.contentType ?? "unknown",
    parameters: (value.parameters ?? []).map((parameter) => ({
      name: parameter.name,
      location: parameter.location,
      type: parameter.dataType ?? parameter.type ?? "string",
      required: parameter.required ?? false,
    })),
    authenticationRequired: value.authenticationRequired ?? false,
    observedRole: value.observedRole ?? "not observed",
    discoverySource: value.discoverySource,
    statusCode: value.statusCode ?? 0,
    fingerprint: value.responseFingerprint ?? "not captured",
    testsCompleted: value.testsCompleted?.length ?? 0,
    relatedFindings: value.findings?.length ?? 0,
    firstSeen: value.firstSeen,
    lastSeen: value.lastSeen,
    kind: value.kind ?? "web",
  };
}

function normalizeScan(value: ApiScan, targets: Map<string, Target>): Scan {
  return {
    id: value.id,
    name: value.name,
    targetName: targets.get(value.targetId)?.name ?? "Authorized target",
    status: value.status,
    progress: value.progress,
    phase: value.currentPhase.replaceAll("_", " "),
    profile: value.profile,
    findings: value.findings?.length ?? (value.statistics?.candidateFindings ?? 0) + (value.statistics?.confirmedFindings ?? 0),
    startedAt: value.startedAt ?? value.createdAt,
    completedAt: value.completedAt ?? null,
  };
}

function normalizeFinding(value: ApiFinding, targets: Map<string, Target>): Finding {
  return {
    id: value.id,
    title: value.title,
    severity: value.severity,
    confidence: value.confidence,
    verificationState: value.verificationState,
    targetName: targets.get(value.targetId)?.name ?? "Authorized target",
    endpoint: `${value.method ?? "HTTP"} ${value.parameter ? `parameter ${value.parameter}` : value.endpointId ?? "stored evidence"}`,
    source: value.source,
    createdAt: value.createdAt,
  };
}

function normalizeFindingDetail(value: FindingDetail, targets: Map<string, Target>): FindingDetail {
  return {
    ...value,
    targetName: targets.get(value.targetId)?.name ?? "Authorized target",
    endpoint: `${value.method} ${value.parameter ? `parameter ${value.parameter}` : value.endpointId ?? "stored evidence"}`,
  };
}

function normalizeScanDetail(value: ApiScan & Omit<ScanDetail, keyof Scan>): ScanDetail {
  const target: Target = {
    id: value.targetId,
    name: "Authorized target",
    baseUrl: "https://authorized.invalid",
    domain: "authorized.invalid",
    environment: "staging",
    verificationStatus: "verified",
    verificationMethod: "mock",
    lastScan: null,
    assets: 0,
    endpoints: 0,
    findings: 0,
    risk: "none",
    scope: { includedHosts: [], excludedHosts: [], includedPaths: [], excludedPaths: [], allowedPorts: [] },
    authenticationProfile: null,
    createdAt: value.createdAt,
  };
  const scan = normalizeScan(value, new Map([[target.id, target]]));
  return {
    ...scan,
    targetId: value.targetId,
    modules: value.modules ?? [],
    speed: value.speed ?? "balanced",
    requestLimit: value.requestLimit ?? 1000,
    concurrency: value.concurrency ?? 2,
    currentPhase: value.currentPhase,
    statistics: value.statistics ?? { assetsFound: 0, endpointsFound: 0, parametersTested: 0, requestsSent: 0, candidateFindings: 0, confirmedFindings: 0 },
    warnings: value.warnings ?? [],
    events: value.events ?? [],
  };
}

function normalizeNotification(value: ApiNotification): Notification {
  const category: Notification["category"] = value.type.includes("finding")
    ? "finding"
    : value.type.includes("asset")
      ? "asset"
      : value.type.includes("scan")
        ? "scan"
        : "system";
  const severity: Notification["severity"] = value.severity === "critical" || value.severity === "high"
    ? "danger"
    : value.severity === "medium"
      ? "warning"
      : value.severity === "success"
        ? "success"
        : "info";
  return {
    id: value.id,
    category,
    title: value.title,
    message: value.message,
    createdAt: value.createdAt,
    read: value.read,
    severity,
    href: value.link ?? "/notifications/all",
  };
}

function canonicalVerificationMethod(value: Target["verificationMethod"]): "dns_txt" | "file" | "meta_tag" | "mock" {
  if (value === "html_file") return "file";
  if (value === "http_header") return "meta_tag";
  return value;
}

async function firstWorkspaceId(): Promise<string> {
  const workspaces = await panService.getWorkspaces();
  return workspaces[0]?.id ?? "wsp_11111111-1111-4111-8111-111111111111";
}

function mergeDedup<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const byId = new Map<string, T>(primary.map((item) => [item.id, item]));
  extra.forEach((item) => { if (!byId.has(item.id)) byId.set(item.id, item); });
  return Array.from(byId.values());
}

export const panService = {
  getCurrentUser: () => fallbackOnUnavailable(
    async () => normalizeUser((await apiRequest<{ user: ApiUser }>("/api/auth/me")).user),
    () => mockUser,
  ),

  getWorkspaces: () => fallbackOnUnavailable(
    async () => (await apiRequest<ApiWorkspace[]>("/api/workspaces")).map(normalizeWorkspace),
    () => mockWorkspaces,
  ),

  createWorkspace: async (input: { name: string; industry: string }) => fallbackOnUnavailable(
    async () => normalizeWorkspace(await apiRequest<ApiWorkspace>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: input.name }),
    })),
    () => ({ id: `workspace_${Date.now()}`, name: input.name, plan: "Hackathon Pro", targetCount: 0, memberCount: 1 }),
  ),

  getTargets: () => fallbackOnUnavailable(
    async () => mergeDedup(unwrapItems(await apiRequest<ApiTarget[] | ApiEnvelope<ApiTarget>>("/api/targets")).map(normalizeTarget), mockTargets),
    () => readLocal(STORAGE.targets, mockTargets),
  ),

  getTarget: async (id: string) => fallbackOnUnavailable(
    async () => normalizeTarget(await apiRequest<ApiTarget>(`/api/targets/${id}`)),
    () => readLocal(STORAGE.targets, mockTargets).find((target) => target.id === id) ?? mockTargets[0],
  ),

  createTarget: async (input: Omit<Target, "id" | "createdAt" | "lastScan" | "assets" | "endpoints" | "findings" | "risk">) => fallbackOnUnavailable(
    async () => {
      const workspaceId = await firstWorkspaceId();
      const created = await apiRequest<ApiTarget>("/api/targets", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          name: input.name,
          baseUrl: input.baseUrl,
          domain: input.domain,
          environment: input.environment,
          verificationMethod: canonicalVerificationMethod(input.verificationMethod),
          scope: input.scope,
          scanProfile: "balanced",
          authorizationAcknowledged: true,
        }),
      });
      return normalizeTarget(created);
    },
    () => {
      const target: Target = { ...input, id: `target_${Date.now()}`, createdAt: new Date().toISOString(), lastScan: null, assets: 0, endpoints: 0, findings: 0, risk: "none" };
      const targets = readLocal(STORAGE.targets, mockTargets);
      writeLocal(STORAGE.targets, [target, ...targets]);
      return target;
    },
  ),

  updateTarget: async (id: string, patch: Partial<Target>) => fallbackOnUnavailable(
    async () => {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.environment !== undefined) body.environment = patch.environment;
      if (patch.scope !== undefined) body.scope = patch.scope;
      if (patch.authenticationProfile !== undefined) body.authenticationProfileId = patch.authenticationProfile;
      return normalizeTarget(await apiRequest<ApiTarget>(`/api/targets/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
    },
    () => {
      const targets = readLocal(STORAGE.targets, mockTargets);
      const updated = targets.map((target) => (target.id === id ? { ...target, ...patch } : target));
      writeLocal(STORAGE.targets, updated);
      return updated.find((target) => target.id === id) ?? updated[0];
    },
  ),

  verifyTarget: async (id: string) => fallbackOnUnavailable(
    async () => normalizeTarget(await apiRequest<ApiTarget>(`/api/targets/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ method: "mock", authorizationAcknowledged: true }),
    })),
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return panService.updateTarget(id, { verificationStatus: "verified" });
    },
  ),

  getAssets: async () => fallbackOnUnavailable(
    async () => {
      const [response, targets] = await Promise.all([
        apiRequest<ApiAsset[] | ApiEnvelope<ApiAsset>>("/api/assets"),
        panService.getTargets(),
      ]);
      const names = targetMap(targets);
      return mergeDedup(unwrapItems(response).map((asset) => normalizeAsset(asset, names)), mockAssets);
    },
    () => mockAssets,
  ),

  getAsset: async (id: string) => fallbackOnUnavailable(
    async () => normalizeAsset(await apiRequest<ApiAsset>(`/api/assets/${id}`), targetMap(await panService.getTargets())),
    () => mockAssets.find((asset) => asset.id === id) ?? mockAssets[0],
  ),

  getEndpoints: async () => fallbackOnUnavailable(
    async () => {
      const [response, targets] = await Promise.all([
        apiRequest<ApiEndpoint[] | ApiEnvelope<ApiEndpoint>>("/api/endpoints"),
        panService.getTargets(),
      ]);
      const names = targetMap(targets);
      return mergeDedup(unwrapItems(response).map((endpoint) => normalizeEndpoint(endpoint, names)), mockEndpoints);
    },
    () => mockEndpoints,
  ),

  getEndpoint: async (id: string) => fallbackOnUnavailable(
    async () => normalizeEndpoint(await apiRequest<ApiEndpoint>(`/api/endpoints/${id}`), targetMap(await panService.getTargets())),
    () => mockEndpoints.find((endpoint) => endpoint.id === id) ?? mockEndpoints[0],
  ),

  getScans: async () => fallbackOnUnavailable(
    async () => {
      const [response, targets] = await Promise.all([
        apiRequest<ApiScan[] | ApiEnvelope<ApiScan>>("/api/scans"),
        panService.getTargets(),
      ]);
      const names = targetMap(targets);
      return mergeDedup(unwrapItems(response).map((scan) => normalizeScan(scan, names)), mockScans);
    },
    () => mockScans,
  ),

  getScan: async (id: string) => fallbackOnUnavailable(
    async () => normalizeScanDetail(await apiRequest<ApiScan & Omit<ScanDetail, keyof Scan>>(`/api/scans/${id}`)),
    () => ({
      ...mockScans[0],
      id,
      targetId: mockTargets[0].id,
      modules: ["subdomains", "url_discovery", "passive", "xss", "ai_analysis"],
      speed: "balanced",
      requestLimit: 2500,
      concurrency: 3,
      currentPhase: "active_testing",
      statistics: { assetsFound: 14, endpointsFound: 312, parametersTested: 91, requestsSent: 840, candidateFindings: 7, confirmedFindings: 2 },
      warnings: ["Mock mode: no live scanner commands are running."],
      events: [],
    }),
  ),

  controlScan: async (id: string, action: "pause" | "resume" | "cancel") => fallbackOnUnavailable(
    async () => {
      await apiRequest(`/api/scans/${id}/${action}`, { method: "POST" });
      return panService.getScan(id);
    },
    async () => panService.getScan(id),
  ),

  deleteScan: async (id: string) => fallbackOnUnavailable(
    async () => {
      await apiRequest(`/api/scans/${id}`, { method: "DELETE" });
      return true;
    },
    async () => {
      // Demo fallback: drop from the local mock list (handled by the caller's refresh).
      return true;
    },
  ),

  getFindings: async () => fallbackOnUnavailable(
    async () => {
      const [response, targets] = await Promise.all([
        apiRequest<ApiFinding[] | ApiEnvelope<ApiFinding>>("/api/findings"),
        panService.getTargets(),
      ]);
      const names = targetMap(targets);
      return mergeDedup(unwrapItems(response).map((finding) => normalizeFinding(finding, names)), mockFindings);
    },
    () => mockDashboard.recentFindings,
  ),

  getFinding: async (id: string) => fallbackOnUnavailable(
    async () => normalizeFindingDetail(await apiRequest<FindingDetail>(`/api/findings/${id}`), targetMap(await panService.getTargets())),
    () => null,
  ),

  retestFinding: async (id: string) => apiRequest<FindingDetail>(`/api/findings/${id}/retest`, {
    method: "POST",
    body: JSON.stringify({ authorizationAcknowledged: true, note: "Requested from the PAN analyst workspace" }),
  }),

  analyzeFinding: async (id: string) => apiRequest<AIAnalysisResult>("/api/ai/analyze-finding", {
    method: "POST",
    body: JSON.stringify({ findingId: id }),
  }),

  startRecon: async (input: { targetId: string; name: string; modules: string[] }) => {
    const workspaceId = await firstWorkspaceId();
    return apiRequest<ReconJob>("/api/recon/jobs", {
      method: "POST",
      body: JSON.stringify({ ...input, workspaceId, authorizationAcknowledged: true }),
    });
  },

  getRecon: async (id: string) => apiRequest<ReconJob>(`/api/recon/jobs/${id}`),

  cancelRecon: async (id: string) => apiRequest<ReconJob>(`/api/recon/jobs/${id}/cancel`, { method: "POST" }),

  createReport: async (input: { name: string; type: string; targetId?: string; scanId?: string; formats: string[] }) => {
    const workspaceId = await firstWorkspaceId();
    return apiRequest<ReportRecord>("/api/reports", { method: "POST", body: JSON.stringify({ ...input, workspaceId }) });
  },

  runAgent: async (input: { targetId?: string; domain?: string; host?: string; phases: string[]; skills: string[]; auth: string }) => {
    const workspaceId = await firstWorkspaceId();
    return apiRequest<AgentRunResult>("/api/agent/run", { method: "POST", body: JSON.stringify({ ...input, workspaceId }) });
  },

  runPassiveScan: async (input: { domain: string; probeSubdomains?: boolean }) => {
    return apiRequest<PassiveScanResult>("/api/scanner/passive/analyze", {
      method: "POST",
      body: JSON.stringify({ domain: input.domain, probe_subdomains: input.probeSubdomains ?? true }),
      signal: AbortSignal.timeout(120_000),
    });
  },

  runSurfaceScan: async (input: { domain: string; probeSubdomains?: boolean }) => {
    return apiRequest<SurfaceScanResult>("/api/scanner/surface", {
      method: "POST",
      body: JSON.stringify({ domain: input.domain, probe_subdomains: input.probeSubdomains ?? true }),
      signal: AbortSignal.timeout(180_000),
    });
  },

  getScanSurface: async (scanId: string) => {
    return apiRequest<ScanSurfaceResponse>(`/api/scans/${scanId}/surface`);
  },

  runXssScan: async (input: { target: string; timeoutSeconds?: number }) => {
    return apiRequest<XssScanResult>("/api/scanner/xss/analyze", {
      method: "POST",
      body: JSON.stringify({ target: input.target, timeout_seconds: input.timeoutSeconds ?? 150 }),
      signal: AbortSignal.timeout(300_000),
    });
  },

  runToolScan: async (tool: string, input: Record<string, unknown>) => {
    const endpoints: Record<string, string> = {
      "open-redirect": "/api/scanner/open-redirect/analyze",
      secrets: "/api/scanner/secrets/analyze",
      cves: "/api/scanner/cves/analyze",
      ssti: "/api/scanner/ssti/analyze",
      sqli: "/api/scanner/sqli/analyze",
      ssrf: "/api/scanner/ssrf/analyze",
    };
    return apiRequest<ToolScanResult>(endpoints[tool], {
      method: "POST",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(600_000),
    });
  },

  scanAgent: async (input: { domain: string; host?: string; phases: string[]; skills: string[]; auth: string }) => {
    return apiRequest<AgentRunResult>("/api/agent/scan", { method: "POST", body: JSON.stringify(input) }, 120_000);
  },

  getAgentWsToken: async () => {
    const data = await apiRequest<{ token: string }>("/api/agent/ws-token", { method: "POST" });
    return data.token;
  },

  fastChat: async (messages: Array<{ role: string; content: string }>, context = "") => {
    try {
      const data = await apiRequest<{ reply: string }>("/api/agent/chat-fast", { method: "POST", body: JSON.stringify({ messages, context }) }, 70_000);
      return data.reply;
    } catch {
      return null;
    }
  },

  runReconModule: async (module: string, url: string) => {
    const realModules = ["subdomains", "live-hosts", "url-discovery", "web-archive", "ports", "technologies"];
    if (!realModules.includes(module)) return null;
    try {
      const urls = url.split(/[\s,]+/).filter(Boolean);
      const body = module === "live-hosts" ? { url: urls[0] ?? "", urls } : { url: urls[0] ?? "" };
      return await apiRequest<{ target: string; items: unknown[]; summary: string }>(`/api/recon/modules/${module}`, {
        method: "POST",
        body: JSON.stringify(body),
      }, 300_000);
    } catch {
      return null;
    }
  },

  searchCombo: async (input: { searchType: "domain" | "login" | "password" | "mail" | "keyword"; query: string; premium: boolean }) => {
    return apiRequest<ComboSearchResponse>("/api/combo/search", {
      method: "POST",
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    });
  },

  getDashboard: async () => fallbackOnUnavailable(
    async () => {
      const [raw, targets] = await Promise.all([
        apiRequest<ApiDashboard>("/api/dashboard/summary"),
        panService.getTargets(),
      ]);
      const names = targetMap(targets);
      const totalFindings = Object.values(raw.findingsBySeverity).reduce((sum, value) => sum + value, 0);
      const coverage = raw.totals.targets ? Math.round((targets.filter((target) => target.verificationStatus === "verified").length / raw.totals.targets) * 100) : 0;
      return {
        metrics: raw.totals,
        severity: raw.findingsBySeverity,
        trend: raw.findingsTrend.map((point) => ({
          label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          critical: 0,
          high: point.count,
          medium: 0,
          resolved: 0,
        })),
        recentAssets: raw.recentAssets.map((asset) => normalizeAsset(asset, names)),
        recentScans: raw.recentScans.map((scan) => normalizeScan(scan, names)),
        recentFindings: raw.recentFindings.map((finding) => normalizeFinding(finding, names)),
        securityScore: Math.max(0, Math.min(100, 100 - (raw.findingsBySeverity.critical * 18 + raw.findingsBySeverity.high * 8 + raw.findingsBySeverity.medium * 3))),
        coverage: totalFindings || raw.totals.endpoints ? coverage : 0,
      } satisfies DashboardSummary;
    },
    () => mockDashboard,
  ),

  getNotifications: () => fallbackOnUnavailable(
    async () => unwrapItems(await apiRequest<ApiNotification[] | ApiEnvelope<ApiNotification>>("/api/notifications")).map(normalizeNotification),
    () => readLocal(STORAGE.notifications, mockNotifications),
  ),

  markNotificationRead: async (id: string, read = true) => fallbackOnUnavailable(
    async () => normalizeNotification(await apiRequest<ApiNotification>(`/api/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ read }) })),
    () => {
      const notifications = readLocal(STORAGE.notifications, mockNotifications);
      const updated = notifications.map((notification) => (notification.id === id ? { ...notification, read } : notification));
      writeLocal(STORAGE.notifications, updated);
      return updated.find((notification) => notification.id === id) ?? updated[0];
    },
  ),

  startScan: async (input: Record<string, unknown>) => fallbackOnUnavailable(
    async () => {
      const moduleMap: Record<string, string[]> = {
        recon: ["subdomains", "live_hosts", "url_discovery"],
        reconnaissance: ["subdomains", "live_hosts", "url_discovery"],
        endpoint_discovery: ["url_discovery"],
        passive_analysis: ["passive"],
        surface: ["surface"],
        surface_discovery: ["surface"],
        "ai-analysis": ["ai_analysis"],
      };
      const requested = Array.isArray(input.modules) ? input.modules.filter((value): value is string => typeof value === "string") : ["passive"];
      const modules = [...new Set(requested.flatMap((module) => moduleMap[module] ?? [module]))];
      const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId : await firstWorkspaceId();
      return apiRequest<ApiScan>("/api/scans", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          targetId: input.targetId,
          name: input.name ?? "PAN authorized scan",
          profile: input.profile ?? "balanced",
          modules,
          speed: input.speed === "standard" ? "balanced" : input.speed ?? "balanced",
          requestLimit: input.requestLimit ?? 1000,
          concurrency: input.concurrency ?? 2,
          authorizationAcknowledged: true,
          disruptiveChecksAcknowledged: Boolean(input.scopeConfirmed),
        }),
      });
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { id: "scan_01" } as ApiScan;
    },
  ),
};
