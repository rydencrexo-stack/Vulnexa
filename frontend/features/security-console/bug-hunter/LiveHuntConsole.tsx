"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Braces,
  Bug,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileCode2,
  Globe2,
  Radar,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AgentTask, TaskLog } from "./tasks";
import { acunetixService, severityName, type AcunetixVulnerability } from "../acunetix-service";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-rose-400/30 bg-rose-400/[0.09] text-rose-300",
  high: "border-orange-400/30 bg-orange-400/[0.09] text-orange-300",
  medium: "border-amber-300/30 bg-amber-300/[0.09] text-amber-200",
  low: "border-emerald-300/30 bg-emerald-300/[0.09] text-emerald-300",
  informational: "border-slate-300/25 bg-slate-300/[0.07] text-slate-300",
};

type LogFilter = "all" | "agent" | "tools" | "reasoning" | "signals";

const STAGES = [
  { label: "Scope + recon", short: "RECON", from: 0, to: 24, icon: Radar },
  { label: "JavaScript + API map", short: "JS / API", from: 24, to: 44, icon: Braces },
  { label: "DeepSeek skill hunt", short: "AI HUNT", from: 44, to: 70, icon: Bot },
  { label: "Evidence validation", short: "VALIDATE", from: 70, to: 88, icon: ShieldCheck },
  { label: "Detailed AI report", short: "REPORT", from: 88, to: 101, icon: FileCode2 },
];

const FILTERS: Array<{ id: LogFilter; label: string }> = [
  { id: "all", label: "All output" },
  { id: "agent", label: "Agent" },
  { id: "tools", label: "Tools" },
  { id: "reasoning", label: "Reasoning" },
  { id: "signals", label: "Signals" },
];

function logVisible(log: TaskLog, filter: LogFilter): boolean {
  if (filter === "all") return true;
  if (filter === "tools") return log.kind === "tool" || log.level === "cmd";
  if (filter === "reasoning") return log.kind === "reasoning" || log.level === "ai";
  if (filter === "signals") return log.kind === "finding" || log.kind === "asset" || log.level === "warn" || log.level === "err";
  return log.kind === "text" || log.kind === "step" || log.kind === "status" || log.kind === "heartbeat" || log.kind === "session";
}

function lineColor(log: TaskLog): string {
  if (log.level === "err") return "text-rose-300";
  if (log.level === "warn") return "text-amber-300";
  if (log.level === "ok") return "text-emerald-300";
  if (log.level === "ai" || log.kind === "reasoning") return "text-violet-200";
  if (log.level === "cmd" || log.kind === "tool") return "text-cyan-100";
  return "text-slate-300";
}

function lineLabel(log: TaskLog): string {
  if (log.kind === "reasoning") return "THINK";
  if (log.kind === "tool") return "TOOL";
  if (log.kind === "heartbeat") return "LIVE";
  if (log.kind === "session") return "LINK";
  if (log.kind === "report") return "REPORT";
  if (log.level === "warn") return "SIGNAL";
  if (log.level === "err") return "ERROR";
  if (log.level === "ok") return "OK";
  return "AGENT";
}

