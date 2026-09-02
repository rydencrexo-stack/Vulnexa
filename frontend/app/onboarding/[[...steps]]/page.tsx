import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/pan/OnboardingWizard";

export const metadata: Metadata = { title: "Secure onboarding" };

export default async function OnboardingPage({ params }: { params: Promise<{ steps?: string[] }> }) {
  const { steps } = await params;
  const allowed = ["create-workspace", "add-target", "verify-target", "configure-scan"];
  const step = allowed.includes(steps?.[0] ?? "") ? (steps?.[0] as string) : "create-workspace";
  return <OnboardingWizard step={step} />;
}
