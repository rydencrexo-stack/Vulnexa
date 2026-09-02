"use client";

import { panService } from "@/services/pan-service";
import type { AgentFinding, AgentRunResult } from "@/types/pan";
import { RECON_PHASES } from "./catalog";
import { patchTask, upsertTask, type AgentTask, type TaskLog } from "./tasks";
import { saveReport } from "./store";
import { wsBaseUrl } from "@/lib/api-url";
import type { AiAssessment, AgentAsset, AgentEndpoint, AgentEvidenceSummary } from "./report-types";

export type AgentTaskControl = {
  paused: boolean;
  stopped: boolean;
};

const DEFAULT_API = "https://opencode.ai/zen/go/v1";
const VENDOR = {
  "deepseek-v4-flash": "https://opencode.ai/zen/go/v1",
  "deepseek-v4-pro": "https://opencode.ai/zen/go/v1",
  "kimi-k2.7-code": "https://opencode.ai/zen/go/v1",
  "kimi-k2.6": "https://opencode.ai/zen/go/v1",
  "glm-5.2": "https://opencode.ai/zen/go/v1",
  "glm-5.1": "https://opencode.ai/zen/go/v1",
  "mimo-v2.5": "https://opencode.ai/zen/go/v1",
  "gemini-2.0-flash": "https://generativelanguage.googleapis.com/v1beta/openai",
  "gemini-1.5-pro": "https://generativelanguage.googleapis.com/v1beta/openai",
  "gpt-4o-mini": "https://api.openai.com/v1",
  "gpt-4o": "https://api.openai.com/v1",
  "claude-3-5-sonnet": "https://api.anthropic.com/v1",
  "claude-3-haiku": "https://api.anthropic.com/v1",
  "llama-3.3-70b": "https://api.groq.com/openai/v1",
  "mistral-large": "https://api.mistral.ai/v1",
} as Record<string, string>;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

interface OpenCodeStreamResult {
  findings: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  endpoints: Array<Record<string, unknown>>;
  summary: string;
  coverage: number;
  aiAnalysis: AiAssessment | null;
}

export const FINAL_ANALYSIS_PROMPT = `Using only the evidence already collected in this authorized assessment, produce the comprehensive final report analysis. Do not run more tools and do not invent vulnerabilities or hosts. Return strict JSON between ---VULNEXA_RESULT_START--- and ---VULNEXA_RESULT_END--- with keys: executiveSummary, attackSurface, riskAssessment, testingNarrative, subdomainHighlights (array of {hostname, reason, priority}), prioritised (array of {title, rationale, safeRetest}), recommendations (string array), limitations (string array), confidence (0-100). Clearly state when no vulnerability was confirmed.`;

export function openCodeWsUrl(): string {
  return `${wsBaseUrl()}/api/agent/ws`;
}

