"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Box,
  Braces,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  FileBarChart,
  Gauge,
  LogOut,
  Menu,
  Network,
  Radar,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Database,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanLogo } from "@/components/pan/PanLogo";
import { StatusBadge } from "@/components/pan/StatusBadge";
import { useToast } from "@/components/pan/ToastProvider";
import { cn, formatRelative, initials } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { logoutAction } from "@/services/auth-actions";
import { panService } from "@/services/pan-service";
import type { Notification, Role, User, Workspace } from "@/types/pan";

interface NavItem { label: string; href: string; icon: LucideIcon; keywords?: string }

const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge, keywords: "overview metrics" },
  { label: "Targets", href: "/targets", icon: Target, keywords: "scope authorization" },
  { label: "Assets", href: "/assets/all", icon: Network, keywords: "hosts subdomains technology" },
  { label: "Endpoints", href: "/endpoints/all", icon: Braces, keywords: "api routes urls" },
  { label: "Recon", href: "/recon/overview", icon: Radar, keywords: "discovery inventory" },
  { label: "Active Scanner", href: "/active-scanner/overview", icon: ScanSearch, keywords: "acunetix dast" },
  { label: "Scanner", href: "/scanner/overview", icon: ShieldCheck, keywords: "passive xss sqli cve" },
  { label: "Breach Search", href: "/combo", icon: Database, keywords: "combo credential leak url login pass exposure" },
  { label: "Scans", href: "/scans", icon: Activity, keywords: "jobs progress history running" },
  { label: "DeltaAI", href: "/bug-hunter", icon: Sparkles, keywords: "ai agent deltaai exploit triage report" },
  { label: "Findings", href: "/findings/all", icon: Box, keywords: "vulnerabilities evidence" },
  { label: "AI Analyst", href: "/ai-analyst/chat", icon: Bot, keywords: "analysis remediation" },
  { label: "Reports", href: "/reports/generate", icon: FileBarChart, keywords: "pdf export executive" },
];

const secondaryNav: NavItem[] = [
  { label: "Learning", href: "/learn", icon: BookOpen, keywords: "academy training rooms vulnerability" },
  { label: "Settings", href: "/settings/general", icon: Settings },
];

const adminNav: NavItem = { label: "Admin Panel", href: "/admin/overview", icon: Users, keywords: "users workers health audit" };
const publicPaths = ["/", "/home", "/login", "/register", "/forgot-password"];