function elapsedSince(startedAt: string | null): string {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function LiveHuntConsole({ task, progress, onStop, onOpen }: { task: AgentTask; progress: number; onStop: () => void; onOpen: () => void }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [followTail, setFollowTail] = useState(true);
  const [elapsed, setElapsed] = useState(() => elapsedSince(task.startedAt));
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(elapsedSince(task.startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [task.startedAt]);

  const visibleLogs = useMemo(() => task.logs.filter((log) => logVisible(log, filter)), [filter, task.logs]);
  const stats = useMemo(() => {
    const text = task.logs.map((log) => log.text).join("\n");
    const assets = new Set(task.reconAssets);
    for (const match of text.matchAll(/\[asset\]\s+([^\s]+)/gi)) assets.add(match[1]);
    return {
      tools: task.logs.filter((log) => log.kind === "tool").length,
      assets: assets.size,
      endpoints: new Set(Array.from(text.matchAll(/https?:\/\/[^\s)\]"']+/gi), (match) => match[0])).size,
      signals: task.logs.filter((log) => log.level === "warn" || log.kind === "finding").length,
    };
  }, [task.logs, task.reconAssets]);

  useEffect(() => {
    if (followTail && terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [followTail, visibleLogs]);

  const currentStage = STAGES.find((stage) => progress >= stage.from && progress < stage.to) ?? STAGES.at(-1)!;
  const CurrentStageIcon = currentStage.icon;

  return (
    <section className="relative mt-5 overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#020706] shadow-[0_28px_90px_rgba(0,0,0,.48),0_0_60px_rgba(34,211,238,.04)]">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(45,212,191,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,.035)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute -left-24 -top-36 h-80 w-80 rounded-full bg-cyan-400/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-10 h-96 w-96 rounded-full bg-violet-500/[0.08] blur-3xl" />

      <header className="relative border-b border-white/[0.07] px-5 py-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200">
            <Radar className="h-6 w-6 animate-[spin_9s_linear_infinite]" />
            <span className="absolute inset-1 animate-ping rounded-xl border border-cyan-300/15" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 font-mono text-[9px] font-bold tracking-[.18em] text-emerald-300">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />LIVE
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[.22em] text-violet-300">Antigravity / DeepSeek</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-100">Autonomous evidence hunt · {task.target}</h2>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-x-5 gap-y-1 text-right font-mono text-[10px] uppercase tracking-[.12em] text-slate-500 sm:grid-cols-3">
            <div><span className="block text-sm font-semibold tracking-normal text-slate-200">{elapsed}</span>elapsed</div>
            <div><span className="block text-sm font-semibold tracking-normal text-cyan-200">{task.model.replace("deepseek-v4-", "v4 ")}</span>model</div>
            <div className="hidden sm:block"><span className="block text-sm font-semibold tracking-normal text-violet-200">{task.skills.length}</span>playbooks</div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-violet-400 transition-[width] duration-700" style={{ width: `${Math.max(2, progress)}%` }} />
            <div className="absolute inset-y-0 w-28 animate-[hunt-sweep_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
          <span className="w-10 text-right font-mono text-xs font-semibold text-cyan-200">{progress}%</span>
        </div>
      </header>

      <div className="relative grid xl:grid-cols-[250px_minmax(0,1fr)_245px]">
        <aside className="border-b border-white/[0.07] p-4 xl:border-b-0 xl:border-r">
          <p className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">Engagement pipeline</p>
          <div className="space-y-1.5">
            {STAGES.map((stage, index) => {
              const done = progress >= stage.to;
              const active = currentStage.short === stage.short;
              const Icon = stage.icon;
              return (
                <div key={stage.short} className={`relative flex items-center gap-3 rounded-xl border px-3 py-3 transition ${active ? "border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-100" : done ? "border-emerald-300/10 bg-emerald-300/[0.035] text-emerald-300" : "border-white/[0.05] text-slate-600"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-cyan-300/15" : "bg-white/[0.035]"}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className={`h-3.5 w-3.5 ${active ? "animate-pulse" : ""}`} />}
                  </span>
                  <div className="min-w-0"><span className="block font-mono text-[9px] tracking-[.14em]">0{index + 1} / {stage.short}</span><span className="block truncate text-xs">{stage.label}</span></div>
                  {active ? <ChevronRight className="ml-auto h-3.5 w-3.5 animate-pulse" /> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-300/[0.035] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-violet-200"><Sparkles className="h-3.5 w-3.5" /> Adaptive skill routing</div>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-500">OpenCode loads relevant playbooks as the stack, routes, and response behavior are discovered.</p>
          </div>
        </aside>

        <div className="min-w-0 p-3 sm:p-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 shadow-inner">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] bg-white/[0.018] px-3 py-2.5">
              <div className="mr-1 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" /></div>
              <Terminal className="h-3.5 w-3.5 text-cyan-300" />
              <span className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">live OpenCode event stream</span>
              <button onClick={() => setFollowTail((value) => !value)} className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${followTail ? "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-200" : "border-white/10 text-slate-500"}`}>
                {followTail ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} follow tail
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-white/[0.05] px-3 py-2">
              {FILTERS.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.1em] ${filter === item.id ? "bg-white/[0.09] text-slate-100" : "text-slate-600 hover:text-slate-300"}`}>{item.label}</button>)}
              <span className="ml-auto self-center font-mono text-[9px] text-slate-600">{visibleLogs.length}/{task.logs.length} events</span>
            </div>
            <div ref={terminalRef} className="h-[470px] overflow-y-auto overscroll-contain p-3 font-mono text-[11px] leading-[1.65] [scrollbar-color:rgba(103,232,249,.22)_transparent] sm:p-4">
              {visibleLogs.length ? visibleLogs.map((log) => (
                <div key={log.id} className="group grid grid-cols-[46px_42px_minmax(0,1fr)] gap-2 border-b border-white/[0.025] py-1.5 hover:bg-white/[0.018]">
                  <span className="text-[9px] text-slate-700">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</span>
                  <span className={`text-[8px] font-bold tracking-[.08em] ${lineColor(log)}`}>{lineLabel(log)}</span>
                  <pre className={`min-w-0 whitespace-pre-wrap break-words font-mono ${lineColor(log)}`}>{log.text}</pre>
                </div>
              )) : <div className="flex h-full items-center justify-center text-slate-600"><Activity className="mr-2 h-4 w-4 animate-pulse" /> Waiting for {filter} events…</div>}
              <span className="inline-block h-3.5 w-1.5 animate-pulse bg-cyan-300 align-middle" />
            </div>
          </div>
        </div>

        <aside className="border-t border-white/[0.07] p-4 xl:border-l xl:border-t-0">
          <p className="mb-3 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">Live intelligence</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            <Metric icon={Wrench} label="Tool events" value={stats.tools} color="cyan" />
            <Metric icon={Globe2} label="Scoped assets" value={stats.assets} color="emerald" />
            <Metric icon={Braces} label="Routes observed" value={stats.endpoints} color="violet" />
            <Metric icon={Zap} label="Signals to validate" value={stats.signals} color="amber" />
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-600">Now executing</p>
            <div className="mt-2 flex items-start gap-2"><CurrentStageIcon className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-cyan-300" /><div><p className="text-xs font-medium text-slate-200">{currentStage.label}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Evidence is streamed as DeepSeek and OpenCode reason, call tools, and validate responses.</p></div></div>
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={onOpen} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] text-xs font-medium text-cyan-100 hover:bg-cyan-300/[0.1]"><Terminal className="h-3.5 w-3.5" /> Open full workspace</button>
            <button onClick={onStop} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-300/15 bg-rose-300/[0.045] text-xs text-rose-300 hover:bg-rose-300/[0.09]"><Square className="h-3.5 w-3.5" /> Stop assessment</button>
          </div>
        </aside>
      </div>

      <AcunetixBugFeed />

      <footer className="relative flex flex-wrap items-center gap-3 border-t border-white/[0.07] px-5 py-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Authorized scope guard active</span>
        <span className="hidden h-3 w-px bg-white/10 sm:block" />
        <span>Non-destructive validation · secrets redacted · evidence-first reporting</span>
        <span className="ml-auto font-mono uppercase tracking-[.12em]">{currentStage.short}</span>
      </footer>
      <style jsx global>{`@keyframes hunt-sweep { 0% { left: -7rem; } 100% { left: 100%; } }`}</style>
    </section>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: "cyan" | "emerald" | "violet" | "amber" }) {
  const colors = { cyan: "text-cyan-200 bg-cyan-300/[0.07]", emerald: "text-emerald-200 bg-emerald-300/[0.07]", violet: "text-violet-200 bg-violet-300/[0.07]", amber: "text-amber-200 bg-amber-300/[0.07]" };
  return <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[color]}`}><Icon className="h-4 w-4" /></span><div><span className="block font-mono text-lg font-semibold leading-none text-slate-100">{value}</span><span className="text-[10px] text-slate-600">{label}</span></div></div>;
}

/** Live vulnerability feed pulled straight from the Acunetix instance. */
function AcunetixBugFeed() {
  const [bugs, setBugs] = useState<AcunetixVulnerability[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await acunetixService.liveVulnerabilities();
        if (!alive) return;
        setBugs(data);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    for (const bug of bugs ?? []) {
      const name = severityName(bug.severity);
      result[name] = (result[name] ?? 0) + 1;
    }
    return result;
  }, [bugs]);

  return (
    <section className="relative border-t border-white/[0.07] px-5 py-4 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-300/[0.07] text-rose-300"><Bug className="h-4 w-4" /></span>
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Acunetix findings feed</p>
          <h3 className="text-sm font-semibold text-slate-100">Vulnerabilities detected by Acunetix</h3>
        </div>
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-0.5 font-mono text-[9px] font-bold tracking-[.16em] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />{offline ? "OFFLINE" : "LIVE"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["critical", "high", "medium", "low"] as const).map((level) => counts[level] ? (
            <span key={level} className={`rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.1em] ${SEVERITY_STYLES[level]}`}>{level} · {counts[level]}</span>
          ) : null)}
          <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">total · {bugs?.length ?? 0}</span>
        </div>
      </div>

      {bugs === null ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Activity className="h-3.5 w-3.5 animate-pulse" /> Polling the Acunetix instance for findings…</p>
      ) : bugs.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-300" /> No vulnerabilities reported by Acunetix yet — the feed refreshes every 10 seconds.
        </div>
      ) : (
        <div className="mt-4 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          {bugs.map((bug) => (
            <div key={bug.vulnId ?? `${bug.target}-${bug.name}`} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] px-4 py-3">
              <span className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.1em] ${SEVERITY_STYLES[severityName(bug.severity)]}`}>{severityName(bug.severity)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-100" title={bug.name}>{bug.name}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{bug.target ?? "?"}{bug.parameter ? ` · ${bug.method ?? "GET"} ${bug.parameter}` : ""}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {bug.cwe ? <span className="rounded border border-violet-300/20 bg-violet-300/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-violet-200">{bug.cwe}</span> : null}
                  {bug.cvss && bug.cvss !== "—" ? <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-slate-300">CVSS {bug.cvss}</span> : null}
                  <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-slate-400">{bug.confidence}% conf</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