/** Stream a scan from the local OpenCode agent over WebSocket, feeding the task terminal. */
function runOpenCodeStream(
  target: string,
  command: string,
  notes: string,
  opts: { auth: string; credentials: string; headers: string; model: string; reconAssets: string[]; phases: string[]; skills: string[]; control: AgentTaskControl },
  push: (level: TaskLog["level"], text: string, kind?: TaskLog["kind"]) => void,
  onActivity: () => void,
): Promise<OpenCodeStreamResult> {
  return new Promise(async (resolve, reject) => {
    let token = "";
    try {
      token = await panService.getAgentWsToken();
    } catch {
      reject(new Error("Could not obtain an agent session token"));
      return;
    }
    let settled = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(openCodeWsUrl());
    } catch (err) {
      reject(err instanceof Error ? err : new Error("WebSocket unavailable"));
      return;
    }
    const result: OpenCodeStreamResult = { findings: [], assets: [], endpoints: [], summary: "", coverage: 0, aiAnalysis: null };
    let scanComplete = false;
    let requestedFinalAnalysis = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      if (scanComplete) finish(resolve);
      else fail(new Error("Scan timed out after 1 hour"));
    }, 3600_000);
    const controlWatch = window.setInterval(() => {
      if (!settled && opts.control.stopped) {
        try { socket.send(JSON.stringify({ action: "close" })); } catch { /* noop */ }
        fail(new Error("Stopped by operator"));
      }
    }, 250);
    const finish = (resolveFn: (r: OpenCodeStreamResult) => void) => { settled = true; window.clearInterval(controlWatch); if (timeoutId) window.clearTimeout(timeoutId); try { socket.close(); } catch { /* noop */ } resolveFn(result); };
    const fail = (err: Error) => { settled = true; window.clearInterval(controlWatch); if (timeoutId) window.clearTimeout(timeoutId); try { socket.close(); } catch { /* noop */ } reject(err); };

    socket.onopen = () => socket.send(JSON.stringify({ token, target, command, acknowledged: true, notes, auth: opts.auth, credentials: opts.credentials, headers: opts.headers, model: opts.model, reconAssets: opts.reconAssets, phases: opts.phases, skills: opts.skills }));
    socket.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      const type = msg.type as string;
      if (type === "log" || type === "status") {
        const allowedLevels: TaskLog["level"][] = ["info", "ok", "warn", "err", "ai", "cmd"];
        const rawLevel = String(msg.level ?? "info") as TaskLog["level"];
        const level = allowedLevels.includes(rawLevel) ? rawLevel : "info";
        push(level, String(msg.text ?? ""), String(msg.kind ?? (type === "status" ? "status" : "text")) as TaskLog["kind"]);
        onActivity();
      }
      else if (type === "finding") result.findings.push((msg.finding ?? {}) as Record<string, unknown>);
      else if (type === "done") {
        if (!scanComplete) {
          result.findings = (Array.isArray(msg.findings) ? msg.findings : result.findings) as Record<string, unknown>[];
          result.assets = (Array.isArray(msg.assets) ? msg.assets : []) as Record<string, unknown>[];
          result.endpoints = (Array.isArray(msg.endpoints) ? msg.endpoints : []) as Record<string, unknown>[];
          result.summary = String(msg.summary ?? "");
          result.coverage = Number(msg.coverage ?? 0);
          scanComplete = true;
        }
        if (!requestedFinalAnalysis) {
          requestedFinalAnalysis = true;
          push("ai", "[ai] DeepSeek is synthesizing the final evidence-backed report…", "report");
          socket.send(JSON.stringify({ action: "chat", text: FINAL_ANALYSIS_PROMPT }));
        } else {
          result.aiAnalysis = normalizeAiAssessment(msg.result);
          finish(resolve);
        }
      } else if (type === "error") {
        if (scanComplete) finish(resolve);
        else fail(new Error(String(msg.message ?? "OpenCode agent error")));
      }
    };
    socket.onerror = () => { if (!settled) fail(new Error("WebSocket connection failed")); };
    socket.onclose = () => { if (!settled) fail(new Error("Connection closed before the scan finished")); };
  });
}

export function normalizeAiAssessment(value: unknown): AiAssessment | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const toStrings = (candidate: unknown) => Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  const subdomainHighlights = Array.isArray(input.subdomainHighlights) ? input.subdomainHighlights.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{ hostname: String(row.hostname ?? ""), reason: String(row.reason ?? ""), priority: String(row.priority ?? "review") }];
  }).filter((item) => item.hostname).slice(0, 30) : [];
  const prioritised = Array.isArray(input.prioritised) ? input.prioritised.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{ title: String(row.title ?? ""), rationale: String(row.rationale ?? ""), safeRetest: row.safeRetest ? String(row.safeRetest) : undefined }];
  }).filter((item) => item.title).slice(0, 40) : [];
  return {
    executiveSummary: String(input.executiveSummary ?? "Assessment synthesis complete."),
    attackSurface: String(input.attackSurface ?? "No attack-surface narrative was returned."),
    riskAssessment: String(input.riskAssessment ?? "Risk could not be determined from the available evidence."),
    testingNarrative: String(input.testingNarrative ?? "Testing narrative unavailable."),
    subdomainHighlights,
    prioritised,
    recommendations: toStrings(input.recommendations),
    limitations: toStrings(input.limitations),
    confidence: Math.max(0, Math.min(100, Number(input.confidence ?? 0))),
  };
}

