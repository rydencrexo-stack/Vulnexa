"use client";

import { KeyRound, Laptop2, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { LoadingState } from "@/components/pan/LoadingState";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { useAsyncData } from "@/hooks/useAsyncData";
import { panService } from "@/services/pan-service";

export function ProfileView({ segments }: { segments: string[] }) {
  const route = segments[0] ?? "personal-information";
  const { data: user, loading } = useAsyncData(() => panService.getCurrentUser());
  if (loading || !user) return <AppPage title="Profile" description="Loading account settings…"><LoadingState rows={6} /></AppPage>;
  if (route === "security") return <SecurityProfile />;
  if (route === "sessions") return <SessionProfile />;
  return <PersonalProfile name={user.name} email={user.email} role={user.role} organization={user.organization} />;
}

function PersonalProfile({ name: initialName, email, role, organization }: { name: string; email: string; role: string; organization: string }) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  function save(event: FormEvent) { event.preventDefault(); toast({ tone: "success", title: "Profile preferences saved", description: "Account identity changes are recorded in the audit trail." }); }
  return <AppPage eyebrow="Account" title="Personal information" description="Manage your PAN identity and workspace-facing profile."><form onSubmit={save}><SectionCard title="Profile details" description="Your role is controlled by a workspace administrator."><div className="pan-form-grid"><label className="pan-field"><span className="pan-label">Full name</span><input className="pan-input" onChange={(event) => setName(event.target.value)} value={name} /></label><label className="pan-field"><span className="pan-label">Email</span><input className="pan-input" disabled value={email} /></label><label className="pan-field"><span className="pan-label">Organization</span><input className="pan-input" disabled value={organization} /></label><div className="pan-field"><span className="pan-label">Role</span><div className="min-h-11 rounded-xl border border-white/10 bg-[#07131f] px-3 py-2.5"><StatusBadge value={role} /></div></div></div><div className="pan-form-actions"><button className="pan-button pan-button-primary" type="submit"><Save size={15} />Save profile</button></div></SectionCard></form></AppPage>;
}

function SecurityProfile() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  function update(event: FormEvent) { event.preventDefault(); if (password.length < 10) { toast({ tone: "danger", title: "Use at least 10 characters" }); return; } setPassword(""); toast({ tone: "success", title: "Password update accepted", description: "The demo does not echo or persist plaintext credentials." }); }
  return <AppPage eyebrow="Account" title="Security" description="Review authentication posture and update security-sensitive preferences."><div className="pan-grid pan-grid-2"><SectionCard title="Change password" description="Use a unique password with uppercase, lowercase, a number, and a symbol."><form onSubmit={update}><label className="pan-field"><span className="pan-label">New password</span><input autoComplete="new-password" className="pan-input" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label><button className="pan-button pan-button-primary" style={{ marginTop: 16 }} type="submit"><KeyRound size={15} />Update password</button></form></SectionCard><SectionCard title="Authentication controls" description="Security defaults for this session"><div className="space-y-3"><div className="pan-safety-notice"><ShieldCheck size={16} /><div><strong>HTTP-only session</strong>The authentication token is inaccessible to browser scripts and cleared on sign-out.</div></div><div className="pan-safety-notice"><LockKeyhole size={16} /><div><strong>Provider keys stay server-side</strong>AI and scanner credentials never enter profile or settings JSON.</div></div></div></SectionCard></div></AppPage>;
}

function SessionProfile() {
  const { toast } = useToast();
  const [revoked, setRevoked] = useState<string[]>([]);
  const sessions = [{ id: "current", device: "Chrome on Windows", location: "Current session · India", active: true }, { id: "review", device: "Firefox on Linux", location: "Bengaluru · 2 days ago", active: false }];
  return <AppPage eyebrow="Account" title="Sessions" description="Review browsers that accessed your PAN account and revoke stale sessions."><SectionCard title="Active sessions" description="Session metadata is sanitized and never includes authentication cookies."><div className="divide-y divide-white/[0.06]">{sessions.filter((session) => !revoked.includes(session.id)).map((session) => <div className="flex flex-wrap items-center gap-4 py-5" key={session.id}><span className="pan-empty-icon"><Laptop2 size={19} /></span><div className="min-w-0 flex-1"><strong className="text-sm text-slate-100">{session.device}</strong><p className="mt-1 text-sm text-slate-500">{session.location}</p></div>{session.active ? <StatusBadge value="current" tone="success" /> : <button className="pan-button pan-button-secondary" onClick={() => { setRevoked((value) => [...value, session.id]); toast({ tone: "success", title: "Session revoked" }); }}>Revoke</button>}</div>)}</div></SectionCard></AppPage>;
}
