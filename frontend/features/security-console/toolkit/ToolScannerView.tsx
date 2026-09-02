"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bug, Download, RotateCcw, TerminalSquare, Wrench } from "lucide-react";
import { panService } from "@/services/pan-service";
import { completeScannerScan, startScannerScan } from "../scans-data";
import type { ToolFinding, ToolScanResult } from "@/types/pan";

export interface ToolConfig {
  slug: string;
  title: string;
  tagline: string;
  placeholder: string;
  toolLabel: string;
  cliLabel: string;
  extraFields?: (state: Record<string, unknown>, set: (patch: Record<string, unknown>) => void) => ReactNode;
  buildPayload: (target: string, options: Record<string, unknown>) => Record<string, unknown>;
  validate?: (target: string) => string;
}

type Phase = "idle" | "scanning" | "done" | "error";

const BOOT_LINES = [
  "initializing engagement console",
  "locking target scope",
  "arming payload sequences",
  "dispatching requests",
  "analyzing responses",
  "correlating evidence",
];

export function ToolScannerView({ config }: { config: ToolConfig }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState("");
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [bootCount, setBootCount] = useState(0);
  const [result, setResult] = useState<ToolScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
const timersRef = useRef<number[]>([]);
const scanIdRef = useRef<string | null>(null);

  const runScan = async (value?: string) => {
    const current = (value ?? target).trim();
    if (!/^(\w+:\/\/)?[^\s]+\.[^\s]+$/.test(current)) {
      setErrorMessage("Enter a valid domain or http(s) URL.");
      setPhase("error");
      return;
    }
    setTarget(current);
    setResult(null);
    setErrorMessage("");
    setPhase("scanning");
    setBootCount(0);
    scanIdRef.current = startScannerScan({ scanner: config.slug, target: current }).id;
    BOOT_LINES.forEach((_, index) => {
      timersRef.current.push(window.setTimeout(() => setBootCount(index + 1), 220 * index));
    });
    try {
      const data = await panService.runToolScan(config.slug, config.buildPayload(current, options));
      setResult(data);
      setPhase("done");
      if (scanIdRef.current) completeScannerScan(scanIdRef.current, { progress: 100, findings: typeof data.summary?.findingsCount === "number" ? data.summary.findingsCount : 0, result: data });
    } catch (error) {
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "The scanner could not be reached.");
    }
  };

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    if (phase !== "scanning") return;
    timersRef.current.push(window.setTimeout(() => setBootCount(BOOT_LINES.length), BOOT_LINES.length * 220));
  }, [phase]);

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorMessage("");
    setOpen(new Set());
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.slug}-${result.target.replace(/[^\w.-]/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const findings = result?.findings ?? [];
  const counts: Record<string, number> = {};
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;

  return (
    <div className="pscan-root">
      <div className="pscan-inner">
        <p className="pscan-kicker"><span className="dot" /> {config.toolLabel} · Authorized Targets Only</p>

        {phase === "idle" || phase === "error" ? (
          <>
            <h1 className="pscan-hero-title">
              {config.title.split(" ").slice(0, -1).join(" ")} <span className="accent">{config.title.split(" ").slice(-1)[0]}</span>
            </h1>
            <p className="pscan-hero-sub">{config.tagline}</p>
            <form className="pscan-console" onSubmit={(event) => { event.preventDefault(); runScan(); }}>
              <div className="pscan-console-bar">
                <span className="p" /><span className="p" /><span className="p" />
                <span className="pscan-console-title">vulnexa / {config.slug}</span>
              </div>
              <div className="pscan-console-body">
                <p className="pscan-prompt"><span className="cmd">{config.cliLabel}</span> &lt;target&gt;</p>
                <div className="pscan-input-row">
                  <input className="pscan-input" value={target} onChange={(event) => setTarget(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runScan(); } }} placeholder={config.placeholder} autoFocus spellCheck={false} />
                  <button className="pscan-btn" type="submit"><Bug size={15} /> {config.toolLabel.split(" ")[0]} Scan</button>
                </div>
                {config.extraFields ? <div className="tool-options" style={{ marginTop: 14 }}>{config.extraFields(options, setOptions)}</div> : null}
                <p className="pscan-hint">Only scan targets you own or are explicitly authorized to test.</p>
              </div>
            </form>
            {phase === "error" ? <div className="pscan-error">Scan failed — {errorMessage}</div> : null}
          </>
        ) : null}

        {phase === "scanning" ? (
          <div className="tool-scan-stage tool-scan-grid" style={{ marginTop: 6 }}>
            <div className="tool-console-head">
              <span>vulnexa / {config.slug}</span>
              <span className="live">● scanning {target}</span>
            </div>
            <div className="tool-radar" />
            <div className="tool-boot">
              {BOOT_LINES.slice(0, bootCount).map((line, index) => (
                <div key={line} className={`line${index === 0 ? " ok" : index === BOOT_LINES.length - 1 ? " cyan" : ""}`}>
                  {index === 0 ? "▸ " : index === 1 ? "+ " : index === 2 ? "~ " : index === 3 ? "» " : index === 4 ? "◈ " : "✓ "}{line}
                </div>
              ))}
              {bootCount < BOOT_LINES.length ? <span className="pscan-cursor" /> : <div className="line cyan">waiting on {config.cliLabel}…</div>}
            </div>
            <div className="tool-progress"><div className="fill" style={{ width: `${Math.min(100, 8 + bootCount * 15)}%` }} /></div>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <>
            <h1 className="pscan-hero-title" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>
              {result.target} <span className="accent">· {config.slug}</span>
            </h1>
            <p className="pscan-hero-sub">
              {result.durationSeconds}s · {result.summary.status ?? "done"} ·{" "}
              {typeof result.summary.findingsCount === "number" ? `${result.summary.findingsCount} findings` : "complete"}
              {result.cliInstalled ? " · CLI executed" : " · CLI preview (tool not installed)"}
            </p>

            <div className="tool-toolbar">
              {Object.entries(counts).filter(([, count]) => count > 0).map(([sev, count]) => (
                <span key={sev} className={`tool-chip${sev === "high" || sev === "critical" ? " acid" : ""}`}>{sev}: {count}</span>
              ))}
              <span className="tool-chip">status: {String(result.summary.status ?? "unknown")}</span>
            </div>

            {!result.cliInstalled ? (
              <div className="pscan-error" style={{ marginTop: 16 }}>
                The underlying tool is not installed on this machine — the CLI command below is ready to run manually.
              </div>
            ) : null}

            <div className="pscan-section">
              <div className="pscan-section-head">
                <h2 className="pscan-section-title">CLI</h2>
                <span className="pscan-section-meta">{result.cli.exitCode === null ? "exit —" : `exit ${result.cli.exitCode}`}</span>
              </div>
              <div className="pscan-terminal" style={{ marginTop: 0 }}>
                <div className="pscan-terminal-head">
                  <span><TerminalSquare size={12} style={{ verticalAlign: -2, marginRight: 6 }} />{config.cliLabel}</span>
                  <span className="live">● {result.cliInstalled ? "ran" : "preview"}</span>
                </div>
                <div className="pscan-terminal-body" style={{ maxHeight: 420 }}>
                  <div className="pscan-log-line ok">$ {result.cli.commandString}</div>
                  {result.cli.rawOutput ? result.cli.rawOutput.split("\n").filter(Boolean).map((line, index) => (
                    <div key={`${index}-${line.slice(0, 10)}`} className={`pscan-log-line${/vulnerab|triggered|reflected|high|critical/i.test(line) ? " err" : ""}`}>{line}</div>
                  )) : <div className="pscan-log-line">(no terminal output captured)</div>}
                </div>
              </div>
            </div>

            <div className="pscan-section">
              <div className="pscan-section-head">
                <h2 className="pscan-section-title">Findings</h2>
                <span className="pscan-section-meta">{findings.length} total</span>
              </div>
              {findings.length === 0 ? (
                <div className="pscan-empty">No findings — {config.toolLabel} reported <strong style={{ color: "var(--ps-ink)" }}>{result.summary.status}</strong>.</div>
              ) : (
                <div className="tool-findings-grid">
                  {findings.map((finding, index) => (
                    <ToolFindingCard key={finding.id || `${config.slug}-${index}`} finding={finding} index={index} open={open.has(finding.id || `${config.slug}-${index}`)} onToggle={() => {
                      const key = finding.id || `${config.slug}-${index}`;
                      setOpen((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div className="pscan-actions">
              <button className="pscan-btn" type="button" onClick={reset}><RotateCcw size={15} /> New scan</button>
              <button className="pscan-btn-ghost" type="button" onClick={downloadJson}><Download size={14} /> Export JSON</button>
              <span className="pscan-btn-ghost" style={{ cursor: "default", opacity: 0.6 }}>
                scanned {result.scannedAt.replace("T", " ").replace("Z", "")}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ToolFindingCard({ finding, index, open, onToggle }: { finding: ToolFinding; index: number; open: boolean; onToggle: () => void }) {
  const rows: Array<[string, string]> = [];
  if (finding.param !== undefined) rows.push(["Parameter", String(finding.param)]);
  if (finding.payload !== undefined) rows.push(["Payload", String(finding.payload)]);
  if (finding.url !== undefined) rows.push(["URL", String(finding.url)]);
  if (finding.location !== undefined) rows.push(["Redirected to", String(finding.location)]);
  if (finding.source !== undefined) rows.push(["Source", String(finding.source)]);
  if (finding.value !== undefined) rows.push(["Matched (redacted)", String(finding.value)]);
  if (finding.entropy !== undefined) rows.push(["Entropy", String(finding.entropy)]);
  if (finding.engine !== undefined) rows.push(["Engine", String(finding.engine)]);
  if (finding.type !== undefined) rows.push(["Type", String(finding.type)]);
  if (finding.cwe !== undefined) rows.push(["CWE", String(finding.cwe)]);
  if (finding.confidence !== undefined) rows.push(["Confidence", String(finding.confidence)]);
  if (finding.templateId !== undefined) rows.push(["Template", String(finding.templateId)]);
  if (finding.matchedAt !== undefined) rows.push(["Matched at", String(finding.matchedAt)]);
  if (finding.detection !== undefined) rows.push(["Detection", String(finding.detection)]);
  if (finding.statusCode !== undefined) rows.push(["Status", String(finding.statusCode)]);

  return (
    <div className={`tool-finding ${finding.severity}${open ? " open" : ""}`} style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}>
      <div className="tool-finding-head" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(event) => { if (event.key === "Enter") onToggle(); }}>
        <Bug size={15} style={{ color: "var(--ps-amber)", flexShrink: 0 }} />
        <span className="tool-finding-title">{finding.title}</span>
        <span className="tool-finding-sev">{finding.severity}</span>
        <span style={{ color: "var(--ps-dim)", transform: open ? "rotate(90deg)" : undefined, transition: "transform .2s" }}>▶</span>
      </div>
      <div className="tool-finding-body">
        {rows.length ? (
          <div style={{ display: "grid", gap: 0, marginBottom: 10 }}>
            {rows.map(([label, value]) => (
              <div className="kv" key={label}><b>{label}</b><span>{value}</span></div>
            ))}
          </div>
        ) : null}
        {finding.evidence ? <div className="pscan-evidence" style={{ marginTop: 10 }}><div className="pscan-evidence-label">evidence</div>{finding.evidence}</div> : null}
        {finding.pocCurl ? <div className="pscan-evidence" style={{ marginTop: 8 }}><div className="pscan-evidence-label">poc</div>{finding.pocCurl}</div> : null}
        {finding.curl ? <div className="pscan-evidence" style={{ marginTop: 8 }}><div className="pscan-evidence-label">curl</div>{finding.curl}</div> : null}
        <div className="pscan-remediation" style={{ marginTop: 10 }}><Wrench size={14} /><span>Review and validate on the authorized target before acting.</span></div>
      </div>
    </div>
  );
}