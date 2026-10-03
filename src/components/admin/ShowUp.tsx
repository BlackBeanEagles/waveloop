"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { post } from "@/lib/client";
import { LANGS, isLang } from "@/lib/i18n";

const S1 = "#2a78d6";
const GRID = "#e5e7eb";

type Report = {
  model: { source: "prior" | "fitted"; intercept: number; trainedOn?: number; accuracy?: number; fittedAt?: string; weights: { key: string; label: string; weight: number }[] };
  registrants: number;
  expectedAttendees: number;
  expectedRate: number;
  atRiskCount: number;
  buckets: { range: string; people: number }[];
  atRisk: { id: number; name: string; p: number; reasons: string[] }[];
  canFit: { ok: boolean; n: number; attended: number; reason: string };
  threshold: number;
  languages: { lang: string; regs: number; verified: number }[];
};

export default function ShowUp({ refreshKey }: { refreshKey: number }) {
  const [r, setR] = useState<Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetch("/api/admin/showup", { cache: "no-store" })
      .then((x) => x.json())
      .then(setR);
  useEffect(() => {
    load();
  }, [refreshKey]);

  if (!r) return <div className="card text-sm text-slate-500">Loading show-up model…</div>;
  const maxW = Math.max(...r.model.weights.map((w) => Math.abs(w.weight)), 0.01);

  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Show-up prediction</h2>
          <span className={`pill ${r.model.source === "fitted" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
            {r.model.source === "fitted" ? `● learned from ${r.model.trainedOn} real registrants (${Math.round((r.model.accuracy ?? 0) * 100)}% accurate)` : "○ prior weights (no attendance data yet)"}
          </span>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          A logistic model scores each registrant&apos;s chance of attending. Everyone below {Math.round(r.threshold * 100)}% gets 2 extra &quot;rescue&quot; messages (3 h and 15 min before), and everyone else is spared them.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-2xl font-extrabold tabular-nums">{r.expectedAttendees}</div>
            <div className="text-xs text-slate-500">expected attendees</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-2xl font-extrabold tabular-nums">{Math.round(r.expectedRate * 100)}%</div>
            <div className="text-xs text-slate-500">expected show-up</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-2xl font-extrabold tabular-nums text-red-700">{r.atRiskCount}</div>
            <div className="text-xs text-slate-500">⚠ at risk (get rescue msgs)</div>
          </div>
        </div>
        {r.registrants === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No registrants yet. Scores appear as people sign up.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={r.buckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} people`, "Registrants"]} labelFormatter={(l) => `Attendance chance ${l}`} />
              <Bar dataKey="people" fill={S1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <h3 className="mb-2 mt-4 text-sm font-bold">What drives attendance (model weights)</h3>
        <ul className="space-y-1 text-xs">
          {r.model.weights.map((w) => (
            <li key={w.key} className="flex items-center gap-2" title={`log-odds ${w.weight.toFixed(2)}`}>
              <span className="w-56 shrink-0 text-slate-600">{w.label}</span>
              <div className="relative h-2 flex-1 rounded bg-slate-100">
                <div
                  className="absolute top-0 h-2 rounded"
                  style={{ background: w.weight >= 0 ? S1 : "#eb6834", left: w.weight >= 0 ? "50%" : `${50 - (Math.abs(w.weight) / maxW) * 50}%`, width: `${(Math.abs(w.weight) / maxW) * 50}%` }}
                />
                <div className="absolute left-1/2 top-[-2px] h-3 w-px bg-slate-400" />
              </div>
              <span className="w-10 text-right tabular-nums">{w.weight >= 0 ? "+" : ""}{w.weight.toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={!r.canFit.ok}
            onClick={async () => {
              const x = await post<{ ok: boolean; reason?: string }>("/api/admin/showup", { action: "fit" });
              setMsg(x.ok ? "Model re-learned from real attendance." : x.reason ?? "Could not fit");
              load();
            }}
          >
            🎓 Learn from real attendance
          </button>
          {r.model.source === "fitted" && (
            <button className="text-slate-500 underline" onClick={async () => (await post("/api/admin/showup", { action: "reset" }), load())}>
              reset to prior
            </button>
          )}
          <span className="text-slate-500">{msg ?? `${r.canFit.reason} (${r.canFit.attended}/${r.canFit.n} attended)`}</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="card">
          <h2 className="mb-3 font-bold">⚠ Most at risk of not showing up</h2>
          {r.atRisk.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody below {Math.round(r.threshold * 100)}%.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
              {r.atRisk.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">{a.name}</span>
                    <span className="tabular-nums text-red-700">{Math.round(a.p * 100)}%</span>
                  </div>
                  <div className="text-xs text-slate-500">{a.reasons.slice(0, 3).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Registrations by language</h2>
          {r.languages.length === 0 ? (
            <p className="text-sm text-slate-500">No registrations yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {r.languages.map((l) => (
                  <tr key={l.lang} className="border-t border-slate-100 first:border-0">
                    <td className="py-1.5">{isLang(l.lang) ? `${LANGS[l.lang].native} (${LANGS[l.lang].label})` : l.lang}</td>
                    <td className="text-right tabular-nums">{l.regs}</td>
                    <td className="text-right text-xs tabular-nums text-slate-500">{l.verified} verified</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
