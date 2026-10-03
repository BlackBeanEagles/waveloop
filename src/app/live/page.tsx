"use client";

import { useCallback, useEffect, useState } from "react";
import { post, visitorId } from "@/lib/client";

type Live = {
  poll: { id: number; question: string; options: string[]; results: number[] } | null;
  polls: { id: number; question: string; active: number }[];
  questions: { id: number; author: string; body: string; upvotes: number; answered: number }[];
};

export default function LivePage() {
  const [d, setD] = useState<Live | null>(null);
  const [host, setHost] = useState(false);
  const [voted, setVoted] = useState<Record<number, number>>({});
  const [q, setQ] = useState({ author: "", body: "" });
  const [newPoll, setNewPoll] = useState({ question: "", options: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/live", { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    await post("/api/live", body);
    load();
  };

  const total = d?.poll ? d.poll.results.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="pill bg-red-100 text-red-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> LIVE
          </div>
          <h1 className="mt-2 text-3xl font-extrabold">Workshop room</h1>
          <p className="text-slate-500">Polls and Q&amp;A that run alongside the stream, so 500 people stay engaged instead of muted.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={host} onChange={(e) => setHost(e.target.checked)} /> Host controls
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold">Live poll</h2>
          {d?.poll ? (
            <>
              <p className="mb-4 text-lg font-semibold">{d.poll.question}</p>
              <div className="space-y-2">
                {d.poll.options.map((o, i) => {
                  const pct = total ? Math.round((d.poll!.results[i] / total) * 100) : 0;
                  const mine = voted[d.poll!.id] === i;
                  return (
                    <button
                      key={o}
                      onClick={() => {
                        setVoted({ ...voted, [d.poll!.id]: i });
                        act({ action: "vote", pollId: d.poll!.id, voter: visitorId(), option: i });
                      }}
                      className={`relative w-full overflow-hidden rounded-xl border p-3 text-left text-sm ${mine ? "border-brand" : "border-slate-200"}`}
                    >
                      <div className="absolute inset-y-0 left-0 bg-brand/10 transition-all" style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between">
                        <span className={mine ? "font-semibold" : ""}>{o}</span>
                        <span className="tabular-nums text-slate-500">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">{total} votes</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No active poll.</p>
          )}

          {host && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-bold">Host: switch poll</h3>
              <div className="flex flex-wrap gap-2">
                {d?.polls.map((p) => (
                  <button key={p.id} onClick={() => act({ action: "activate", pollId: p.id })} className={`btn text-xs ${p.active ? "bg-brand text-white" : "border border-slate-300"}`}>
                    {p.question.slice(0, 32)}
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  act({ action: "create_poll", question: newPoll.question, options: newPoll.options.split(",") });
                  setNewPoll({ question: "", options: "" });
                }}
              >
                <input className="input" placeholder="New poll question" value={newPoll.question} onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })} />
                <input className="input" placeholder="Options, comma separated" value={newPoll.options} onChange={(e) => setNewPoll({ ...newPoll, options: e.target.value })} />
                <button className="btn-primary">Launch poll</button>
              </form>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold">Questions</h2>
          <form
            className="mb-4 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "ask", ...q });
              setQ({ ...q, body: "" });
            }}
          >
            <div className="flex gap-2">
              <input className="input w-32" placeholder="Name" value={q.author} onChange={(e) => setQ({ ...q, author: e.target.value })} />
              <input className="input" required placeholder="Ask the instructor…" value={q.body} onChange={(e) => setQ({ ...q, body: e.target.value })} />
            </div>
            <button className="btn-primary">Ask</button>
          </form>
          <ul className="space-y-2">
            {d?.questions.map((x) => (
              <li key={x.id} className={`flex gap-3 rounded-xl border p-3 text-sm ${x.answered ? "border-green-200 bg-green-50 opacity-70" : "border-slate-200"}`}>
                <button onClick={() => act({ action: "upvote", id: x.id })} className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1 text-xs font-bold hover:bg-brand/10">
                  ▲<span>{x.upvotes}</span>
                </button>
                <div className="flex-1">
                  <div>{x.body}</div>
                  <div className="text-xs text-slate-500">{x.author}</div>
                </div>
                {host && !x.answered && (
                  <button onClick={() => act({ action: "answered", id: x.id })} className="self-start text-xs text-green-700 underline">
                    answered
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
