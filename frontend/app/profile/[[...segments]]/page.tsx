import type { Metadata } from "next";
import { ProfileView } from "@/components/pan/ProfileView";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  return <ProfileView segments={segments} />;
}
