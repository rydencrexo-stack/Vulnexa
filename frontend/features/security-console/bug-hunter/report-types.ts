import type { AgentFinding, AgentRunResult } from "@/types/pan";

export type AgentAsset = AgentRunResult["assets"][number];
export type AgentEndpoint = AgentRunResult["endpoints"][number];
export type AgentEvidenceSummary = AgentRunResult["evidenceSummary"];

export type AiAssessment = {
  executiveSummary: string;
  attackSurface: string;
  riskAssessment: string;
  testingNarrative: string;
  subdomainHighlights: Array<{ hostname: string; reason: string; priority: string }>;
  prioritised: Array<{ title: string; rationale: string; safeRetest?: string }>;
  recommendations: string[];
  limitations: string[];
  confidence: number;
};

export type AgentReport = {
  id: string;
  name: string;
  target: string;
  auth: string;
  model: string;
  phases: string[];
  skills: string[];
  startedAt: string;
  completedAt: string;
  createdAt: string;
  summary: string;
  findings: AgentFinding[];
  assets: AgentAsset[];
  endpoints: AgentEndpoint[];
  evidenceSummary: AgentEvidenceSummary;
  methodology: string[];
  coverage: number;
  status?: "ready";
  aiSummary?: string | null;
  aiAnalysis?: AiAssessment | null;
};
