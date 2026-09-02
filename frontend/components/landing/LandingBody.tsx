"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Panel, SectionHead, magnetic } from "./kit";

const PROBLEMS: Array<[string, string, string]> = [
  [
    "/01",
    "Fragmented asset discovery",
    "Subdomains, live hosts, APIs, JavaScript files and historical URLs are frequently stored across different tools and files.",
  ],
  [
    "/02",
    "Noisy scanner output",
    "Automated scanners can generate duplicate, incomplete or low-context alerts that require manual investigation.",
  ],
  [
    "/03",
    "Slow prioritization",
    "A severity score alone does not explain whether a vulnerability is exposed, exploitable or important to the organization.",
  ],
];

const RECON = [
  "Root domains",
  "Subdomains",
  "Live hosts",
  "IP addresses",
  "Open ports",
  "Technologies",
  "Web endpoints",
  "API endpoints",
  "JavaScript files",
  "Historical URLs",
  "Archived resources",
  "Website screenshots",
];

const PASSIVE = [
  "SECURITY-HEADER ANALYSIS",
  "COOKIE-SECURITY ANALYSIS",
  "TLS & CERTIFICATE INFO",
  "CORS CONFIGURATION",
  "CSP ANALYSIS",
  "EXPOSED METADATA",
  "PUBLICLY ACCESSIBLE FILES",
  "CLIENT-SIDE JS ANALYSIS",
  "TECHNOLOGY DETECTION",
  "INFO-DISCLOSURE DETECTION",
];

const SPECIALIZED = [
  "Cross-Site Scripting",
  "SQL Injection",
  "API security",
  "Exposed secrets",
  "Security misconfigurations",
  "Known CVEs",
  "Custom security checks",
];

const FINDING_FIELDS = [
  "title",
  "severity",
  "confidence",
  "target",
  "endpoint",
  "parameter",
  "source",
  "evidence",
  "http",
  "impact",
  "remediation",
  "status",
  "timeline",
];

const REPORTS = [
  "Executive security summaries",
  "Technical vulnerability reports",
  "Target-specific reports",
  "Scan reports",
  "Remediation reports",
  "Retest reports",
];

const STEPS: Array<[string, string, string]> = [
  ["STEP.01", "Add a target", "Add a domain, web application or API that your organization owns or is authorized to test."],
  [
    "STEP.02",
    "Define and verify scope",
    "Specify allowed domains, subdomains, URLs and excluded resources. Verify ownership before active scanning becomes available.",
  ],
  [
    "STEP.03",
    "Discover the attack surface",
    "Identify subdomains, hosts, technologies, ports, endpoints, JavaScript resources and historical URLs.",
  ],
  [
    "STEP.04",
    "Analyze security exposure",
    "Run selected passive, active or specialized scanner modules according to the verified scope.",
  ],
  [
    "STEP.05",
    "Review and remediate",
    "Examine evidence, validate findings, prioritize risks, apply remediation and retest resolved vulnerabilities.",
  ],
];

const AI_ABILITIES = [
  "Summarize complicated findings",
  "Explain vulnerabilities simply",
  "Correlate scanner results",
  "Identify possible duplicates",
  "Estimate evidence confidence",
  "Suggest remediation steps",
  "Assist report preparation",
  "Answer asset questions",
  "Help analysts prioritize investigations",
];

const CONTROLS = [
  "Target-ownership verification",
  "Explicit scanning scope",
  "Allowed and excluded targets",
  "Role-based access",
  "Scan rate limits",
  "Concurrency controls",
  "Scanner activity logs",
  "Secure API-key storage",
  "Scanner-worker isolation",
  "Emergency scan cancellation",
  "Configurable data retention",
  "Responsible-use acknowledgment",
  "Complete audit history",
];

const REASONS: Array<[string, string, string]> = [
  ["01", "Unified visibility", "View targets, assets, endpoints, scans and findings in one platform."],
  ["02", "Modular scanning", "Connect multiple security tools without managing every tool separately."],
  ["03", "Better context", "Combine severity, evidence, exposure and vulnerability intelligence."],
  ["04", "Reduced noise", "Group duplicate or related results for easier analyst review."],
  ["05", "Clear remediation", "Transform complicated technical evidence into actionable guidance."],
  ["06", "Continuous learning", "Explain vulnerabilities and security concepts directly alongside findings."],
];

const TOPICS = [
  "Reconnaissance",
  "Passive scanning",
  "Active scanning",
  "Vulnerability severity",
  "Security evidence",
  "Cross-Site Scripting",
  "SQL Injection",
  "IDOR",
  "SSRF",
  "API-security issues",
  "Security misconfigurations",
  "Secure remediation",
];

