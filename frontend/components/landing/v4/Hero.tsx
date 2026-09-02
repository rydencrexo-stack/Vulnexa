 "use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./kit";

const STATS = [
  { icon: "<", target: 120, suffix: "ms", decimals: 0, label: "Inference Time" },
  { icon: "%", target: 99.99, suffix: "%", decimals: 2, label: "Platform Uptime" },
  { icon: "*", target: 24, suffix: "/7", decimals: 0, label: "Autonomous Runtime" },
  { icon: "#", target: 2.4, suffix: "M", decimals: 1, label: "Context Windows" },
];

function CountUp({ target, decimals, delay, duration }: { target: number; decimals: number; delay: number; duration: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [target, delay, duration]);

  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}

export function Hero() {
  return (
    <section className="ds-video-hero" id="top">
      <div className="ds-video-bg" aria-hidden>
        <video className="ds-bg-video" autoPlay muted loop playsInline>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
        <div className="ds-video-overlay" />
      </div>

      <div className="ds-video-hero-inner">
        <div className="ds-trust-row ds-video-anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
          <div className="ds-trust-avatar ds-a1"><span><i className="fa-brands fa-microsoft" /></span></div>
          <div className="ds-trust-avatar ds-a2"><span><i className="fa-brands fa-amazon" /></span></div>
          <div className="ds-trust-avatar ds-a3"><span><i className="fa-brands fa-google" /></span></div>
          <div className="ds-trust-pill">Trusted by 2000+ Enterprises</div>
        </div>

        <h1 className="ds-video-headline">
          <span style={{ "--d": "0.12s" } as React.CSSProperties}>Intelligence</span>
          <span style={{ "--d": "0.3s" } as React.CSSProperties}>Designed To Evolve</span>
        </h1>

        <p className="ds-video-subhead ds-video-anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
          Build applications that reason, adapt and collaborate using a modular
          <br className="ds-desktop-break" /> AI platform designed for production.
        </p>

        <div className="ds-video-actions ds-video-anim" style={{ "--d": "0.4s" } as React.CSSProperties}>
          <Link href="/register" className="ds-video-cta">Get Started</Link>
          <a href="#product-tour" className="ds-video-secondary">Explore platform <Icon name="arrow" /></a>
        </div>
      </div>

      <div className="ds-video-stats">
        {STATS.map((stat, i) => (
          <div className="ds-video-stat ds-video-anim" style={{ "--d": `${0.5 + i * 0.08}s` } as React.CSSProperties} key={stat.label}>
            <div className="ds-stat-main">
              <span className="ds-stat-icon">{stat.icon}</span>
              <strong><CountUp target={stat.target} decimals={stat.decimals} delay={480 + i * 90} duration={1500 + i * 80} />{stat.suffix}</strong>
            </div>
            <span className="ds-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
