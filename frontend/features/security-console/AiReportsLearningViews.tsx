"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bot,
  BrainCircuit,
  Bug,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileChartColumn,
  FileJson,
  FileText,
  History,
  Lightbulb,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  SquarePen,
  Target,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  AppPage,
  DataTable,
  EmptyState,
  MetricCard,
  SectionCard,
  StatusBadge,
} from "@/components/pan";
import {
  CodePanel,
  DefinitionGrid,
  Field,
  KeyValueRows,
  PageTabs,
  ProgressBar,
  SafetyNotice,
  SectionLink,
  inputClass,
  primaryButton,
  secondaryButton,
} from "./FeatureUI";
import type { RouteViewProps } from "./types";
import { wsBaseUrl } from "@/lib/api-url";
import { panService } from "@/services/pan-service";
import { addMessage, createConversation, deleteConversation, getConversation, getConversations, type AiConversation, type AiMessage } from "./ai-chat-store";

function openCodeWsUrl(): string {
  const base = wsBaseUrl();
  return `${base}/api/agent/ws`;
}
import { getReports } from "./bug-hunter/store";

const aiTabs = [
  { label: "Chat", value: "chat" },
  { label: "Analysis", value: "analysis" },
  { label: "Investigations", value: "investigations" },
  { label: "Remediation", value: "remediation" },
  { label: "History", value: "history" },
];

export function AiAnalystView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "chat";
  const convId = segments[1];
  if (page === "analysis" || page === "chat") return <AiChat key={convId ?? "new"} convId={convId} />;
  if (page === "investigations") return <AiInvestigations />;
  if (page === "remediation") return <AiRemediation />;
  if (page === "history") return <AiHistory />;
  return <AiChat key="new" />;
}

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
  evidence?: string[];
};

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "I can explain PAN findings, compare sanitized evidence, prioritize risk, and draft remediation. My conclusions cite evidence IDs and never change verification state.",
  },
  {
    id: 2,
    role: "user",
    content: "Why is finding_01 considered high confidence?",
  },
  {
    id: 3,
    role: "assistant",
    content:
      "PAN observed the q parameter reflected into an HTML attribute without encoding, then reproduced execution of a harmless marker in an isolated browser. That deterministic chain supports 96% confidence. Impact breadth remains uncertain until the affected template and session protections are reviewed.",
    evidence: ["evidence_request_01", "evidence_response_01", "evidence_browser_01"],
  },
];

/* ---------- ChatGPT-style markdown ---------- */

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) nodes.push(<strong key={`b${i++}`} className="font-semibold text-slate-100">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={`i${i++}`} className="text-slate-200">{token.slice(1, -1)}</em>);
    else if (token.startsWith("`")) nodes.push(<code key={`c${i++}`} className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-teal-200">{token.slice(1, -1)}</code>);
    else {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) nodes.push(<a key={`a${i++}`} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-teal-300/40 underline-offset-2 hover:decoration-teal-300">{linkMatch[1]}</a>);
      else nodes.push(token);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/50">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">code</span>
        <button type="button" aria-label="Copy code" onClick={() => void copy()} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:text-teal-300">
          {done ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-5 text-slate-300 whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buffer.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(<CodeBlock key={`cb${key++}`} code={buffer.join("\n")} />);
    } else if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const content = line.replace(/^#+\s*/, "");
      const cls = level <= 2 ? "text-[15px] font-bold text-slate-100" : "text-[13.5px] font-semibold text-slate-200";
      blocks.push(<p key={`h${key++}`} className={`mt-2 first:mt-0 ${cls}`}>{inlineNodes(content)}</p>);
      i += 1;
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul${key++}`} className="my-1.5 list-disc space-y-1 pl-5">
          {items.map((item, index) => <li key={index} className="marker:text-slate-600">{inlineNodes(item)}</li>)}
        </ul>,
      );
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol${key++}`} className="my-1.5 list-decimal space-y-1 pl-5">
          {items.map((item, index) => <li key={index} className="marker:text-slate-600">{inlineNodes(item)}</li>)}
        </ol>,
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={`sp${key++}`} className="h-2" />);
      i += 1;
    } else {
      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].trimStart().startsWith("```") && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
        paragraph.push(lines[i]);
        i += 1;
      }
      blocks.push(<p key={`p${key++}`} className="first:mt-0">{inlineNodes(paragraph.join(" "))}</p>);
    }
  }
  return <div className="space-y-1.5">{blocks}</div>;
}

/* ---------- ChatGPT-style chat ---------- */

const slashCommands = [
  { cmd: "/summarize", text: "Summarize my current attack surface" },
  { cmd: "/prioritize", text: "Prioritize my open findings by risk" },
  { cmd: "/explain", text: "Explain how an IDOR could be exploited" },
  { cmd: "/scan", text: "Scan example.com for subdomains" },
];

const suggestions = [
  { icon: Target, title: "Summarize attack surface", prompt: "Summarize my current attack surface" },
  { icon: ShieldAlert, title: "Prioritize findings", prompt: "Prioritize my open findings by risk" },
  { icon: Bug, title: "Explain an IDOR path", prompt: "Explain how an IDOR could be exploited" },
  { icon: RefreshCw, title: "Scan for subdomains", prompt: "Scan example.com for subdomains" },
];

