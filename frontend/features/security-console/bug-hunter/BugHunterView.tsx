"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CircleDot,
  ChevronDown,
  ChevronRight,
  FileText,
  KeyRound,
  ListChecks,
  Minus,
  Play,
  Search,
  Square,
  TerminalSquare,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { SectionCard, StatusBadge } from "@/components/pan";
import { findSkill, VULN_SKILLS, RECON_PHASES, COMPLETE_PHASES, AUTH_PROFILES, type VulnSkill } from "./catalog";
import { LIBRARY_SKILLS, type LibrarySkill } from "./skills-library";
import { getApiKey, getModel, setApiKey, setModel } from "./store";
import { getTasks, patchTask, createTask, deleteTask, type AgentTask } from "./tasks";
import { runAgentTask } from "./engine";
import { latestReconForDomain } from "../recon-data";
import { LiveHuntConsole } from "./LiveHuntConsole";
import { OrbitalEarthHero } from "../OrbitalEarthHero";

const MODELS = [
  { id: "deepseek-v4-flash", label: "OpenCode Go · DeepSeek v4 Flash" },
  { id: "deepseek-v4-pro", label: "OpenCode Go · DeepSeek v4 Pro" },
];

type RunMode = "complete" | "custom";

type AgentConfig = {
  target: string;
  mode: RunMode;
  auth: string;
  credentials: string;
  headers: string;
  notes: string;
  phases: string[];
  skills: string[];
  librarySkills: string[];
};

const COMPLETE_CONFIG: AgentConfig = {
  target: "", mode: "complete", auth: "None - non-authenticated", credentials: "", headers: "", notes: "",
  phases: COMPLETE_PHASES,
  skills: ["xss-reflected", "sqli", "idor", "ssrf", "open-redirect", "cors", "ssti", "xxe", "cmd", "rce"],
  librarySkills: LIBRARY_SKILLS.map((skill) => skill.id),
};

const CUSTOM_CONFIG: AgentConfig = {
  ...COMPLETE_CONFIG, mode: "custom",
  phases: ["subdomains", "endpoints", "passive", "cred-leak", "static"],
  skills: ["xss-reflected", "sqli", "idor"],
  librarySkills: ["bug-bounty"],
};

const field = "min-h-11 w-full rounded-lg border border-white/10 bg-[#0a0f0a] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-400/40 focus:ring-1 focus:ring-teal-400/20";

