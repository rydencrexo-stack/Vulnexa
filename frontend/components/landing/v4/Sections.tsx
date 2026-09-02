"use client";

import Link from "next/link";
import { Icon, type IconName } from "./kit";

const METRICS = [
  ["38", "Verified assets"],
  ["1,284", "Mapped endpoints"],
  ["96%", "Scope coverage"],
  ["91%", "Evidence confidence"],
] as const;

const CAPABILITIES: ReadonlyArray<readonly [IconName, string]> = [
  ["globe", "Attack surface"],
  ["target", "Scope control"],
  ["layers", "Passive analysis"],
  ["scan", "Active scanning"],
  ["api", "API security"],
  ["bug", "Finding validation"],
  ["spark", "AI triage"],
  ["doc", "Clear reporting"],
] as const;

export function Sections() {
  return (
    <>
      <section className="ds-metric-band" aria-label="Example workspace metrics">
        <div className="ds-wrap ds-metric-band-inner">
          {METRICS.map(([value, label], index) => (
            <div data-rise key={label} style={{ "--i": index } as React.CSSProperties}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ds-compact-capabilities" id="capabilities">
        <div className="ds-wrap">
          <div className="ds-compact-head">
            <div>
              <span className="ds-eyebrow" data-rise>One continuous workflow</span>
              <h2 className="ds-h2" data-rise style={{ "--i": 1 } as React.CSSProperties}>
                Discover. Verify. Act.
              </h2>
            </div>
            <p className="ds-lede" data-rise style={{ "--i": 2 } as React.CSSProperties}>
              Vulnexa connects the attack surface to evidence and a clear next action.
            </p>
          </div>

          <div className="ds-compact-grid">
            <article className="ds-compact-card ds-card" data-rise>
              <div className="ds-compact-visual ds-radar-ui" aria-hidden>
                <span className="ds-radar-ring is-one" />
                <span className="ds-radar-ring is-two" />
                <span className="ds-radar-ring is-three" />
                <span className="ds-radar-sweep" />
                <i className="ds-radar-node is-a" /><i className="ds-radar-node is-b" />
                <i className="ds-radar-node is-c" /><i className="ds-radar-node is-d" />
                <span className="ds-radar-label"><i /> Surface live</span>
              </div>
              <div className="ds-compact-copy">
                <span className="ds-compact-index">01 / Discover</span>
                <h3 className="ds-h3">Map what attackers can reach.</h3>
                <p>Continuously organize domains, hosts, services, technologies, APIs, and endpoints.</p>
                <ul>
                  <li><Icon name="check" /> Change-aware inventory</li>
                  <li><Icon name="check" /> Verified scope boundaries</li>
                </ul>
              </div>
            </article>

            <article className="ds-compact-card ds-card" data-rise style={{ "--i": 1 } as React.CSSProperties}>
              <div className="ds-compact-visual ds-pipeline-ui" aria-hidden>
                <div className="ds-pipeline-head"><span><i /> Scan 042 running</span><b>68%</b></div>
                <div className="ds-pipeline-track"><i /></div>
                <div className="ds-pipeline-steps">
                  {(["Scope", "Recon", "Passive", "Active", "Verify"] as const).map((step, index) => (
                    <span className={index < 4 ? "is-done" : ""} key={step}><i>{index < 4 ? "✓" : index + 1}</i>{step}</span>
                  ))}
                </div>
                <div className="ds-pipeline-log"><span>14:31</span><b>Evidence captured</b><i>confidence 91%</i></div>
              </div>
              <div className="ds-compact-copy">
                <span className="ds-compact-index">02 / Verify</span>
                <h3 className="ds-h3">Keep proof beside every finding.</h3>
                <p>Preserve requests, responses, confidence, exposure, and scanner context in one record.</p>
                <ul>
                  <li><Icon name="check" /> Evidence-led review</li>
                  <li><Icon name="check" /> Analyst confirmation</li>
                </ul>
              </div>
            </article>

            <article className="ds-compact-card ds-card" data-rise style={{ "--i": 2 } as React.CSSProperties}>
              <div className="ds-compact-visual ds-ai-flow-ui" aria-hidden>
                <div className="ds-ai-flow-head"><span><Icon name="spark" /> DeltaAI analysis</span><i /><i /><i /></div>
                <div className="ds-ai-flow-row is-critical"><span>01</span><div><b>Authorization bypass</b><small>Critical · Internet exposed</small></div><em>91%</em></div>
                <div className="ds-ai-flow-row is-high"><span>02</span><div><b>Reflected XSS</b><small>High · Reproducible</small></div><em>96%</em></div>
                <div className="ds-ai-flow-foot"><i className="ds-dot ds-pulse" /> 4 duplicates grouped</div>
              </div>
              <div className="ds-compact-copy">
                <span className="ds-compact-index">03 / Act</span>
                <h3 className="ds-h3">Prioritize with the full context.</h3>
                <p>DeltaAI correlates signals and explains what deserves attention while analysts stay in control.</p>
                <ul>
                  <li><Icon name="check" /> Context-aware ranking</li>
                  <li><Icon name="check" /> Practical remediation</li>
                </ul>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="ds-capability-rail" aria-label="Vulnexa capabilities">
        <div className="ds-capability-track">
          {[0, 1].map((copy) => (
            <div aria-hidden={copy === 1} className="ds-capability-set" key={copy}>
              {CAPABILITIES.map(([icon, label]) => (
                <span key={`${copy}-${label}`}><Icon name={icon} />{label}<i /></span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="ds-minimal-close" id="cta">
        <div className="ds-wrap">
          <div className="ds-minimal-panel" data-rise>
            <span className="ds-minimal-orb" aria-hidden />
            <span className="ds-eyebrow">Authorized security, in focus</span>
            <h2 className="ds-h2">See what is exposed.</h2>
            <p>Start with one verified target. Vulnexa handles the surface from discovery to decision.</p>
            <div className="ds-btnrow">
              <Link className="ds-btn ds-btn-primary" href="/register" data-magnetic>
                Start free <Icon name="arrow" />
              </Link>
              <Link className="ds-btn ds-btn-quiet" href="/login" data-magnetic>
                Log in
              </Link>
            </div>
            <div className="ds-minimal-status" aria-label="Platform status">
              <span><i className="ds-dot ds-pulse" /> Systems operational</span>
              <span>Verified scope only</span>
              <span>Vulnexa Alpha</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
