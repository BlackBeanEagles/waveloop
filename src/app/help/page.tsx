"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";

type Answer = { diagnosis: string; fix_steps: string[]; code_fix: string; confidence: "low" | "medium" | "high"; needs_mentor: boolean; engine: string };

const STEPS = [
  "Step 1 (0-15 min): write and test the core prompt",
  "Step 2 (15-30 min): wrap it in a Streamlit or Lovable app",
  "Step 3 (30-45 min): add one 'wow' feature",
  "Step 4 (45-60 min): deploy and record a demo",
];

export default function Help() {
  const [f, setF] = useState({ name: "", email: "", step: STEPS[0], problem: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ ticketId: number; answer: Answer } | null>(null);
  const [status, setStatus] = useState<"open" | "solved" | "escalated">("open");
  const [mentorNote, setMentorNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wl_help_me") ?? "{}");
      setF((x) => ({ ...x, name: saved.name ?? "", email: saved.email ?? "" }));
    } catch {}
  }, []);

  // After escalating, wait for the mentor's reply.
  useEffect(() => {
    if (status !== "escalated" || !res) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/help?id=${res.ticketId}`).then((r) => r.json());
      if (d.ticket?.mentorNote) {
        setMentorNote(d.ticket.mentorNote);
        clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [status, res]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      localStorage.setItem("wl_help_me", JSON.stringify({ name: f.name, email: f.email }));
    } catch {}
    const lang = new URLSearchParams(location.search).get("lang") ?? undefined;
    const r = await post<{ ticketId?: number; answer?: Answer; error?: string }>("/api/help", { ...f, lang });
    setBusy(false);
    if (r.answer && r.ticketId) {
      setRes({ ticketId: r.ticketId, answer: r.answer });
      setStatus("open");
      setMentorNote(null);
    } else setErr(r.error ?? "Could not get help");
  }

  async function feedback(action: "solved" | "escalate") {
    if (!res) return;
    await post("/api/help", { ticketId: res.ticketId, action });
    setStatus(action === "solved" ? "solved" : "escalated");
  }

  const a = res?.answer;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2">
      <form onSubmit={ask} className="card flex flex-col gap-3 self-start">
        <div className="pill w-fit bg-red-100 text-red-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Live workshop help desk
        </div>
        <h1 className="text-2xl font-extrabold">Stuck? Paste your error.</h1>
        <p className="text-sm text-slate-500">You get a fix in seconds, matched to your own project. If it doesn&apos;t work, a mentor picks it up.</p>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" required placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" type="email" placeholder="Registered email (uses your project)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <select className="input" value={f.step} onChange={(e) => setF({ ...f, step: e.target.value })}>
          {STEPS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <textarea
          className="input min-h-48 font-mono text-xs"
          required
          placeholder={"Paste the error here, e.g.\nModuleNotFoundError: No module named 'google.generativeai'"}
          value={f.problem}
          onChange={(e) => setF({ ...f, problem: e.target.value })}
        />
        <button className="btn-primary py-3" disabled={busy}>
          {busy ? "Looking at your error…" : "Get a fix"}
        </button>
      </form>

      <div>
        {!a ? (
          <div className="card text-sm text-slate-600">
            <h2 className="mb-2 font-bold text-ink">How it works</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>AI reads your error, your workshop step and your registered project idea.</li>
              <li>You get a plain-language diagnosis, 2-4 steps and a code fix.</li>
              <li>Tap &quot;That fixed it&quot; or &quot;Still stuck&quot;. Stuck tickets go to the mentor queue and the reply appears here.</li>
            </ol>
          </div>
        ) : (
          <div className="card flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold">{a.diagnosis}</h2>
              <span className={`pill shrink-0 ${a.confidence === "high" ? "bg-green-100 text-green-800" : a.confidence === "medium" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                {a.confidence} confidence
              </span>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {a.fix_steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {a.code_fix && (
              <div className="relative">
                <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs text-white">{a.code_fix}</pre>
                <button
                  className="absolute right-2 top-2 rounded bg-white/15 px-2 py-0.5 text-xs text-white"
                  onClick={async () => {
                    await navigator.clipboard.writeText(a.code_fix);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">Answered by {a.engine === "claude" ? "Claude" : "the common-errors guide (no API key)"} · ticket #{res!.ticketId}</p>
            {status === "open" && (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" onClick={() => feedback("solved")}>
                  ✅ That fixed it
                </button>
                <button className="btn-ghost" onClick={() => feedback("escalate")}>
                  🙋 Still stuck: get a mentor
                </button>
              </div>
            )}
            {status === "solved" && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">Nice! Back to building 🚀</div>}
            {status === "escalated" &&
              (mentorNote ? (
                <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                  <b>Mentor reply:</b> {mentorNote}
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">A mentor has your ticket. Their reply will appear here, so keep this tab open.</div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
