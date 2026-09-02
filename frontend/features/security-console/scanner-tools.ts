export type ScannerTool = {
  name: string;
  engine: string;
  kind?: "subdomain" | "live" | "ports" | "tech" | "url" | "archive" | "js" | "params" | "api" | "browser";
};

export type ToolCategory = {
  id: string;
  label: string;
  description: string;
  tools: ScannerTool[];
};

export const scannerToolCatalog: ToolCategory[] = [
  {
    id: "subdomains",
    label: "Subdomains / Asset Discovery",
    description: "Enumerate and cross-reference hostnames from passive and active sources.",
    tools: [
      { name: "Subfinder", engine: "Passive DNS / CT", kind: "subdomain" },
      { name: "OWASP Amass", engine: "Multi-source mapping", kind: "subdomain" },
      { name: "Sublist3r", engine: "Search-engine enum", kind: "subdomain" },
      { name: "Findomain", engine: "Cert + DNS", kind: "subdomain" },
      { name: "assetfinder", engine: "Passive sources", kind: "subdomain" },
      { name: "Chaos", engine: "PDNS dataset", kind: "subdomain" },
      { name: "crt.sh", engine: "Certificate transparency", kind: "subdomain" },
      { name: "CertSpotter", engine: "Certificate transparency", kind: "subdomain" },
      { name: "Censys", engine: "Internet scan index", kind: "subdomain" },
      { name: "VirusTotal", engine: "Subdomain + passive DNS", kind: "subdomain" },
      { name: "AlienVault OTX", engine: "Threat intel", kind: "subdomain" },
      { name: "SecurityTrails", engine: "Historical DNS", kind: "subdomain" },
      { name: "Shodan", engine: "Service + host index", kind: "subdomain" },
      { name: "DNSDumpster", engine: "DNS recon", kind: "subdomain" },
      { name: "Common Crawl", engine: "Web crawl index", kind: "subdomain" },
      { name: "RapidDNS", engine: "Passive DNS", kind: "subdomain" },
      { name: "HackerTarget", engine: "DNS + recon API", kind: "subdomain" },
      { name: "Anubis", engine: "Passive enum", kind: "subdomain" },
    ],
  },
  {
    id: "live",
    label: "Live Hosts",
    description: "Probe which hosts actually respond over HTTP/HTTPS.",
    tools: [
      { name: "HTTPx", engine: "HTTP probe", kind: "live" },
      { name: "httprobe", engine: "HTTP probe", kind: "live" },
      { name: "Naabu", engine: "Port → host", kind: "live" },
      { name: "Nmap", engine: "Host discovery", kind: "live" },
    ],
  },
  {
    id: "ports",
    label: "Ports / Services",
    description: "Discover exposed TCP services within the allowed port set.",
    tools: [
      { name: "Naabu", engine: "Fast port scan", kind: "ports" },
      { name: "Nmap", engine: "Service fingerprint", kind: "ports" },
      { name: "Masscan", engine: "High-speed sweep", kind: "ports" },
      { name: "RustScan", engine: "Batched scan", kind: "ports" },
    ],
  },
  {
    id: "tech",
    label: "Technologies",
    description: "Identify frameworks, servers, CDNs, and libraries.",
    tools: [
      { name: "WhatWeb", engine: "Web fingerprint", kind: "tech" },
      { name: "Wappalyzer", engine: "Tech stack", kind: "tech" },
      { name: "httpx", engine: "Response fingerprint", kind: "tech" },
      { name: "Webanalyze", engine: "Header + HTML", kind: "tech" },
      { name: "BuiltWith", engine: "Tech profile", kind: "tech" },
    ],
  },
  {
    id: "url",
    label: "URL / Endpoint Discovery",
    description: "Crawl and extract routes, links, forms, and API references.",
    tools: [
      { name: "Katana", engine: "Headless crawl", kind: "url" },
      { name: "gau", engine: "URL aggregation", kind: "url" },
      { name: "waybackurls", engine: "Archive URLs", kind: "url" },
      { name: "hakrawler", engine: "Crawl + archive", kind: "url" },
      { name: "gospider", engine: "Crawler", kind: "url" },
      { name: "feroxbuster", engine: "Content discovery", kind: "url" },
      { name: "ffuf", engine: "Fuzz discovery", kind: "url" },
    ],
  },
  {
    id: "archive",
    label: "Web Archive / Historical URLs",
    description: "Pull historical URLs and parameters, then scope-filter them.",
    tools: [
      { name: "Wayback Machine CDX", engine: "Archive index", kind: "archive" },
      { name: "waybackurls", engine: "CDX client", kind: "archive" },
      { name: "gau", engine: "Aggregated archives", kind: "archive" },
      { name: "Common Crawl Index", engine: "Crawl index", kind: "archive" },
      { name: "Arquivo.pt", engine: "Web archive", kind: "archive" },
      { name: "Memento Time Travel", engine: "Archive mementos", kind: "archive" },
    ],
  },
  {
    id: "js",
    label: "JavaScript / Endpoint Extraction",
    description: "Extract routes, parameters, and secret indicators from scripts.",
    tools: [
      { name: "LinkFinder", engine: "JS endpoint extraction", kind: "js" },
      { name: "xnLinkFinder", engine: "JS + endpoint crawl", kind: "js" },
      { name: "JSluice", engine: "JS route mining", kind: "js" },
      { name: "SecretFinder", engine: "Secret regexes", kind: "js" },
      { name: "Mantra", engine: "JS analysis", kind: "js" },
      { name: "Retire.js", engine: "JS library CVEs", kind: "js" },
    ],
  },
  {
    id: "params",
    label: "Parameters / API Discovery",
    description: "Discover parameters and hidden API surfaces.",
    tools: [
      { name: "Arjun", engine: "Parameter discovery", kind: "params" },
      { name: "Kiterunner", engine: "API content discovery", kind: "params" },
      { name: "ParamSpider", engine: "Parameter mining", kind: "params" },
      { name: "ffuf", engine: "Param fuzz", kind: "params" },
      { name: "feroxbuster", engine: "API content", kind: "params" },
    ],
  },
  {
    id: "api",
    label: "API / GraphQL",
    description: "Exercise validated API and GraphQL contracts within scope.",
    tools: [
      { name: "Kiterunner", engine: "API route discovery", kind: "api" },
      { name: "InQL", engine: "GraphQL introspection", kind: "api" },
      { name: "GraphQL Voyager", engine: "Schema visualizer", kind: "api" },
      { name: "GraphQLmap", engine: "GraphQL testing", kind: "api" },
      { name: "Postman", engine: "API collections", kind: "api" },
    ],
  },
  {
    id: "browser",
    label: "Screenshots / Browser",
    description: "Capture and fingerprint approved hosts in an isolated browser.",
    tools: [
      { name: "Playwright", engine: "Browser automation", kind: "browser" },
      { name: "Puppeteer", engine: "Headless Chrome", kind: "browser" },
      { name: "Selenium", engine: "Browser automation", kind: "browser" },
    ],
  },
];