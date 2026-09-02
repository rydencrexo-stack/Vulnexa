"use client";

import { useMemo, useState } from "react";
import {
  Database,
  Download,
  Globe,
  Loader2,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";
import { AppPage } from "@/components/pan/AppPage";
import { SectionCard } from "@/components/pan/SectionCard";
import { Field, inputClass, primaryButton, secondaryButton, SafetyNotice } from "@/features/security-console/FeatureUI";
import { panService } from "@/services/pan-service";
import type { ComboSearchResponse } from "@/types/pan";
import { apiBaseUrl } from "@/lib/api-url";

type SearchType = "domain" | "login" | "password" | "mail" | "keyword";

const API_BASE = apiBaseUrl();

const OPTIONS: Array<{ value: SearchType; label: string; icon: LucideIcon; example: string }> = [
  { value: "domain", label: "Domain", icon: Globe, example: "example.com" },
  { value: "login", label: "Login", icon: User, example: "myusername" },
  { value: "password", label: "Password", icon: LockKeyhole, example: "mypassword" },
  { value: "mail", label: "Mail", icon: Mail, example: "user@gmail.com" },
  { value: "keyword", label: "Keyword", icon: Tag, example: "acme" },
];

export function ComboSearch() {
  const [searchType, setSearchType] = useState<SearchType>("domain");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComboSearchResponse | null>(null);

  const active = OPTIONS.find((option) => option.value === searchType)!;

  const exportUrl = useMemo(() => {
    if (!query.trim()) return null;
    const params = new URLSearchParams({ searchType, query: query.trim() });
    return `${API_BASE}/api/combo/export?${params.toString()}`;
  }, [searchType, query]);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await panService.searchCombo({
        searchType,
        query: query.trim(),
        premium: false,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppPage
      eyebrow="Credential exposure · Combo search"
      title="Breach / combo search"
      description="Search the local, operator-controlled dataset (url:login:pass). Results expose credentials tied to a query — only run this against data you are authorized to hold."
      actions={
        query.trim() && result ? (
          <a className={secondaryButton} href={exportUrl ?? undefined} download>
            <Download className="h-4 w-4" /> Export .txt
          </a>
        ) : undefined
      }
    >
      <SafetyNotice variant="info">
        This page reads a local combolist dataset on the server. It never contacts an external bot or service, and it
        returns raw credential lines. Verify authorization before searching any domain or identity.
      </SafetyNotice>

      <SectionCard title="Search" description="Choose a field to match, then run the query.">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Search field">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = option.value === searchType;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSearchType(option.value)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-teal-300/40 bg-teal-300/10 text-teal-200"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Field label={`${active.label} query`} hint={`e.g. ${active.example}`}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className={`${inputClass} pl-10`}
                  value={query}
                  placeholder={`Enter a ${active.label.toLowerCase()}…`}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && runSearch()}
                />
              </div>
              <button
                type="button"
                className={primaryButton}
                onClick={() => void runSearch()}
                disabled={loading || !query.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          </Field>
        </div>
      </SectionCard>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {result ? (
        <SectionCard
          title={`${result.preview.length} records for ${result.query}`}
          description={`${result.total.toLocaleString()} unique matches · format ${result.format} · preview shows domain user password`}
          className="mt-4"
          action={
            <a className={primaryButton} href={exportUrl ?? undefined} download>
              <Download className="h-4 w-4" /> Download .txt
            </a>
          }
        >
          <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Unique matches", value: result.total.toLocaleString() },
              { label: "Shown", value: result.shown.toLocaleString() },
              { label: "Lines scanned", value: result.linesScanned.toLocaleString() },
              { label: "Dataset files", value: String(result.filesScanned) },
            ].map((item) => (
              <div key={item.label} className="bg-[#091622] px-4 py-3.5">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</dt>
                <dd className="mt-1.5 font-mono text-sm font-semibold text-slate-100">{item.value}</dd>
              </div>
            ))}
          </div>

          {result.preview.length ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#040b12]">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  First {result.preview.length} · domain user password
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="h-3 w-3" /> authorized dataset only
                </span>
              </div>
              <ol className="max-h-96 divide-y divide-white/[0.05] overflow-auto font-mono text-xs text-slate-300">
                {result.preview.map((record, index) => {
                  const [domain, user, ...password] = record.split(" ");
                  return (
                    <li key={`${record}-${index}`} className="flex gap-3 px-4 py-2">
                      <span className="w-8 shrink-0 text-right text-slate-600">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-teal-300">{domain}</span>
                        <span className="text-slate-200"> {user}</span>
                        <span className="text-slate-500"> {password.join(" ")}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 text-sm text-slate-400">
              No matches found for this query.
            </div>
          )}
        </SectionCard>
      ) : null}
    </AppPage>
  );
}

export default ComboSearch;
