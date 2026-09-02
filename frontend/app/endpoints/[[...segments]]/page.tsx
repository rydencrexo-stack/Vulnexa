import type { Metadata } from "next";
import { EndpointsView } from "@/components/pan/EndpointsView";

export const metadata: Metadata = { title: "Endpoints" };

export default async function EndpointsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  return <EndpointsView segments={segments} />;
}
