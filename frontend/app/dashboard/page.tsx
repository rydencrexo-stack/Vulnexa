import type { Metadata } from "next";
import { LightDashboard } from "@/components/pan/LightDashboard";

export const metadata: Metadata = { title: "Security Overview" };
export default function DashboardPage() { return <LightDashboard />; }