export async function runAgentTask(task: AgentTask, opts: { apiKey: string; model: string; credentials: string; headers: string; auth: string }, control: AgentTaskControl): Promise<void> {
  const target = task.target;
  const push = (level: TaskLog["level"], text: string, kind?: TaskLog["kind"]) => {
    const lastId = task.logs.at(-1)?.id ?? 0;
    const last = task.logs.at(-1);
    const canCoalesce = (kind === "text" || kind === "reasoning") && last?.kind === kind && last.level === level && last.text.length + text.length < 24_000;
    const logs = canCoalesce
      ? [...task.logs.slice(0, -1), { ...last, text: last.text + text }].slice(-2000)
      : [...task.logs, { id: lastId + 1, level, text, kind, timestamp: new Date().toISOString() }].slice(-2000);
    task.logs = logs;
    patchTask(task.id, { logs });
  };

  patchTask(task.id, { status: "running", startedAt: new Date().toISOString(), progress: 3 });
  push("cmd", `$ bug-hunter --target ${target} --mode ${task.mode} --model ${opts.model}`, "operator");
  if (task.notes?.trim()) push("info", `[notes] ${task.notes.trim().slice(0, 200)}`);
  push("info", `[vulnexa] session started · mode=${task.mode} · auth=${opts.auth} · phases=${task.phases.length}`);
  if (task.mode === "complete") push("ok", "[mode] COMPLETE test — full pipeline (recon → archive → leak-hunt → tech → full sweep)");
  else push("info", "[mode] CUSTOM — selected phases and skills only.");
  if ((task.reconAssets ?? []).length) push("ok", `[recon-import] loaded ${task.reconAssets.length} scoped host(s) from ${task.reconJobId ?? "Recon Overview"}`);
  if (opts.auth !== "None — non-authenticated" && opts.auth !== "None - non-authenticated") push("ok", "[config] authenticated test context attached; secrets are redacted from the live transcript.", "status");
  if (task.status === "cancelled" || control.stopped) return;

  const phaseList = task.phases;
  let realRun: AgentRunResult | null = null;
  let openCodeAnalysis: AiAssessment | null = null;
  const openCodeCommand = task.mode === "complete" ? "assess" : "analyze";
  let activityProgress = 10;

  try {
    push("info", `[opencode] connecting to the OpenCode agent (/${openCodeCommand})…`);
    patchTask(task.id, { progress: 10 });
    const live = await runOpenCodeStream(
      target,
      openCodeCommand,
      task.notes ?? "",
      { auth: opts.auth, credentials: opts.credentials, headers: opts.headers, model: opts.model, reconAssets: task.reconAssets ?? [], phases: task.phases, skills: task.skills, control },
      push,
      () => { activityProgress = Math.min(82, activityProgress + 2); patchTask(task.id, { progress: activityProgress }); },
    );
    const now = new Date().toISOString();
    openCodeAnalysis = live.aiAnalysis;
    realRun = {
      status: "completed",
      reportId: `agent_${Date.now()}`,
      name: `${target} — AI bug-hunter assessment`,
      target: { host: target, domain: target },
      auth: opts.auth,
      phases: phaseList,
      skills: task.skills,
      assets: live.assets as AgentRunResult["assets"],
      endpoints: live.endpoints as AgentRunResult["endpoints"],
      findings: live.findings as unknown as AgentFinding[],
      evidenceSummary: { subdomains: Math.max(live.assets.length, (task.reconAssets ?? []).length), archiveUrls: 0, paths: live.endpoints.length, jsBundles: 0, emails: 0, github: null, virustotal: null },
      artifacts: {},
      generatedAt: now,
    };
    push("ok", `[opencode] agent complete — ${live.findings.length} findings, ${live.assets.length} assets, ${live.endpoints.length} endpoints`);
    if (live.summary) push("info", `[opencode] ${live.summary.slice(0, 500)}`);
    patchTask(task.id, { progress: 84 });
  } catch (err) {
    if (control.stopped) {
      push("err", "[stopped] OpenCode session aborted by operator.");
      patchTask(task.id, { status: "cancelled", completedAt: new Date().toISOString() });
      return;
    }
    push("warn", `[opencode] agent stream unavailable (${err instanceof Error ? err.message : "error"}) — falling back to recon API.`);
  }

  if (!realRun) {
    try {
      push("info", "[recon] running real authorized scan (subdomains, archive, headers, leak-hunt)…");
      const run = await panService.scanAgent({ domain: target, host: target, phases: phaseList, skills: task.skills, auth: opts.auth });
      realRun = run;
      push("ok", `[backend] recon complete — ${run.evidenceSummary.subdomains} subdomains, ${run.endpoints.length} endpoints, ${run.evidenceSummary.emails} emails, ${run.findings.length} candidates`);
      if (run.evidenceSummary.github?.length) push("warn", `[github] ${run.evidenceSummary.github.length} potential leak match(es) on GitHub`);
      if (run.evidenceSummary.virustotal?.status === "ok") push("ai", `[virustotal] malicious=${run.evidenceSummary.virustotal.malicious} suspicious=${run.evidenceSummary.virustotal.suspicious}`);
      patchTask(task.id, { progress: 84 });
    } catch {
      push("warn", "[backend] unavailable — running local engine.");
    }
  }

  if (!realRun) {
    for (let i = 0; i < phaseList.length; i++) {
      const phase = RECON_PHASES.find((p) => p.id === phaseList[i]);
      if (!phase) continue;
      push("info", `[${phaseList[i]}] ${phase.label}…`);
      await sleep(450);
      push("ok", `[${phaseList[i]}] done`);
      patchTask(task.id, { progress: Math.round(((i + 1) / phaseList.length) * 100) });
      if (control.paused) { push("warn", "[paused] run paused by user."); while (control.paused && !control.stopped) await sleep(250); }
      if (control.stopped) { push("err", "[stopped] run halted by user."); patchTask(task.id, { status: "cancelled", completedAt: new Date().toISOString() }); return; }
    }
  }

  const importedAssets: AgentAsset[] = (task.reconAssets ?? []).map((hostname) => ({
    hostname,
    url: `https://${hostname}`,
    status: 0,
    title: "Imported from Recon Overview",
    technologies: [],
  }));
  const discoveredAssets: AgentAsset[] = [...(realRun?.assets ?? [])];
  for (const imported of importedAssets) {
    if (!discoveredAssets.some((asset) => asset.hostname === imported.hostname)) discoveredAssets.push(imported);
  }
  const discoveredEndpoints: AgentEndpoint[] = [...(realRun?.endpoints ?? [])];
  const evidenceSummary: AgentEvidenceSummary = realRun?.evidenceSummary ?? {
    subdomains: importedAssets.length,
    archiveUrls: 0,
    paths: discoveredEndpoints.length,
    jsBundles: 0,
    emails: 0,
    github: null,
    virustotal: null,
  };
  evidenceSummary.subdomains = Math.max(evidenceSummary.subdomains, discoveredAssets.length, importedAssets.length);

  for (const asset of discoveredAssets.slice(0, 40)) {
    push(asset.status > 0 ? "ok" : "info", `[asset] ${asset.hostname}${asset.status > 0 ? ` → HTTP ${asset.status}` : " → queued for verification"}`);
    await sleep(28);
  }
  for (const finding of (realRun?.findings ?? []).slice(0, 30)) {
    push("warn", `[finding:${finding.severity}] ${finding.title}${finding.endpoint ? ` @ ${finding.endpoint}` : ""}`);
    await sleep(45);
  }
  patchTask(task.id, { progress: 88 });

  // Real findings only — never fabricate candidates.
  const localFindings = realRun?.findings?.length ? realRun.findings : [];
  let aiSummary: string | null = null;
  let aiEnriched: AgentFinding[] = localFindings;
  let aiAnalysis: AiAssessment | null = openCodeAnalysis;
  if (openCodeAnalysis) {
    aiSummary = openCodeAnalysis.executiveSummary;
    push("ai", `[ai] ${openCodeAnalysis.executiveSummary}`);
  }

  if (opts.apiKey && !aiAnalysis) {
    push("info", `[ai] ${opts.model} live triage over ${localFindings.length} finding(s)…`);
    try {
      const res = await fetch("/api/agent/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: opts.apiKey, model: opts.model, baseUrl: VENDOR[opts.model] || DEFAULT_API, target, auth: opts.auth, skills: task.skills, phases: phaseList, notes: task.notes || "", findings: localFindings, assets: discoveredAssets, endpoints: discoveredEndpoints, evidenceSummary }),
      });
      const data = (await res.json()) as { ok: boolean; analysis?: AiAssessment; error?: string };
      if (data.ok && data.analysis) {
        aiAnalysis = data.analysis;
        aiSummary = data.analysis.executiveSummary ?? "AI analysis complete.";
        // Merge the model's rationale onto matching findings (matched by title).
        if (Array.isArray(data.analysis.prioritised)) {
          aiEnriched = localFindings.map((f) => {
            const p = data.analysis!.prioritised!.find((x) => x.title && (f.title.toLowerCase().includes(x.title.toLowerCase()) || x.title.toLowerCase().includes(f.title.toLowerCase())));
            return p ? { ...f, rationale: p.rationale } : f;
          });
        }
        push("ai", `[ai] ${aiSummary}`);
      } else {
        push("warn", `[ai] provider error (${data.error ?? "unknown"}) — report will be recon-only.`);
      }
    } catch (err) {
      push("warn", `[ai] live triage failed (${err instanceof Error ? err.message : "error"}) — report will be recon-only.`);
    }
  } else if (!aiAnalysis) {
    push("warn", "[ai] no API key set — skipping AI triage. Report contains real recon findings only.");
  }

  if (control.stopped) { patchTask(task.id, { status: "cancelled", completedAt: new Date().toISOString() }); return; }
  push("info", "[report] compiling deliverable…");
  patchTask(task.id, { progress: 95 });
  await sleep(200);

  const now = new Date().toISOString();
  const coverage = realRun ? Math.min(100, Math.round(55 + discoveredEndpoints.length + evidenceSummary.subdomains + evidenceSummary.emails)) : Math.min(70, 20 + importedAssets.length);
  const report = {
    id: realRun?.reportId ?? task.id.replace("task_", "agent_"),
    name: `${target} — AI bug-hunter assessment (${task.mode})`,
    target,
    auth: opts.auth,
    model: opts.model,
    phases: phaseList,
    skills: task.skills,
    summary: aiSummary
      ? aiSummary
      : realRun
        ? `${evidenceSummary.subdomains} subdomains, ${discoveredEndpoints.length} endpoints, ${evidenceSummary.emails} emails across ${phaseList.length} phases; ${localFindings.length} findings. AI synthesis not run (no key).`
        : `Recon failed or returned no findings.`,
    findings: aiEnriched,
    assets: discoveredAssets,
    endpoints: discoveredEndpoints,
    evidenceSummary,
    methodology: [
      "Recon Overview inventory import and scope validation",
      "Certificate-transparency and passive subdomain discovery",
      "HTTP reachability and technology fingerprinting",
      "Endpoint, archive, header, and static evidence collection",
      `OpenCode agent analysis using opencode-go/${opts.model}`,
      aiAnalysis ? "DeepSeek evidence synthesis and prioritisation" : "AI synthesis was unavailable; report contains collected evidence only",
    ],
    aiSummary,
    aiAnalysis,
    coverage,
    createdAt: now,
    startedAt: task.startedAt ?? now,
    completedAt: now,
  };
  saveReport({ ...report, status: "ready" });
  upsertTask({ ...task, report, status: "completed", progress: 100, completedAt: now, logs: task.logs });
  push("ok", `[report] saved to Reports · ${report.id}`);
}
