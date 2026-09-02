"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, Clipboard, Globe2, LoaderCircle, Radar, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PanLogo } from "@/components/pan/PanLogo";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { toCsvList } from "@/lib/utils";
import { panService } from "@/services/pan-service";

const steps = [
  { id: "create-workspace", label: "Workspace", icon: Building2 },
  { id: "add-target", label: "Authorized target", icon: Globe2 },
  { id: "verify-target", label: "Verify ownership", icon: ShieldCheck },
  { id: "configure-scan", label: "First scan", icon: SlidersHorizontal },
];

export function OnboardingWizard({ step }: { step: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const currentIndex = Math.max(0, steps.findIndex((item) => item.id === step));
  const [busy, setBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Northstar Security");
  const [industry, setIndustry] = useState("Technology");
  const [targetName, setTargetName] = useState("Customer portal");
  const [baseUrl, setBaseUrl] = useState("https://portal.northstar-demo.com");
  const [domain, setDomain] = useState("northstar-demo.com");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("staging");
  const [includedHosts, setIncludedHosts] = useState("portal.northstar-demo.com, api.northstar-demo.com");
  const [excludedHosts, setExcludedHosts] = useState("payments.northstar-demo.com");
  const [includedPaths, setIncludedPaths] = useState("/*");
  const [excludedPaths, setExcludedPaths] = useState("/logout, /account/delete, /billing/charge");
  const [ports, setPorts] = useState("80, 443");
  const [verificationMethod, setVerificationMethod] = useState<"dns_txt" | "html_file" | "http_header">("dns_txt");
  const [verified, setVerified] = useState(false);
  const [profile, setProfile] = useState("balanced");
  const [speed, setSpeed] = useState("standard");
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [modules, setModules] = useState(["reconnaissance", "endpoint_discovery", "passive_analysis", "ai_analysis"]);
  const challenge = useMemo(() => `pan-verify=${domain.replace(/[^a-z0-9]/gi, "").slice(0, 8)}-${"8f3c21d9"}`, [domain]);

  useEffect(() => {
    const savedDomain = window.localStorage.getItem("pan_onboarding_domain");
    if (!savedDomain) return;
    const timer = window.setTimeout(() => setDomain(savedDomain), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    if (workspaceName.trim().length < 2) return;
    setBusy(true);
    const workspace = await panService.createWorkspace({ name: workspaceName.trim(), industry });
    window.localStorage.setItem("pan_onboarding_workspace", workspace.id);
    setBusy(false);
    router.push("/onboarding/add-target");
  }

  async function addTarget(event: FormEvent) {
    event.preventDefault();
    let parsedUrl: URL;
    try { parsedUrl = new URL(baseUrl); } catch { toast({ tone: "danger", title: "Enter a valid HTTPS URL" }); return; }
    if (parsedUrl.protocol !== "https:") { toast({ tone: "danger", title: "HTTPS is required for this onboarding flow" }); return; }
    setBusy(true);
    const target = await panService.createTarget({
      name: targetName.trim(), baseUrl, domain: domain || parsedUrl.hostname, environment,
      verificationStatus: "pending", verificationMethod,
      scope: {
        includedHosts: toCsvList(includedHosts), excludedHosts: toCsvList(excludedHosts),
        includedPaths: toCsvList(includedPaths), excludedPaths: toCsvList(excludedPaths),
        allowedPorts: toCsvList(ports).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port <= 65535),
      },
      authenticationProfile: null,
    });
    window.localStorage.setItem("pan_onboarding_target", target.id);
    window.localStorage.setItem("pan_onboarding_domain", target.domain);
    setBusy(false);
    router.push("/onboarding/verify-target");
  }

  async function verify() {
    setBusy(true);
    const targetId = window.localStorage.getItem("pan_onboarding_target") ?? "target_01";
    await panService.verifyTarget(targetId);
    setVerified(true);
    setBusy(false);
    toast({ tone: "success", title: "Target ownership verified", description: "PAN can now run jobs within the approved scope." });
  }

  async function startScan() {
    if (!safetyAccepted) { toast({ tone: "danger", title: "Authorization confirmation required" }); return; }
    setBusy(true);
    const targetId = window.localStorage.getItem("pan_onboarding_target") ?? "target_01";
    const scan = await panService.startScan({ targetId, name: "First authorized scan", profile, modules, speed, scopeConfirmed: true });
    setBusy(false);
    toast({ tone: "success", title: "First scan queued" });
    router.push(`/scans/${scan.id}/live`);
  }

  function toggleModule(module: string) {
    setModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module]);
  }

  return (
    <main className="pan-onboarding">
      <header className="pan-onboarding-header"><PanLogo href="/home" /><div><span>Secure setup</span><ShieldCheck size={15} /></div></header>
      <div className="pan-onboarding-body">
        <aside className="pan-onboarding-steps">
          <p className="pan-eyebrow">Workspace setup</p>
          <h1>Let’s map your first authorized surface.</h1>
          <p>PAN requires ownership verification and explicit boundaries before any scanner can send requests.</p>
          <ol>
            {steps.map((item, index) => { const Icon = item.icon; const complete = index < currentIndex; const active = index === currentIndex; return <li className={active ? "is-active" : complete ? "is-complete" : ""} key={item.id}><span>{complete ? <Check size={15} /> : <Icon size={15} />}</span><div><small>Step {index + 1}</small><strong>{item.label}</strong></div>{active ? <ChevronRight size={15} /> : null}</li>; })}
          </ol>
          <div className="pan-safety-notice"><ShieldCheck size={16} /><div><strong>Authorized targets only</strong>Only add systems you own or have written permission to assess.</div></div>
        </aside>

        <section className="pan-onboarding-stage">
          {step === "create-workspace" ? <form className="pan-onboarding-card" onSubmit={createWorkspace}><div className="pan-onboarding-icon"><Building2 size={23} /></div><h2>Create your workspace</h2><p>Workspaces keep targets, scans, members, and audit history separated.</p><div className="pan-field"><label htmlFor="workspace-name">Workspace name</label><input className="pan-input" id="workspace-name" onChange={(event) => setWorkspaceName(event.target.value)} required value={workspaceName} /></div><div className="pan-field"><label htmlFor="industry">Industry</label><select className="pan-select" id="industry" onChange={(event) => setIndustry(event.target.value)} value={industry}><option>Technology</option><option>Financial services</option><option>Healthcare</option><option>Retail</option><option>Public sector</option><option>Other</option></select></div><button className="pan-button pan-button-primary pan-onboarding-next" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={16} /> : null}Continue to target <ChevronRight size={16} /></button></form> : null}

          {step === "add-target" ? <form className="pan-onboarding-card pan-onboarding-card-wide" onSubmit={addTarget}><div className="pan-onboarding-icon"><Globe2 size={23} /></div><h2>Add an authorized target</h2><p>Define the root target and boundaries. You can refine authentication later.</p><div className="pan-form-grid"><div className="pan-field"><label htmlFor="target-name">Target name</label><input className="pan-input" id="target-name" onChange={(event) => setTargetName(event.target.value)} required value={targetName} /></div><div className="pan-field"><label htmlFor="environment">Environment</label><select className="pan-select" id="environment" onChange={(event) => setEnvironment(event.target.value as typeof environment)} value={environment}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></div><div className="pan-field"><label htmlFor="base-url">Base URL</label><input className="pan-input" id="base-url" onChange={(event) => setBaseUrl(event.target.value)} required type="url" value={baseUrl} /></div><div className="pan-field"><label htmlFor="domain">Domain</label><input className="pan-input" id="domain" onChange={(event) => setDomain(event.target.value)} required value={domain} /></div><div className="pan-field pan-field-full"><label htmlFor="included-hosts">Included hosts</label><input className="pan-input" id="included-hosts" onChange={(event) => setIncludedHosts(event.target.value)} value={includedHosts} /><span className="pan-field-hint">Comma-separated exact hosts. Wildcards are reviewed before scanning.</span></div><div className="pan-field pan-field-full"><label htmlFor="excluded-hosts">Excluded hosts</label><input className="pan-input" id="excluded-hosts" onChange={(event) => setExcludedHosts(event.target.value)} value={excludedHosts} /></div><div className="pan-field"><label htmlFor="included-paths">Included paths</label><input className="pan-input" id="included-paths" onChange={(event) => setIncludedPaths(event.target.value)} value={includedPaths} /></div><div className="pan-field"><label htmlFor="excluded-paths">Excluded paths</label><input className="pan-input" id="excluded-paths" onChange={(event) => setExcludedPaths(event.target.value)} value={excludedPaths} /></div><div className="pan-field"><label htmlFor="ports">Allowed ports</label><input className="pan-input" id="ports" onChange={(event) => setPorts(event.target.value)} value={ports} /></div><div className="pan-field"><label htmlFor="verification-method">Verification method</label><select className="pan-select" id="verification-method" onChange={(event) => setVerificationMethod(event.target.value as typeof verificationMethod)} value={verificationMethod}><option value="dns_txt">DNS TXT record</option><option value="html_file">HTML verification file</option><option value="http_header">HTTP response header</option></select></div></div><button className="pan-button pan-button-primary pan-onboarding-next" disabled={busy} type="submit">Save scope & continue <ChevronRight size={16} /></button></form> : null}

          {step === "verify-target" ? <div className="pan-onboarding-card"><div className="pan-onboarding-icon"><ShieldCheck size={23} /></div><h2>Verify target ownership</h2><p>This safe MVP flow simulates checking your selected {verificationMethod.replace("_", " ")} proof.</p><div className="pan-verification-box"><div><span>DNS host</span><strong>_pan-verification.{domain}</strong></div><div><span>TXT value</span><code>{challenge}</code><button aria-label="Copy verification value" onClick={() => { void navigator.clipboard?.writeText(challenge); toast({ tone: "info", title: "Verification value copied" }); }}><Clipboard size={15} /></button></div></div>{verified ? <div className="pan-verified-state"><Check size={18} /><div><strong>Ownership verified</strong><p>Scope is unlocked for authorized mock scanning.</p></div></div> : <button className="pan-button pan-button-primary pan-onboarding-next" disabled={busy} onClick={() => void verify()}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Radar size={16} />}Check verification</button>}{verified ? <button className="pan-button pan-button-primary pan-onboarding-next" onClick={() => router.push("/onboarding/configure-scan")}>Configure first scan <ChevronRight size={16} /></button> : null}</div> : null}

          {step === "configure-scan" ? <div className="pan-onboarding-card pan-onboarding-card-wide"><div className="pan-onboarding-icon"><SlidersHorizontal size={23} /></div><h2>Configure your first scan</h2><p>Start with a safe profile. Potentially disruptive checks remain off.</p><div className="pan-onboarding-section"><h3>Scan profile</h3><div className="pan-choice-grid">{[{ id: "recon", name: "Recon only", text: "Inventory hosts and routes." }, { id: "balanced", name: "Balanced", text: "Recon plus passive analysis." }, { id: "api", name: "API focused", text: "Schema-guided API coverage." }].map((item) => <button className={profile === item.id ? "pan-choice is-selected" : "pan-choice"} key={item.id} onClick={() => setProfile(item.id)}><strong>{item.name}</strong><span>{item.text}</span>{profile === item.id ? <Check size={15} /> : null}</button>)}</div></div><div className="pan-onboarding-section"><h3>Modules</h3><div className="pan-module-list">{["reconnaissance", "endpoint_discovery", "passive_analysis", "javascript", "ai_analysis"].map((module) => <label key={module}><input checked={modules.includes(module)} onChange={() => toggleModule(module)} type="checkbox" /><span>{module.replaceAll("_", " ")}</span>{module === "ai_analysis" ? <StatusBadge value="sanitized" tone="purple" dot={false} /> : null}</label>)}</div></div><div className="pan-onboarding-section"><h3>Request speed</h3><select className="pan-select" onChange={(event) => setSpeed(event.target.value)} value={speed}><option value="safe">Safe · 2 requests/sec</option><option value="standard">Standard · 5 requests/sec</option><option value="fast">Fast · 10 requests/sec</option></select></div><label className="pan-checkbox pan-onboarding-confirm"><input checked={safetyAccepted} onChange={(event) => setSafetyAccepted(event.target.checked)} type="checkbox" /><span>I confirm this target is authorized, the displayed scope is accurate, and I understand mock mode will not execute destructive exploitation.</span></label><button className="pan-button pan-button-primary pan-onboarding-next" disabled={busy} onClick={() => void startScan()}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}Start first authorized scan</button></div> : null}
        </section>
      </div>
    </main>
  );
}
