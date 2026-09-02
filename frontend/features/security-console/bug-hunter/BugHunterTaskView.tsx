"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Play,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Wifi,
} from "lucide-react";
import { StatusBadge } from "@/components/pan";
import { DefinitionGrid } from "../FeatureUI";
import { getTask, patchTask, deleteTask, upsertTask, type AgentTask, type TaskLog } from "./tasks";
import { FINAL_ANALYSIS_PROMPT, normalizeAiAssessment, openCodeWsUrl } from "./engine";
import { saveReport } from "./store";
import { getModel } from "./store";
import { panService } from "@/services/pan-service";
import type { AgentFinding, AgentRunResult } from "@/types/pan";

const btn = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition";

export function BugHunterTaskView({ id }: { id: string }) {
  const router = useRouter();
  const [task, setTask] = useState<AgentTask | null>(null);
  const [connected, setConnected] = useState(false);
  const [chat, setChat] = useState("");
  const [auth, setAuth] = useState("None - non-authenticated");
  const [cred, setCred] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scanResultRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      const latest = getTask(id);
      if (latest) { setTask(latest); if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }
    }, 200);
    return () => clearInterval(iv);
  }, [id]);

  useEffect(() => {
    return () => { if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: "close" })); };
  }, []);

  function refresh() { setTask(getTask(id)); }

  function pushLog(level: TaskLog["level"], text: string, kind?: TaskLog["kind"]) {
    const cur = getTask(id);
    if (!cur) return;
    const last = cur.logs.at(-1);
    const canCoalesce = (kind === "text" || kind === "reasoning") && last?.kind === kind && last.level === level && last.text.length + text.length < 24_000;
    const logs = canCoalesce
      ? [...cur.logs.slice(0, -1), { ...last, text: last.text + text }].slice(-2000)
      : [...cur.logs, { id: (last?.id ?? 0) + 1, level, text, kind, timestamp: new Date().toISOString() }].slice(-2000);
    patchTask(id, { logs });
    setTask(getTask(id));
  }

  async function connectScan() {
    const cur = getTask(id);
    if (!cur) return;
    patchTask(id, { status: "running", startedAt: new Date().toISOString(), completedAt: null });
    setTask(getTask(id));

    let token = "";
    try { token = await panService.getAgentWsToken(); } catch { pushLog("err", "could not obtain an agent session token"); return; }

    const ws = new WebSocket(openCodeWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      pushLog("cmd", `$ bug-hunter --target ${cur.target} --mode ${cur.mode}`, "operator");
      ws.send(JSON.stringify({ token, target: cur.target, command: cur.mode === "complete" ? "assess" : "analyze", acknowledged: true, notes: cur.notes ?? "", auth, credentials: cred, headers: "", model: cur.model, reconAssets: cur.reconAssets ?? [], phases: cur.phases, skills: cur.skills }));
    };
    ws.onmessage = (event) => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(String(event.data)); } catch { return; }
      const type = m.type as string;
      if (type === "status") {
        const cur = getTask(id);
        if (!cur) return;
        const logs = [...cur.logs];
        const last = logs[logs.length - 1];
        if (last && (last.text.startsWith("agent working") || last.text.startsWith("connected") || last.text.startsWith("/assess") || last.text.startsWith("/analyze"))) {
          logs[logs.length - 1] = { ...last, level: (m.level as TaskLog["level"]) || "info", text: String(m.text ?? ""), kind: (m.kind as TaskLog["kind"]) || "status", timestamp: new Date().toISOString() };
        } else {
          logs.push({ id: (last?.id ?? 0) + 1, level: (m.level as TaskLog["level"]) || "info", text: String(m.text ?? ""), kind: (m.kind as TaskLog["kind"]) || "status", timestamp: new Date().toISOString() });
        }
        patchTask(id, { logs: logs.slice(-2000), progress: Math.min(85, Math.max(cur.progress, cur.progress + 2)) });
        setTask(getTask(id));
      } else if (type === "log") pushLog((m.level as TaskLog["level"]) || "info", String(m.text ?? ""), (m.kind as TaskLog["kind"]) || "text");
      else if (type === "error") pushLog("err", String(m.message ?? "error"));
      else if (type === "done") {
        if (m.phase === "chat") {
          if (scanResultRef.current) finalizeReport(scanResultRef.current, m.result);
          else pushLog("ok", `[opencode] ${String(m.summary ?? "")}`.slice(0, 2000));
        } else {
          scanResultRef.current = m;
          pushLog("ai", "[ai] DeepSeek is synthesizing the comprehensive final report…");
          ws.send(JSON.stringify({ action: "chat", text: FINAL_ANALYSIS_PROMPT }));
        }
      }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => pushLog("err", "websocket connection failed");
  }

  function finalizeReport(m: Record<string, unknown>, analysisValue?: unknown) {
    const cur = getTask(id);
    if (!cur) return;
    const now = new Date().toISOString();
    const findings = (Array.isArray(m.findings) ? m.findings : []) as AgentFinding[];
    const assets = (Array.isArray(m.assets) ? m.assets : []) as AgentRunResult["assets"];
    const endpoints = (Array.isArray(m.endpoints) ? m.endpoints : []) as AgentRunResult["endpoints"];
    const aiAnalysis = normalizeAiAssessment(analysisValue);
    const report = {
      id: `agent_${Date.now()}`,
      name: `${cur.target} — AI bug-hunter assessment (${cur.mode})`,
      target: cur.target,
      auth: cur.auth || "None",
      model: getModel(),
      phases: cur.phases,
      skills: cur.skills,
      summary: aiAnalysis?.executiveSummary ?? String(m.summary ?? "Assessment complete."),
      findings,
      assets,
      endpoints,
      evidenceSummary: { subdomains: Math.max(assets.length, (cur.reconAssets ?? []).length), archiveUrls: 0, paths: endpoints.length, jsBundles: 0, emails: 0, github: null, virustotal: null },
      methodology: ["Recon Overview inventory import", "OpenCode agent assessment", `DeepSeek analysis using opencode-go/${cur.model}`],
      aiSummary: aiAnalysis?.executiveSummary ?? String(m.summary ?? null),
      aiAnalysis,
      coverage: Number(m.coverage ?? 60),
      createdAt: now,
      startedAt: cur.startedAt ?? now,
      completedAt: now,
    };
    saveReport({ ...report, status: "ready" });
    const logs = [...cur.logs, { id: cur.logs.length + 1, level: "ok" as TaskLog["level"], text: `[opencode] assessment complete — ${findings.length} findings` }];
    upsertTask({ ...cur, report, status: "completed", progress: 100, completedAt: now, logs });
    setTask(getTask(id));
  }

  function sendChat() {
    const text = chat.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { pushLog("warn", "not connected to the OpenCode agent"); return; }
    pushLog("cmd", `> ${text}`);
    wsRef.current.send(JSON.stringify({ action: "chat", text }));
    setChat("");
  }

  function disconnect() {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: "close" }));
    setConnected(false);
  }

  function stop() {
    disconnect();
    patchTask(id, { status: "cancelled", completedAt: new Date().toISOString() });
    refresh();
  }
  function remove() {
    disconnect();
    deleteTask(id);
    router.push("/bug-hunter");
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-slate-400">Task not found.</p>
        <Link href="/bug-hunter" className={`${btn} border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]`}><ArrowLeft className="h-4 w-4" /> Back to DeltaAI</Link>
      </div>
    );
  }

  const report = task.report;
  const active = task.status === "running" || task.status === "queued" || task.status === "paused";

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/bug-hunter" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100">{task.name}</h1>
            <p className="font-mono text-xs text-slate-500">{task.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={task.status} />
          {active ? (
            <>
              <button onClick={stop} className={`${btn} border-red-300/20 bg-red-300/[0.06] text-red-300 hover:bg-red-300/[0.12]`}><Square className="h-4 w-4" /> Stop</button>
            </>
          ) : task.status === "cancelled" || task.status === "failed" ? (
            <button onClick={connectScan} className={`${btn} border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]`}><RefreshCw className="h-4 w-4" /> Re-run</button>
          ) : null}
          {connected ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/30 bg-teal-300/[0.08] px-2.5 py-1 text-xs font-semibold text-teal-300"><Wifi className="h-3.5 w-3.5" /> opencode</span> : null}
          <button onClick={remove} className={`${btn} border-red-300/20 bg-red-300/[0.06] text-red-300 hover:bg-red-300/[0.12]`}><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
        {/* Left: live terminal + options + chat */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#040807]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Options</span>
            <select value={auth} onChange={(e) => setAuth(e.target.value)} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-400/40">
              <option value="None - non-authenticated">Unauthenticated</option>
              <option value="Authenticated (credentials)">Authenticated</option>
            </select>
            <input value={cred} onChange={(e) => setCred(e.target.value)} placeholder="credentials e.g. user:pass" className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400/40" />
            <span className="font-mono text-xs text-slate-500">{task.progress}%</span>
          </div>
          <div className="h-1 w-full bg-white/[0.06]"><div className="h-full bg-teal-400 transition-all duration-500" style={{ width: `${task.progress}%` }} /></div>
          <div ref={logRef} className="h-[440px] overflow-y-auto p-4 font-mono text-xs leading-6">
            {task.logs.length === 0 ? <p className="text-slate-600"># no output yet — connect to the OpenCode agent and run.</p> : task.logs.map((line) => (
              <div key={line.id} className={line.level === "ok" ? "text-teal-300" : line.level === "warn" ? "text-amber-300" : line.level === "err" ? "text-red-300" : line.level === "ai" ? "text-violet-300" : line.level === "cmd" ? "text-slate-200" : "text-slate-400"}>{line.text}</div>
            ))}
            {active ? <div className="mt-1 text-slate-500"><RefreshCw className="inline h-3 w-3 animate-spin" /> working…</div> : null}
          </div>
          {/* Chat bar */}
          <div className="flex items-center gap-2 border-t border-white/[0.06] p-3">
            <input
              aria-label="Chat with the OpenCode agent"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400/40"
              onChange={(e) => setChat(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder={connected ? "Chat with the OpenCode agent… (Enter to send)" : "Start a run to connect to the OpenCode agent"}
              value={chat}
            />
            {!connected ? (
              <button onClick={connectScan} className={`${btn} !h-9 border-teal-300/30 bg-teal-300/[0.08] text-teal-300 hover:bg-teal-300/[0.14]`}><Play className="h-4 w-4" /> Run</button>
            ) : (
              <button onClick={sendChat} className={`${btn} !h-9 border-teal-300/30 bg-teal-300/[0.08] text-teal-300 hover:bg-teal-300/[0.14]`}><Send className="h-4 w-4" /> Send</button>
            )}
          </div>
        </div>

        {/* Right: report */}
        <div className="grid content-start gap-5">
          {report ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-100">Detailed report</h2>
                  <button onClick={() => downloadJson(task)} className={`${btn} !h-8 border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]`}><Download className="h-4 w-4" /> JSON</button>
                </div>
                <DefinitionGrid items={[
                  { label: "Target", value: report.target },
                  { label: "Mode", value: report.phases.length > 8 ? "Complete" : "Custom" },
                  { label: "Model", value: report.model },
                  { label: "Coverage", value: `${report.coverage}%` },
                  { label: "Findings", value: String(report.findings.length) },
                  { label: "Subdomains", value: String(report.evidenceSummary?.subdomains ?? report.assets?.length ?? 0) },
                  { label: "Endpoints", value: String(report.endpoints?.length ?? 0) },
                  { label: "Auth", value: report.auth },
                ]} />
              </div>
              {(report.assets?.length ?? 0) > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-5">
                  <h2 className="mb-3 text-base font-bold text-slate-100">Attack surface · subdomains</h2>
                  <div className="max-h-64 divide-y divide-white/[0.06] overflow-y-auto rounded-lg border border-white/[0.07]">
                    {report.assets.map((asset) => (
                      <div key={`${asset.hostname}-${asset.url}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0"><p className="truncate font-mono text-xs text-teal-200">{asset.hostname}</p><p className="truncate text-[11px] text-slate-500">{asset.title || asset.url}</p></div>
                        <span className={`shrink-0 font-mono text-[11px] ${asset.status > 0 && asset.status < 400 ? "text-teal-300" : "text-slate-500"}`}>{asset.status > 0 ? asset.status : "imported"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {(report.endpoints?.length ?? 0) > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-5">
                  <h2 className="mb-3 text-base font-bold text-slate-100">Discovered endpoints</h2>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {report.endpoints.slice(0, 100).map((endpoint, index) => (
                      <div key={`${endpoint.url}-${index}`} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                        <span className="mr-2 rounded bg-teal-300/10 px-1.5 py-0.5 font-mono text-[10px] text-teal-300">{endpoint.method}</span>
                        <span className="break-all font-mono text-[11px] text-slate-300">{endpoint.url}</span>
                        <p className="mt-1 text-[10px] text-slate-500">{endpoint.kind} · {endpoint.source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-5">
                <h2 className="mb-3 text-base font-bold text-slate-100">Findings</h2>
                <div className="grid gap-2">
                  {report.findings.map((f, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-200">{f.title}</p><StatusBadge value={f.severity} /></div>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">{f.endpoint}</p>
                      <p className="mt-1 text-xs text-slate-400">Confidence {f.confidence}%</p>
                      {f.rationale ? <p className="mt-2 rounded-md border border-violet-300/20 bg-violet-300/[0.05] p-2 text-xs leading-5 text-slate-300"><span className="font-bold text-violet-300">AI:</span> {f.rationale}</p> : null}
                    </div>
                  ))}
                  {report.findings.length === 0 ? <p className="text-sm text-slate-500">No findings recorded.</p> : null}
                </div>
              </div>
              {report.aiSummary ? (
                <div className="rounded-2xl border border-violet-300/25 bg-violet-300/[0.06] p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet-300">AI summary · {report.model}</p>
                  <p className="text-sm leading-6 text-slate-200">{report.aiSummary}</p>
                </div>
              ) : null}
              {report.aiAnalysis ? (
                <div className="grid gap-3 rounded-2xl border border-violet-300/25 bg-violet-300/[0.04] p-5">
                  <div className="flex items-center justify-between gap-3"><h2 className="text-base font-bold text-violet-100">Comprehensive DeepSeek analysis</h2><span className="font-mono text-xs text-violet-300">{report.aiAnalysis.confidence}% confidence</span></div>
                  {[
                    ["Attack surface", report.aiAnalysis.attackSurface],
                    ["Risk assessment", report.aiAnalysis.riskAssessment],
                    ["Testing narrative", report.aiAnalysis.testingNarrative],
                  ].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{value}</p></div>)}
                  {report.aiAnalysis.subdomainHighlights.length ? <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Priority subdomains</p><div className="grid gap-2">{report.aiAnalysis.subdomainHighlights.map((item) => <div key={item.hostname} className="rounded-lg border border-violet-300/15 bg-black/15 p-2.5"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-violet-100">{item.hostname}</span><span className="text-[10px] uppercase text-violet-300">{item.priority}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{item.reason}</p></div>)}</div></div> : null}
                  {report.aiAnalysis.recommendations.length ? <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300">Recommendations</p><ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">{report.aiAnalysis.recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div> : null}
                  {report.aiAnalysis.limitations.length ? <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Limitations</p><ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">{report.aiAnalysis.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
                </div>
              ) : null}
              <div className="rounded-2xl border border-teal-300/20 bg-teal-300/[0.05] p-4">
                <p className="text-sm leading-6 text-slate-300">{report.summary}</p>
              </div>
              {(report.methodology?.length ?? 0) > 0 ? <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-5"><h2 className="mb-3 text-base font-bold text-slate-100">Methodology</h2><ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-slate-400">{report.methodology.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div> : null}
              {task.notes?.trim() ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">Operator notes</h3>
                  <p className="text-sm leading-6 whitespace-pre-wrap text-slate-200">{task.notes}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0f0a] p-6 text-center">
              <p className="text-sm text-slate-500">Report will appear here when the OpenCode agent run completes.</p>
              <button onClick={connectScan} className={`${btn} mt-4 border-white/15 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]`}><Play className="h-4 w-4" /> Run now</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function downloadJson(task: AgentTask) {
  const report = task.report;
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${report.id}.json`; a.click();
  URL.revokeObjectURL(url);
}
