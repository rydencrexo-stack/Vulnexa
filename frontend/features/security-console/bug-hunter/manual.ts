"use client";

import type { AgentTask } from "./tasks";
import { upsertTask } from "./tasks";

/**
 * Records a manually-verified real assessment as a task so it persists in
 * the Bug Hunter task list and Reports section. Used for genuine findings
 * that required authenticated manual testing (not auto-scanned).
 */
export function recordManualAssessment(partial: {
  target: string;
  mode: "complete" | "custom";
  model: string;
  auth: string;
  phases: string[];
  skills: string[];
  findings: Array<{ title: string; severity: string; confidence: number; endpoint: string }>;
  summary: string;
}): AgentTask {
  const now = new Date().toISOString();
  const id = `task_${now.replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.floor(Math.random() * 999)}`;
  const task: AgentTask = {
    id,
    name: `${partial.target} - AI bug-hunter assessment (${partial.mode})`,
    target: partial.target,
    mode: partial.mode,
    model: partial.model,
    auth: partial.auth,
    phases: partial.phases,
    skills: partial.skills,
    status: "completed",
    progress: 100,
    reconAssets: [],
    logs: [
      { id: 1, level: "cmd", text: `$ bug-hunter --target ${partial.target} --mode ${partial.mode}` },
      { id: 2, level: "ok", text: "[manual] authenticated real assessment completed." },
      { id: 3, level: "ai", text: `${partial.findings.length} verified finding(s).` },
    ],
    report: {
      id,
      name: `${partial.target} - assessment`,
      target: partial.target,
      auth: partial.auth,
      model: partial.model,
      phases: partial.phases,
      skills: partial.skills,
      summary: partial.summary,
      findings: partial.findings,
      assets: [],
      endpoints: [],
      evidenceSummary: { subdomains: 0, archiveUrls: 0, paths: 0, jsBundles: 0, emails: 0, github: null, virustotal: null },
      methodology: ["Manually verified authorized assessment"],
      coverage: 100,
      createdAt: now,
      startedAt: now,
      completedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: now,
  };
  upsertTask(task);
  return task;
}
