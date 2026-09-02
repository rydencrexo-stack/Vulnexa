import type { Company, CompanyTopology, TopologyNode } from "@/types/pan";

/**
 * Demo "company workspace" dataset used by the asset map and company overview.
 * Each company owns a branded attack-surface topology (nodes + links) plus
 * metadata shown on the overview grid. Custom assets added from the map are
 * persisted to localStorage on top of these seeded nodes.
 */

export const MAP_SIZE = { width: 1000, height: 640 };

export const companySeed: Company[] = [
  {
    slug: "Atharva A. Deshmukh",
    name: "Atharva A. Deshmukh Technologies",
    tagline: "Customer portal & commerce platform",
    industry: "SaaS · Web",
    location: "Bengaluru, IN",
    color: "#b9ff2d",
    soft: "rgba(185, 255, 45, 0.12)",
    mark: "SH",
    assetCount: 12,
    endpointCount: 284,
    findingCount: 9,
    risk: "high",
    domain: "Atharva A. Deshmukh.com",
    securityScore: 71,
  },
  {
    slug: "nexacloud",
    name: "NexaCloud",
    tagline: "Managed cloud infrastructure platform",
    industry: "Cloud · IaaS",
    location: "Frankfurt, DE",
    color: "#4cc9f0",
    soft: "rgba(76, 201, 240, 0.14)",
    mark: "NX",
    assetCount: 14,
    endpointCount: 162,
    findingCount: 5,
    risk: "medium",
    domain: "nexacloud.io",
    securityScore: 83,
  },
  {
    slug: "finpulse",
    name: "FinPulse Bank",
    tagline: "Digital banking & payments gateway",
    industry: "FinTech · Banking",
    location: "New York, US",
    color: "#ffb020",
    soft: "rgba(255, 176, 32, 0.14)",
    mark: "FP",
    assetCount: 11,
    endpointCount: 341,
    findingCount: 4,
    risk: "medium",
    domain: "finpulse.bank",
    securityScore: 79,
  },
];

