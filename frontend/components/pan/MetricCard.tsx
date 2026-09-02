"use client";

import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTone = "teal" | "purple" | "blue" | "amber" | "red";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  tone?: MetricTone;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
}

function isNumeric(value: string | number): boolean {
  return typeof value === "number" || (String(value).trim() !== "" && !Number.isNaN(Number(value)));
}

function CountUp({ value, started }: { value: string | number; started: boolean }) {
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    if (!started) return;
    if (!isNumeric(value)) { setDisplay(String(value)); return; }
    const target = Number(value);
    const duration = 1000;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased).toLocaleString("en-US"));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [started, value]);
  return <>{display}</>;
}

export function MetricCard({ label, value, detail, trend, trendDirection = "flat", tone = "teal", icon: Icon }: MetricCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const TrendIcon = trendDirection === "up" ? ArrowUpRight : trendDirection === "down" ? ArrowDownRight : Minus;

  useEffect(() => {
    const node = ref.current;
    if (!node) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <article className={cn("pan-metric", `pan-metric-${tone}`)} ref={ref}>
      <div className="pan-metric-topline">
        <p>{label}</p>
        {Icon ? <span className="pan-metric-icon"><Icon size={18} strokeWidth={1.8} /></span> : null}
      </div>
      <div className="pan-metric-value"><CountUp value={value} started={visible} /></div>
      {trend || detail ? (
        <div className="pan-metric-detail">
          {trend ? <span className={cn("pan-trend", `pan-trend-${trendDirection}`)}><TrendIcon size={13} />{trend}</span> : null}
          {detail ? <span>{detail}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export default MetricCard;
