import { apiRequest } from "@/services/api";
import type { Finding } from "@/types/pan";

export interface AcunetixState {
  configured: boolean;
  connected: boolean;
  mode: string;
  baseUrl?: string | null;
  message: string;
}

export interface AcunetixTarget {
  id: string;
  address: string;
  description?: string;
  criticality?: number;
  state?: string;
}

export interface ProviderStatus {
  id: string;
  status: string;
  providerStatus: string;
  progress: number;
  severity?: number;
  eventLogId?: string | null;
}

export interface ActiveScanRow {
  id: string;
  name: string;
  targetName?: string | null;
  targetId?: string | null;
  status: string;
  progress: number;
  profile: string;
  startedAt?: string | null;
  completedAt?: string | null;
  currentPhase?: string;
  modules?: string[];
  warnings?: string[];
  statistics?: {
    candidateFindings?: number;
    confirmedFindings?: number;
    requestsSent?: number;
    endpointsFound?: number;
    assetsFound?: number;
  } | null;
  providerStatus?: ProviderStatus | null;
  externalReference?: { provider?: string; id?: string; mode?: string } | null;
}

export interface AcunetixReport {
  scanId: string;
  reportId: string;
  status: string;
  available: boolean;
  downloadUrl?: string | null;
}

export interface AcunetixVulnerability {
  vulnId: string;
  name: string;
  severity: number;
  confidence: number;
  cwe?: string;
  owasp?: string;
  cvss?: string;
  method?: string;
  parameter?: string;
  target?: string;
  scanId?: string;
  resultId?: string;
}

export interface SyncResult {
  mode: string;
  synchronized: number;
  externalRequests?: number;
  created?: number;
}

const SEVERITY_NAMES = ["informational", "low", "medium", "high", "critical"];

export function severityName(severity: number): string {
  return SEVERITY_NAMES[severity] ?? "medium";
}

export const acunetixService = {
  status: () => apiRequest<AcunetixState>("/api/active-scanner/status"),
  testConnection: () => apiRequest<AcunetixState>("/api/active-scanner/test-connection", { method: "POST" }),
  targets: () => apiRequest<AcunetixTarget[]>("/api/active-scanner/targets"),
  syncTargets: () => apiRequest<SyncResult>("/api/active-scanner/sync-targets", { method: "POST" }),
  listScans: () => apiRequest<ActiveScanRow[]>("/api/active-scanner/scans"),
  liveVulnerabilities: () => apiRequest<AcunetixVulnerability[]>("/api/active-scanner/vulnerabilities"),

  startScan: (payload: { workspaceId: string; targetId: string; name: string; profile: string; authorizationAcknowledged: true }) =>
    apiRequest<ActiveScanRow>("/api/active-scanner/scans", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getScan: (id: string) => apiRequest<ActiveScanRow>(`/api/active-scanner/scans/${id}`),

  stopScan: (id: string) =>
    apiRequest<ActiveScanRow>(`/api/active-scanner/scans/${id}/stop`, { method: "POST" }),

  syncFindings: (id: string) =>
    apiRequest<{ imported: number; findings: Finding[] }>(`/api/active-scanner/scans/${id}/sync-findings`, {
      method: "POST",
    }),

  reports: (id: string) => apiRequest<AcunetixReport[]>(`/api/active-scanner/scans/${id}/reports`),

  reportDownloadUrl: (scanId: string, reportId: string) =>
    `/api/active-scanner/scans/${scanId}/reports/download/${reportId}`,
};