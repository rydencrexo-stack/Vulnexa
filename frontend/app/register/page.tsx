import type { Metadata } from "next";
import { AuthExperience } from "@/components/pan/AuthExperience";

export const metadata: Metadata = { title: "Create account" };
export default function RegisterPage() { return <AuthExperience mode="register" />; }
