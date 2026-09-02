import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/pan/AppShell";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { ToastProvider } from "@/components/pan/ToastProvider";
import { readSession } from "@/lib/session";
import "./globals.css";
import "@/features/security-console/passive/passive.css";
import "./scan-animations.css";
import "./dashboard-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PAN — Proactive Attack Navigator",
    template: "%s · PAN",
  },
  description: "Authorized attack-surface discovery, security scanning, evidence analysis, and vulnerability management.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a08",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link href="/icons/icon-180.png" rel="apple-touch-icon" />
      </head>
      <body suppressHydrationWarning>
        <RegisterServiceWorker />
        <ToastProvider>
          <AppShell initialRole={session.role}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