const FAQS: Array<[string, string]> = [
  [
    "What is Vulnexa?",
    "Vulnexa is a unified web-security platform for attack-surface discovery, passive analysis, authorized active scanning, findings management and AI-assisted security analysis.",
  ],
  [
    "Is Vulnexa an autonomous hacking tool?",
    "No. Vulnexa is a defensive-security platform intended only for systems the user owns or has explicit authorization to test.",
  ],
  [
    "Does Vulnexa replace security professionals?",
    "No. Vulnexa assists with discovery, organization, correlation, explanation and reporting. Security professionals remain responsible for validating findings and making final decisions.",
  ],
  [
    "Can Vulnexa perform active scans?",
    "The planned platform supports controlled active scanning against ownership-verified targets through configured scanner providers.",
  ],
  [
    "Can Vulnexa connect with existing tools?",
    "Yes. Vulnexa is planned around modular adapters that can connect approved reconnaissance tools, vulnerability scanners and intelligence sources.",
  ],
  [
    "Does Vulnexa guarantee vulnerability detection?",
    "No security scanner can guarantee complete detection. Vulnexa combines multiple sources and evidence to improve visibility while keeping analysts involved in validation.",
  ],
  [
    "Is Vulnexa currently available?",
    "Vulnexa is currently being developed as an Alpha product. Scanning, authentication and provider integrations will be introduced in later development phases.",
  ],
];

const AI_ANSWER: Array<[string, string]> = [
  ["two findings require immediate analyst attention: an ", "t-mute"],
  ["internet-accessible administration endpoint", "t-red"],
  [" and a ", "t-mute"],
  ["high-confidence SQL-injection candidate", "t-amber"],
  [".", "t-mute"],
];

const SECTION = "relative py-24 sm:py-32";

