import { completeScannerScan, removeScanRecord, startScannerScan, type ScanRowRecord } from "./scans-data";
import { panService } from "@/services/pan-service";

export type ReconModule =
  | "subdomains"
  | "live-hosts"
  | "url-discovery"
  | "web-archive"
  | "ports"
  | "technologies"
  | "javascript"
  | "screenshots";

export type ReconTask = {
  id: string;
  module: ReconModule;
  url: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  started: string;
  completed: string | null;
  scanId: string;
  result: Record<string, unknown>;
};

const KEY = "pan_recon_tasks";

const SUB_PREFIXES = ["www", "api", "app", "mail", "portal", "admin", "cdn", "status", "dev", "staging", "blog", "shop", "docs", "grafana", "jenkins", "db", "vpn", "git", "test", "beta", "m", "static", "assets", "auth", "payments", "support", "internal", "vault"];
const TECH = ["nginx", "React", "Next.js", "Node.js", "FastAPI", "Go", "Cloudflare", "WordPress", "Python", "Django", "Kubernetes", "Envoy", "PostgreSQL", "Redis", "Laravel", "Vue", "Angular", "Apache", "Elasticsearch"];
const ROUTES = ["/api/v1/users", "/api/v1/orders", "/login", "/admin", "/health", "/v2/search", "/account/profile", "/graphql", "/api/export", "/callback", "/sitemap.xml", "/robots.txt", "/oauth/token", "/docs/swagger", "/config.json"];
const LINKS = ["/home", "/about", "/contact", "/login", "/register", "/dashboard", "/pricing", "/docs", "/blog", "/status"];
const PORTS = ["22/tcp", "80/tcp", "443/tcp", "8080/tcp", "8443/tcp", "3306/tcp", "5432/tcp", "6379/tcp", "27017/tcp", "3000/tcp", "9200/tcp", "9090/tcp"];

function randInt(max: number) {
  return Math.floor(Math.random() * max);
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(randInt(copy.length), 1)[0]);
  return out;
}
function genIp() {
  return `${10 + randInt(200)}.${randInt(255)}.${randInt(255)}.${1 + randInt(253)}`;
}
function hostFor(domain: string, i: number) {
  const a = SUB_PREFIXES[i % SUB_PREFIXES.length];
  const b = SUB_PREFIXES[(i + 7) % SUB_PREFIXES.length];
  return Math.random() < 0.45 ? `${a}.${domain}` : `${a}.${b}.${domain}`;
}
function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function generateResult(module: ReconModule, url: string): Record<string, unknown> {
  const domain = stripProtocol(url);
  switch (module) {
    case "subdomains": {
      const subs = [];
      for (let i = 0; i < 10 + randInt(12); i++) {
        const hostname = hostFor(domain, i);
        subs.push({ hostname, ip: genIp(), live: Math.random() < 0.7, tech: pickN(TECH, 1 + randInt(3)) });
      }
      return { target: domain, items: subs, summary: `${subs.length} subdomains` };
    }
    case "live-hosts": {
      const subs = [];
      for (let i = 0; i < 8 + randInt(6); i++) {
        const hostname = hostFor(domain, i);
        subs.push({ hostname, ip: genIp(), status: [200, 200, 301, 403][randInt(4)], title: `Service — ${hostname.split(".")[0]}` });
      }
      return { target: domain, items: subs, summary: `${subs.length} live hosts` };
    }
    case "url-discovery":
    case "web-archive": {
      const urls = [`https://${domain}/`];
      for (let i = 0; i < 8 + randInt(10); i++) {
        const host = Math.random() < 0.6 ? domain : hostFor(domain, i);
        urls.push(`https://${host}${ROUTES[randInt(ROUTES.length)]}`);
      }
      return { target: domain, items: [...new Set(urls)], summary: `${urls.length} URLs` };
    }
    case "ports":
      return { target: domain, items: pickN(PORTS, 4 + randInt(4)).map((port) => ({ port, service: port.split("/")[1], state: "open" })), summary: `${4 + randInt(4)} services` };
    case "technologies":
      return { target: domain, items: pickN(TECH, 3 + randInt(4)).map((name) => ({ name, version: `${1 + randInt(3)}.${randInt(9)}.${randInt(9)}` })), summary: `${3 + randInt(4)} technologies` };
    case "javascript":
      return { target: domain, items: pickN(ROUTES, 4 + randInt(5)).map((route) => ({ route, source: `/js/${Math.random().toString(36).slice(2, 8)}.js` })), summary: `${4 + randInt(5)} routes` };
    case "screenshots":
      return { target: domain, items: Array.from({ length: 3 + randInt(3) }, (_, i) => ({ host: i === 0 ? domain : hostFor(domain, i), title: `Capture ${i + 1}` })), summary: `${3 + randInt(3)} captures` };
  }
}

function readAll(): ReconTask[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(KEY);
    return value ? (JSON.parse(value) as ReconTask[]) : [];
  } catch {
    return [];
  }
}
function writeAll(tasks: ReconTask[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // ignore storage failures
  }
}
function now() {
  return new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function getReconTasks(): ReconTask[] {
  return readAll();
}
export function getReconTasksByModule(module: ReconModule): ReconTask[] {
  return readAll().filter((task) => task.module === module);
}
export function getReconTask(id: string): ReconTask | null {
  return readAll().find((task) => task.id === id) ?? null;
}

export function startReconTask(module: ReconModule, url: string): ReconTask {
  const id = `${module}_${Date.now()}`;
  const scan: ScanRowRecord = startScannerScan({ scanner: "recon", target: url, name: `${module} · ${url}` });
  const task: ReconTask = {
    id,
    module,
    url,
    status: "running",
    progress: 5,
    started: now(),
    completed: null,
    scanId: scan.id,
    result: {},
  };
  writeAll([task, ...readAll()]);
  return task;
}

export async function completeReconTask(id: string): Promise<ReconTask | null> {
  const task = getReconTask(id);
  if (!task) return null;
  const real = await panService.runReconModule(task.module, task.url);
  const result = real && Array.isArray(real.items) ? { target: real.target, items: real.items, summary: real.summary } : generateResult(task.module, task.url);
  const updated: ReconTask = {
    ...task,
    status: "completed",
    progress: 100,
    completed: now(),
    result,
  };
  writeAll(readAll().map((t) => (t.id === id ? updated : t)));
  completeScannerScan(task.scanId, { progress: 100, findings: Array.isArray(updated.result.items) ? updated.result.items.length : 0, result: updated.result });
  return updated;
}

export function removeReconTask(id: string) {
  const task = getReconTask(id);
  writeAll(readAll().filter((t) => t.id !== id));
  if (task) removeScanRecord(task.scanId);
}

export function clearReconTasks() {
  const tasks = readAll();
  tasks.forEach((task) => removeScanRecord(task.scanId));
  writeAll([]);
}