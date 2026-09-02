"use client";

import { ActiveScannerView, ReconView, ScannerModuleView } from "./ReconScannerViews";
import { FindingView, ScanView } from "./ScanFindingViews";
import { AiAnalystView, LearningView, ReportsView } from "./AiReportsLearningViews";
import { AdminView, SettingsView } from "./SettingsAdminViews";
import { BugHunterView, BugHunterTaskView, BugHunterTerminalView } from "./bug-hunter";
import type { ProductArea } from "./types";

type ProductRouteProps = {
  area: ProductArea;
  segments: string[];
};

export function ProductRoute({ area, segments }: ProductRouteProps) {
  switch (area) {
    case "recon":
      return <ReconView segments={segments} />;
    case "active-scanner":
      return <ActiveScannerView segments={segments} />;
    case "scanner":
      return <ScannerModuleView segments={segments} />;
    case "scans":
      return <ScanView segments={segments} />;
    case "findings":
      return <FindingView segments={segments} />;
    case "ai-analyst":
      return <AiAnalystView segments={segments} />;
    case "bug-hunter":
      if (segments[0] === "terminal") return <BugHunterTerminalView />;
      return segments[0] ? <BugHunterTaskView id={segments[0]} /> : <BugHunterView />;
    case "reports":
      return <ReportsView segments={segments} />;
    case "learning":
      return <LearningView segments={segments} />;
    case "settings":
      return <SettingsView segments={segments} />;
    case "admin":
      return <AdminView segments={segments} />;
  }
}

