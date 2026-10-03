"use client";

import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/client";

type Q = { id: number; name: string; step: string | null; problem: string; created_at: string; answer: { diagnosis: string; fix_steps: string[] } };
type Stats = { total: number; selfSolved: number; escalated: number; waiting: number; noFeedback: number; deflection: number };

export default function Mentor() {
  const [queue, setQueue] = useState<Q[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/helpdesk", { cache: "no-store" });
    if (r.status === 403) return setForbidden(true);
    const d = await r.json();
    setQueue(d.queue);
    setStats(d.stats);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (forbidden) return <p className="p-10 text-center text-slate-500">Log in on the Growth dashboard first (mentors use the admin key).</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Mentor queue</h1>
      <p className="mb-6 text-slate-500">Only tickets the AI couldn&apos;t fix land here. Oldest first. Your reply appears on the student&apos;s screen.</p>
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [stats.total, "help requests"],
            [stats.selfSolved, "fixed by AI"],
            [stats.waiting, "waiting for a mentor"],
            [`${Math.round(stats.deflection * 100)}%`, "solved without a mentor"],
          ].map(([n, l]) => (
            <div key={String(l)} className="card text-center">
              <div className="text-3xl font-extrabold text-brand">{n}</div>
              <div className="text-xs text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      )}
      {queue.length === 0 ? (
        <div className="card text-sm text-slate-500">Queue is empty. 🎉</div>
      ) : (
        <ul className="space-y-3">
          {queue.map((q) => (
            <li key={q.id} className="card">
              <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-bold">
                  #{q.id} · {q.name}
                </span>
                <span className="text-slate-500">
                  {q.step ?? ""} · {new Date(q.created_at).toLocaleTimeString()}
                </span>
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-xs">{q.problem}</pre>
              <p className="mt-2 text-xs text-slate-500">
                <b>AI tried:</b> {q.answer.diagnosis}
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await post("/api/admin/helpdesk", { id: q.id, note: notes[q.id] });
                  load();
                }}
              >
                <input className="input" required placeholder="Reply to the student…" value={notes[q.id] ?? ""} onChange={(e) => setNotes({ ...notes, [q.id]: e.target.value })} />
                <button className="btn-primary shrink-0">Send & resolve</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
