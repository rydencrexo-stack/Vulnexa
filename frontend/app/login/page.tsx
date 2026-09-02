import type { Metadata } from "next";
import { AuthExperience } from "@/components/pan/AuthExperience";

export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage() { return <AuthExperience mode="login" />; }