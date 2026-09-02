import type { Metadata } from "next";
import { TargetsView } from "@/components/pan/TargetsView";

export const metadata: Metadata = { title: "Targets" };
export default async function TargetsPage({ params }: { params: Promise<{ segments?: string[] }> }) { const { segments } = await params; return <TargetsView segments={segments ?? []} />; }