function AiChat({ convId }: { convId?: string }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<AiConversation[]>(() => getConversations());
  const [conv, setConv] = useState<AiConversation | null>(() => (convId ? getConversation(convId) : null));
  const [messages, setMessages] = useState<AiMessage[]>(() => (convId ? (getConversation(convId)?.messages ?? []) : []));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [attached, setAttached] = useState<{ name: string; text: string } | null>(null);
  const [sidebarMobile, setSidebarMobile] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const convIdRef = useRef<string | null>(convId ?? null);
  const contextRef = useRef("");
  const contextSent = useRef(false);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Sync when the conversation id changes (past-chat navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync on route change
    setConv(convId ? getConversation(convId) : null);
    setMessages(convId ? (getConversation(convId)?.messages ?? []) : []);
    convIdRef.current = convId ?? null;
  }, [convId]);

  // Gather workspace context (assets, endpoints, targets, scans, findings) for the agent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [assets, endpoints, targets, scans, findings] = await Promise.all([
          panService.getAssets(),
          panService.getEndpoints(),
          panService.getTargets(),
          panService.getScans(),
          panService.getFindings(),
        ]);
        if (cancelled) return;
        const assetSample = assets.slice(0, 6).map((a) => a.hostname).join(", ");
        const endpointSample = endpoints.slice(0, 6).map((e) => `${e.method} ${e.path}`).join(", ");
        contextRef.current =
          `Vulnexa workspace inventory — ${targets.length} targets, ${assets.length} assets, ${endpoints.length} endpoints, ${scans.length} scans, ${findings.length} findings. ` +
          `Sample assets: ${assetSample}. Sample endpoints: ${endpointSample}. ` +
          `You are Vulnexa's AI analyst: answer questions about this inventory, analyze findings, and if asked you may run authorized recon/scanning on a target using your tools. Never invent data.`;
        setContextReady(true);
      } catch {
        if (!cancelled) setContextReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    async function connect() {
      let token = "";
      try {
        token = await panService.getAgentWsToken();
      } catch {
        return;
      }
      if (closed) return;
      socket = new WebSocket(openCodeWsUrl());
      wsRef.current = socket;
      socket.onopen = () => {
        socket?.send(JSON.stringify({ token, mode: "chat" }));
        setConnected(true);
      };
      socket.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const type = msg.type as string;
        if (type === "status" && String(msg.text ?? "").startsWith("connected")) {
          setConnected(true);
        } else if (type === "done") {
          const summary = String(msg.summary ?? "");
          if (summary && convIdRef.current) {
            const updated = addMessage(convIdRef.current, "assistant", summary);
            if (updated) {
              setMessages(updated.messages);
              setConv(updated);
              setConversations(getConversations());
            }
          } else if (summary) {
            setMessages((current) => [...current, { id: `msg_${Date.now()}`, role: "assistant", content: summary, createdAt: new Date().toISOString() }]);
          }
          setSending(false);
          sendingRef.current = false;
        } else if (type === "error") {
          const err = `Error: ${String(msg.message ?? "unknown")}`;
          if (convIdRef.current) {
            const updated = addMessage(convIdRef.current, "assistant", err);
            if (updated) { setMessages(updated.messages); setConv(updated); setConversations(getConversations()); }
          }
          setSending(false);
          sendingRef.current = false;
        }
      };
      socket.onclose = () => setConnected(false);
      socket.onerror = () => setConnected(false);
    }
    connect();
    return () => {
      closed = true;
      if (socket) socket.close();
      // If the user left mid-response, mark the reply as interrupted so it isn't lost.
      if (sendingRef.current && convIdRef.current) {
        addMessage(convIdRef.current, "assistant", "(AI response was interrupted — you left the chat. Reconnect to continue this conversation.)");
      }
    };
  }, []);

  async function send(text: string) {
    let clean = text.trim();
    if (!clean || sending) return;
    if (attached) {
      clean = `${clean}\n\nAttached file ${attached.name}:\n\`\`\`\n${attached.text.slice(0, 4000)}\n\`\`\``;
      setAttached(null);
    }
    let currentConv = convIdRef.current ? getConversation(convIdRef.current) : null;
    if (!currentConv) {
      currentConv = createConversation();
      convIdRef.current = currentConv.id;
    }
    const history = currentConv.messages.map((m) => ({ role: m.role, content: m.content }));
    const updated = addMessage(currentConv.id, "user", clean);
    if (updated) {
      setMessages(updated.messages);
      setConv(updated);
      setConversations(getConversations());
    }
    setMessage("");
    setSending(true);
    sendingRef.current = true;
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Fast path: single model call (much faster than the agent loop).
    const reply = await panService.fastChat([...history, { role: "user", content: clean }], contextRef.current);
    if (reply && !reply.startsWith("Fast AI chat failed")) {
      const res = addMessage(currentConv.id, "assistant", reply);
      if (res) { setMessages(res.messages); setConv(res); setConversations(getConversations()); }
      setSending(false);
      sendingRef.current = false;
      return;
    }

    // Fallback: agent via WebSocket (slower, but works when the fast API is rate-limited).
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "chat", text: contextSent.current ? clean : `${contextRef.current}\n\nOperator: ${clean}` }));
      contextSent.current = true;
    } else {
      const err = addMessage(currentConv.id, "assistant", "AI is unavailable right now (rate-limited and the agent is not connected).");
      if (err) { setMessages(err.messages); setConv(err); setConversations(getConversations()); }
      setSending(false);
      sendingRef.current = false;
    }
  }

  function newChat() {
    router.push("/ai-analyst/analysis");
  }
  function openChat(id: string) {
    router.push(`/ai-analyst/chat/${id}`);
  }
  function delChat(id: string) {
    deleteConversation(id);
    setConversations(getConversations());
    if (id === convIdRef.current) {
      convIdRef.current = null;
      setMessages([]);
      setConv(null);
      router.replace("/ai-analyst/analysis");
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = file.size > 200_000 ? `[${file.name} was too large to attach — showing the name only]` : await file.text();
      setAttached({ name: file.name, text: text.slice(0, 4000) });
    } catch {
      setAttached({ name: file.name, text: `[could not read ${file.name}]` });
    }
  }

  const tabs = aiTabs.map((t) => (t.value === "chat" ? { ...t, href: "/ai-analyst/analysis" } : t));
  const slashFiltered = message.startsWith("/")
    ? slashCommands.filter((c) => `${c.cmd} ${c.text}`.toLowerCase().includes(message.slice(1).trim().toLowerCase()))
    : [];

  function conversationList() {
    if (conversations.length === 0) return <p className="px-3 py-3 text-xs text-slate-500">No past chats yet.</p>;
    return conversations.map((c) => (
      <div key={c.id} className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-left ${c.id === conv?.id ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}>
        <button type="button" onClick={() => { openChat(c.id); setSidebarMobile(false); }} className="min-w-0 flex-1 truncate text-left text-sm text-slate-300">{c.title}</button>
        <button type="button" aria-label="Delete chat" onClick={() => delChat(c.id)} className="shrink-0 rounded p-1 text-slate-600 opacity-100 transition hover:text-red-300 lg:opacity-0 lg:group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    ));
  }

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height)-74px)] min-h-[540px] flex-col">
      <PageTabs basePath="/ai-analyst" active="chat" items={tabs} />
      <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[268px_minmax(0,1fr)]">
        {/* Conversations sidebar */}
        <aside className="hidden min-h-0 flex-col rounded-2xl border border-white/10 bg-[#0a0f0a] p-3 lg:flex">
          <button type="button" onClick={newChat} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-300 px-4 py-2 text-sm font-bold text-[#041513] shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
            <SquarePen className="h-4 w-4" /> New chat
          </button>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">{conversationList()}</div>
          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,.8)]" : "bg-amber-400"}`} />
              {connected ? "OpenCode connected" : "connecting…"}
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-600">deepseek-v4-flash · saved locally</p>
          </div>
        </aside>

        {/* Chat column */}
        <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#040807]">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4 py-2.5">
            <button type="button" aria-label="Chat history" onClick={() => setSidebarMobile(true)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200 lg:hidden"><History className="h-4 w-4" /></button>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-400/25 to-teal-300/20 text-violet-200"><Bot className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-100">{conv?.title ?? "New chat"}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-teal-400" : "bg-amber-400"}`} />
                {connected ? "Live · OpenCode agent" : "Connecting…"}{contextReady ? " · context loaded" : ""}
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:inline-flex">
              <Sparkles className="h-3 w-3 text-violet-300" /> Vulnexa AI
            </span>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {messages.length === 0 && !sending ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-400/30 to-teal-300/20 text-violet-200 shadow-[0_0_40px_rgba(167,139,250,.25)]"><Bot className="h-7 w-7" /></div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">How can I help secure your workspace?</h2>
                  <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">I have your attack surface loaded. Ask about findings, endpoints, or tell me to scan a target.</p>
                </div>
                <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button key={s.title} type="button" onClick={() => void send(s.prompt)} className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-left transition hover:border-teal-300/30 hover:bg-white/[0.05]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-300/10 text-teal-300"><s.icon className="h-4 w-4" /></span>
                      <span className="text-sm font-semibold text-slate-300 transition group-hover:text-slate-100">{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((item) => (
                  <div key={item.id} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                    {item.role === "assistant" ? (
                      <div className="grid h-8 w-8 shrink-0 self-end place-items-center rounded-lg bg-violet-400/10 text-violet-300"><Bot className="h-4 w-4" /></div>
                    ) : null}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-6 sm:max-w-[78%] ${item.role === "user" ? "rounded-br-md bg-teal-300 font-medium text-[#041513]" : "rounded-bl-md border border-white/[0.08] bg-white/[0.035] text-slate-300"}`}>
                      {item.role === "assistant" ? <Md text={item.content} /> : <p className="whitespace-pre-wrap">{item.content}</p>}
                    </div>
                  </div>
                ))}
                {sending ? (
                  <div className="flex items-end gap-3 justify-start">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-violet-300"><Bot className="h-4 w-4" /></div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.035] px-4 py-3"><span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" /></div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="relative shrink-0 border-t border-white/[0.07] bg-[#040807] p-3 sm:px-5">
            {message.startsWith("/") ? (
              <div className="absolute bottom-full left-3 right-3 z-10 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b120f] shadow-2xl sm:left-5 sm:right-5">
                {slashFiltered.length ? slashFiltered.map((c) => (
                  <button key={c.cmd} type="button" onClick={() => { setMessage(c.text); textareaRef.current?.focus(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/[0.05]">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] font-bold text-teal-300">{c.cmd}</span>
                    <span className="text-sm text-slate-300">{c.text}</span>
                  </button>
                )) : <p className="px-3.5 py-2.5 text-xs text-slate-500">No matching command</p>}
              </div>
            ) : null}
            {attached ? (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-teal-300/20 bg-teal-300/[0.06] px-2.5 py-1.5 text-xs text-teal-100">
                <FileText className="h-3.5 w-3.5" /> {attached.name}
                <button type="button" aria-label="Remove attachment" onClick={() => setAttached(null)} className="ml-auto rounded p-0.5 text-slate-500 transition hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : null}
            <div className="flex items-end gap-2 rounded-[22px] border border-white/10 bg-white/[0.04] px-2 py-1.5 transition focus-within:border-teal-300/40 focus-within:ring-2 focus-within:ring-teal-300/10">
              <button type="button" aria-label="Attach file" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-teal-300"><Paperclip className="h-4 w-4" /></button>
              <textarea
                ref={textareaRef}
                rows={1}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  const el = event.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(message); } }}
                placeholder="Message Vulnexa AI… (type / for commands)"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={() => void send(message)}
                disabled={!message.trim() || sending}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${message.trim() && !sending ? "bg-teal-300 text-[#041513] hover:bg-teal-200" : "cursor-not-allowed bg-white/[0.06] text-slate-600"}`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-600">Vulnexa AI can make mistakes — verify security decisions against evidence. Enter to send · Shift+Enter for a new line.</p>
            <input ref={fileRef} type="file" accept=".txt,.log,.json,.md,.csv" className="hidden" onChange={(event) => void onFile(event)} />
          </div>
        </div>
      </div>

      {/* Mobile history drawer */}
      {sidebarMobile ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[#0a0f0a] p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-sm font-bold text-slate-200">Chats</p>
              <button type="button" aria-label="Close history" onClick={() => setSidebarMobile(false)} className="rounded p-1.5 text-slate-500 transition hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => { newChat(); setSidebarMobile(false); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-3 py-2 text-sm font-bold text-[#041513]"><SquarePen className="h-4 w-4" /> New chat</button>
            <div className="mt-3 flex flex-col gap-0.5">{conversationList()}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AiAnalysis() {
  const [analyzed, setAnalyzed] = useState(false);
  return (
    <AppPage eyebrow="AI Analyst" title="Finding analysis" description="Generate a structured, evidence-linked assessment from sanitized request, response, browser, and scan metadata." actions={<button type="button" className={primaryButton} onClick={() => setAnalyzed(true)}><BrainCircuit className="h-4 w-4" /> Analyze finding</button>}>
      <PageTabs basePath="/ai-analyst" active="analysis" items={aiTabs} />
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <SectionCard title="Analysis input">
          <Field label="Finding"><select className={inputClass}><option>finding_01 · Reflected XSS</option><option>finding_02 · CORS arbitrary origin</option><option>finding_05 · Possible BOLA</option></select></Field>
          <div className="mt-5"><KeyValueRows rows={[
            { label: "Evidence", value: "3 records" }, { label: "Sanitized", value: "Yes" }, { label: "Current state", value: <StatusBadge value="confirmed" /> }, { label: "Provider", value: "Demo adapter" },
          ]} /></div>
        </SectionCard>
        {analyzed ? <SectionCard title="Structured result" action={<StatusBadge value="validated JSON" tone="success" />}>
          <CodePanel label="AI analysis result">{`{
  "summary": "Browser-verified reflected XSS in the search query parameter.",
  "vulnerabilityType": "xss",
  "confidence": 96,
  "verificationRecommendation": "Retain confirmed state; evidence is deterministic.",
  "evidenceUsed": ["evidence_request_01", "evidence_response_01", "evidence_browser_01"],
  "impact": "Script execution in the application origin; session impact requires review.",
  "remediation": ["Apply attribute-context encoding", "Avoid unsafe DOM sinks"],
  "safeNextSteps": ["Patch staging template", "Run saved-marker retest"],
  "limitations": ["Production was not tested", "Session scope not assessed"]
}`}</CodePanel>
        </SectionCard> : <EmptyState icon={BrainCircuit} title="Ready to analyze" description="Select a finding with sanitized evidence, then generate a structured result. AI output cannot confirm or execute anything." action={<button type="button" className={primaryButton} onClick={() => setAnalyzed(true)}>Analyze finding</button>} />}
</div>
    </AppPage>
  );
}

function AiInvestigations() {
  type Investigation = { id: string; title: string; findings: number; owner: string; status: string; updated: string };
  const investigations: Investigation[] = [
    { id: "inv_01", title: "Staging injection chain", findings: 3, owner: "Maya Chen", status: "in review", updated: "12 min ago" },
    { id: "inv_02", title: "API authorization candidates", findings: 4, owner: "Ravi Kumar", status: "open", updated: "Yesterday" },
    { id: "inv_03", title: "Public exposure changes", findings: 2, owner: "Maya Chen", status: "completed", updated: "Aug 24" },
  ];
  return (
    <AppPage eyebrow="AI Analyst" title="Investigations" description="Group related findings and evidence into an analyst-owned investigation. Correlations remain hypotheses until reviewed." actions={<button type="button" className={primaryButton}>New investigation</button>}>
      <PageTabs basePath="/ai-analyst" active="investigations" items={aiTabs} />
      <SectionCard title="Open investigations"><DataTable data={investigations} keyField="id" columns={[
        { key: "title", header: "Investigation", render: (item: Investigation) => <span className="font-semibold text-slate-100">{item.title}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{item.id}</span></span> }, { key: "findings", header: "Findings" }, { key: "owner", header: "Owner" }, { key: "status", header: "Status", render: (item: Investigation) => <StatusBadge value={item.status} /> }, { key: "updated", header: "Updated" },
      ]} /></SectionCard>
      <SafetyNotice variant="info">AI correlation highlights shared assets, parameters, and evidence. It does not claim an exploit chain without supporting deterministic evidence.</SafetyNotice>
    </AppPage>
  );
}

function AiRemediation() {
  const [generated, setGenerated] = useState(false);
  return (
    <AppPage eyebrow="AI Analyst" title="Remediation assistant" description="Draft technology-aware fixes, safe verification steps, and developer-ready acceptance criteria from evidence-backed findings.">
      <PageTabs basePath="/ai-analyst" active="remediation" items={aiTabs} />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <SectionCard title="Remediation brief">
          <div className="grid gap-4">
            <Field label="Finding"><select className={inputClass}><option>finding_01 · Reflected XSS</option><option>finding_02 · CORS arbitrary origin</option></select></Field>
            <Field label="Application stack"><select className={inputClass}><option>Next.js · React</option><option>FastAPI · Python</option><option>Framework neutral</option></select></Field>
            <Field label="Output"><select className={inputClass}><option>Developer fix plan</option><option>Ticket acceptance criteria</option><option>Verification checklist</option></select></Field>
            <button type="button" className={primaryButton} onClick={() => setGenerated(true)}><WandSparkles className="h-4 w-4" /> Generate remediation</button>
          </div>
        </SectionCard>
        {generated ? <SectionCard title="Developer fix plan" action={<StatusBadge value="AI draft" tone="purple" />}>
          <div className="space-y-5 text-sm leading-7 text-slate-300"><div><h3 className="font-bold text-slate-100">Change</h3><p>Render the query value through React&apos;s escaped string interpolation. Remove any use of raw HTML insertion along the search-result path.</p></div><div><h3 className="font-bold text-slate-100">Defense in depth</h3><p>Add a nonce-based Content Security Policy after testing compatibility. CSP does not replace output encoding.</p></div><div><h3 className="font-bold text-slate-100">Acceptance criteria</h3><ul className="list-disc pl-5"><li>The saved marker renders as text and does not execute.</li><li>Legitimate Unicode search terms remain functional.</li><li>The PAN retest records a sanitized clean response and browser capture.</li></ul></div></div>
        </SectionCard> : <EmptyState icon={WandSparkles} title="No remediation generated" description="Choose a finding and application stack to create an evidence-linked developer draft." />}
      </div>
    </AppPage>
  );
}

function AiHistory() {
  type Conversation = { id: string; title: string; context: string; messages: number; model: string; updated: string };
  const conversations: Conversation[] = [
    { id: "conv_07", title: "Why is finding_01 high confidence?", context: "finding_01", messages: 6, model: "pan-analyst-demo", updated: "8 min ago" },
    { id: "conv_06", title: "Prioritize scan_01 findings", context: "scan_01", messages: 11, model: "pan-analyst-demo", updated: "Yesterday" },
    { id: "conv_05", title: "Draft executive summary", context: "report_03", messages: 4, model: "pan-analyst-demo", updated: "Aug 24" },
  ];
  return (
    <AppPage eyebrow="AI Analyst" title="Conversation history" description="Stored conversation metadata and sanitized messages. Raw secrets and full target responses are excluded.">
      <PageTabs basePath="/ai-analyst" active="history" items={aiTabs} />
      <SectionCard title="Recent conversations"><DataTable data={conversations} keyField="id" columns={[
        { key: "title", header: "Conversation", render: (item: Conversation) => <span className="font-semibold text-slate-100">{item.title}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{item.id}</span></span> }, { key: "context", header: "Evidence context" }, { key: "messages", header: "Messages" }, { key: "model", header: "Model" }, { key: "updated", header: "Updated" },
      ]} /></SectionCard>
    </AppPage>
  );
}

const reportTabs = [
  { label: "Reports", value: "all", href: "/reports" }, { label: "Generate", value: "generate" }, { label: "Executive", value: "executive" }, { label: "Technical", value: "technical" }, { label: "Templates", value: "templates" },
];

type Report = { id: string; name: string; type: string; target: string; findings: number; formats: string; status: string; created: string };
const reports: Report[] = [
  { id: "report_03", name: "Northstar Customer Portal security assessment", type: "Full scan", target: "Northstar Customer Portal", findings: 9, formats: "PDF · HTML", status: "ready", created: "Today, 10:18" },
  { id: "report_02", name: "Executive risk brief", type: "Executive", target: "Northstar workspace", findings: 14, formats: "PDF", status: "ready", created: "Yesterday" },
  { id: "report_01", name: "API recon inventory", type: "Recon", target: "Atlas Partner API", findings: 0, formats: "HTML · JSON", status: "ready", created: "Aug 24" },
];

export function ReportsView({ segments }: RouteViewProps) {
  const page = segments[0] ?? "all";
  if (page === "generate") return <GenerateReport />;
  if (page === "executive") return <ExecutiveReport />;
  if (page === "technical") return <TechnicalReport />;
  if (page === "templates") return <ReportTemplates />;
  if (page !== "all") return <ReportDetail id={page} />;
  return <ReportList />;
}

function ReportList() {
  return (
    <AppPage eyebrow="Evidence-backed deliverables" title="Reports" description="Turn normalized scope, coverage, findings, evidence references, remediation, and limitations into professional exports." actions={<Link href="/reports/generate" className={primaryButton}><FileText className="h-4 w-4" /> Generate report</Link>}>
      <PageTabs basePath="/reports" active="all" items={reportTabs} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ready reports" value="3" detail="2 generated this week" tone="teal" icon={FileText} />
        <MetricCard label="Findings covered" value="23" detail="18 remediations" tone="blue" icon={ShieldAlert} />
        <MetricCard label="Available formats" value="4" detail="PDF · HTML · JSON · CSV" tone="purple" icon={Download} />
        <MetricCard label="Templates" value="6" detail="2 workspace custom" tone="amber" icon={FileChartColumn} />
      </div>
      <SectionCard title="Generated reports"><ReportTable /></SectionCard>
    </AppPage>
  );
}

function ReportTable() {
  const agentReports = getReports();
  const merged: Report[] = [
    ...agentReports.map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: "DeltaAI",
      target: agent.target,
      findings: agent.findings.length,
      formats: "HTML · JSON",
      status: "ready",
      created: new Date(agent.completedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    })),
    ...reports,
  ];
  return <DataTable data={merged} keyField="id" columns={[
    { key: "name", header: "Report", render: (report: Report) => <Link href={`/reports/${report.id}`} className="font-semibold text-slate-100 hover:text-teal-300">{report.name}<span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">{report.id}</span></Link> }, { key: "type", header: "Type" }, { key: "target", header: "Target" }, { key: "findings", header: "Findings" }, { key: "formats", header: "Exports" }, { key: "status", header: "Status", render: (report: Report) => <StatusBadge value={report.status} /> }, { key: "created", header: "Generated" },
  ]} />;
}

function GenerateReport() {
  const [generated, setGenerated] = useState(false);
  const [formats, setFormats] = useState(new Set(["PDF", "HTML"]));
  const formatOptions = ["PDF", "HTML", "JSON", "CSV"];
  function toggleFormat(format: string) { setFormats((current) => { const next = new Set(current); if (next.has(format)) next.delete(format); else next.add(format); return next; }); }
  return (
    <AppPage eyebrow="Reporting" title="Generate report" description="Choose audience, evidence detail, and export formats. PAN records the exact target scope and generated timestamp.">
      <PageTabs basePath="/reports" active="generate" items={reportTabs} />
      {generated ? <SectionCard title="Report generation complete" description="report_04 · generated from a consistent scan and finding snapshot">
        <div className="flex flex-col gap-5 rounded-xl border border-teal-300/20 bg-teal-300/[0.06] p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-teal-300" /><p className="font-bold text-teal-100">Northstar Customer Portal full assessment</p></div><p className="mt-2 text-sm text-slate-400">{Array.from(formats).join(" · ")} · 9 findings · generated just now</p></div><Link href="/reports/report_04" className={primaryButton}>Open report</Link></div>
      </SectionCard> : <form onSubmit={(event) => { event.preventDefault(); setGenerated(true); }} className="grid gap-5">
        <SectionCard title="Report configuration">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Report type"><select className={inputClass}><option>Full scan report</option><option>Executive report</option><option>Technical vulnerability report</option><option>Findings-only report</option><option>Recon report</option><option>Comparison report</option></select></Field>
            <Field label="Source"><select className={inputClass}><option>scan_01 · Northstar balanced scan</option><option>Workspace snapshot</option><option>Selected findings</option></select></Field>
            <Field label="Template"><select className={inputClass}><option>PAN professional dark</option><option>Executive brief</option><option>Developer handoff</option></select></Field>
            <Field label="Report name"><input className={inputClass} defaultValue="Northstar Customer Portal full assessment" /></Field>
          </div>
        </SectionCard>
        <SectionCard title="Included content"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[
          "Target and authorization scope", "Methodology and scan modules", "Coverage and limitations", "Findings summary", "Detailed evidence references", "Remediation and retest status",
        ].map((item) => <label key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm font-semibold text-slate-200"><input type="checkbox" defaultChecked className="h-4 w-4 accent-teal-400" />{item}</label>)}</div></SectionCard>
        <SectionCard title="Export formats" description="Choose one or more artifacts."><div className="flex flex-wrap gap-3">{formatOptions.map((format) => <label key={format} className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold ${formats.has(format) ? "border-teal-300/30 bg-teal-300/[0.08] text-teal-100" : "border-white/[0.08] text-slate-400"}`}><input type="checkbox" className="sr-only" checked={formats.has(format)} onChange={() => toggleFormat(format)} />{format}</label>)}</div></SectionCard>
        <div className="flex justify-end"><button type="submit" className={primaryButton} disabled={!formats.size}><FileText className="h-4 w-4" /> Generate report</button></div>
      </form>}
    </AppPage>
  );
}

