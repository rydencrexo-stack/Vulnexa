import type { Metadata } from "next";
import { AuthExperience } from "@/components/pan/AuthExperience";

export const metadata: Metadata = { title: "Reset password" };
export default function ForgotPasswordPage() { return <AuthExperience mode="forgot" />; }
