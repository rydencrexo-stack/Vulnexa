import { cn, capitalize } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

interface StatusBadgeProps {
  value: string;
  label?: string;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

/* Severity resolves to its own ramp so a level is never coloured like a status. */
const severityTones: Record<string, BadgeTone> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "informational",
};

function inferTone(value: string): BadgeTone {
  const normalized = value.toLowerCase();
  if (severityTones[normalized]) return severityTones[normalized];
  if (["verified", "completed", "confirmed", "healthy", "success", "fixed", "live", "active"].includes(normalized)) return "success";
  if (["failed", "danger", "blocked", "cancelled", "reopened", "at risk"].includes(normalized)) return "danger";
  if (["running", "pending", "queued", "warning", "paused", "high_confidence", "needs attention"].includes(normalized)) return "warning";
  if (["info", "candidate", "connected"].includes(normalized)) return "info";
  if (["analyst", "admin", "purple"].includes(normalized)) return "purple";
  return "neutral";
}

export function StatusBadge({ value, label, tone, dot = true, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? inferTone(value);
  return (
    <span className={cn("pan-badge", `pan-badge-${resolvedTone}`, className)}>
      {dot ? <span className="pan-badge-dot" aria-hidden="true" /> : null}
      {label ?? capitalize(value)}
    </span>
  );
}

export default StatusBadge;
