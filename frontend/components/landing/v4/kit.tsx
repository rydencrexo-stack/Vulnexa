"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Adds `.is-in` to every `[data-rise]` inside `root` as it scrolls into view. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const targets = Array.from(host.querySelectorAll<HTMLElement>("[data-rise]"));
    if (!targets.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}

/** Scroll progress (0-100) + whether the page has left the top. */
export function useScrollState() {
  const [progress, setProgress] = useState(0);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      setStuck(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return { progress, stuck };
}

/** Id of the section currently closest to the top of the viewport. */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState("");
  useEffect(() => {
    const pick = () => {
      const line = window.innerHeight * 0.32;
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [ids]);
  return active;
}

/** True once `ref` has entered the viewport; never flips back. */
export function useInView<T extends HTMLElement>(ref: RefObject<T | null>, threshold = 0.25) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}

/** Feeds pointer position into `--mx` / `--my` on every `.ds-card` inside root. */
export function useSpotlight(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".ds-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    return () => host.removeEventListener("pointermove", onMove);
  }, [root]);
}

/** Adds a restrained magnetic response to primary actions and a cursor spotlight to the hero. */
export function usePointerMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current;
    if (!host || !window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hero = host.querySelector<HTMLElement>(".ds-hero-stage");
    const items = Array.from(host.querySelectorAll<HTMLElement>("[data-magnetic]"));

    const spotlight = (event: PointerEvent) => {
      hero?.style.setProperty("--pointer-x", `${event.clientX}px`);
      hero?.style.setProperty("--pointer-y", `${event.clientY}px`);
    };
    const listeners = items.map((item) => {
      const move = (event: PointerEvent) => {
        const rect = item.getBoundingClientRect();
        item.style.setProperty("--mag-x", `${(event.clientX - rect.left - rect.width / 2) * 0.16}px`);
        item.style.setProperty("--mag-y", `${(event.clientY - rect.top - rect.height / 2) * 0.2}px`);
      };
      const reset = () => {
        item.style.setProperty("--mag-x", "0px");
        item.style.setProperty("--mag-y", "0px");
      };
      item.addEventListener("pointermove", move);
      item.addEventListener("pointerleave", reset);
      return { item, move, reset };
    });
    window.addEventListener("pointermove", spotlight, { passive: true });
    return () => {
      window.removeEventListener("pointermove", spotlight);
      listeners.forEach(({ item, move, reset }) => {
        item.removeEventListener("pointermove", move);
        item.removeEventListener("pointerleave", reset);
      });
    };
  }, [root]);
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