function ExecutiveReport() {
  return (
    <AppPage eyebrow="Report preview" title="Executive risk brief" description="A concise leadership view of exposure, business impact, trend, and recommended priorities." actions={<button type="button" className={primaryButton}><Download className="h-4 w-4" /> Export PDF</button>}>
      <PageTabs basePath="/reports" active="executive" items={reportTabs} />
      <SectionCard title="Executive summary" action={<StatusBadge value="preview" tone="info" />}>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4 text-sm leading-7 text-slate-300"><p>PAN assessed two verified staging targets across their approved web and API scope. No critical vulnerabilities were confirmed. Two high-severity issues require priority remediation: reflected cross-site scripting and an overly permissive CORS policy.</p><p>Overall exposure is <strong className="text-amber-200">moderate and improving</strong>. Seven previously identified issues were fixed and successfully retested this month. One API authorization candidate still requires analyst review.</p><p>Recommended next actions are to patch the confirmed injection issue, restrict CORS origins, complete the authorization review, and maintain the weekly passive scan schedule.</p></div><div className="grid grid-cols-2 gap-3"><MetricCard label="Risk score" value="63 / 100" detail="Moderate" tone="amber" icon={ShieldAlert} /><MetricCard label="Confirmed high" value="2" detail="0 critical" tone="red" icon={Bug} /><MetricCard label="Fixed" value="7" detail="This month" tone="teal" icon={CheckCircle2} /><MetricCard label="Coverage" value="92%" detail="Approved endpoints" tone="purple" icon={Target} /></div></div>
      </SectionCard>
      <SafetyNotice variant="info">The executive summary is generated from PAN evidence and includes stated coverage limitations. It does not claim untested production impact.</SafetyNotice>
    </AppPage>
  );
}

