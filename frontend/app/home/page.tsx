import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Landing } from "@/components/landing/v4";
import "./landing.css";

const display = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--ds-font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--ds-font-mono",
});

export const metadata: Metadata = {
  title: { absolute: "Intelligence Designed To Evolve" },
  description:
    "Vulnexa helps security teams discover assets, map endpoints, identify vulnerabilities and transform scanner output into clear, actionable security insights.",
};

export default function HomePage() {
  return (
    <div className={`ds-root ${display.variable} ${mono.variable}`}>
      <Landing />
    </div>
  );
}
