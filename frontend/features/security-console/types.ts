export type ProductArea =
  | "recon"
  | "active-scanner"
  | "scanner"
  | "scans"
  | "findings"
  | "ai-analyst"
  | "bug-hunter"
  | "reports"
  | "learning"
  | "settings"
  | "admin";

export type RouteViewProps = {
  segments: string[];
};

export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

