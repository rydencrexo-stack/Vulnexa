"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Hero } from "./Hero";
import { ProductShowcase } from "./ProductShowcase";
import { Sections } from "./Sections";
import { Mark, useActiveSection, usePointerMotion, useReveal, useScrollState, useSpotlight } from "./kit";

const NAV: ReadonlyArray<readonly [string, string]> = [
  ["Home", "top"],
  ["Product", "product-tour"],
  ["Case Studies", "capabilities"],
  ["Contact", "cta"],
];

const SECTION_IDS = NAV.map(([, id]) => id);

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  const { progress, stuck } = useScrollState();
  const active = useActiveSection(SECTION_IDS);

  useReveal(rootRef);
  useSpotlight(rootRef);
  usePointerMotion(rootRef);

  return (
    <div ref={rootRef}>
      <div className="ds-field" aria-hidden>
        <span className="ds-glow ds-glow-a" />
        <span className="ds-glow ds-glow-b" />
        <span className="ds-glow ds-glow-c" />
      </div>
      <div className="ds-progress" style={{ width: `${progress}%` }} aria-hidden />

      <div className="ds-topbar">
        <div className="ds-wrap ds-topbar-in">
          <span>
            <i className="ds-dot ds-pulse" /> System operational
          </span>
          <div className="ds-topbar-set">
            <span>Recon — ok</span>
            <span>Passive — ok</span>
            <span>Active — standby</span>
          </div>
          <span className="ds-mono">Alpha 0.9.2</span>
        </div>
      </div>

      <header className={cn("ds-header", stuck && "is-pinned")}>
        <div className="ds-wrap ds-header-in">
          <a className="ds-brand" href="#top" aria-label="Vulnexa home">
            <Mark />
            Delta<em>Sec</em>
          </a>

          <nav className="ds-nav" aria-label="Sections">
            {NAV.map(([label, id]) => (
              <a key={id} href={`#${id}`} className={cn(active === id && "is-on")}>
                {label}
              </a>
            ))}
          </nav>

          <div className="ds-header-cta">
            <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/login" data-magnetic>
              Log in
            </Link>
            <Link className="ds-btn ds-btn-primary ds-btn-sm" href="/register" data-magnetic>
              Start free
            </Link>
          </div>

          <button
            type="button"
            className={cn("ds-burger", drawer && "is-open")}
            aria-label="Toggle navigation"
            aria-expanded={drawer}
            aria-controls="ds-drawer"
            onClick={() => setDrawer((v) => !v)}
          >
            <i />
            <i />
            <i />
          </button>
        </div>

        <div className={cn("ds-drawer", drawer && "is-open")} id="ds-drawer">
          <div>
            <nav aria-label="Sections">
              {NAV.map(([label, id]) => (
                <a key={`${id}-${label}`} href={`#${id}`} onClick={() => setDrawer(false)}>
                  {label}
                </a>
              ))}
              <div className="ds-btnrow">
                <Link className="ds-btn ds-btn-ghost" href="/login" onClick={() => setDrawer(false)}>
                  Log in
                </Link>
                <Link className="ds-btn ds-btn-primary" href="/register" onClick={() => setDrawer(false)}>
                  Start free
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="ds-main">
        <Hero />
        <ProductShowcase />
        <Sections />
      </main>

      <footer className="ds-footer">
        <div className="ds-wrap">
          <div className="ds-footer-minimal">
            <a className="ds-brand" href="#top" aria-label="Vulnexa home">
              <Mark />
              Delta<em>Sec</em>
            </a>
            <span className="ds-note">© {new Date().getFullYear()} · Authorized testing only</span>
            <nav aria-label="Footer">
              <Link href="/login">Log in</Link>
              <Link href="/register">Register</Link>
              <a href="#top">Top ↑</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
