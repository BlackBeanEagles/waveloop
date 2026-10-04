"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { post } from "@/lib/client";

type Msg = { direction: "in" | "out"; body: string };

// Quick replies map to the bot's numbered menu, so a student can register without typing much.
const QUICK: [string, string][] = [
  ["Register", "1"],
  ["My AI project idea", "2"],
  ["My referrals", "3"],
  ["Ask a question", "4"],
  ["Menu", "MENU"],
];

function sessionId() {
  try {
    let id = localStorage.getItem("wl_chat_sid");
    if (!id) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      id = "w_" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
      localStorage.setItem("wl_chat_sid", id);
    }
    return id;
  } catch {
    return "w_" + Math.random().toString(36).slice(2).padEnd(18, "0");
  }
}

export default function ChatWidget() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [sid, setSid] = useState("");
  const [started, setStarted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setSid(sessionId()), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  // First open: restore the conversation, or start one (the bot's menu is its greeting).
  useEffect(() => {
    if (!open || started || !sid) return;
    setStarted(true);
    fetch(`/api/chat?sid=${sid}`)
      .then((r) => r.json())
      .then(async (d) => {
        if (d.messages?.length) return setMsgs(d.messages);
        setTyping(true);
        const r = await post<{ replies?: string[] }>("/api/chat", { sid, text: "Hi" });
        setTyping(false);
        setMsgs((r.replies ?? []).map((body) => ({ direction: "out" as const, body })));
      });
  }, [open, started, sid]);

  if (path.startsWith("/admin") || path.startsWith("/mentor")) return null;

  async function send(body: string) {
    if (!body.trim() || typing) return;
    setMsgs((m) => [...m, { direction: "in", body }]);
    setText("");
    setTyping(true);
    const r = await post<{ replies?: string[]; error?: string }>("/api/chat", { sid, text: body });
    setTyping(false);
    setMsgs((m) => [...m, ...(r.replies ?? [r.error ?? "Something went wrong, try again."]).map((b) => ({ direction: "out" as const, body: b }))]);
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Workshop assistant chat"
          className="fixed bottom-24 right-4 z-50 flex h-[34rem] max-h-[75vh] w-[23rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-line bg-cream shadow-[0_24px_60px_rgba(19,35,61,0.3)]"
        >
          <div className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold">NW</div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Workshop assistant</div>
              <div className="text-xs text-white/70">{typing ? "typing…" : "Register, get an AI project idea, ask anything"}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white">
              ✕
            </button>
          </div>
          <div ref={scroller} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  m.direction === "in" ? "self-end rounded-br-sm bg-[#e4f3e7] text-ink" : "self-start rounded-bl-sm bg-paper text-ink"
                }`}
              >
                {fmt(m.body)}
              </div>
            ))}
            {typing && <div className="self-start rounded-2xl bg-paper px-3 py-2 text-sm text-ink-soft">●●●</div>}
          </div>
          <div className="flex flex-wrap gap-1 border-t border-line bg-paper/60 px-2 pt-2">
            {QUICK.map(([label, value]) => (
              <button key={label} onClick={() => send(value)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs hover:bg-sand">
                {label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 bg-paper/60 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input className="input" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <button className="btn-primary shrink-0 px-3" disabled={typing || !text.trim()} aria-label="Send">
              ➤
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat assistant"}
        className="fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(180,80,31,0.4)] hover:bg-brand-dark"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
        {open ? "Close" : "Chat"}
      </button>
    </>
  );
}

// WhatsApp-style *bold* and _italic_
function fmt(s: string) {
  return s.split(/(\*[^*]+\*|_[^_]+_)/g).map((p, i) =>
    p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p,
  );
}