export function LandingBody() {
  return (
    <>
      {/* ---------------------------------------------------------------- 01 */}
      <section className={SECTION} id="platform">
        <div className="ds-shell">
          <SectionHead label="THE PLATFORM" num="01">
            Security data is everywhere. <span className="ds-grad">Vulnexa brings the context together.</span>
          </SectionHead>

          <div className="grid lg:grid-cols-12 gap-10 xl:gap-14">
            <div className="lg:col-span-5 space-y-5 t-mute" data-reveal>
              <p>
                Security teams often use separate tools for subdomain discovery, endpoint collection, active scanning,
                vulnerability validation and reporting. This creates fragmented data, duplicated findings and slower
                remediation.
              </p>
              <p>
                Vulnexa brings these workflows into one organized security platform — helping teams understand what
                they own, what is exposed and what should be fixed first.
              </p>
            </div>

            <div className="lg:col-span-7">
              {PROBLEMS.map(([num, title, copy], index) => (
                <div className="ds-row" data-reveal key={num} style={{ "--d": `${index * 90}ms` } as React.CSSProperties}>
                  <span className="ds-row-num">{num}</span>
                  <h3 className="ds-h3">{title}</h3>
                  <p className="text-[13.5px] t-mute">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 02 */}
      <section className={cn(SECTION, "ds-sep")} id="capabilities">
        <div className="ds-shell">
          <SectionHead label="CAPABILITIES" num="02">
            One platform for your complete <span className="ds-grad">web-security workflow.</span>
          </SectionHead>

          <div className="grid lg:grid-cols-6 gap-4">
            <Panel className="lg:col-span-4 p-7 sm:p-8" lift reveal>
              <CapHead code="CAP.01" title="Reconnaissance" />
              <p className="text-[13.5px] t-mute mb-6">Discover and organize every layer of your external footprint:</p>
              <div className="flex flex-wrap gap-2">
                {RECON.map((item) => (
                  <span className="ds-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel className="lg:col-span-2 p-7 sm:p-8" delay={60} lift reveal>
              <CapHead code="CAP.02" title="Passive Scanner" />
              <p className="text-[13.5px] t-mute mb-6">
                Analyze accessible application data without aggressive security testing:
              </p>
              <ul className="space-y-2.5">
                {PASSIVE.map((item) => (
                  <li className="flex gap-3 ds-mono t-mute" key={item}>
                    <span className="t-lime">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="lg:col-span-2 p-7 sm:p-8" delay={120} lift reveal>
              <CapHead code="CAP.03" title="Active Scanner" />
              <p className="text-[13.5px] t-mute">
                Launch authorized active scans against ownership-verified targets.
              </p>
              <p className="mt-4 text-[13.5px] t-mute">
                Integrate with scanning providers such as <span className="t-ink">Acunetix</span> while keeping
                configuration, progress, findings and reports inside Vulnexa.
              </p>
              <div
                className="mt-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 ds-mono t-amber fs-10"
                style={{ border: "1px solid rgba(255,182,72,.34)", background: "rgba(255,182,72,.07)" }}
              >
                OWNERSHIP VERIFICATION REQUIRED
              </div>
            </Panel>

            <Panel className="lg:col-span-4 p-7 sm:p-8" delay={40} lift reveal>
              <CapHead code="CAP.04" title="Specialized Scanners" />
              <p className="text-[13.5px] t-mute mb-6">Organized security-testing modules for:</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {SPECIALIZED.map((item) => (
                  <span className="ds-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
              <p
                className="ds-mono t-dim pl-3.5 fs-10 leading-[1.9]"
                style={{ borderLeft: "1px solid rgba(255,182,72,.5)" }}
              >
                Scanner results are initially treated as candidates until evidence is reviewed and confirmed.
              </p>
            </Panel>

            <Panel className="lg:col-span-3 p-7 sm:p-8" delay={90} lift reveal>
              <CapHead code="CAP.05" title="Findings Management" />
              <p className="text-[13.5px] t-mute mb-6">Every finding carries full context:</p>
              <div
                className="rounded-[10px] p-5"
                style={{ border: "1px solid var(--hair)", background: "rgba(0,0,0,.32)" }}
              >
                {FINDING_FIELDS.map((field) => (
                  <div className="ds-kv" key={field}>
                    <span className="t-lime">{field}</span>
                    <span className="t-dim">field</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="lg:col-span-3 p-7 sm:p-8" delay={140} lift reveal>
              <CapHead code="CAP.06" title="Reports" />
              <p className="text-[13.5px] t-mute mb-6">Create structured reports for different audiences:</p>
              <ul className="space-y-2.5">
                {REPORTS.map((item) => (
                  <li
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-[13.5px] t-mute"
                    key={item}
                    style={{ border: "1px solid var(--hair)", background: "rgba(0,0,0,.2)" }}
                  >
                    <i className="ds-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 03 */}
      <section className={cn(SECTION, "ds-sep")} id="how-it-works">
        <div className="ds-shell">
          <SectionHead label="WORKFLOW" num="03">
            Target discovery to remediation in <span className="ds-grad">five controlled steps.</span>
          </SectionHead>

          <div className="ds-steps max-w-3xl mx-auto">
            {STEPS.map(([tag, title, copy], index) => (
              <div className="ds-step" data-reveal key={tag} style={{ "--d": `${index * 70}ms` } as React.CSSProperties}>
                <span aria-hidden className="ds-step-node" />
                <span className="ds-eyebrow">{tag}</span>
                <h3 className="ds-h3 mt-2.5 fs-17">{title}</h3>
                <p className="mt-2 max-w-xl text-[13.5px] t-mute">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 04 */}
      <section className={cn(SECTION, "ds-sep")} id="ai-analyst">
        <div className="ds-shell">
          <SectionHead label="VULNEXA AI ANALYST" num="04">
            Turn scanner output into <span className="ds-grad">security understanding.</span>
          </SectionHead>

          <div className="grid lg:grid-cols-2 gap-10 xl:gap-14 items-start">
            <div data-reveal>
              <p className="ds-lead max-w-xl">
                The Vulnexa AI Analyst helps security teams interpret technical evidence, correlate related findings,
                explain potential impact and create clearer remediation guidance.
              </p>
              <div className="mt-9 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {AI_ABILITIES.map((item) => (
                  <div className="flex gap-3 ds-mono t-mute" key={item}>
                    <span className="t-lime">&#9656;</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <AiTerminal />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 05 */}
      <section className={cn(SECTION, "ds-sep")} id="security">
        <div className="ds-shell">
          <SectionHead label="SECURITY &amp; RESPONSIBLE USE" num="05">
            Powerful testing requires <span className="ds-grad">clear boundaries.</span>
          </SectionHead>

          <div className="ds-matrix sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-reveal>
            {CONTROLS.map((item) => (
              <div key={item}>
                <span
                  className="shrink-0"
                  style={{ width: 8, height: 8, border: "1px solid var(--lime)", borderRadius: 2 }}
                />
                <span className="text-[13.5px] t-mute">{item}</span>
              </div>
            ))}
          </div>

          <div
            className="mt-10 rounded-[14px] p-6 sm:p-8 flex flex-col sm:flex-row items-start gap-5"
            data-reveal
            style={{ border: "1px solid rgba(255,92,92,.34)", background: "rgba(255,92,92,.055)" }}
          >
            <span
              className="shrink-0 rounded-md px-2.5 py-1 ds-mono t-red"
              style={{ border: "1px solid rgba(255,92,92,.5)" }}
            >
              CRITICAL
            </span>
            <div>
              <p className="ds-h3 fs-17 leading-snug">
                Vulnexa must only be used on systems you own or have explicit written permission to test.
              </p>
              <p className="mt-2 text-[13.5px] t-mute">
                Unauthorized security testing may violate laws, contracts and service policies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 06 */}
      <section className={cn(SECTION, "ds-sep")} id="solution">
        <div className="ds-shell">
          <SectionHead label="WHY VULNEXA" num="06">
            Six reasons teams <span className="ds-grad">choose Vulnexa.</span>
          </SectionHead>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {REASONS.map(([num, title, copy], index) => (
              <Panel className="p-7" delay={index * 60} key={num} lift reveal>
                <span aria-hidden className="ds-disp text-[2.6rem] font-bold ds-stroke-soft leading-none">{num}</span>
                <h3 className="ds-h3 mt-5">{title}</h3>
                <p className="mt-2 text-[13.5px] t-mute">{copy}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 07 */}
      <section className={cn(SECTION, "ds-sep")} id="learning">
        <div className="ds-shell">
          <SectionHead label="LEARNING CENTER" num="07">
            Understand security concepts <span className="ds-grad">alongside real findings.</span>
          </SectionHead>

          <Panel bracket className="p-7 sm:p-9" reveal>
            <p className="text-[13.5px] t-mute mb-6">Help students, developers and security teams understand:</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <span className="ds-chip ds-chip--lime" key={topic}>
                  {topic}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ---------------------------------------------------------------- 08 */}
      <section className={cn(SECTION, "ds-sep")} id="faq">
        <div className="ds-shell max-w-3xl">
          <SectionHead label="FAQ" num="08">
            Questions, <span className="ds-grad">answered.</span>
          </SectionHead>
          <Faq />
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className={cn("relative overflow-hidden py-28 sm:py-36", "ds-sep")}>
        <div className="ds-shell relative text-center">
          <span className="ds-eyebrow" data-reveal>
            SEC.09 — FINAL TRANSMISSION
          </span>
          <h2
            className="ds-h1 mt-8 mx-auto max-w-4xl"
            data-reveal
            style={{ "--d": "70ms" } as React.CSSProperties}
          >
            Bring your complete security workflow <span className="ds-grad">into focus.</span>
          </h2>
          <p
            className="ds-lead mt-7 mx-auto max-w-2xl"
            data-reveal
            style={{ "--d": "140ms" } as React.CSSProperties}
          >
            Discover your attack surface, organize vulnerability evidence and understand which security risks require
            attention.
          </p>
          <div
            className="mt-10 flex flex-wrap justify-center gap-3"
            data-reveal
            style={{ "--d": "210ms" } as React.CSSProperties}
          >
            <Link className="ds-btn ds-btn--primary" href="/register" {...magnetic}>
              JOIN VULNEXA ALPHA <span className="ds-arr">&#8594;</span>
            </Link>
            <Link className="ds-btn ds-btn--ghost" href="/bug-hunter" {...magnetic}>
              EXPLORE PLATFORM
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function CapHead({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5">
      <h3 className="ds-h3">{title}</h3>
      <span className="ds-mono t-dim">{code}</span>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div data-reveal>
      {FAQS.map(([question, answer], index) => (
        <div className={cn("ds-faq", open === index && "is-open")} key={question}>
          <button
            aria-expanded={open === index}
            className="ds-faq-btn"
            onClick={() => setOpen(open === index ? null : index)}
            type="button"
          >
            <span className="ds-faq-q">{question}</span>
            <span aria-hidden className="ds-faq-ic" />
          </button>
          <div className="ds-faq-body">
            <div>
              <p>{answer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiTerminal() {
  const host = useRef<HTMLDivElement>(null);
  const total = AI_ANSWER.reduce((sum, [text]) => sum + text.length, 0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setTyped(total);
      return;
    }
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        timer = window.setInterval(() => {
          setTyped((n) => {
            if (n >= total) {
              window.clearInterval(timer);
              return n;
            }
            return n + 2;
          });
        }, 18);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [total]);

  let budget = typed;
  return (
    <div ref={host}>
      <Panel bracket className="overflow-hidden" delay={90} reveal>
        <div className="ds-panel-head">
          <span className="ds-mono t-mute">AI.ANALYST — SESSION 042</span>
          <span className="flex items-center gap-2 ds-mono t-lime">
            <i className="ds-dot ds-dot--pulse" />
            ONLINE
          </span>
        </div>
        <div className="p-6" style={{ fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 1.95 }}>
          <div className="t-dim">&gt; what should I review first?</div>
          <div className="mt-4 t-mute">
            <span className="t-lime">AI/</span>{" "}
            {AI_ANSWER.map(([text, tone], index) => {
              const slice = text.slice(0, Math.max(0, budget));
              budget -= text.length;
              return (
                <span className={tone} key={index}>
                  {slice}
                </span>
              );
            })}
          </div>
          <div className="mt-4 t-lime">
            &gt; <span className="ds-caret" />
          </div>
        </div>
      </Panel>
    </div>
  );
}
