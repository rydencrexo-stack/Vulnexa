import type { Metadata } from "next";
import { NotificationsView } from "@/components/pan/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  return <NotificationsView segments={segments} />;
}
