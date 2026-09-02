import type { Metadata } from "next";
import { LearningDashboard } from "@/components/pan/LearningDashboard";

export const metadata: Metadata = { title: "Learning dashboard" };
export default function LearnPage() { return <LearningDashboard />; }
