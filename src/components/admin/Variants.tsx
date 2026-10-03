"use client";

import { useState } from "react";
import { post } from "@/lib/client";

export type V = { key: string; headline: string; sub: string; source: string; active: number; views: number; regs: number; rate: number; pBest: number; share: number };

const S1 = "#2a78d6";

export default function Variants({ variants, reload }: { variants: V[]; reload: () => void }) {
  const [form, setForm] = useState({ headline: "", sub: "" });
  const leader = [...variants].filter((v) => v.active).sort((a, b) => b.pBest - a.pBest)[0];
  const act = async (body: Record<string, unknown>) => {
    await post("/api/admin/variants", body);
    reload();
  };

  return (
    <div className="card">
      <h2 className="mb-1 font-bold">Self-optimising headline test</h2>
      <p className="mb-4 text-xs text-ink-soft">
        Thompson sampling: each new visitor sees the headline drawn from each arm&apos;s Beta posterior, so traffic shifts to winners automatically while weak arms still get explored.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-ink-soft">
            <tr>
              <th className="py-1">Headline</th>
              <th>Visitors</th>
              <th>Regs</th>
              <th>Conv.</th>
              <th className="w-40">P(best)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.key} className={`border-t border-line align-top ${v.active ? "" : "opacity-50"}`}>
                <td className="max-w-xs py-2 pr-2">
                  <div className="font-semibold">
                    <span className="mr-1 font-mono text-xs text-ink-soft/70">{v.key}</span>
                    {v.headline}
                  </div>
                  {v.source === "copilot" && <span className="pill mt-1 bg-brand/10 text-brand">🧠 copilot</span>}
                </td>
                <td className="tabular-nums">{v.views}</td>
                <td className="tabular-nums">{v.regs}</td>
                <td className="tabular-nums font-semibold">{v.views ? `${(v.rate * 100).toFixed(1)}%` : "–"}</td>
                <td>
                  <div className="flex items-center gap-2" title={`${Math.round(v.pBest * 100)}% chance this is the best headline`}>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-sand">
                      <div className="h-full rounded" style={{ width: `${v.pBest * 100}%`, background: S1 }} />
                    </div>
                    <span className="w-9 text-right text-xs tabular-nums">{Math.round(v.pBest * 100)}%</span>
                  </div>
                </td>
                <td className="pl-2">
                  <button className="text-xs text-ink-soft underline" onClick={() => act({ action: v.active ? "pause" : "resume", key: v.key })}>
                    {v.active ? "pause" : "resume"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${leader && leader.pBest >= 0.95 ? "bg-green-50 text-green-900" : "bg-cream text-ink"}`}>
        {!leader
          ? "No active headlines."
          : leader.views < 30
            ? "Exploring: too few visitors to call a winner yet. Traffic is split almost evenly."
            : leader.pBest >= 0.95
              ? `✓ ${leader.key} is the winner (${Math.round(leader.pBest * 100)}% probability best). Pause the others or add a new challenger.`
              : `${leader.key} leads with ${Math.round(leader.pBest * 100)}% probability of being best. Still learning.`}
      </div>
      <form
        className="mt-4 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "add", ...form });
          setForm({ headline: "", sub: "" });
        }}
      >
        <input className="input" required placeholder="New headline" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        <input className="input" required placeholder="Sub-line" value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} />
        <button className="btn-ghost">+ Add challenger</button>
      </form>
    </div>
  );
}
