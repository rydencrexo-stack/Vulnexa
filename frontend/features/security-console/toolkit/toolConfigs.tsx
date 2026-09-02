"use client";

import type { ReactNode } from "react";
import type { ToolConfig } from "./ToolScannerView";

function OptionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="tool-option">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const toolConfigs: Record<string, ToolConfig> = {
  "open-redirect": {
    slug: "open-redirect",
    title: "Open Redirect Finder",
    tagline: "Blast every redirect parameter with protocol + encoding bypass payloads and watch where the victim lands.",
    placeholder: "https://example.com/redirect?url=https://example.com",
    toolLabel: "OPEN REDIRECT",
    cliLabel: "dalfox-style redirect sweep",
    extraFields: (state, set) => (
      <OptionField label="Parameter (optional — auto-detect if empty)">
        <input value={String(state.parameter ?? "")} onChange={(event) => set({ ...state, parameter: event.target.value })} placeholder="url, redirect, next, return…" />
      </OptionField>
    ),
    buildPayload: (target, options) => ({ target, parameter: options.parameter ? String(options.parameter) : null, timeout_seconds: 120 }),
  },
  secrets: {
    slug: "secrets",
    title: "Secrets Exposure",
    tagline: "Crawl HTML, JavaScript and source maps for API keys, tokens, credentials and high-entropy secrets.",
    placeholder: "https://example.com",
    toolLabel: "SECRETS",
    cliLabel: "PAN secrets · gitleaks/trufflehog ready",
    buildPayload: (target) => ({ target, timeout_seconds: 120 }),
  },
  cves: {
    slug: "cves",
    title: "Known CVEs · Nuclei",
    tagline: "Run the real Nuclei engine against a target — 13,000+ templates, tag and severity aware.",
    placeholder: "https://example.com",
    toolLabel: "NUCLEI",
    cliLabel: "nuclei -severity high,critical",
    extraFields: (state, set) => (
      <>
        <OptionField label="Severity">
          <select value={String(state.severity ?? "high,critical")} onChange={(event) => set({ ...state, severity: event.target.value })}>
            <option value="critical">critical</option>
            <option value="high,critical">high, critical</option>
            <option value="medium,high,critical">medium, high, critical</option>
            <option value="low,medium,high,critical">low, medium, high, critical</option>
            <option value="info,low,medium,high,critical">all</option>
          </select>
        </OptionField>
        <OptionField label="Tags (optional)">
          <input value={String(state.tags ?? "")} onChange={(event) => set({ ...state, tags: event.target.value })} placeholder="cve,tech,exposure…" />
        </OptionField>
      </>
    ),
    buildPayload: (target, options) => ({ target, severity: String(options.severity ?? "high,critical"), tags: String(options.tags ?? ""), templates: "", timeout_seconds: 300 }),
  },
  ssti: {
    slug: "ssti",
    title: "Template Injection · SSTImap",
    tagline: "Detect server-side template injection with the real SSTImap engine (Jinja2, Twig, Freemarker, Velocity…).",
    placeholder: "https://example.com/search?q=test",
    toolLabel: "SSTI",
    cliLabel: "SSTImap",
    buildPayload: (target) => ({ target, timeout_seconds: 180 }),
  },
  sqli: {
    slug: "sqli",
    title: "SQL Injection · SQLMap",
    tagline: "Run SQLMap against a parameterized endpoint to detect injectable parameters.",
    placeholder: "https://example.com/search?q=test",
    toolLabel: "SQLI",
    cliLabel: "sqlmap -u",
    extraFields: (state, set) => (
      <>
        <OptionField label="Level">
          <select value={String(state.level ?? 1)} onChange={(event) => set({ ...state, level: Number(event.target.value) })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </OptionField>
        <OptionField label="Risk">
          <select value={String(state.risk ?? 1)} onChange={(event) => set({ ...state, risk: Number(event.target.value) })}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </OptionField>
      </>
    ),
    buildPayload: (target, options) => ({ target, level: Number(options.level ?? 1), risk: Number(options.risk ?? 1), timeout_seconds: 300 }),
  },
  ssrf: {
    slug: "ssrf",
    title: "Server-Side Request Forgery",
    tagline: "Probe URL-fetching parameters with the ssrfmap engine and detect server-side request sinks.",
    placeholder: "https://example.com/fetch?url=https://example.com",
    toolLabel: "SSRF",
    cliLabel: "ssrfmap",
    extraFields: (state, set) => (
      <OptionField label="Parameter (optional — uses first query param)">
        <input value={String(state.parameter ?? "")} onChange={(event) => set({ ...state, parameter: event.target.value })} placeholder="url, uri, dest…" />
      </OptionField>
    ),
    buildPayload: (target, options) => ({ target, parameter: options.parameter ? String(options.parameter) : null, timeout_seconds: 180 }),
  },
};