const ICONS = {
  arrow: <path d="M5 12h13M12.5 6l6 6-6 6" />,
  check: <path d="M4 12.6l5.2 5.2L20 6.6" strokeWidth={1.9} />,
  lock: <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5M5.5 10.5h13v9.5h-13z" />,
  shield: <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6l8-3z" />,
  target: (
    <>
      <circle cx={12} cy={12} r={5} />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </>
  ),
  scan: <path d="M4 8.5V5h3.5M20 8.5V5h-3.5M4 15.5V19h3.5M20 15.5V19h-3.5M3.5 12h17" />,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  code: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  db: (
    <>
      <ellipse cx={12} cy={6.5} rx={7.5} ry={3} />
      <path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  api: <path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5v2A2.5 2.5 0 0 1 2.5 11a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 0 7.5 18H9M15 4h1.5A2.5 2.5 0 0 1 19 6.5v2a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v2A2.5 2.5 0 0 1 16.5 18H15" />,
  key: (
    <>
      <circle cx={15.5} cy={8.5} r={4} />
      <path d="M12.6 11.4L4 20M7 17l2.4 2.4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h8M17.5 8H20M4 16h3.5M13 16h7" />
      <circle cx={14.7} cy={8} r={2.3} />
      <circle cx={10.2} cy={16} r={2.3} />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  globe: (
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" />
    </>
  ),
  alert: <path d="M12 4l8.5 15.5h-17L12 4zM12 10v4.2M12 17.2h.01" />,
  spark: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />,
  doc: <path d="M14 3H7.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8l-4.5-5zM14 3v5h4.5M9 13.5h6M9 17h4" />,
  users: (
    <>
      <circle cx={9.2} cy={8.4} r={3.4} />
      <path d="M3 20c0-3.4 2.8-5.2 6.2-5.2S15.4 16.6 15.4 20M16 5.4a3.4 3.4 0 0 1 0 6M18 20c0-2.6-1-4.3-2.6-5.2" />
    </>
  ),
  chart: <path d="M3 20.5h18M6.5 20.5V12M11.5 20.5V5M16.5 20.5v-6" />,
  grid: <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 1 4 18.5v-13zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5A2.5 2.5 0 0 0 20 18.5v-13z" />,
  info: (
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 11v6M12 7.8h.01" />
    </>
  ),
  bug: <path d="M9 5.5L7.5 3M15 5.5L16.5 3M8.5 8.5h7a3 3 0 0 1 3 3v2a6.5 6.5 0 0 1-13 0v-2a3 3 0 0 1 3-3zM3 13h2.5M18.5 13H21M4.5 18.5l2-1.2M19.5 18.5l-2-1.2" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** Vulnexa delta mark. useId keeps the gradient id stable across SSR
 *  and hydration — a module-level counter drifts between the two. */
export function Mark() {
  const id = `ds-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#9a8cff" />
          <stop offset="1" stopColor="#2fd8ee" />
        </linearGradient>
      </defs>
      <path d="M16 4.4 27.7 26.1a1.6 1.6 0 0 1-1.4 2.4H5.7a1.6 1.6 0 0 1-1.4-2.4L16 4.4Z" stroke={`url(#${id})`} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M16 13.4 21.7 23.6H10.3L16 13.4Z" fill={`url(#${id})`} fillOpacity=".2" />
      <circle cx="16" cy="21.4" r="1.7" fill={`url(#${id})`} />
    </svg>
  );
}

export function SectionHead({ num, label, title, lede }: { num: string; label: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <div className="ds-sechead">
      <span className="ds-eyebrow" data-rise>
        {num} — <b>{label}</b>
      </span>
      <h2 className="ds-h2" data-rise style={{ "--i": 1 } as React.CSSProperties}>
        {title}
      </h2>
      {lede ? (
        <p className="ds-lede" data-rise style={{ "--i": 2 } as React.CSSProperties}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}

export function CapHead({ icon, title, code }: { icon?: IconName; title: string; code: string }) {
  return (
    <div className="ds-caphead">
      {icon ? (
        <div className="ds-flex">
          <span className="ds-ico">
            <Icon name={icon} />
          </span>
          <h3 className="ds-h3">{title}</h3>
        </div>
      ) : (
        <h3 className="ds-h3">{title}</h3>
      )}
      <span className="ds-idx">{code}</span>
    </div>
  );
}

/** Counts up to `to` the first time it is scrolled into view. */
export function Counter({ to, suffix }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, 0.4);
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1250);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, to, reduced]);

  return (
    <span ref={ref}>
      {(reduced ? to : value).toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

/** Thin bar that fills to `value`% once visible. */
export function Meter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, 0.2);
  return (
    <span ref={ref} className={cn("ds-meter", className)}>
      <i style={{ width: seen ? `${value}%` : 0 }} />
    </span>
  );
}

/** Stacked severity distribution bar. */
export function StackBar({ parts }: { parts: ReadonlyArray<{ color: string; pct: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, 0.2);
  return (
    <div ref={ref} className="ds-stack">
      {parts.map((part) => (
        <i key={part.color} style={{ background: part.color, width: seen ? `${part.pct}%` : 0 }} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Asset graph                                                                */
/* -------------------------------------------------------------------------- */

type GraphNode = { x: number; y: number; r: number; phase: number; speed: number; risk: boolean };

/** Drifting node/edge graph standing in for a discovered attack surface. */
export function AssetGraph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COUNT = 30;
    const nodes: GraphNode[] = Array.from({ length: COUNT }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: i < 3 ? 3 : i < 10 ? 2.1 : 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.1 + Math.random() * 0.3,
      risk: i % 11 === 0,
    }));
    const pulses = Array.from({ length: 4 }, (_, p) => ({ a: (p * 3) % COUNT, b: (p * 7 + 5) % COUNT }));

    let w = 0;
    let h = 0;
    let frame = 0;
    let visible = true;
    const pointer = { x: 0.5, y: 0.5 };

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      const t = reduced ? 0 : performance.now() / 1000;
      const ox = (pointer.x - 0.5) * 16;
      const oy = (pointer.y - 0.5) * 16;
      const pts = nodes.map((n) => {
        const depth = n.r / 3;
        return {
          x: (n.x * 0.86 + 0.07) * w + Math.sin(t * n.speed + n.phase) * 9 + ox * depth,
          y: (n.y * 0.84 + 0.08) * h + Math.cos(t * n.speed * 0.82 + n.phase) * 9 + oy * depth,
          r: n.r,
          risk: n.risk,
        };
      });
      const reach = Math.min(w, h) * 0.36;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > reach) continue;
          ctx.strokeStyle = `rgba(154,140,255,${((1 - d / reach) * 0.26).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }

      pulses.forEach((pulse, k) => {
        const a = pts[pulse.a];
        const b = pts[pulse.b];
        if (!a || !b) return;
        const prog = reduced ? 0.5 : (t * 0.34 + k * 0.27) % 1;
        ctx.fillStyle = `rgba(47,216,238,${(0.75 * Math.sin(prog * Math.PI)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(a.x + (b.x - a.x) * prog, a.y + (b.y - a.y) * prog, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.6, 0, Math.PI * 2);
        ctx.fillStyle = p.risk ? "rgba(242,83,109,.13)" : "rgba(154,140,255,.11)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.risk ? "#f2536d" : "#d5dbff";
        ctx.fill();
      });
    };

    size();
    draw();

    const ro = new ResizeObserver(() => size());
    ro.observe(canvas);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0 });
    io.observe(canvas);

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    };
    const onLeave = () => {
      pointer.x = 0.5;
      pointer.y = 0.5;
    };
    if (fine && !reduced) {
      wrap.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div className="ds-graph" ref={wrapRef}>
      <canvas ref={canvasRef} aria-hidden />
      <div className="ds-graph-cap">
        <span>58 hosts · 1284 endpoints</span>
        <span>2 at risk</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recon console (demonstration only — nothing is requested)                   */
/* -------------------------------------------------------------------------- */

type Seg = [className: string, text: string];

const IDLE: Seg[][] = [
  [["ds-t-dim", "$ "], ["", "vulnexa recon --target "], ["ds-t-key", "portal.example.com"]],
  [["ds-t-dim", "awaiting command "], ["ds-t-iris", "·"]],
];

function reconScript(target: string): Seg[][] {
  return [
    [["ds-t-dim", "$ "], ["", "vulnexa recon --target "], ["ds-t-key", target], ["ds-t-dim", " --scope verified"]],
    [["ds-t-dim", "[recon]   "], ["", "root domain resolved "], ["ds-t-dim", "·········· "], ["ds-t-ok", "ok"]],
    [["ds-t-dim", "[recon]   "], ["", "certificate transparency "], ["ds-t-dim", "····· "], ["ds-t-iris", "34 names"]],
    [["ds-t-dim", "[recon]   "], ["", "passive dns + archives "], ["ds-t-dim", "········ "], ["ds-t-iris", "1284 urls"]],
    [["ds-t-dim", "[recon]   "], ["", "live host probe "], ["ds-t-dim", "··············· "], ["ds-t-ok", "41/58 up"]],
    [["ds-t-dim", "[recon]   "], ["", "fingerprint "], ["ds-t-dim", "··················· "], ["ds-t-iris", "nginx, react 18"]],
    [["ds-t-dim", "[passive] "], ["", "security headers "], ["ds-t-dim", "·············· "], ["ds-t-warn", "3 gaps"]],
    [["ds-t-dim", "[passive] "], ["", "cookie flags "], ["ds-t-dim", "·················· "], ["ds-t-warn", "1 gap"]],
    [["ds-t-dim", "[passive] "], ["", "tls + certificate chain "], ["ds-t-dim", "······· "], ["ds-t-ok", "ok"]],
    [["ds-t-dim", "[passive] "], ["", "cors policy "], ["ds-t-dim", "··················· "], ["ds-t-bad", "permissive origin"]],
    [["ds-t-dim", "[triage]  "], ["", "candidates raised "], ["ds-t-dim", "············· "], ["ds-t-warn", "17 · 2 high"]],
    [["ds-t-dim", "[triage]  "], ["", "ai correlation "], ["ds-t-dim", "················ "], ["ds-t-iris", "4 duplicates merged"]],
    [["ds-t-ok", "done "], ["ds-t-dim", "in 41.6s — evidence stored, awaiting analyst review"]],
    [["ds-t-dim", "note: "], ["", "active modules stay locked until target ownership is verified."]],
  ];
}

/** Strips scheme, path and anything unexpected — this string is only ever
 *  rendered as text, but keep it boring anyway. */
function cleanTarget(raw: string) {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/[^a-z0-9.\-:]/g, "");
  return t.slice(0, 48) || "portal.example.com";
}

const MAX_LINES = 8;

export function ReconConsole() {
  const boxRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const seen = useInView(boxRef, 0.4);
  const [lines, setLines] = useState<Seg[][]>(IDLE);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState("");

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = (raw: string) => {
    if (running) return;
    setRunning(true);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);

    const script = reconScript(cleanTarget(raw));
    let delay = 0;
    script.forEach((segments, i) => {
      delay += i === 0 ? 120 : 210 + Math.random() * 170;
      timers.current.push(
        window.setTimeout(() => {
          setLines((prev) => [...prev, segments].slice(-MAX_LINES));
        }, delay),
      );
    });
    timers.current.push(window.setTimeout(() => setRunning(false), delay + 260));
  };

  useEffect(() => {
    if (!seen || started.current) return;
    started.current = true;
    run("portal.example.com");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  return (
    <div>
      <form
        className="ds-terminp"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          run(target);
        }}
      >
        <span className="ds-caret" aria-hidden>
          &gt;
        </span>
        <label className="ds-sr" htmlFor="ds-recon-target">
          Demo target domain
        </label>
        <input
          id="ds-recon-target"
          name="target"
          type="text"
          spellCheck={false}
          placeholder="portal.example.com"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <button type="submit" disabled={running}>
          {running ? "Running" : "Run recon"}
        </button>
      </form>
      <p className="ds-sr">A simulated reconnaissance log renders below. No requests are sent.</p>
      <div className="ds-term" ref={boxRef} aria-hidden>
        {lines.map((segments, i) => (
          <div key={`${i}-${segments[0]?.[1] ?? ""}`}>
            {segments.map((seg, j) => (
              <span key={j} className={seg[0] || undefined}>
                {seg[1]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);

  // scrollHeight reports the full content height even while the panel is
  // clipped to 0, so a single observer keeps the target height correct
  // through font loading and reflows.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={cn("ds-faq", open && "is-open")}>
      <button type="button" className="ds-faqbtn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {question}
        <span className="ds-faqico" aria-hidden />
      </button>
      <div className="ds-faqpanel" ref={panelRef} style={{ maxHeight: open ? height : 0 }}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

export function Faq({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="ds-faqs" data-rise>
      {items.map(([question, answer]) => (
        <FaqItem key={question} question={question} answer={answer} />
      ))}
    </div>
  );
}
