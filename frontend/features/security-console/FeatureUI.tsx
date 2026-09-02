"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Info,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/pan";

export const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2 text-sm font-bold text-[#041513] shadow-sm transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50";

export function PageTabs({
  basePath,
  active,
  items,
}: {
  basePath: string;
  active: string;
  items: Array<{ label: string; value: string; href?: string }>;
}) {
  return (
    <nav
      aria-label="Page sections"
      className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/15 p-1"
    >
      {items.map((item) => {
        const selected = item.value === active;
        return (
          <Link
            key={item.value}
            href={item.href ?? `${basePath}/${item.value}`}
            aria-current={selected ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              selected
                ? "bg-white/[0.09] text-white shadow-sm"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SectionLink({
  href,
  title,
  description,
  eyebrow,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  eyebrow?: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-40 flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:-translate-y-0.5 hover:border-teal-300/25 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          {eyebrow ? (
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">
              {eyebrow}
            </span>
          ) : (
            <span />
          )}
          {badge ? <StatusBadge value={badge} /> : null}
        </div>
        <h3 className="mt-3 text-base font-bold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal-300">
        Open module
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-white/10 bg-[#07131f] px-3 py-2.5 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/10";

export function ProgressBar({
  value,
  label,
  tone = "teal",
}: {
  value: number;
  label?: string;
  tone?: "teal" | "purple" | "amber";
}) {
  const fill =
    tone === "purple"
      ? "bg-violet-400"
      : tone === "amber"
        ? "bg-amber-400"
        : "bg-teal-400";
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-medium text-slate-400">{label ?? "Progress"}</span>
        <span className="font-mono font-bold text-slate-200">{clamped}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
      >
        <div className={`h-full rounded-full transition-all duration-700 ${fill}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function SafetyNotice({
  children,
  variant = "warning",
}: {
  children?: ReactNode;
  variant?: "warning" | "info" | "success";
}) {
  const styles = {
    warning: "border-amber-300/20 bg-amber-300/[0.07] text-amber-100",
    info: "border-sky-300/20 bg-sky-300/[0.07] text-sky-100",
    success: "border-teal-300/20 bg-teal-300/[0.07] text-teal-100",
  };
  const Icon = variant === "warning" ? AlertTriangle : variant === "success" ? ShieldCheck : Info;

  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm leading-6 ${styles[variant]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        {children ?? (
          <>
            Run PAN only against targets you own or have explicit permission to test. Scope is
            validated before each job and disruptive exploitation is disabled.
          </>
        )}
      </div>
    </div>
  );
}

export function DefinitionGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-[#091622] px-4 py-3.5">
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-1.5 break-words text-sm font-semibold text-slate-200">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CodePanel({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "request" | "response";
}) {
  const badge = tone === "request" ? "HTTP request" : tone === "response" ? "HTTP response" : label;
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#040b12]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {badge}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <LockKeyhole className="h-3 w-3" /> sanitized
        </span>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-slate-300">
        {children}
      </pre>
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{ title: string; detail: string; time: string; state?: "done" | "active" | "pending" }>;
}) {
  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const active = item.state === "active";
        const done = item.state === "done";
        return (
          <li key={`${item.title}-${item.time}`} className="relative flex gap-3 pb-5 last:pb-0">
            {index < items.length - 1 ? (
              <span className="absolute left-[9px] top-5 h-full w-px bg-white/[0.08]" />
            ) : null}
            <span
              className={`relative z-10 mt-1 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border ${
                active
                  ? "border-teal-300 bg-teal-300/15 text-teal-300"
                  : done
                    ? "border-teal-400/30 bg-teal-400 text-[#041513]"
                    : "border-white/15 bg-[#0a1621] text-slate-500"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : <CircleDot className="h-2.5 w-2.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock3 className="h-3 w-3" /> {item.time}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-500">{item.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function KeyValueRows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; href?: string }>;
}) {
  return (
    <div className="divide-y divide-white/[0.06]">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-5">
          <span className="text-sm text-slate-500">{row.label}</span>
          {row.href ? (
            <Link href={row.href} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-300 hover:text-teal-200">
              {row.value}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-sm font-semibold text-slate-200 sm:text-right">{row.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <span>
        <span className="block text-sm font-semibold text-slate-200">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-700 transition peer-checked:bg-teal-400 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#091622] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