export function BugHunterView() {
  const [config, setConfig] = useState<AgentConfig>(COMPLETE_CONFIG);
  const [apiKey, setKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModelId] = useState("deepseek-v4-flash");
  const [progress, setProgress] = useState(0);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");

  useEffect(() => {
    // Hydrate client-only values (localStorage) after mount to avoid SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only hydration
    setKey(getApiKey());
    setModelId(getModel());
    setTasks(getTasks());
  }, []);
  const [showLibrary, setShowLibrary] = useState(false);
  const router = useRouter();
  const controlRef = useRef({ paused: false, stopped: false });

  function refreshTasks() { setTasks(getTasks()); }

  // keep progress live while a run is active
  useEffect(() => {
    if (!runningId) return;
    const iv = setInterval(() => {
      const t = getTasks().find((x) => x.id === runningId);
      if (t) { setProgress(t.progress); setTasks(getTasks()); }
    }, 700);
    return () => clearInterval(iv);
  }, [runningId]);

  const skillGroups = useMemo(() => {
    const filter = skillFilter.trim().toLowerCase();
    const base = allVulnSkills();
    const list = filter ? base.filter((s) => (s.name + s.category).toLowerCase().includes(filter)) : base;
    const groups = new Map<string, VulnSkill[]>();
    for (const skill of list) {
      const g = groups.get(skill.category) ?? [];
      g.push(skill);
      groups.set(skill.category, g);
    }
    return Array.from(groups.entries());
  }, [skillFilter]);

  const libraryGroups = useMemo(() => {
    const filter = skillFilter.trim().toLowerCase();
    const list = filter ? LIBRARY_SKILLS.filter((s) => (s.name + s.category + s.description).toLowerCase().includes(filter)) : LIBRARY_SKILLS;
    const groups = new Map<string, LibrarySkill[]>();
    for (const skill of list) {
      const g = groups.get(skill.category) ?? [];
      g.push(skill);
      groups.set(skill.category, g);
    }
    return Array.from(groups.entries());
  }, [skillFilter]);

  function setMode(mode: RunMode) {
    setConfig((c) => ({ ...(mode === "complete" ? COMPLETE_CONFIG : CUSTOM_CONFIG), target: c.target, mode }));
  }
  function togglePhase(id: string) {
    setConfig((c) => ({ ...c, phases: c.phases.includes(id) ? c.phases.filter((p) => p !== id) : [...c.phases, id] }));
  }
  function toggleSkill(id: string) {
    setConfig((c) => ({ ...c, skills: c.skills.includes(id) ? c.skills.filter((s) => s !== id) : [...c.skills, id] }));
  }
  function toggleLibrary(id: string) {
    setConfig((c) => ({ ...c, librarySkills: c.librarySkills.includes(id) ? c.librarySkills.filter((s) => s !== id) : [...c.librarySkills, id] }));
  }

  async function beginRun() {
    if (runningId) return;
    const target = config.target.trim();
    if (!target) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(target)) return;
    if (config.skills.length === 0 && config.librarySkills.length === 0) return;

    const linkedRecon = latestReconForDomain(target);
    const created = createTask({
      target,
      mode: config.mode,
      model,
      auth: config.auth,
      phases: config.phases,
      skills: [...config.skills, ...config.librarySkills],
      notes: config.notes.trim() || undefined,
      reconJobId: linkedRecon?.id,
      reconAssets: linkedRecon?.subdomains.map((asset) => asset.hostname) ?? [],
    });
    setRunningId(created.id);
    setProgress(0);
    controlRef.current = { paused: false, stopped: false };
    refreshTasks();

    // Commit the key so the engine always uses the latest value.
    setApiKey(apiKey);
    setKeySaved(true);
    await runAgentTask(created, { apiKey, model, credentials: config.credentials, headers: config.headers, auth: config.auth }, controlRef.current);
    setRunningId(null);
    refreshTasks();
  }

  function stopTask() {
    controlRef.current.paused = false;
    controlRef.current.stopped = true;
    if (runningId) patchTask(runningId, { status: "cancelled", completedAt: new Date().toISOString() });
    refreshTasks();
  }
  function removeTask(id: string) { deleteTask(id); refreshTasks(); }
  function openTask(id: string) { router.push(`/bug-hunter/${id}`); }

  const selectedLibrary = LIBRARY_SKILLS.filter((s) => config.librarySkills.includes(s.id));
  const activeTask = tasks.find((t) => t.id === runningId);
  const reconSource = latestReconForDomain(config.target);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      {/* Engine settings strip */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0a0f0a] px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><KeyRound className="h-4 w-4" /> Engine</div>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Optional fallback key</span>
          <input type="password" value={apiKey} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setApiKey(apiKey); setKeySaved(true); } }} placeholder="sk-..." autoComplete="off" className="w-44 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400/40" />
          <button onClick={() => { setApiKey(apiKey); setKeySaved(true); }} className="inline-flex h-7 items-center rounded-md bg-teal-400 px-2.5 text-[11px] font-bold text-[#04130f] hover:bg-teal-300">Save</button>
          <span className={`text-[10px] font-semibold ${keySaved ? "text-teal-300" : "text-slate-600"}`}>{keySaved ? "saved" : "unsaved"}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300"><span className="text-xs text-slate-500">Model</span><select value={model} onChange={(e) => { setModelId(e.target.value); setModel(e.target.value); }} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-400/40">{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <span className="ml-auto text-xs text-slate-500">{apiKey ? "OpenCode + fallback synthesis ready" : "DeepSeek via OpenCode ready"}</span>
        <Link href="/bug-hunter/terminal" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]"><TerminalSquare className="h-4 w-4" /> Terminal</Link>
      </div>

      <OrbitalEarthHero mode="bug-hunter" className="mb-6" />

      {/* Center: target + mode */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0f0a] p-6 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard active={config.mode === "complete"} icon={<WandSparkles className="h-5 w-5" />} title="Complete test" desc={`${LIBRARY_SKILLS.length} playbooks · recon, JS/API mapping, safe validation, AI report`} onClick={() => setMode("complete")} />
          <ModeCard active={config.mode === "custom"} icon={<ListChecks className="h-5 w-5" />} title="Custom" desc="Choose phases & skills" onClick={() => setMode("custom")} />
        </div>
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Target</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input value={config.target} onChange={(e) => setConfig((c) => ({ ...c, target: e.target.value }))} placeholder="app.example.com" spellCheck={false} className={`${field} flex-1`} />
            <button onClick={() => void beginRun()} disabled={runningId !== null || !config.target.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-400 px-6 text-sm font-bold text-[#04130f] transition hover:bg-teal-300 disabled:opacity-50"><Play className="h-4 w-4" /> {runningId ? "Running..." : "Run"}</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {reconSource ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-teal-300/20 bg-teal-300/[0.06] px-3 py-2 text-teal-200">
                <Check className="h-3.5 w-3.5" /> Recon Overview linked · {reconSource.subdomains.length} subdomains · {reconSource.liveHosts.length} live
              </span>
            ) : (
              <Link href="/recon/overview" className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-amber-200">
                <CircleDot className="h-3.5 w-3.5" /> No matching recon inventory · run Recon Overview first
              </Link>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-300"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Authentication</span><select className={field} value={config.auth} onChange={(e) => setConfig((c) => ({ ...c, auth: e.target.value }))}>{AUTH_PROFILES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="block text-sm text-slate-300"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</span><input className={field} value={config.notes} onChange={(e) => setConfig((c) => ({ ...c, notes: e.target.value }))} placeholder="Crown-jewel endpoints, test accounts, scope caveats..." /></label>
        </div>
        {config.auth !== "None - non-authenticated" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Credentials</span><textarea className={field} rows={2} value={config.credentials} onChange={(e) => setConfig((c) => ({ ...c, credentials: e.target.value }))} placeholder="token=... or user:pass" /></label>
            <label className="block text-sm text-slate-300"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Extra headers</span><textarea className={field} rows={2} value={config.headers} onChange={(e) => setConfig((c) => ({ ...c, headers: e.target.value }))} placeholder="X-CSRF-Token: ..." /></label>
          </div>
        ) : null}
      </div>

      {/* Custom-only advanced panels */}
      {config.mode === "custom" ? (
        <div className="mt-5 grid gap-5">
          <SectionCard title="Reconnaissance pipeline" description="Toggle the phases to include.">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {RECON_PHASES.map((phase) => {
                const on = config.phases.includes(phase.id);
                return (
                  <button key={phase.id} onClick={() => togglePhase(phase.id)} className={`rounded-lg border px-3 py-3 text-left text-xs font-semibold transition ${on ? "border-teal-300/30 bg-teal-300/[0.06] text-slate-100" : "border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/20"}`}>
                    <span className="flex items-center justify-between gap-2">{on ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}{on ? "on" : "off"}</span>
                    <span className="mt-1 block leading-4">{phase.label}</span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Vulnerability skills" description={`${config.skills.length} vector(s) + ${config.librarySkills.length} library skill(s)`} action={<button onClick={() => setShowSkills((s) => !s)} className="text-xs font-semibold text-slate-300 hover:text-white">{showSkills ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} {showSkills ? "Hide" : "Browse"}</button>}>
            {showSkills ? (
              <div>
                <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input className={`${field} pl-9`} value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} placeholder="Filter skills..." /></div>
                <div className="mb-4"><button onClick={() => setShowLibrary((s) => !s)} className="inline-flex items-center gap-2 text-xs font-bold text-violet-300">{showLibrary ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Skill library (hunt-*) · {LIBRARY_SKILLS.length}</button></div>
                {showLibrary ? <SkillLibraryPicker selected={config.librarySkills} onToggle={toggleLibrary} groups={libraryGroups} /> : null}
                <div className="grid max-h-[340px] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
                  {skillGroups.map(([category, skills]) => (
                    <div key={category}><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{category} · {skills.length}</p>
                      <div className="grid gap-1.5">{skills.map((skill) => <button key={skill.id} onClick={() => toggleSkill(skill.id)} title={skill.description} className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${config.skills.includes(skill.id) ? "border-teal-300/30 bg-teal-300/[0.07] text-slate-100" : "border-white/[0.06] text-slate-400 hover:border-white/15"}`}><span className="truncate">{skill.name}</span>{config.skills.includes(skill.id) ? <Check className="h-3.5 w-3.5 shrink-0 text-teal-300" /> : null}</button>)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {config.skills.map((id) => { const s = findSkill(id); if (!s) return null; return <button key={id} onClick={() => toggleSkill(id)} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 hover:border-teal-300/30">{s.name}</button>; })}
                {selectedLibrary.map((s) => <button key={s.id} onClick={() => toggleLibrary(s.id)} className="rounded-md border border-violet-300/20 bg-violet-300/[0.05] px-2.5 py-1 text-xs text-violet-200 hover:border-violet-300/40">{s.name}</button>)}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* Live progress for the active run */}
      {runningId && activeTask ? (
        <LiveHuntConsole task={activeTask} progress={progress} onStop={stopTask} onOpen={() => openTask(runningId)} />
      ) : null}

      {/* Task history */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a0f0a] p-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-slate-100">Runs / tasks</h2><p className="text-xs text-slate-500">Every assessment you ran - open one to view the live terminal & report.</p></div>
          {runningId ? <span className="flex items-center gap-2 text-xs text-teal-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" /> running...</span> : null}
        </div>
        {tasks.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">No runs yet. Start your first assessment above.</p>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.06]">
            {tasks.map((t) => {
              const isRunning = t.status === "running" || t.status === "queued" || t.status === "paused";
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/bug-hunter/${t.id}`} className="block truncate text-sm font-semibold text-slate-100 hover:text-teal-300">{t.name}</Link>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{t.target} · {t.mode} · {t.phases.length} phases</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={t.status} />
                    {isRunning && runningId === t.id ? <TaskControl onStop={stopTask} /> : null}
                    <button title="View" onClick={() => openTask(t.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"><FileText className="h-4 w-4" /></button>
                    <button title="Delete" onClick={() => removeTask(t.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-red-400/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({ active, icon, title, desc, onClick }: { active: boolean; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${active ? "border-teal-300/40 bg-teal-300/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-teal-300/15 text-teal-300" : "bg-white/[0.04] text-slate-400"}`}>{icon}</span>
      <span className="flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-slate-100">{title}{active ? <Check className="h-4 w-4 text-teal-300" /> : null}</span><span className="block text-xs text-slate-500">{desc}</span></span>
    </button>
  );
}

function SkillLibraryPicker({ selected, onToggle, groups }: { selected: string[]; onToggle: (id: string) => void; groups: Array<[string, LibrarySkill[]]> }) {
  return (
    <div className="grid max-h-[300px] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
      {groups.map(([category, skills]) => (
        <div key={category}><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300/80">{category} · {skills.length}</p>
          <div className="grid gap-1.5">{skills.map((skill) => <button key={skill.id} onClick={() => onToggle(skill.id)} title={skill.description} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition ${selected.includes(skill.id) ? "border-violet-300/30 bg-violet-300/[0.07] text-slate-100" : "border-white/[0.06] text-slate-400 hover:border-white/15"}`}><span className="truncate">{skill.name}</span>{selected.includes(skill.id) ? <Check className="h-3.5 w-3.5 shrink-0 text-violet-300" /> : null}</button>)}</div>
        </div>
      ))}
    </div>
  );
}

function TaskControl({ onStop }: { onStop: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onStop} title="Stop" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300/20 bg-red-300/[0.06] text-red-300 hover:bg-red-300/[0.12]"><Square className="h-4 w-4" /></button>
    </div>
  );
}

function allVulnSkills(): VulnSkill[] { return VULN_SKILLS.flatMap((g) => g.skills); }