function TechnicalReport() {
  return (
    <AppPage eyebrow="Report preview" title="Technical vulnerability report" description="Detailed scope, methodology, evidence references, reproduction guidance, remediation, and retest status." actions={<button type="button" className={primaryButton}><Download className="h-4 w-4" /> Export PDF</button>}>
      <PageTabs basePath="/reports" active="technical" items={reportTabs} />
      <DefinitionGrid items={[
        { label: "Target", value: "Northstar Customer Portal" }, { label: "Scope", value: "2 hosts · ports 80/443" }, { label: "Scan", value: "scan_01" }, { label: "Modules", value: "Recon, passive, XSS, CVEs, AI" }, { label: "Coverage", value: "287 / 312 endpoints" }, { label: "Generated", value: "Aug 27, 2026 · 10:18 IST" },
      ]} />
      <SectionCard title="Detailed findings"><FindingSummaryRows /></SectionCard>
      <SectionCard title="Limitations"><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300"><li>Testing was limited to the saved staging scope and excluded payment and account-deletion paths.</li><li>Destructive exploitation, denial-of-service behavior, and production testing were not performed.</li><li>AI analysis used sanitized evidence and did not independently confirm findings.</li></ul></SectionCard>
    </AppPage>
  );
}

function FindingSummaryRows() {
  return <div className="divide-y divide-white/[0.07]">{[
    ["High", "Reflected Cross-Site Scripting", "confirmed", "CWE-79 · CVSS 8.2"], ["High", "CORS allows arbitrary origin", "confirmed", "CWE-942 · CVSS 8.1"], ["Medium", "Missing Content Security Policy", "candidate", "CWE-693 · CVSS 5.3"],
  ].map(([severity, title, state, meta]) => <div key={title} className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[90px_1fr_130px] md:items-center"><StatusBadge value={severity} /><div><p className="font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div><StatusBadge value={state} /></div>)}</div>;
}

