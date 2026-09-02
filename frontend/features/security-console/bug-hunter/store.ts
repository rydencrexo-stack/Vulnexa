"use client";

import type { AgentReport } from "./report-types";
import { DEMO_AGENT_REPORTS } from "./demo-reports";

export type { AgentReport } from "./report-types";

const KEY_ID = "vulnexa.agent.apikey";
const MODEL_ID = "vulnexa.agent.model";
const REPORT_ID = "vulnexa.agent.reports";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY_ID) ?? "";
}

export function setApiKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ID, key.trim());
}

export function getModel(): string {
  if (typeof window === "undefined") return "deepseek-v4-flash";
  const value = window.localStorage.getItem(MODEL_ID);
  return value === "deepseek-v4-pro" ? value : "deepseek-v4-flash";
}

export function setModel(model: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODEL_ID, model);
}

export function getReports(): AgentReport[] {
  if (typeof window === "undefined") return DEMO_AGENT_REPORTS;
  const stored = safeParse(window.localStorage.getItem(REPORT_ID), [] as AgentReport[]);
  const storedIds = new Set(stored.map((report) => report.id));
  return [...stored, ...DEMO_AGENT_REPORTS.filter((report) => !storedIds.has(report.id))];
}

export function saveReport(report: AgentReport): AgentReport[] {
  const current = getReports().filter((item) => !item.id.startsWith("demo_ai_report_"));
  const next = [report, ...current].slice(0, 30);
  if (typeof window !== "undefined") window.localStorage.setItem(REPORT_ID, JSON.stringify(next));
  return [...next, ...DEMO_AGENT_REPORTS];
}
