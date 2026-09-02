"use client";

import Link from "next/link";

function SectionHeading({ num, label, children }: { num: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10 mb-6">
      <span className="sec-num">{num}</span>
      <div className="flex-1">
        <div className="mono-label !text-acid mb-4">{label}</div>
        <h2 className="font-display font-bold uppercase leading-[1.05] tracking-tight text-2xl sm:text-4xl xl:text-5xl text-ink">
          {children}
        </h2>
      </div>
    </div>
  );
}

export function LandingSections() {
  return (
    <>
      {/* PLATFORM */}
      <section id="platform" className="relative py-24 sm:py-32">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="01" label="THE PLATFORM">
            Security data is everywhere. <span className="text-acid">Vulnexa brings the context together.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-5 text-mut leading-relaxed">
              <p>Security teams often use separate tools for subdomain discovery, endpoint collection, active scanning, vulnerability validation and reporting. This creates fragmented data, duplicated findings and slower remediation.</p>
              <p>Vulnexa brings these workflows into one organized security platform — helping teams understand what they own, what is exposed and what should be fixed first.</p>
            </div>
            <div className="lg:col-span-7">
              {[
                ["/01", "Fragmented asset discovery", "Subdomains, live hosts, APIs, JavaScript files and historical URLs are frequently stored across different tools and files."],
                ["/02", "Noisy scanner output", "Automated scanners can generate duplicate, incomplete or low-context alerts that require manual investigation."],
                ["/03", "Slow prioritization", "A severity score alone does not explain whether a vulnerability is exposed, exploitable or important to the organization."],
              ].map(([num, title, desc]) => (
                <div key={num} className="row-item grid sm:grid-cols-[64px_220px_1fr] gap-3 sm:gap-6 py-6 px-2">
                  <span className="row-num font-mono text-sm text-dim">{num}</span>
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">{title}</h3>
                  <p className="text-sm text-mut leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="capabilities" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="02" label="CAPABILITIES">
            One platform for your complete <span className="text-acid">web-security workflow.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="grid lg:grid-cols-6 gap-4">
            <div className="lg:col-span-4 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Reconnaissance</h3>
                <span className="mono-label">CAP.01</span>
              </div>
              <p className="text-sm text-mut mb-6">Discover and organize every layer of your external footprint:</p>
              <div className="flex flex-wrap gap-2">
                {["Root domains", "Subdomains", "Live hosts", "IP addresses", "Open ports", "Technologies", "Web endpoints", "API endpoints", "JavaScript files", "Historical URLs", "Archived resources", "Website screenshots"].map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
            <div className="lg:col-span-2 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Passive Scanner</h3>
                <span className="mono-label">CAP.02</span>
              </div>
              <p className="text-sm text-mut mb-6">Analyze accessible application data without aggressive security testing:</p>
              <ul className="space-y-2.5 font-mono text-[11px] tracking-[.06em] text-mut">
                {["SECURITY-HEADER ANALYSIS", "COOKIE-SECURITY ANALYSIS", "TLS & CERTIFICATE INFO", "CORS CONFIGURATION", "CSP ANALYSIS", "EXPOSED METADATA", "PUBLICLY ACCESSIBLE FILES", "CLIENT-SIDE JS ANALYSIS", "TECHNOLOGY DETECTION", "INFO-DISCLOSURE DETECTION"].map((item) => <li key={item} className="flex gap-3"><span className="text-acid">+</span>{item}</li>)}
              </ul>
            </div>
            <div className="lg:col-span-2 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Active Scanner</h3>
                <span className="mono-label">CAP.03</span>
              </div>
              <p className="text-sm text-mut leading-relaxed">Launch authorized active scans against ownership-verified targets.</p>
              <p className="mt-4 text-sm text-mut leading-relaxed">Integrate with scanning providers such as <span className="text-ink">Acunetix</span> while keeping configuration, progress, findings and reports inside Vulnexa.</p>
              <div className="mt-6 inline-flex items-center gap-2 border border-amber/40 bg-amber/[.06] px-3 py-2 font-mono text-[10px] tracking-[.16em] text-amber uppercase">OWNERSHIP VERIFICATION REQUIRED</div>
            </div>
            <div className="lg:col-span-4 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Specialized Scanners</h3>
                <span className="mono-label">CAP.04</span>
              </div>
              <p className="text-sm text-mut mb-6">Organized security-testing modules for:</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Cross-Site Scripting", "SQL Injection", "API security", "Exposed secrets", "Security misconfigurations", "Known CVEs", "Custom security checks"].map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
              <p className="font-mono text-[10px] tracking-[.14em] text-dim uppercase border-l border-amber/50 pl-3">Scanner results are initially treated as candidates until evidence is reviewed and confirmed.</p>
            </div>
            <div className="lg:col-span-3 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Findings Management</h3>
                <span className="mono-label">CAP.05</span>
              </div>
              <p className="text-sm text-mut mb-6">Every finding carries full context:</p>
              <div className="border border-line bg-black/40 p-5 font-mono text-[11px] leading-6 text-mut">
                {["title", "severity", "confidence", "target", "endpoint", "parameter", "source", "evidence", "http", "impact", "remediation", "status", "timeline"].map((k) => <div key={k} className="flex justify-between gap-4"><span className="text-acid">{k}</span><span>field</span></div>)}
              </div>
            </div>
            <div className="lg:col-span-3 hacker-panel hud panel-lift p-7 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-base font-bold uppercase tracking-wide text-ink">Reports</h3>
                <span className="mono-label">CAP.06</span>
              </div>
              <p className="text-sm text-mut mb-6">Create structured reports for different audiences:</p>
              <ul className="space-y-3 text-sm text-mut">
                {["Executive security summaries", "Technical vulnerability reports", "Target-specific reports", "Scan reports", "Remediation reports", "Retest reports"].map((item) => <li key={item} className="flex items-center gap-3 border border-line bg-black/20 px-4 py-2.5"><span className="w-1.5 h-1.5 bg-acid inline-block" />{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="how-it-works" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="03" label="WORKFLOW">
            Target discovery to remediation in <span className="text-acid">five controlled steps.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-16" />
          <div className="relative max-w-4xl mx-auto pl-10 sm:pl-14">
            <div className="rail-line" />
            {[
              ["STEP.01", "Add a target", "Add a domain, web application or API that your organization owns or is authorized to test."],
              ["STEP.02", "Define and verify scope", "Specify allowed domains, subdomains, URLs and excluded resources. Verify ownership before active scanning becomes available."],
              ["STEP.03", "Discover the attack surface", "Identify subdomains, hosts, technologies, ports, endpoints, JavaScript resources and historical URLs."],
              ["STEP.04", "Analyze security exposure", "Run selected passive, active or specialized scanner modules according to the verified scope."],
              ["STEP.05", "Review and remediate", "Examine evidence, validate findings, prioritize risks, apply remediation and retest resolved vulnerabilities."],
            ].map(([tag, title, desc]) => (
              <div key={tag} className="relative pb-12">
                <span className="rail-node -left-10 sm:-left-14" />
                <span className="mono-label !text-acid">{tag}</span>
                <h3 className="font-display text-lg font-bold uppercase tracking-wide text-ink mt-2">{title}</h3>
                <p className="mt-2 text-sm text-mut leading-relaxed max-w-xl">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI ANALYST */}
      <section id="ai-analyst" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="06" label="VULNEXA AI ANALYST">
            Turn scanner output into <span className="text-acid">security understanding.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-mut leading-relaxed max-w-xl">The Vulnexa AI Analyst helps security teams interpret technical evidence, correlate related findings, explain potential impact and create clearer remediation guidance.</p>
              <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3 font-mono text-[11px] tracking-[.08em] text-mut uppercase">
                {["Summarize complicated findings", "Explain vulnerabilities simply", "Correlate scanner results", "Identify possible duplicates", "Estimate evidence confidence", "Suggest remediation steps", "Assist report preparation", "Answer asset questions", "Help analysts prioritize investigations"].map((item) => <div key={item} className="flex gap-3"><span className="text-acid">&#9656;</span>{item}</div>)}
              </div>
            </div>
            <div className="hacker-panel hud hud-on clipped relative overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-black/40">
                <span className="font-mono text-[11px] tracking-[.2em] text-mut uppercase">AI.ANALYST — SESSION 042</span>
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-[.2em] text-acid"><span className="w-1.5 h-1.5 bg-acid animate-blink inline-block" />ONLINE</span>
              </div>
              <div className="p-6 font-mono text-[12px] leading-6">
                <div className="text-dim">&gt; what should I review first?</div>
                <div className="mt-4 text-mut"><span className="text-acid">AI/</span> two findings require immediate analyst attention: an <span className="text-alert">internet-accessible administration endpoint</span> and a <span className="text-amber">high-confidence SQL-injection candidate</span>.</div>
                <div className="mt-4 text-acid">&gt; <span className="animate-blink inline-block w-2 h-4 bg-acid align-middle" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="08" label="SECURITY &amp; RESPONSIBLE USE">
            Powerful testing requires <span className="text-acid">clear boundaries.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-line border border-line">
            {["Target-ownership verification", "Explicit scanning scope", "Allowed and excluded targets", "Role-based access", "Scan rate limits", "Concurrency controls", "Scanner activity logs", "Secure API-key storage", "Scanner-worker isolation", "Emergency scan cancellation", "Configurable data retention", "Responsible-use acknowledgment", "Complete audit history"].map((c) => (
              <div key={c} className="bg-panel px-5 py-4 flex items-center gap-3 hover:bg-panel2 transition-colors"><span className="w-2 h-2 border border-acid inline-block shrink-0" /><span className="text-sm text-mut">{c}</span></div>
            ))}
          </div>
          <div className="mt-10 border border-alert/40 bg-alert/[.05] p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-5">
            <span className="font-mono text-[10px] tracking-[.2em] text-alert border border-alert/50 px-2.5 py-1 uppercase shrink-0">CRITICAL</span>
            <div>
              <p className="font-display font-bold uppercase tracking-wide text-lg leading-snug text-ink">Vulnexa must only be used on systems you own or have explicit written permission to test.</p>
              <p className="mt-2 text-sm text-mut">Unauthorized security testing may violate laws, contracts and service policies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION / WHY */}
      <section id="solution" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="07" label="WHY VULNEXA">
            Six reasons teams <span className="text-acid">choose Vulnexa.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["01", "Unified visibility", "View targets, assets, endpoints, scans and findings in one platform."],
              ["02", "Modular scanning", "Connect multiple security tools without managing every tool separately."],
              ["03", "Better context", "Combine severity, evidence, exposure and vulnerability intelligence."],
              ["04", "Reduced noise", "Group duplicate or related results for easier analyst review."],
              ["05", "Clear remediation", "Transform complicated technical evidence into actionable guidance."],
              ["06", "Continuous learning", "Explain vulnerabilities and security concepts directly alongside findings."],
            ].map(([num, title, desc]) => (
              <div key={num} className="hacker-panel hud panel-lift p-7">
                <span className="font-display text-4xl font-extrabold txt-outline-soft">{num}</span>
                <h3 className="mt-4 font-display text-sm font-bold uppercase tracking-wide text-ink">{title}</h3>
                <p className="mt-2 text-sm text-mut leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEARNING */}
      <section id="learning" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <SectionHeading num="09" label="LEARNING CENTER">
            Understand security concepts <span className="text-acid">alongside real findings.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-14" />
          <div className="hacker-panel hud p-7 sm:p-8">
            <p className="text-sm text-mut mb-6">Help students, developers and security teams understand: </p>
            <div className="flex flex-wrap gap-2">
              {["Reconnaissance", "Passive scanning", "Active scanning", "Vulnerability severity", "Security evidence", "Cross-Site Scripting", "SQL Injection", "IDOR", "SSRF", "API-security issues", "Security misconfigurations", "Secure remediation"].map((c) => <span key={c} className="chip !text-acid !border-acid/30">{c}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-24 sm:py-32 border-t border-line">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <SectionHeading num="11" label="FAQ">
            Questions, <span className="text-acid">answered.</span>
          </SectionHeading>
          <div className="h-px bg-line mb-10" />
          {[
            ["What is Vulnexa?", "Vulnexa is a unified web-security platform for attack-surface discovery, passive analysis, authorized active scanning, findings management and AI-assisted security analysis."],
            ["Is Vulnexa an autonomous hacking tool?", "No. Vulnexa is a defensive-security platform intended only for systems the user owns or has explicit authorization to test."],
            ["Does Vulnexa replace security professionals?", "No. Vulnexa assists with discovery, organization, correlation, explanation and reporting. Security professionals remain responsible for validating findings and making final decisions."],
            ["Can Vulnexa perform active scans?", "The planned platform supports controlled active scanning against ownership-verified targets through configured scanner providers."],
            ["Can Vulnexa connect with existing tools?", "Yes. Vulnexa is planned around modular adapters that can connect approved reconnaissance tools, vulnerability scanners and intelligence sources."],
            ["Does Vulnexa guarantee vulnerability detection?", "No security scanner can guarantee complete detection. Vulnexa combines multiple sources and evidence to improve visibility while keeping analysts involved in validation."],
            ["Is Vulnexa currently available?", "Vulnexa is currently being developed as an Alpha product. Scanning, authentication and provider integrations will be introduced in later development phases."],
          ].map(([q, a]) => (
            <details key={q} className="group border-t border-line last:border-b">
              <summary className="flex items-center justify-between gap-4 py-6 text-left cursor-pointer list-none">
                <span className="font-display text-sm sm:text-base font-bold uppercase tracking-wide text-ink group-hover:text-acid transition-colors">{q}</span>
                <span className="text-acid text-xl leading-none shrink-0 font-mono">+</span>
              </summary>
              <p className="pb-6 text-sm text-mut leading-relaxed max-w-2xl -mt-3">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 sm:py-36 border-t border-line overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <div className="mono-label !text-acid mb-8">SEC.12 — FINAL TRANSMISSION</div>
          <h2 className="font-display font-extrabold uppercase leading-[1.03] tracking-tight text-3xl sm:text-5xl xl:text-6xl text-ink">Bring your complete security workflow <span className="txt-acid-outline">into focus.</span></h2>
          <p className="mt-7 text-lg text-mut max-w-2xl mx-auto leading-relaxed">Discover your attack surface, organize vulnerability evidence and understand which security risks require attention.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="magnetic hacker-btn btn-solid">JOIN VULNEXA ALPHA <span className="arr">&#8594;</span></Link>
            <Link href="/bug-hunter" className="magnetic hacker-btn btn-line">EXPLORE PLATFORM</Link>
          </div>
        </div>
      </section>
    </>
  );
}