export const topologySeed: Record<string, CompanyTopology> = {
  vulnexa: {
    companySlug: "vulnexa",
    nodes: [
      { id: "int", label: "Internet", kind: "internet", x: 500, y: 56 },
      { id: "dom", label: "Atharva A. Deshmukh.com", kind: "domain", x: 500, y: 150, ip: "203.0.113.1", note: "Registrable domain · apex" },
      { id: "waf", label: "Edge WAF", kind: "waf", x: 500, y: 244, services: ["443/tcp"], tech: ["Cloudflare"], note: "TLS terminator" },
      { id: "web", label: "portal.Atharva A. Deshmukh.com", kind: "web", x: 300, y: 320, ip: "203.0.113.42", port: 443, services: ["443/tcp", "80/tcp"], tech: ["Next.js", "React", "nginx"] },
      { id: "api", label: "api.Atharva A. Deshmukh.com", kind: "api", x: 700, y: 320, ip: "203.0.113.44", port: 443, services: ["443/tcp"], tech: ["FastAPI", "Python"] },
      { id: "app", label: "app-01", kind: "server", x: 300, y: 422, ip: "10.2.4.18", port: 22, services: ["22/tcp", "3000/tcp"], tech: ["Ubuntu", "Docker"] },
      { id: "api01", label: "api-01", kind: "server", x: 700, y: 422, ip: "10.2.4.20", port: 22, services: ["22/tcp", "8000/tcp"], tech: ["Ubuntu", "Kubernetes"] },
      { id: "db", label: "postgres-cluster", kind: "database", x: 500, y: 422, ip: "10.2.4.31", port: 5432, services: ["5432/tcp"], tech: ["PostgreSQL 15"] },
      { id: "lb", label: "lb-01", kind: "router", x: 120, y: 520, ip: "10.2.4.1", services: ["443/tcp"], tech: ["HAProxy"], note: "Internal load balancer" },
      { id: "cloud", label: "aws-vpc-prod", kind: "cloud", x: 880, y: 520, services: ["VPC", "RDS"], tech: ["AWS"], note: "eu-west-1" },
      { id: "mon", label: "monitoring", kind: "device", x: 300, y: 520, ip: "10.2.4.50", services: ["9090/tcp"], tech: ["Prometheus"], note: "Observability" },
      { id: "cve", label: "CVE-2026-0247", kind: "vuln", x: 700, y: 520, risk: "high", note: "Unauthenticated API endpoint" },
    ],
    links: [
      { from: "int", to: "dom", kind: "edge" },
      { from: "dom", to: "waf", kind: "edge" },
      { from: "waf", to: "web", kind: "edge" },
      { from: "waf", to: "api", kind: "edge" },
      { from: "web", to: "app", kind: "lan" },
      { from: "api", to: "api01", kind: "lan" },
      { from: "api01", to: "db", kind: "lan", label: "5432" },
      { from: "web", to: "lb", kind: "lan" },
      { from: "cloud", to: "db", kind: "wan", label: "peering" },
      { from: "web", to: "mon", kind: "lan" },
      { from: "api01", to: "cve", kind: "lan", label: "affected" },
      { from: "api", to: "cve", kind: "lan", label: "exposed" },
    ],
  },
  nexacloud: {
    companySlug: "nexacloud",
    nodes: [
      { id: "int", label: "Internet", kind: "internet", x: 500, y: 56 },
      { id: "dom", label: "nexacloud.io", kind: "domain", x: 500, y: 150, ip: "198.51.100.1", note: "Registrable domain" },
      { id: "waf", label: "Cloud Shield", kind: "waf", x: 360, y: 244, services: ["443/tcp"], tech: ["Cloudflare"], note: "DDoS mitigation" },
      { id: "cn", label: "app.nexacloud.io", kind: "web", x: 360, y: 330, ip: "198.51.100.40", port: 443, services: ["443/tcp"], tech: ["Grafana", "Go"] },
      { id: "api", label: "api.nexacloud.io", kind: "api", x: 640, y: 244, ip: "198.51.100.45", port: 443, services: ["443/tcp", "8443/tcp"], tech: ["Go", "Envoy"] },
      { id: "ing", label: "ingress-01", kind: "server", x: 640, y: 330, ip: "10.0.1.8", port: 8443, services: ["8443/tcp"], tech: ["Kubernetes", "Nginx"] },
      { id: "svc", label: "scheduler", kind: "server", x: 360, y: 422, ip: "10.0.1.12", port: 22, services: ["22/tcp", "8080/tcp"], tech: ["Nomad", "Linux"] },
      { id: "db", label: "etcd-cluster", kind: "database", x: 640, y: 422, ip: "10.0.1.30", port: 2379, services: ["2379/tcp", "2380/tcp"], tech: ["etcd"] },
      { id: "rt", label: "edge-router", kind: "router", x: 130, y: 430, ip: "10.0.0.1", services: ["443/tcp", "1194/udp"], tech: ["FRRouting"] },
      { id: "ns", label: "k8s-nodes", kind: "cloud", x: 860, y: 330, services: ["6443/tcp"], tech: ["Kubernetes"], note: "3-node control plane" },
      { id: "dev", label: "gateway", kind: "device", x: 860, y: 500, ip: "10.0.2.1", services: ["8443/tcp"], tech: ["Envoy"], note: "Edge gateway" },
      { id: "cve", label: "CVE-2025-3918", kind: "vuln", x: 500, y: 520, risk: "medium", note: "TLS misconfiguration" },
    ],
    links: [
      { from: "int", to: "dom", kind: "edge" },
      { from: "dom", to: "waf", kind: "edge" },
      { from: "dom", to: "api", kind: "edge" },
      { from: "waf", to: "cn", kind: "edge" },
      { from: "api", to: "ing", kind: "lan" },
      { from: "ing", to: "svc", kind: "lan" },
      { from: "ing", to: "db", kind: "lan" },
      { from: "svc", to: "db", kind: "lan" },
      { from: "cn", to: "rt", kind: "lan" },
      { from: "ns", to: "ing", kind: "lan", label: "6443" },
      { from: "dev", to: "ing", kind: "lan" },
      { from: "api", to: "cve", kind: "lan", label: "affected" },
      { from: "dev", to: "cve", kind: "lan", label: "exposed" },
    ],
  },
  finpulse: {
    companySlug: "finpulse",
    nodes: [
      { id: "int", label: "Internet", kind: "internet", x: 500, y: 56 },
      { id: "dom", label: "finpulse.bank", kind: "domain", x: 500, y: 150, ip: "192.0.2.10", note: "Registrable domain" },
      { id: "waf", label: "App WAF", kind: "waf", x: 500, y: 244, services: ["443/tcp"], tech: ["Imperva"], note: "PCI zone" },
      { id: "web", label: "online.finpulse.bank", kind: "web", x: 310, y: 322, ip: "192.0.2.20", port: 443, services: ["443/tcp"], tech: ["Angular", "nginx"] },
      { id: "api", label: "gw.finpulse.bank", kind: "api", x: 690, y: 322, ip: "192.0.2.25", port: 443, services: ["443/tcp"], tech: ["Kong", "Node.js"] },
      { id: "app", label: "banking-core", kind: "server", x: 310, y: 424, ip: "10.40.1.5", port: 22, services: ["22/tcp", "9090/tcp"], tech: ["Red Hat", "Java"] },
      { id: "pay", label: "payments-svc", kind: "server", x: 690, y: 424, ip: "10.40.1.9", port: 22, services: ["22/tcp", "8443/tcp"], tech: ["Java", "Spring"] },
      { id: "db", label: "ledger-db", kind: "database", x: 500, y: 424, ip: "10.40.1.40", port: 5432, services: ["5432/tcp"], tech: ["PostgreSQL"] },
      { id: "hs", label: "bank-hsm", kind: "device", x: 310, y: 524, ip: "10.40.1.60", services: ["3000/tcp"], tech: ["HSM"], note: "Key management" },
      { id: "cloud", label: "sap-bank-vpc", kind: "cloud", x: 690, y: 524, services: ["VPC", "RDS"], tech: ["AWS"] },
      { id: "rt", label: "core-router", kind: "router", x: 130, y: 430, ip: "10.40.0.1", services: ["443/tcp"], tech: ["Cisco ISR"] },
      { id: "cve", label: "CVE-2024-21734", kind: "vuln", x: 690, y: 560, risk: "medium", note: "Hardcoded API token" },
    ],
    links: [
      { from: "int", to: "dom", kind: "edge" },
      { from: "dom", to: "waf", kind: "edge" },
      { from: "waf", to: "web", kind: "edge" },
      { from: "waf", to: "api", kind: "edge" },
      { from: "web", to: "app", kind: "lan" },
      { from: "api", to: "pay", kind: "lan" },
      { from: "app", to: "db", kind: "lan", label: "5432" },
      { from: "pay", to: "db", kind: "lan", label: "5432" },
      { from: "app", to: "hs", kind: "lan", label: "PKCS#11" },
      { from: "cloud", to: "db", kind: "wan" },
      { from: "web", to: "rt", kind: "lan" },
      { from: "pay", to: "cve", kind: "lan", label: "affected" },
    ],
  },
};

export const nodeKinds = [
  "internet",
  "domain",
  "web",
  "api",
  "waf",
  "server",
  "database",
  "router",
  "device",
  "cloud",
  "vuln",
] as const;

export function getCompanies(): Company[] {
  return companySeed;
}

export function getCompany(slug: string): Company | undefined {
  return companySeed.find((company) => company.slug === slug);
}

export function getTopology(slug: string): CompanyTopology {
  return topologySeed[slug] ?? { companySlug: slug, nodes: [], links: [] };
}

const CUSTOM_KEY = "pan_company_assets";

export function getCustomAssets(slug: string): TopologyNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, TopologyNode[]>) : {};
    return parsed[slug] ?? [];
  } catch {
    return [];
  }
}

export function addCustomAsset(slug: string, node: TopologyNode): TopologyNode[] {
  const current = getCustomAssets(slug);
  const next = [...current, node];
  if (typeof window !== "undefined") {
    try {
      const all = JSON.parse(window.localStorage.getItem(CUSTOM_KEY) ?? "{}") as Record<string, TopologyNode[]>;
      all[slug] = next;
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
    } catch {
      // ignore storage failures in demo mode
    }
  }
  return next;
}