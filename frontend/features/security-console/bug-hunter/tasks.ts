"use client";

import type { AgentReport } from "./report-types";

export type TaskStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type TaskLogKind = "text" | "reasoning" | "tool" | "step" | "status" | "heartbeat" | "session" | "operator" | "finding" | "asset" | "report";

export type TaskLog = {
  id: number;
  level: "info" | "ok" | "warn" | "err" | "ai" | "cmd";
  text: string;
  kind?: TaskLogKind;
  timestamp?: string;
};

export type AgentTask = {
  id: string;
  name: string;
  target: string;
  mode: "complete" | "custom";
  model: string;
  auth: string;
  notes?: string;
  phases: string[];
  skills: string[];
  status: TaskStatus;
  progress: number;
  logs: TaskLog[];
  reconJobId?: string;
  reconAssets: string[];
  report: AgentReport | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

const TASKS_ID = "vulnexa.agent.tasks";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function getTasks(): AgentTask[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(TASKS_ID), [] as AgentTask[]);
}

export function writeTasks(tasks: AgentTask[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TASKS_ID, JSON.stringify(tasks.slice(0, 50)));
}

export function getTask(id: string): AgentTask | null {
  return getTasks().find((t) => t.id === id) ?? null;
}

export function upsertTask(task: AgentTask): AgentTask {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx === -1) tasks.unshift(task);
  else tasks[idx] = task;
  writeTasks(tasks);
  return task;
}

export function patchTask(id: string, patch: Partial<AgentTask>): void {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
  writeTasks(tasks);
}

export function deleteTask(id: string): void {
  writeTasks(getTasks().filter((t) => t.id !== id));
}

export function createTask(partial: Pick<AgentTask, "target" | "mode" | "model" | "auth" | "phases" | "skills"> & { notes?: string; reconJobId?: string; reconAssets?: string[] }): AgentTask {
  const now = new Date().toISOString();
  const id = `task_${now.replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.floor(Math.random() * 999)}`;
  const task: AgentTask = {
    ...partial,
    id,
    name: `${partial.target} - AI bug-hunter assessment (${partial.mode})`,
    status: "queued",
    progress: 0,
    logs: [],
    reconAssets: partial.reconAssets ?? [],
    report: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };
  upsertTask(task);
  return task;
}