function ReportTemplates() {
  return (
    <AppPage eyebrow="Reporting" title="Report templates" description="Reusable audience-specific layouts with consistent methodology, evidence, and limitation sections." actions={<button type="button" className={primaryButton}>New template</button>}>
      <PageTabs basePath="/reports" active="templates" items={reportTabs} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SectionLink href="/reports/generate" eyebrow="Leadership" title="Executive risk brief" description="Business impact, trend, priorities, and concise severity summary." badge="system" />
        <SectionLink href="/reports/generate" eyebrow="Engineering" title="Developer handoff" description="Evidence references, reproduction, remediation, owners, and retest criteria." badge="system" />
        <SectionLink href="/reports/generate" eyebrow="Full assessment" title="PAN professional dark" description="Complete scope, methodology, coverage, findings, evidence, and limitations." badge="workspace" />
      </div>
    </AppPage>
  );
}

function ReportDetail({ id }: { id: string }) {
  const agent = getReports().find((report) => report.id === id);
  if (agent) return <AgentReportDetail report={agent} />;
  return (
    <AppPage eyebrow={`Report · ${id}`} title="Northstar Customer Portal security assessment" description="Full scan report · generated Aug 27, 2026 at 10:18 IST" actions={<div className="flex flex-wrap gap-2"><button type="button" className={secondaryButton}><FileJson className="h-4 w-4" /> JSON</button><button type="button" className={primaryButton}><Download className="h-4 w-4" /> PDF</button></div>}>
      <DefinitionGrid items={[
        { label: "Status", value: <StatusBadge value="ready" /> }, { label: "Target", value: "Northstar Customer Portal" }, { label: "Source scan", value: "scan_01" }, { label: "Findings", value: "9" }, { label: "Evidence refs", value: "27" }, { label: "Formats", value: "PDF · HTML · JSON · CSV" },
      ]} />
      <SectionCard title="Report contents"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{["Authorization and scope", "Methodology and modules", "Coverage summary", "Findings summary", "Detailed findings", "Evidence index", "Remediation plan", "Limitations", "Generated timestamp"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-300/10 text-xs font-bold text-teal-300">{index + 1}</span><span className="text-sm font-semibold text-slate-300">{item}</span></div>)}</div></SectionCard>
      <SafetyNotice variant="success">The report snapshot is immutable. Evidence downloads continue to follow workspace permissions and retention policy.</SafetyNotice>
    </AppPage>
  );
}

function AgentReportDetail({ report }: { report: import("./bug-hunter/store").AgentReport }) {
  return (
    <AppPage eyebrow={`DeltaAI · ${report.id}`} title={report.name} description={`Generated ${new Date(report.completedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`} actions={<div className="flex flex-wrap gap-2"><Link href="/bug-hunter" className={primaryButton}><WandSparkles className="h-4 w-4" /> New assessment</Link></div>}>
      <DefinitionGrid items={[
        { label: "Status", value: <StatusBadge value="ready" /> },
        { label: "Target", value: report.target },
        { label: "Auth", value: report.auth },
        { label: "Model", value: report.model },
        { label: "Coverage", value: `${report.coverage}%` },
        { label: "Findings", value: String(report.findings.length) },
      ]} />
      <SectionCard title="AI summary">
        <p className="text-sm leading-7 text-slate-300">{report.summary}</p>
      </SectionCard>
      <SectionCard title="Candidate findings" description="All results are candidates requiring analyst validation.">
        <div className="divide-y divide-white/[0.06]">
          {report.findings.map((finding, index) => (
            <div key={index} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-semibold text-slate-200">{finding.title}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{finding.endpoint}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{finding.confidence}%</span>
                <StatusBadge value={finding.severity} />
              </div>
            </div>
          ))}
          {report.findings.length === 0 ? <p className="py-4 text-sm text-slate-500">No candidate findings recorded.</p> : null}
        </div>
      </SectionCard>
      <SectionCard title="Assessment phases">
        <div className="flex flex-wrap gap-2">
          {report.phases.map((phase) => <span key={phase} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300">{phase}</span>)}
          {report.skills.map((skill) => <span key={skill} className="rounded-md border border-violet-300/20 bg-violet-300/[0.06] px-2.5 py-1 text-xs text-violet-200">{skill}</span>)}
        </div>
      </SectionCard>
      <SafetyNotice variant="info">AI-generated analysis can be incomplete or incorrect. All findings must be validated before remediation, escalation, or disclosure.</SafetyNotice>
    </AppPage>
  );
}

type LearningArticle = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  takeaways: string[];
  example: string;
  moduleHref: string;
  moduleLabel: string;
  minutes: number;
};

const learningArticles: LearningArticle[] = [
  { slug: "getting-started", title: "Getting started with PAN", category: "Fundamentals", summary: "Move from verified target to evidence-backed report without leaving the authorization envelope.", takeaways: ["Verify ownership before discovery", "Review included and excluded scope", "Start conservative and inspect evidence"], example: "A first scan can combine recon, passive rules, and AI summarization while active testing remains off.", moduleHref: "/scans/new", moduleLabel: "Create a safe first scan", minutes: 4 },
  { slug: "understanding-scans", title: "Understanding scans", category: "Fundamentals", summary: "Learn PAN phases, worker state, coverage, candidate findings, and safe cancellation.", takeaways: ["A scan is a bounded workflow", "Coverage differs by module eligibility", "Pause and cancel occur between safe operations"], example: "scan_01 moves from scope validation through recon, passive analysis, active testing, verification, AI analysis, and reporting.", moduleHref: "/scans/scan_01/live", moduleLabel: "Open a live scan", minutes: 5 },
  { slug: "understanding-findings", title: "Understanding findings", category: "Fundamentals", summary: "Separate observations, confidence, deterministic verification, status, and remediation progress.", takeaways: ["Severity is not confidence", "Candidates need review", "AI never confirms a finding"], example: "A 96% confidence XSS observation becomes confirmed only after deterministic browser evidence or analyst review.", moduleHref: "/findings", moduleLabel: "Review findings", minutes: 5 },
  { slug: "reconnaissance", title: "Reconnaissance", category: "Workflow", summary: "Build an authorized inventory of hosts, services, technologies, endpoints, scripts, and historical URLs.", takeaways: ["Discovery starts with verified scope", "Normalize data across adapters", "Investigate changes before testing"], example: "PAN filters historical URLs back through the current allowed host and path scope before storing them.", moduleHref: "/recon", moduleLabel: "Open reconnaissance", minutes: 6 },
  { slug: "active-scanning", title: "Active scanning", category: "Workflow", summary: "Understand when to use Acunetix, how PAN synchronizes state, and why authorization reviews matter.", takeaways: ["Active traffic can affect target state", "Use staging and test accounts", "Keep disruptive checks explicitly disabled"], example: "PAN maps an approved target to Acunetix, imports vulnerabilities, and preserves the original source reference.", moduleHref: "/active-scanner", moduleLabel: "Open Active Scanner", minutes: 6 },
  { slug: "passive-scanning", title: "Passive scanning", category: "Workflow", summary: "Identify security signals in traffic already captured by authorized discovery and testing.", takeaways: ["No attack payloads are sent", "Headers and cookies reveal posture", "Passive findings can still need verification"], example: "A missing CSP is detected from a captured response, but its practical impact depends on the rest of the application.", moduleHref: "/scanner/passive", moduleLabel: "Open passive scanner", minutes: 4 },
  { slug: "vulnerabilities/xss", title: "Cross-site scripting (XSS)", category: "Vulnerability", summary: "XSS occurs when untrusted input reaches an executable browser context without safe handling.", takeaways: ["Encoding must match the output context", "Framework escaping is a strong default", "CSP is defense in depth, not the primary fix"], example: "A search value reflected inside an HTML attribute needs attribute-context encoding.", moduleHref: "/scanner/xss", moduleLabel: "Open XSS scanner", minutes: 7 },
  { slug: "vulnerabilities/sql-injection", title: "SQL injection", category: "Vulnerability", summary: "SQL injection occurs when untrusted input changes the structure of a database query.", takeaways: ["Use parameterized queries", "Avoid string-built SQL", "Bound tests and disable destructive techniques"], example: "Use a bound :user_id parameter instead of concatenating a path value into a query.", moduleHref: "/scanner/sqli", moduleLabel: "Open SQLi scanner", minutes: 7 },
  { slug: "vulnerabilities/idor", title: "Insecure direct object reference", category: "Vulnerability", summary: "IDOR appears when a user can reference an object they are not authorized to access.", takeaways: ["Authorization must be checked per object", "Unpredictable IDs are not access control", "Use controlled test accounts"], example: "Changing /orders/104 to /orders/105 must not expose another account's order.", moduleHref: "/scanner/api", moduleLabel: "Open API scanner", minutes: 6 },
  { slug: "vulnerabilities/ssrf", title: "Server-side request forgery", category: "Vulnerability", summary: "SSRF makes a server request an attacker-selected destination or resource.", takeaways: ["Allowlist destinations", "Revalidate redirects", "Block private and metadata addresses"], example: "An image-fetch feature must not follow a redirect from an allowed host to 169.254.169.254.", moduleHref: "/scanner/api", moduleLabel: "Review API checks", minutes: 7 },
  { slug: "vulnerabilities/xxe", title: "XML external entity injection", category: "Vulnerability", summary: "XXE abuses XML entity processing to read files or trigger server-side requests.", takeaways: ["Disable external entities", "Use hardened parsers", "Prefer simpler formats when possible"], example: "An XML import should reject document type declarations and external entity resolution.", moduleHref: "/scanner/misconfigurations", moduleLabel: "Open configuration scanner", minutes: 5 },
  { slug: "vulnerabilities/file-upload", title: "Unsafe file upload", category: "Vulnerability", summary: "Uploads become dangerous when file type, storage, rendering, or access controls are weak.", takeaways: ["Validate content, not only extension", "Store outside executable paths", "Serve with safe content types"], example: "Rename uploads, scan content, and return them through a controlled download handler.", moduleHref: "/scanner/misconfigurations", moduleLabel: "Review configuration checks", minutes: 6 },
  { slug: "vulnerabilities/security-misconfiguration", title: "Security misconfiguration", category: "Vulnerability", summary: "Insecure defaults, exposed services, missing controls, and environment drift create avoidable risk.", takeaways: ["Harden from a reviewed baseline", "Remove unused features", "Continuously detect drift"], example: "A staging debug console must not become internet-accessible after a deployment change.", moduleHref: "/scanner/misconfigurations", moduleLabel: "Open misconfiguration scanner", minutes: 5 },
];

export function LearningView({ segments }: RouteViewProps) {
  const slug = segments.join("/");
  const article = learningArticles.find((item) => item.slug === slug);
  if (article) return <LearningArticleView article={article} />;
  return <LearningHome />;
}

function LearningHome() {
  const fundamentals = learningArticles.filter((item) => item.category !== "Vulnerability");
  const vulnerabilities = learningArticles.filter((item) => item.category === "Vulnerability");
  return (
    <AppPage eyebrow="Security guidance" title="PAN Learning" description="Short, practical guidance that connects security concepts to authorized workflows inside PAN.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Guides" value="13" detail="6 workflow · 7 vulnerability" tone="teal" icon={BookOpen} />
        <MetricCard label="Completed" value="4" detail="31% of library" tone="blue" icon={CheckCircle2} />
        <MetricCard label="Current streak" value="3 days" detail="Keep learning" tone="purple" icon={Sparkles} />
        <MetricCard label="Reading time" value="73 min" detail="Entire library" tone="amber" icon={Lightbulb} />
      </div>
      <SectionCard title="Fundamentals and workflows" description="Start with authorization, scope, scans, evidence, and safe operation.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fundamentals.map((article) => <SectionLink key={article.slug} href={`/learning/${article.slug}`} eyebrow={`${article.category} · ${article.minutes} min`} title={article.title} description={article.summary} badge={article.slug === "getting-started" ? "recommended" : undefined} />)}</div>
      </SectionCard>
      <SectionCard title="Vulnerability primers" description="Understand common vulnerability classes before reviewing evidence or choosing a module.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{vulnerabilities.map((article) => <SectionLink key={article.slug} href={`/learning/${article.slug}`} eyebrow={`${article.category} · ${article.minutes} min`} title={article.title} description={article.summary} />)}</div>
      </SectionCard>
    </AppPage>
  );
}

function LearningArticleView({ article }: { article: LearningArticle }) {
  const related = learningArticles.filter((item) => item.slug !== article.slug && item.category === article.category).slice(0, 3);
  return (
    <AppPage eyebrow={`${article.category} · ${article.minutes} minute read`} title={article.title} description={article.summary} actions={<Link href={article.moduleHref} className={primaryButton}>{article.moduleLabel}<ArrowRight className="h-4 w-4" /></Link>}>
      <ProgressBar value={article.slug === "getting-started" ? 100 : 35} label="Learning progress" tone="purple" />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          <SectionCard title="Why it matters"><p className="text-sm leading-7 text-slate-300">{article.summary} PAN keeps authorization, evidence provenance, uncertainty, and analyst ownership visible so the security workflow stays useful and defensible.</p></SectionCard>
          <SectionCard title="What to remember"><ul className="space-y-3">{article.takeaways.map((takeaway) => <li key={takeaway} className="flex gap-3 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-300" />{takeaway}</li>)}</ul></SectionCard>
          <SectionCard title="Example"><div className="rounded-xl border border-violet-300/15 bg-violet-300/[0.05] p-5 text-sm leading-7 text-slate-300">{article.example}</div></SectionCard>
          <SafetyNotice>Use these concepts only on systems you own or are explicitly authorized to test. Choose safe verification that minimizes impact and preserves evidence.</SafetyNotice>
        </div>
        <div className="grid content-start gap-5">
          <SectionCard title="Apply in PAN"><Link href={article.moduleHref} className="group flex items-center justify-between gap-4 rounded-xl border border-teal-300/15 bg-teal-300/[0.05] p-4 text-sm font-bold text-teal-200 hover:bg-teal-300/[0.08]">{article.moduleLabel}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></Link></SectionCard>
          <SectionCard title="Related reading"><div className="grid gap-2">{related.map((item) => <Link key={item.slug} href={`/learning/${item.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3 text-sm font-semibold text-slate-300 hover:border-white/[0.14] hover:text-white"><span>{item.title}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500" /></Link>)}</div></SectionCard>
        </div>
      </div>
    </AppPage>
  );
}
