import type { Metadata } from "next";
import { AssetsView } from "@/components/pan/AssetsView";

export const metadata: Metadata = { title: "Assets" };
export default async function AssetsPage({ params }: { params: Promise<{ segments?: string[] }> }) { const { segments } = await params; return <AssetsView segments={segments ?? []} />; }
