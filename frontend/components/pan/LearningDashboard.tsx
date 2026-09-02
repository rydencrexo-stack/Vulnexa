"use client";

import {
  ArrowRight,
  BookOpen,
  Bug,
  Crosshair,
  Eye,
  FlaskConical,
  Flame,
  Gem,
  Layers,
  Play,
  Radar,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AppPage } from "@/components/pan/AppPage";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { panService } from "@/services/pan-service";
import type { User } from "@/types/pan";

interface Track {
  slug: string;
  title: string;
  description: string;
  rooms: number;
  progress: number;
  icon: LucideIcon;
  color: string;
  featured?: boolean;
}

const tracks: Track[] = [
  { slug: "getting-started", title: "Getting Started", description: "Foundations and your first scan.", rooms: 2, progress: 35, icon: BookOpen, color: "#b9ff2d", featured: true },
  { slug: "understanding-scans", title: "Understanding Scans", description: "Active vs passive probing.", rooms: 1, progress: 100, icon: ScanLine, color: "#4cc9f0" },
  { slug: "understanding-findings", title: "Understanding Findings", description: "Triage, severity, and CVEs.", rooms: 1, progress: 0, icon: FlaskConical, color: "#b388ff" },
  { slug: "reconnaissance", title: "Reconnaissance", description: "Attack-surface mapping.", rooms: 1, progress: 50, icon: Radar, color: "#7ee787" },
  { slug: "active-scanning", title: "Active Scanning", description: "Fuzzing and injection.", rooms: 1, progress: 0, icon: Crosshair, color: "#ff9f43" },
  { slug: "passive-scanning", title: "Passive Scanning", description: "OSINT and telemetry.", rooms: 1, progress: 0, icon: Eye, color: "#63e6be" },
  { slug: "vulnerabilities", title: "Vulnerability Library", description: "OWASP Top 10 deep-dives.", rooms: 7, progress: 10, icon: Bug, color: "#ff6b6b", featured: true },
];

const totalRooms = tracks.reduce((sum, track) => sum + track.rooms, 0);

export function LearningDashboard() {
  const { data: user } = useAsyncData<User>(() => panService.getCurrentUser());

  return (
    <AppPage
      eyebrow="vulnexa · Learning dashboard"
      title={`Welcome back, ${user?.name?.split(" ")[0] ?? "analyst"}`}
      description="Your learning dashboard — track progress, continue where you left off, and master the academy one room at a time."
      actions={<a className="pan-button pan-button-primary" href="/learn/index.html"><Layers size={16} />Open academy</a>}
    >
      <div className="pan-kpi-row" style={{ marginBottom: 14 }}>
        <MetricCard icon={Layers} label="Tracks" value={tracks.length} detail="learning paths" />
        <MetricCard icon={Sparkles} label="Rooms" value={totalRooms} tone="blue" detail="interactive labs" />
        <MetricCard icon={Gem} label="XP earned" value={1240} tone="purple" detail="across all tracks" />
        <MetricCard icon={Flame} label="Day streak" value={4} tone="amber" detail="keep it alive" />
      </div>

      <div className="pan-dashboard-grid pan-dashboard-grid-learn">
        <SectionCard className="pan-learn-hero" title="Continue learning" description="Next room in your active path">
          <div className="pan-learn-continue">
            <span className="pan-learn-cta-icon"><Play size={20} fill="currentColor" /></span>
            <div className="min-w-0">
              <strong>Getting Started · First Scan</strong>
              <p>You&apos;re 35% through the Getting Started track. Pick up where you left off.</p>
              <div className="pan-progress pan-progress-sm"><span style={{ width: "35%" }} /></div>
            </div>
            <a className="pan-button pan-button-primary pan-button-sm" href="/learn/getting-started/first-scan/index.html">Continue <ArrowRight size={14} /></a>
          </div>
        </SectionCard>

        <SectionCard className="pan-learn-score" title="Mastery" description="Vulnerability library coverage">
          <div className="pan-score"><div className="pan-score-ring" style={{ "--score": "108deg" } as React.CSSProperties}><span><strong>30</strong><small>%</small></span></div><div><StatusBadge label="On track" tone="info" value="info" /><p>2 of 7 vulnerability labs started. Keep the streak going.</p></div></div>
        </SectionCard>
      </div>

      <div className="pan-learn-grid pan-learn-grid-featured">
        {tracks.filter((track) => track.featured).map((track) => (
          <a className="pan-learn-card pan-learn-card-featured" href={`/learn/${track.slug}/index.html`} key={track.slug} style={{ "--track": track.color } as React.CSSProperties}>
            <span className="pan-learn-card-icon" style={{ color: track.color, background: `${track.color}1c` }}><track.icon size={20} /></span>
            <h3>{track.title}</h3>
            <p>{track.description} · {track.rooms} {track.rooms === 1 ? "room" : "rooms"}</p>
            <div className="pan-progress pan-progress-sm"><span style={{ width: `${track.progress}%` }} /></div>
            <span className="pan-learn-card-foot"><span>{track.progress}% complete</span><ArrowRight size={15} /></span>
          </a>
        ))}
      </div>

      <div className="pan-learn-grid">
        {tracks.filter((track) => !track.featured).map((track) => (
          <a className="pan-learn-card" href={`/learn/${track.slug}/index.html`} key={track.slug} style={{ "--track": track.color } as React.CSSProperties}>
            <span className="pan-learn-card-icon" style={{ color: track.color, background: `${track.color}1c` }}><track.icon size={18} /></span>
            <h3>{track.title}</h3>
            <p>{track.description} · {track.rooms} {track.rooms === 1 ? "room" : "rooms"}</p>
            <div className="pan-progress pan-progress-sm"><span style={{ width: `${track.progress}%` }} /></div>
            <span className="pan-learn-card-foot"><span>{track.progress}% complete</span><ArrowRight size={15} /></span>
          </a>
        ))}
      </div>

      <SectionCard className="pan-learn-footer" title="The Vulnexa" description="Hands-on security training for every operator.">
        <div className="pan-learn-footer-links">
          <a className="pan-button pan-button-secondary" href="/learn/index.html">Academy home</a>
          <a className="pan-button pan-button-secondary" href="/learn/vulnerabilities/index.html">Vulnerability library</a>
        </div>
      </SectionCard>
    </AppPage>
  );
}

export default LearningDashboard;