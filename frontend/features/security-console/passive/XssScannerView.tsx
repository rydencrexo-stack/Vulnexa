"use client";

import { useRef, useState } from "react";
import { Bug, Download, RotateCcw, ShieldAlert, TerminalSquare } from "lucide-react";
import { panService } from "@/services/pan-service";
import { completeScannerScan, startScannerScan } from "../scans-data";
import type { XssScanResult } from "@/types/pan";

type Phase = "idle" | "scanning" | "done" | "error";

const SEV_ORDER = ["critical", "high", "medium", "low", "informational"] as const;

export function XssScannerView() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState("");
  const [inputError, setInputError] = useState("");
  const [result, setResult] = useState<XssScanResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const scanIdRef = useRef<string | null>(null);

  const validate = (value: string): boolean => {
    const candidate = value.trim();
    if (!/^(https?:\/\/)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(\/\S*)?$/i.test(candidate)) {
      setInputError("Enter a domain or http(s) URL — e.g. example.com or https://example.com/page?q=1");
      return false;
    }
    setInputError("");
    return true;
  };

  const runScan = async (value?: string) => {
    const current = (value ?? target).trim();
    if (!validate(current)) return;
    setTarget(current);
    setResult(null);
    setErrorMessage("");
    setPhase("scanning");
    scanIdRef.current = startScannerScan({ scanner: "xss", target: current }).id;
    try {
      const data = await panService.runXssScan({ target: current });
      setResult(data);
      setPhase("done");
      if (scanIdRef.current) completeScannerScan(scanIdRef.current, { progress: 100, findings: data.findings?.length ?? 0, result: data });
    } catch (error) {
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "The Dalfox scanner could not be reached.");
    }
  };

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
    link.download = `xss-${result.target.replace(/[^\w.-]/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const findings = result?.findings ?? [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;

  return (
    <div className="pscan-root">
      <div className="pscan-inner">
        <p className="pscan-kicker"><span className="dot" /> Dalfox XSS Scanner · Real Payload Engine · Authorized Targets Only</p>

        {phase === "idle" || phase === "error" ? (
          <>
            <h1 className="pscan-hero-title">
              Find <span className="accent">cross-site scripting</span> in one target.
            </h1>
            <p className="pscan-hero-sub">
              Enter a URL or domain and PAN runs <strong style={{ color: "var(--ps-ink)" }}>Dalfox</strong> against it —
              the same CLI you know from the terminal, with normalized findings and the exact command shown.
            </p>
            <form
              className="pscan-console"
              onSubmit={(event) => {
                event.preventDefault();
                runScan();
              }}
            >
              <div className="pscan-console-bar">
                <span className="p" /><span className="p" /><span className="p" />
                <span className="pscan-console-title">vulnexa / xss</span>
              </div>
              <div className="pscan-console-body">
                <p className="pscan-prompt">
                  <span className="cmd">$ dalfox url --url</span> &lt;target&gt;
                </p>
                <div className="pscan-input-row">
                  <input
                    className={`pscan-input${inputError ? " error" : ""}`}
                    value={target}
                    onChange={(event) => {
                      setTarget(event.target.value);
                      if (inputError) validate(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runScan();
                      }
                    }}
                    placeholder="https://example.com/page?q=1"
                    autoFocus
                    spellCheck={false}
                  />
                  <button className="pscan-btn" type="submit">
                    <Bug size={15} /> Scan for XSS
                  </button>
                </div>
                <p className="pscan-hint">
                  Only scan targets you own or are explicitly authorized to test. Payloads are real but non-destructive.
                </p>
              </div>
            </form>
            {phase === "error" ? <div className="pscan-error">Scan failed — {errorMessage}</div> : null}
          </>
        ) : null}

        {phase === "scanning" ? (
          <div className="tool-scan-stage tool-scan-grid" style={{ marginTop: 6 }}>
            <div className="tool-console-head">
              <span>vulnexa / xss</span>
              <span className="live">● hunting {target}</span>
            </div>
            <div className="tool-radar" />
            <div className="tool-boot">
              <div className="line ok">▸ arming dalfox payload sequences</div>
              <div className="line">+ target locked: {target}</div>
              <div className="line">~ dispatching reflected &amp; DOM payloads</div>
              <div className="line cyan">» analyzing response reflections…</div>
              <span className="pscan-cursor" />
            </div>
            <div className="tool-progress"><div className="fill" style={{ width: "68%" }} /></div>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <>
            <h1 className="pscan-hero-title" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>
              {result.target} <span className="accent">· xss</span>
            </h1>
            <p className="pscan-hero-sub">
              {result.cliInstalled ? `Dalfox ${result.cli.version ?? ""}` : "Dalfox binary not installed"} · {result.durationSeconds}s ·
              {result.summary.totalRequests} requests · {result.summary.scanDurationMs}ms engine time
            </p>

            <div className="pscan-summary">
              {SEV_ORDER.map((sev) => (
                <div className="pscan-metric" key={sev}>
                  <div className="label">{sev}</div>
                  <div className="value" style={{ color: sev === "informational" ? "var(--ps-mut)" : undefined }}>{counts[sev]}</div>
                  <div className="sub">findings</div>
                </div>
              ))}
              <div className="pscan-metric">
                <div className="label">Requests</div>
                <div className="value" style={{ color: "var(--ps-cyan)", fontSize: 22 }}>{result.summary.totalRequests}</div>
                <div className="sub">total</div>
              </div>
            </div>

            {!result.cliInstalled ? (
              <div className="pscan-error" style={{ marginTop: 22 }}>
                Dalfox is not installed on this machine. Install it with:
                <code className="pscan-evidence" style={{ display: "block", marginTop: 8 }}>go install github.com/hahwul/dalfox/v2@latest</code>
                or set <strong>DALFOX_PATH</strong> to the binary, then re-run.
              </div>
            ) : null}

            <div className="pscan-section">
              <div className="pscan-section-head">
                <h2 className="pscan-section-title">CLI</h2>
                <span className="pscan-section-meta">{result.cli.exitCode === 0 || result.cli.exitCode === null ? "exit 0" : `exit ${result.cli.exitCode}`}</span>
              </div>
              <div className="pscan-terminal" style={{ marginTop: 0 }}>
                <div className="pscan-terminal-head">
                  <span><TerminalSquare size={12} style={{ verticalAlign: -2, marginRight: 6 }} />dalfox url</span>
                  <span className="live">● {result.cliInstalled ? "ran" : "preview"}</span>
                </div>
                <div className="pscan-terminal-body" style={{ maxHeight: 420 }}>
                  <div className="pscan-log-line ok">$ {result.cli.commandString}</div>
                  {result.cli.output.length ? result.cli.output.map((line, index) => (
                    <div key={`${index}-${line.slice(0, 10)}`} className={`pscan-log-line${/vulnerable|triggered|xss|payload/i.test(line) ? " err" : ""}`}>{line}</div>
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
                <div className="pscan-empty">
                  <ShieldAlert size={20} style={{ marginBottom: 8, color: "var(--ps-green)" }} />
                  No XSS detected. Dalfox reported <strong style={{ color: "var(--ps-ink)" }}>{result.summary.status}</strong> for this target.
                </div>
              ) : (
                <div className="pscan-findings">
                  {findings.map((finding) => {
                    const isOpen = open.has(finding.id);
                    return (
                      <div className={`pscan-finding ${finding.severity}${isOpen ? " open" : ""}`} key={finding.id}>
                        <div className="pscan-finding-head" role="button" tabIndex={0} onClick={() => toggle(finding.id)} onKeyDown={(event) => { if (event.key === "Enter") toggle(finding.id); }}>
                          <Bug size={16} style={{ color: "var(--ps-amber)" }} />
                          <span className="pscan-finding-title">{finding.title}</span>
                          <span className="pscan-finding-cat">{finding.typeLabel} · {finding.cwe}</span>
                          <span className="pscan-finding-toggle">▶</span>
                        </div>
                        <div className="pscan-finding-body">
                          <p className="pscan-finding-desc">
                            <strong>Parameter:</strong> {finding.param} ({finding.method} {finding.location}) · <strong>Confidence:</strong> {finding.confidence}
                            {finding.confidenceReason ? ` — ${finding.confidenceReason}` : ""}
                            {finding.evidence ? ` · ${finding.evidence}` : ""}
                          </p>
                          <div className="pscan-evidence">
                            <div className="pscan-evidence-label">payload</div>
                            {finding.payload}
                          </div>
                          <div className="pscan-evidence">
                            <div className="pscan-evidence-label">injected url</div>
                            {finding.url}
                          </div>
                          <div className="pscan-evidence">
                            <div className="pscan-evidence-label">poc</div>
                            {finding.pocCurl}
                          </div>
                          {finding.injectType ? <div className="pscan-remediation" style={{ color: "var(--ps-cyan)" }}><ShieldAlert size={14} /><span>Inject type: {finding.injectType} · Detection: {finding.detectionMethod}</span></div> : null}
                        </div>
                      </div>
                    );
                  })}
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