export function AppShell({ children, initialRole = "user" }: { children: ReactNode; initialRole?: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  function openSidebar() {
    if (closeTimerRef.current) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setOpen(true);
  }
  function closeSidebar() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 260);
  }

  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [user, setUser] = useState<User>({ id: "session_user", name: initialRole === "admin" ? "Avery Admin" : "Maya Chen", email: initialRole === "admin" ? "admin@pan.local" : "analyst@pan.local", role: initialRole, organization: "Northstar Security" });
  const searchInput = useRef<HTMLInputElement>(null);

  const isPublic = publicPaths.includes(pathname);
  const isOnboarding = pathname.startsWith("/onboarding");
  const isMobile = useIsMobile();
  const unread = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (isPublic) return;
    void Promise.all([panService.getCurrentUser(), panService.getWorkspaces(), panService.getNotifications()]).then(([nextUser, nextWorkspaces, nextNotifications]) => {
      setUser(initialRole === "admin" ? { ...nextUser, role: "admin", name: "Avery Admin", email: "admin@pan.local" } : nextUser);
      setWorkspaces(nextWorkspaces);
      setActiveWorkspace(nextWorkspaces[0] ?? null);
      setNotifications(nextNotifications);
    });
  }, [initialRole, isPublic]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchInput.current?.focus(), 30);
  }, [searchOpen]);

  const allNav = useMemo(() => [...primaryNav, ...secondaryNav, ...(user.role === "admin" ? [adminNav] : [])], [user.role]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allNav.slice(0, 7);
    return allNav.filter((item) => `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(normalized));
  }, [allNav, query]);

  if (isPublic || isOnboarding) return <>{children}</>;

  // Dedicated mobile app shell (bottom navigation, thumb-friendly).
  if (isMobile) {
    const mobileTabs: Array<{ label: string; href: string; icon: LucideIcon }> = [
      { label: "Home", href: "/dashboard", icon: Gauge },
      { label: "Assets", href: "/assets/all", icon: Network },
      { label: "Scans", href: "/scans", icon: Activity },
      { label: "Findings", href: "/findings/all", icon: Box },
      { label: "AI", href: "/ai-analyst/analysis", icon: Bot },
    ];
    return (
      <div className="pan-mobile-app">
        <header className="pan-mobile-top">
          <PanLogo compact />
          <div className="flex items-center gap-2">
            <Link href="/ai-analyst/analysis" className="pan-mobile-deltai"><Sparkles size={15} /> DeltaAI</Link>
            <button aria-label={`${unread} unread notifications`} className="pan-icon-button" onClick={() => { setNotificationOpen(false); router.push("/notifications/all"); }}><Bell size={18} />{unread ? <span className="pan-mobile-badge">{unread}</span> : null}</button>
            <Link href="/profile/personal-information" className="pan-avatar">{initials(user.name)}</Link>
          </div>
        </header>
        <main className="pan-mobile-content" id="main-content">{children}</main>
        <nav className="pan-mobile-nav" aria-label="Mobile navigation">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`) || (tab.href === "/dashboard" && pathname === "/");
            return (
              <Link aria-current={active ? "page" : undefined} className={cn("pan-mobile-tab", active && "is-active")} href={tab.href} key={tab.href}>
                <Icon size={20} strokeWidth={1.8} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href.split("/").slice(0, 2).join("/")}/`);

  async function signOut() {
    await logoutAction();
    toast({ tone: "success", title: "Signed out safely" });
    router.replace("/login");
    router.refresh();
  }

  async function markNotification(notification: Notification) {
    if (!notification.read) {
      await panService.markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    }
    setNotificationOpen(false);
    router.push(notification.href);
  }

  const renderSidebar = (mobile = false) => (
    <aside
      onMouseEnter={!mobile ? openSidebar : undefined}
      onMouseLeave={!mobile ? closeSidebar : undefined}
      className={cn("pan-sidebar", !mobile && !open && "pan-sidebar-collapsed", mobile && "pan-sidebar-mobile")}
    >
      <div className="pan-sidebar-brand">
        <PanLogo compact={!mobile && !open} />
        {mobile ? <button aria-label="Close navigation" className="pan-icon-button" onClick={() => setMobileOpen(false)}><X size={18} /></button> : null}
      </div>
      <nav aria-label="Main navigation" className="pan-sidebar-nav">
        <div className="pan-nav-group">
          {open || mobile ? <p className="pan-nav-label">Workspace</p> : null}
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link aria-current={isActive(item.href) ? "page" : undefined} className={cn("pan-nav-item", isActive(item.href) && "pan-nav-item-active")} href={item.href} key={item.href} onClick={() => setMobileOpen(false)} title={!mobile && !open ? item.label : undefined}>
                <Icon size={18} strokeWidth={1.8} />
                {open || mobile ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
        <div className="pan-nav-group pan-nav-group-bottom">
          {open || mobile ? <p className="pan-nav-label">Manage</p> : null}
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            return <Link aria-current={isActive(item.href) ? "page" : undefined} className={cn("pan-nav-item", isActive(item.href) && "pan-nav-item-active")} href={item.href} key={item.href} onClick={() => setMobileOpen(false)} title={!mobile && !open ? item.label : undefined}><Icon size={18} strokeWidth={1.8} />{open || mobile ? <span>{item.label}</span> : null}</Link>;
          })}
          {user.role === "admin" ? <Link aria-current={isActive(adminNav.href) ? "page" : undefined} className={cn("pan-nav-item", isActive(adminNav.href) && "pan-nav-item-active")} href={adminNav.href} onClick={() => setMobileOpen(false)} title={!mobile && !open ? adminNav.label : undefined}><Users size={18} strokeWidth={1.8} />{open || mobile ? <span>{adminNav.label}</span> : null}</Link> : null}
        </div>
      </nav>
    </aside>
  );

  return (
    <div className="pan-app-shell">
      <div className="pan-edge-strip" onMouseEnter={() => setOpen(true)} onMouseLeave={closeSidebar} />
      {renderSidebar()}
      {mobileOpen ? <div className="pan-mobile-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMobileOpen(false)}>{renderSidebar(true)}</div> : null}
      <div className="pan-app-main">
        <header className="pan-topbar">
          <div className="pan-topbar-left">
            <button aria-label="Open navigation" className="pan-icon-button pan-mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="pan-workspace-wrap">
              <button aria-expanded={workspaceOpen} className="pan-workspace-button" onClick={() => { setWorkspaceOpen((value) => !value); setNotificationOpen(false); setProfileOpen(false); }}>
                <span className="pan-workspace-icon"><Building2 size={16} /></span>
                <span><small>Workspace</small><strong>{activeWorkspace?.name ?? "Northstar Cloud"}</strong></span>
                <ChevronDown size={14} />
              </button>
              {workspaceOpen ? <div className="pan-popover pan-workspace-popover"><p className="pan-popover-label">Switch workspace</p>{workspaces.map((workspace) => <button className={cn("pan-workspace-option", workspace.id === activeWorkspace?.id && "is-active")} key={workspace.id} onClick={() => { setActiveWorkspace(workspace); setWorkspaceOpen(false); toast({ tone: "info", title: `Switched to ${workspace.name}` }); }}><span>{initials(workspace.name)}</span><div><strong>{workspace.name}</strong><small>{workspace.targetCount} targets · {workspace.plan}</small></div>{workspace.id === activeWorkspace?.id ? <ShieldCheck size={15} /> : null}</button>)}</div> : null}
            </div>
          </div>

          <button className="pan-global-search" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search PAN…</span><kbd>/</kbd></button>

          <div className="pan-topbar-actions">
            <Link className="pan-quick-action" href="/scans/new"><Sparkles size={15} />Quick scan</Link>
            <div className="pan-popover-wrap">
              <button aria-label={`${unread} unread notifications`} aria-expanded={notificationOpen} className="pan-icon-button pan-notification-button" onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); setWorkspaceOpen(false); }}><Bell size={18} />{unread ? <span>{unread}</span> : null}</button>
              {notificationOpen ? <div className="pan-popover pan-notifications-popover"><div className="pan-popover-heading"><div><strong>Notifications</strong><small>{unread} unread</small></div><Link href="/notifications/all" onClick={() => setNotificationOpen(false)}>View all</Link></div><div className="pan-notification-list">{notifications.slice(0, 4).map((notification) => <button className={cn("pan-notification-item", !notification.read && "is-unread")} key={notification.id} onClick={() => void markNotification(notification)}><span className={`pan-notification-tone pan-notification-tone-${notification.severity}`} /><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{formatRelative(notification.createdAt)}</small></div></button>)}</div></div> : null}
            </div>
            <div className="pan-popover-wrap">
              <button aria-expanded={profileOpen} className="pan-profile-button" onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false); setWorkspaceOpen(false); }}><span className="pan-avatar">{initials(user.name)}</span><span className="pan-profile-meta"><strong>{user.name}</strong><small>{user.role}</small></span><ChevronDown size={14} /></button>
              {profileOpen ? <div className="pan-popover pan-profile-popover"><div className="pan-profile-summary"><span className="pan-avatar pan-avatar-large">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small><StatusBadge value={user.role} dot={false} /></div></div><div className="pan-popover-links"><Link href="/profile/personal-information"><CircleUserRound size={16} />Profile</Link><Link href="/settings/workspace"><Building2 size={16} />Workspace settings</Link><button onClick={() => void signOut()}><LogOut size={16} />Sign out</button></div></div> : null}
            </div>
          </div>
        </header>
        <main className="pan-content" id="main-content">{children}</main>
      </div>

      {searchOpen ? (
        <div className="pan-command-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}>
          <div aria-label="Global search" aria-modal="true" className="pan-command" role="dialog">
            <div className="pan-command-input"><Search size={19} /><input aria-label="Search PAN" onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, targets, findings…" ref={searchInput} value={query} /><button aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
            <div className="pan-command-results"><p>Navigate</p>{results.length ? results.map((item) => { const Icon = item.icon; return <button key={item.href} onClick={() => { router.push(item.href); setSearchOpen(false); }}><span><Icon size={17} /></span><div><strong>{item.label}</strong><small>{item.keywords?.split(" ").slice(0, 3).join(" · ") ?? "PAN workspace"}</small></div><ChevronRight size={15} /></button>; }) : <div className="pan-command-empty">No matching PAN areas found.</div>}</div>
            <footer><span><kbd>↑</kbd><kbd>↓</kbd> browse</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AppShell;
