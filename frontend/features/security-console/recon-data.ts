import { completeScannerScan, startScannerScan, type ScanRowRecord } from "./scans-data";

export type ReconStage = "subdomains" | "live-hosts" | "url-discovery";

export type SubdomainAsset = {
  hostname: string;
  ip?: string;
  status?: number;
  title?: string;
  tech: string[];
  routes: string[];
  links: string[];
  live: boolean;
};

export type ReconResult = {
  id: string;
  domains: string[];
  stages: ReconStage[];
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  started: string;
  completed: string | null;
  scanId: string;
  subdomains: SubdomainAsset[];
  liveHosts: SubdomainAsset[];
  urls: string[];
};

const RECON_KEY = "pan_recon_jobs";

function readAll(): ReconResult[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(RECON_KEY);
    return value ? (JSON.parse(value) as ReconResult[]) : [];
  } catch {
    return [];
  }
}
function writeAll(jobs: ReconResult[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECON_KEY, JSON.stringify(jobs));
  } catch {
    // ignore storage failures
  }
}
function now() {
  return new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function getReconJobs(): ReconResult[] {
  return readAll();
}
export function getReconJob(id: string): ReconResult | null {
  return readAll().find((job) => job.id === id) ?? null;
}

export function createReconJob(domains: string[], stages: ReconStage[]): ReconResult {
  const id = `recon_${Date.now()}`;
  const scan: ScanRowRecord = startScannerScan({
    scanner: "recon",
    target: domains[0],
    name: `Complete recon · ${domains[0]}${domains.length > 1 ? ` (+${domains.length - 1})` : ""}`,
  });
  const job: ReconResult = {
    id,
    domains,
    stages,
    status: "running",
    progress: 5,
    started: now(),
    completed: null,
    scanId: scan.id,
    subdomains: [],
    liveHosts: [],
    urls: [],
  };
  writeAll([job, ...readAll()]);
  return job;
}

export function finalizeReconJob(
  id: string,
  discovery: Pick<ReconResult, "subdomains" | "liveHosts" | "urls">,
): ReconResult | null {
  const job = getReconJob(id);
  if (!job) return null;
  const updated: ReconResult = {
    ...job,
    status: "completed",
    progress: 100,
    completed: now(),
    subdomains: discovery.subdomains,
    liveHosts: discovery.liveHosts,
    urls: [...new Set(discovery.urls)],
  };
  writeAll(readAll().map((j) => (j.id === id ? updated : j)));
  completeScannerScan(job.scanId, { progress: 100, findings: discovery.liveHosts.length });
  return updated;
}

export function failReconJob(id: string): ReconResult | null {
  const job = getReconJob(id);
  if (!job) return null;
  const updated: ReconResult = { ...job, status: "failed", completed: now() };
  writeAll(readAll().map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function latestReconForDomain(domain: string): ReconResult | null {
  const needle = domain.trim().toLowerCase();
  return readAll().find((job) => job.status === "completed" && job.domains.some((item) => needle === item || needle.endsWith(`.${item}`))) ?? null;
}

export function removeReconJob(id: string) {
  writeAll(readAll().filter((job) => job.id !== id));
}
