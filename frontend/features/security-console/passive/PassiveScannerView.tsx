"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, RotateCcw } from "lucide-react";
import { panService } from "@/services/pan-service";
import type { SurfaceScanResult } from "@/types/pan";
import { completeScannerScan, startScannerScan } from "../scans-data";
import { SurfaceGraph } from "./SurfaceGraph";
import { AssetsView, OverviewView, RelationshipsView, SourcesView, TimelineView, TreeView } from "./SurfaceViews";

type Phase = "idle" | "scanning" | "replaying" | "done" | "error";
type Tab = "overview" | "graph" | "tree" | "assets" | "timeline" | "relationships" | "sources";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "graph", label: "Graph" },
  { id: "tree", label: "Tree" },
  { id: "assets", label: "Assets" },
  { id: "timeline", label: "Timeline" },
  { id: "relationships", label: "Relationships" },
  { id: "sources", label: "Sources" },
];

export function PassiveScannerView() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [domain, setDomain] = useState("");
  const [inputError, setInputError] = useState("");
  const [result, setResult] = useState<SurfaceScanResult | null>(null);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const timersRef = useRef<number[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const validateDomain = (value: string): boolean => {
    const candidate = value.trim().toLowerCase();
    if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(candidate)) {
      setInputError("Enter a valid domain — e.g. example.com (no scheme, no path)");
      return false;
    }
    setInputError("");
    return true;
  };

  const runScan = async (target?: string) => {
    const value = (target ?? domain).trim().toLowerCase();
    if (!validateDomain(value)) return;
    setDomain(value);
    setResult(null);
    setVisibleLogs([]);
    setErrorMessage("");
    setTab("overview");
    setPhase("scanning");
    const record = startScannerScan({ scanner: "passive", target: value });
    setScanId(record.id);

    try {
      const data = await panService.runSurfaceScan({ domain: value });
      setResult(data);
      setPhase("replaying");
      completeScannerScan(record.id, { progress: 100, findings: data.findings?.length ?? 0, result: data });
      setVisibleLogs([]);
      const logs = data.log ?? [];
      const stepMs = Math.max(18, Math.min(90, Math.floor(3000 / Math.max(logs.length, 1))));
      logs.forEach((line, index) => {
        timersRef.current.push(window.setTimeout(() => {
          setVisibleLogs((current) => [...current, line]);
          if (index === logs.length - 1) {
            timersRef.current.push(window.setTimeout(() => setPhase("done"), 380));
          }
        }, 70 + index * stepMs));
      });
    } catch (error) {
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "The discovery engine could not be reached.");
    }
  };

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setResult(null);
    setVisibleLogs([]);
    setErrorMessage("");
    setTab("overview");
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `surface-${result.domain}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pscan-root">
      <div className="pscan-inner">
        <p className="pscan-kicker"><span className="dot" /> Surface Finder · Passive Attack-Surface Discovery · Read-Only</p>

        {phase === "idle" || phase === "error" ? (
          <>
            <h1 className="pscan-hero-title">
              Map the <span className="accent">entire surface</span> of any domain.
            </h1>
            <p className="pscan-hero-sub">
              One domain. A graph of subdomains, certificates, IPs, ASNs, cloud providers,
              historical URLs, API endpoints, technologies and code references — every edge
              backed by evidence, confidence and scope. No attack payloads are ever sent.
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
                <span className="pscan-console-title">vulnexa / surface-finder</span>
              </div>
              <div className="pscan-console-body">
                <p className="pscan-prompt">
                  <span className="cmd">$ pan surface --target</span> &lt;domain&gt;
                </p>
                <div className="pscan-input-row">
                  <input
                    className={`pscan-input${inputError ? " error" : ""}`}
                    value={domain}
                    onChange={(event) => {
                      setDomain(event.target.value);
                      if (inputError) validateDomain(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runScan();
                      }
                    }}
                    placeholder="example.com"
                    autoFocus
                    spellCheck={false}
                  />
                  <button className="pscan-btn" type="submit">
                    <span className="spinner" aria-hidden="true" /> Map Surface
                  </button>
                </div>
                <p className="pscan-hint">
                  Sources: Certificate Transparency · Passive DNS · Wayback · Common Crawl · DNS · IP/ASN · GitHub (if token configured)
                </p>
              </div>
            </form>
            {phase === "error" ? <div className="pscan-error">Discovery failed — {errorMessage}</div> : null}
          </>
        ) : null}

        {phase === "scanning" ? (
          <div className="tool-scan-stage tool-scan-grid" style={{ marginTop: 6 }}>
            <div className="tool-console-head">
              <span>vulnexa / surface-finder</span>
              <span className="live">● discovering {domain}</span>
            </div>
            <div className="tool-radar" />
            <div className="tool-boot">
              <div className="line ok">▸ initializing discovery engine</div>
              <div className="line">+ locking target scope: {domain}</div>
              <div className="line">~ querying certificate transparency / passive DNS / Wayback</div>
              <div className="line cyan">» building the asset graph…</div>
              <span className="pscan-cursor" />
            </div>
            <div className="tool-progress"><div className="fill" style={{ width: "62%" }} /></div>
          </div>
        ) : null}

        {phase === "replaying" ? (
          <div className="pscan-terminal" style={{ marginTop: 8 }}>
            <div className="pscan-terminal-head">
              <span>recon stream</span>
              <span className="live">● live</span>
            </div>
            <div className="pscan-terminal-body">
              {visibleLogs.map((line, index) => (
                <div key={`${index}-${line.slice(0, 12)}`} className={`pscan-log-line${line.startsWith("!") ? " err" : ""}`}>{line}</div>
              ))}
              <span className="pscan-cursor" />
            </div>
          </div>
        ) : null}

        {phase === "done" && result ? (
          <>
            <h1 className="pscan-hero-title" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>
              {result.domain} <span className="accent">· surface</span>
            </h1>
            <p className="pscan-hero-sub">
              {result.summary.assetTotal} assets · {result.summary.relationshipCount} relationships
              · {result.durationSeconds}s · {result.sourcesUsed.length} sources
            </p>

            <nav className="pscan-tabs" aria-label="Surface views">
              {TABS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`pscan-tab${tab === item.id ? " is-active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  {item.id === "assets" ? <span className="pscan-tab-count">{result.assets.length}</span> : null}
                </button>
              ))}
            </nav>

            <div className="pscan-view">
              {tab === "overview" ? <OverviewView result={result} /> : null}
              {tab === "graph" ? <SurfaceGraph assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
              {tab === "tree" ? <TreeView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
              {tab === "assets" ? <AssetsView assets={result.assets} /> : null}
              {tab === "timeline" ? <TimelineView timeline={result.timeline} assets={result.assets} /> : null}
              {tab === "relationships" ? <RelationshipsView assets={result.assets} relationships={result.relationships} rootValue={result.domain} /> : null}
              {tab === "sources" ? <SourcesView result={result} /> : null}
            </div>

            <div className="pscan-actions">
              <button className="pscan-btn" type="button" onClick={reset}><RotateCcw size={15} /> New scan</button>
              {scanId ? <Link className="pscan-btn" href={`/scanner/passive/${scanId}`}>View scan →</Link> : null}
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