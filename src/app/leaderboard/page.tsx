"use client";

import { useEffect, useState } from "react";

type Board = {
  colleges: { name: string; city: string; regs: number; verified: number }[];
  people: { name: string; college: string; refs: number }[];
  total: number;
  target: number;
};

export default function Leaderboard() {
  const [b, setB] = useState<Board | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetch("/api/leaderboard", { cache: "no-store" });
      if (alive && r.ok) {
        setB(await r.json());
        setUpdated(new Date());
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const max = Math.max(1, ...(b?.colleges.map((c) => c.verified) ?? [1]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">College Championship</h1>
          <p className="text-slate-500">The college with the most verified sign-ups gets a dedicated NxtWave campus session. Updates live.</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
          live · {updated ? updated.toLocaleTimeString() : "loading"}
        </div>
      </div>
      {b && (
        <div className="card mb-6">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-extrabold tabular-nums">{b.total}</span>
            <span className="text-slate-500">of {b.target} verified registrations</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark transition-all" style={{ width: `${Math.min(100, (b.total / b.target) * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <h2 className="mb-4 font-bold">Colleges</h2>
          <ol className="space-y-3">
            {b?.colleges.map((c, i) => (
              <li key={c.name} className="flex items-center gap-3">
                <span className={`w-7 text-center font-bold ${i < 3 ? "text-brand" : "text-slate-400"}`}>{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="tabular-nums text-slate-600">{c.verified}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(c.verified / max) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
            {b && b.colleges.length === 0 && <p className="text-sm text-slate-500">No registrations yet. Be the first!</p>}
          </ol>
        </div>
        <div className="card">
          <h2 className="mb-4 font-bold">Top referrers</h2>
          <ol className="divide-y divide-slate-100">
            {b?.people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-6 font-bold text-slate-400">{i + 1}</span>
                <div className="flex-1">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.college}</div>
                </div>
                <span className="pill bg-brand/10 text-brand">{p.refs} refs</span>
              </li>
            ))}
            {b && b.people.length === 0 && <p className="text-sm text-slate-500">No referrals yet.</p>}
          </ol>
          <p className="mt-4 text-xs text-slate-500">Prize pool: ₹1,000 / ₹500 / ₹500 for the top 3. Flagged or unverified referrals don&apos;t count.</p>
        </div>
      </div>
    </div>
  );
}
