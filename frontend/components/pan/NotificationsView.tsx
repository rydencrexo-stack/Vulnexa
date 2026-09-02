"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AppPage } from "@/components/pan/AppPage";
import { LoadingState } from "@/components/pan/LoadingState";
import { MetricCard } from "@/components/pan/MetricCard";
import { SectionCard } from "@/components/pan/SectionCard";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatRelative } from "@/lib/utils";
import { panService } from "@/services/pan-service";
import type { Notification } from "@/types/pan";

const filters: Record<string, Notification["category"] | "all"> = {
  all: "all",
  "scan-alerts": "scan",
  "new-findings": "finding",
  "asset-changes": "asset",
};

export function NotificationsView({ segments }: { segments: string[] }) {
  const route = segments[0] ?? "all";
  const category = filters[route] ?? "all";
  const router = useRouter();
  const { toast } = useToast();
  const { data, loading, setData } = useAsyncData(() => panService.getNotifications());
  const [show, setShow] = useState<"all" | "unread">("all");
  const visible = useMemo(() => (data ?? []).filter((item) => (category === "all" || item.category === category) && (show === "all" || !item.read)), [category, data, show]);

  async function open(item: Notification) {
    if (!item.read) {
      await panService.markNotificationRead(item.id);
      setData((current) => current?.map((value) => value.id === item.id ? { ...value, read: true } : value) ?? null);
    }
    router.push(item.href);
  }

  async function markAllRead() {
    const unread = (data ?? []).filter((item) => !item.read);
    await Promise.all(unread.map((item) => panService.markNotificationRead(item.id)));
    setData((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
    toast({ tone: "success", title: "Notifications marked as read" });
  }

  return <AppPage eyebrow="Workspace activity" title="Notifications" description="Scan events, new findings, asset changes, and platform safety updates for this workspace." actions={<button className="pan-button pan-button-secondary" onClick={() => void markAllRead()}><CheckCheck size={15} />Mark all read</button>}>
    <div className="pan-kpi-row" style={{ marginBottom: 14 }}><MetricCard icon={Bell} label="Unread" value={data?.filter((item) => !item.read).length ?? 0} detail="need attention" /><MetricCard icon={ShieldAlert} label="Findings" value={data?.filter((item) => item.category === "finding").length ?? 0} tone="red" detail="triage activity" /><MetricCard icon={Radar} label="Scan alerts" value={data?.filter((item) => item.category === "scan").length ?? 0} tone="blue" detail="job state changes" /><MetricCard icon={Sparkles} label="Asset changes" value={data?.filter((item) => item.category === "asset").length ?? 0} tone="purple" detail="new observations" /></div>
    <SectionCard title="Activity inbox" description={`${visible.length} matching notification${visible.length === 1 ? "" : "s"}`}>
      <div className="pan-table-toolbar"><div className="pan-tabs"><button className={show === "all" ? "pan-tab pan-tab-active" : "pan-tab"} onClick={() => setShow("all")}>All</button><button className={show === "unread" ? "pan-tab pan-tab-active" : "pan-tab"} onClick={() => setShow("unread")}>Unread</button></div><select aria-label="Notification category" className="pan-select pan-filter-select" onChange={(event) => router.push(`/notifications/${event.target.value}`)} value={route in filters ? route : "all"}><option value="all">All activity</option><option value="scan-alerts">Scan alerts</option><option value="new-findings">New findings</option><option value="asset-changes">Asset changes</option></select></div>
      {loading ? <LoadingState rows={6} /> : <div className="divide-y divide-white/[0.06]">{visible.map((item) => <button className="flex w-full items-start gap-4 px-1 py-5 text-left transition hover:bg-white/[0.02]" key={item.id} onClick={() => void open(item)}><span className={`pan-notification-tone pan-notification-tone-${item.severity} mt-1`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-100">{item.title}</strong>{!item.read ? <StatusBadge value="new" tone="info" /> : null}<StatusBadge value={item.category} dot={false} /></div><p className="mt-1 text-sm leading-6 text-slate-400">{item.message}</p><small className="mt-2 block text-xs text-slate-500">{formatRelative(item.createdAt)}</small></div></button>)}{!visible.length ? <div className="py-12 text-center text-sm text-slate-500">No notifications match this view.</div> : null}</div>}
    </SectionCard>
  </AppPage>;
}

