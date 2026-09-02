"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, TerminalSquare, Trash2, WandSparkles } from "lucide-react";
import { getApiKey } from "./store";
import { wsBaseUrl } from "@/lib/api-url";

const WS_URL = () => `${wsBaseUrl()}/api/agent/terminal`;

type TermLine = { id: number; kind: "in" | "out" | "err" | "sys"; text: string };

export function BugHunterTerminalView() {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [cmd, setCmd] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const seq = useRef(0);
  const outBox = useRef<HTMLDivElement>(null);

  function push(kind: TermLine["kind"], text: string) {
    setLines((cur) => [...cur, { id: ++seq.current, kind, text }].slice(-2000));
  }

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(WS_URL());
    } catch {
      window.setTimeout(() => { setStatus("connect_failed"); push("sys", "Failed to open WebSocket."); }, 0);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true); setStatus("connected"); push("sys", "Terminal connected. Type a command and press Enter.");
      // Pass the stored AI/opencode key(s) into the shell environment.
      const key = getApiKey();
      if (key) {
        ws.send(`__ENV__${JSON.stringify({ OPENCODE_API_KEY: key, DEEPSEEK_API_KEY: key, ANTHROPIC_API_KEY: key, OPENAI_API_KEY: key })}`);
      }
    };
    ws.onmessage = (ev) => {
      let msg: { type: string; data?: string };
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.type === "out") push("out", msg.data ?? "");
      else if (msg.type === "exit") { setStatus("exit"); push("sys", `[process exited ${msg.data}]`); }
      else if (msg.type === "error") push("err", msg.data ?? "");
    };
    ws.onclose = (e) => { setConnected(false); setStatus(`closed (${e.code})`); };
    ws.onerror = () => { setStatus("error"); };
    return () => { try { ws.close(); } catch {} wsRef.current = null; };
  }, []);

  useEffect(() => {
    if (outBox.current) outBox.current.scrollTop = outBox.current.scrollHeight;
  }, [lines]);

  function sendCommand(command: string) {
    const c = command.trim();
    if (!c || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    push("in", `> ${c}`);
    wsRef.current.send(c);
    setCmd("");
  }

  function send() { sendCommand(cmd); }

  const [ocPrompt, setOcPrompt] = useState("");

  function runOpenCode() {
    const prompt = ocPrompt.trim().replaceAll('"', '\\"');
    sendCommand(`opencode run --model opencode-go/deepseek-v4-flash --thinking "${prompt}"`);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/bug-hunter" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-100"><TerminalSquare className="h-5 w-5 text-teal-300" /> Terminal</h1>
            <p className="font-mono text-xs text-slate-500">Local shell · {status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setLines([]); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"><Trash2 className="h-4 w-4" /> Clear</button>
          <button onClick={send} disabled={!connected || !cmd.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-400 px-3 text-sm font-bold text-[#04130f] hover:bg-teal-300 disabled:opacity-50"><Play className="h-4 w-4" /> Send</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#040807]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-teal-400" : "bg-red-400"}`} /> {connected ? "connected" : status}
        </div>
        <div ref={outBox} className="h-[440px] overflow-y-auto p-4 font-mono text-xs leading-6">
          {lines.length === 0 ? <p className="text-slate-600"># terminal — run tools, opencode, curl, etc. Output streams here.</p> : lines.map((l) => (
            <div key={l.id} className={l.kind === "in" ? "text-teal-300" : l.kind === "err" ? "text-red-300" : l.kind === "sys" ? "text-slate-600" : "text-slate-300"} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l.text}</div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-white/[0.06] bg-[#0a0f0a] p-3">
          <div className="flex items-center gap-2">
            <WandSparkles className="h-4 w-4 shrink-0 text-violet-300" />
            <input
              value={ocPrompt}
              onChange={(e) => setOcPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runOpenCode(); }}
              placeholder="Describe the authorized target, scope, recon, JS/API mapping, validation, and report you want"
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
            <button onClick={runOpenCode} disabled={!connected || !ocPrompt.trim()} className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-violet-500 px-3 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-50"><Play className="h-4 w-4" /> Run opencode</button>
          </div>
          <div className="flex items-center gap-2 border-t border-white/[0.05] pt-2">
            <span className="text-teal-300">&gt;</span>
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="or run any shell command (curl, subfinder, nuclei...)"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
            <button onClick={send} disabled={!connected || !cmd.trim()} className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"><Play className="h-4 w-4" /> Run</button>
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-200">
        Authorized use only. This terminal runs a local shell on the server and requires a logged-in session. Only run commands against systems you own or have explicit permission to test.
      </p>
    </div>
  );
}
