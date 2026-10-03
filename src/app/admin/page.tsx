"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { CHANNEL_LABEL } from "@/lib/config";
import { post } from "@/lib/client";
import Copilot from "@/components/admin/Copilot";
import Variants, { type V } from "@/components/admin/Variants";
import ReferralTree from "@/components/admin/ReferralTree";
import ShowUp from "@/components/admin/ShowUp";
import Webhooks from "@/components/admin/Webhooks";

// Validated categorical slots 1-2 (reference palette, in fixed order).
const S1 = "#2a78d6";
const S2 = "#eb6834";
const GRID = "#e5e7eb";

type D = {
  integrations: Record<string, boolean>;
  clock: { dayNumber: number; workshop: string };
  kpis: { counted: number; registered: number; verified: number; flagged: number; attended: number; viaReferral: number; kFactor: number; projected: number; neededPerDay: number; costPerReg: number; target: number };
  funnel: { stage: string; value: number }[];
  series: { day: string; registrations: number | null; cumulative: number | null; target: number }[];
  byChannel: { channel: string; regs: number; verified: number }[];
  ambassadors: { name: string; code: string; college: string; regs: number; verified: number; groups: number }[];
  fraudQueue: { id: number; name: string; email: string; fraud_score: number; reasons: string[]; created_at: string }[];
  outbox: { template: string; status: string; n: number }[];
};
type OutMsg = { id: number; name: string; template: string; body: string; send_at: string; status: string; provider: string | null };

export default function Admin() {
  const [d, setD] = useState<D | null>(null);
  const [msgs, setMsgs] = useState<OutMsg[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [variants, setVariants] = useState<V[]>([]);
  const [tick, setTick] = useState(0);
  const [key, setKey] = useState("");

  const load = useCallback(async () => {
    const [m, o] = await Promise.all([fetch("/api/admin/metrics", { cache: "no-store" }), fetch("/api/admin/drip", { cache: "no-store" })]);
    if (m.status === 403) return setLocked(true);
    setLocked(false);
    if (m.ok) setD(await m.json());
    if (o.ok) setMsgs((await o.json()).messages);
    const v = await fetch("/api/admin/variants", { cache: "no-store" });
    if (v.ok) setVariants((await v.json()).variants);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      load();
      setTick((x) => x + 1);
    }, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function action(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    const r = await fn();
    setNote(label === "drip" ? `Drip run: ${JSON.stringify(r)}` : null);
    setBusy(null);
    load();
  }

  if (locked)
    return (
      <form
        className="card mx-auto mt-16 flex max-w-sm flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await post<{ ok: boolean; error?: string }>("/api/admin/login", { key });
          if (r.ok) load();
          else setNote(r.error ?? "Wrong key");
        }}
      >
        <h1 className="text-lg font-bold">Admin login</h1>
        {note && <div className="text-sm text-red-700">{note}</div>}
        <input className="input" type="password" placeholder="Admin key" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn-primary">Open dashboard</button>
      </form>
    );
  if (!d) return <div className="p-10 text-center text-slate-500">Loading dashboard…</div>;
  const k = d.kpis;
  const onTrack = k.projected >= k.target;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Growth dashboard</h1>
          <p className="text-slate-500">
            Day {d.clock.dayNumber} of 7 · target {k.target} verified registrations · ₹2,000 spent on referral prizes, ₹0 on ads
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(d.integrations).map(([key, on]) => (
              <span key={key} className={`pill ${on ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                {on ? "●" : "○"} {key}: {on ? "live" : "mock"}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!!busy} onClick={() => action("drip", () => post("/api/admin/drip", {}))}>
            {busy === "drip" ? "Sending…" : "✉ Run drip now"}
          </button>
          <a className="btn-ghost" href="/api/admin/export">
            ⬇ Export CSV
          </a>
          <button
            className="btn-ghost text-red-700"
            disabled={!!busy}
            onClick={() => confirm("Delete ALL registrations, events and messages and restart the 7-day clock from now? This cannot be undone.") && action("reset", () => post("/api/admin/reset", { action: "clear" }))}
          >
            {busy === "reset" ? "Clearing…" : "🗑 Clear all data"}
          </button>
        </div>
      </div>
      {note && <div className="mb-4 rounded-xl bg-blue-50 px-3 py-2 font-mono text-xs text-blue-900">{note}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi big={`${k.counted}`} sub={`of ${k.target} counted`} hint="Verified and not flagged" />
        <Kpi big={`${k.projected}`} sub="projected by day 7" tone={onTrack ? "good" : "bad"} hint={onTrack ? "On track" : "Behind pace"} />
        <Kpi big={`${k.neededPerDay}/day`} sub="needed from here" hint="To hit target" />
        <Kpi big={k.kFactor.toFixed(2)} sub="viral coefficient" hint="Referral sign-ups per seed sign-up" />
        <Kpi big={`${k.flagged}`} sub="flagged as fraud" hint="Held out of the leaderboard" />
        <Kpi big={`${k.attended}`} sub="checked in live" hint={k.counted ? `${Math.round((k.attended / k.counted) * 100)}% show-up rate` : "Attendance"} />
      </div>

      <Copilot onVariantAdded={load} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Cumulative registrations vs target pace">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line name="Actual" dataKey="cumulative" stroke={S1} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
              <Line name="Target pace" dataKey="target" stroke={S2} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Funnel (unique visitors → sharers)">
          <ol className="space-y-2">
            {d.funnel.map((f, i) => {
              const top = d.funnel[0].value || 1;
              const prev = i ? d.funnel[i - 1].value : f.value;
              const step = prev ? Math.round((f.value / prev) * 100) : 0;
              return (
                <li key={f.stage} className="text-sm" title={`${f.value} (${step}% of previous step)`}>
                  <div className="mb-1 flex justify-between">
                    <span>{f.stage}</span>
                    <span className="tabular-nums text-slate-600">
                      {f.value.toLocaleString("en-IN")} {i > 0 && <span className="text-xs text-slate-400">· {step}%</span>}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded" style={{ width: `${(f.value / top) * 100}%`, background: S1 }} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Biggest drop is the step to fix next. Hover a row for the step conversion.</p>
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Verified registrations by channel">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.byChannel.map((c) => ({ ...c, label: CHANNEL_LABEL[c.channel] ?? c.channel }))} layout="vertical" margin={{ left: 30, right: 24 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: "#52514e" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="verified" name="Verified" fill={S1} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Variants variants={variants} reload={load} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Campus ambassadors">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Ambassador</th>
                <th>Groups</th>
                <th>Regs</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {d.ambassadors.map((a) => (
                <tr key={a.code} className="border-t border-slate-100">
                  <td className="py-2">
                    <a href={`/ambassador/${a.code}`} className="font-semibold hover:underline">
                      {a.name}
                    </a>
                    <div className="text-xs text-slate-500">{a.college}</div>
                  </td>
                  <td className="tabular-nums">{a.groups}</td>
                  <td className="tabular-nums">{a.regs}</td>
                  <td className="tabular-nums font-semibold">{a.verified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={`Fraud review queue (${d.fraudQueue.length})`}>
          {d.fraudQueue.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing flagged.</p>
          ) : (
            <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {d.fraudQueue.map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-xs text-slate-500">{f.email}</div>
                    </div>
                    <span className="pill bg-red-100 text-red-800">⚠ risk {f.fraud_score}</span>
                  </div>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                    {f.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => action("fraud", () => post("/api/admin/fraud", { id: f.id, action: "approve" }))}>
                      Approve
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs text-red-700" onClick={() => action("fraud", () => post("/api/admin/fraud", { id: f.id, action: "reject" }))}>
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ShowUp refreshKey={Math.floor(tick / 3)} />

      <div className="mb-6">
        <ReferralTree refreshKey={Math.floor(tick / 3)} />
      </div>

      <HelpDeskCard refreshKey={tick} />

      <Webhooks refreshKey={Math.floor(tick / 3)} />

      <Panel title="WhatsApp drip engine">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {summarizeOutbox(d.outbox).map(([t, s]) => (
            <span key={t} className="pill bg-slate-100 text-slate-700">
              {t}: {s}
            </span>
          ))}
        </div>
        {msgs.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Register on the student page to queue the 6-step sequence.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1">To</th>
                  <th>Step</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {msgs.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-2 font-semibold">{m.name}</td>
                    <td className="pr-2 font-mono text-xs">{m.template}</td>
                    <td className="pr-2 text-xs text-slate-500">{new Date(m.send_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="pr-2 text-xs">
                      {m.status}
                      {m.provider && <div className="text-slate-400">{m.provider}</div>}
                    </td>
                    <td className="max-w-md text-xs text-slate-600">{m.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Rules are checked at send time: no referral nudge to people who already referred, no project reminder to no-shows. Runs on Vercel Cron in production.
        </p>
      </Panel>
    </div>
  );
}

function HelpDeskCard({ refreshKey }: { refreshKey: number }) {
  const [s, setS] = useState<{ total: number; selfSolved: number; waiting: number; noFeedback: number; deflection: number } | null>(null);
  useEffect(() => {
    fetch("/api/admin/helpdesk", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setS(d.stats));
  }, [refreshKey]);
  if (!s) return null;
  return (
    <div className="card mb-6 flex flex-wrap items-center gap-6">
      <div>
        <h2 className="font-bold">Live help desk</h2>
        <p className="text-xs text-slate-500">AI answers first; mentors only get what it can&apos;t fix.</p>
      </div>
      {[
        [s.total, "requests"],
        [s.selfSolved, "fixed by AI"],
        [s.waiting, "⚠ waiting for mentor"],
        [`${Math.round(s.deflection * 100)}%`, "solved without mentor"],
      ].map(([n, l]) => (
        <div key={String(l)} className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">{n}</div>
          <div className="text-xs text-slate-500">{l}</div>
        </div>
      ))}
      <a href="/mentor" className="btn-ghost ml-auto">
        Open mentor queue →
      </a>
    </div>
  );
}

function summarizeOutbox(rows: D["outbox"]) {
  const by: Record<string, number> = {};
  for (const r of rows) by[r.status] = (by[r.status] ?? 0) + r.n;
  return Object.entries(by);
}

function Kpi({ big, sub, hint, tone }: { big: string; sub: string; hint: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4" title={hint}>
      <div className={`text-2xl font-extrabold tabular-nums ${tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-700" : "text-ink"}`}>{big}</div>
      <div className="text-xs text-slate-500">{sub}</div>
      <div className="mt-1 text-[11px] text-slate-400">
        {tone === "good" ? "✓ " : tone === "bad" ? "⚠ " : ""}
        {hint}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-4 font-bold">{title}</h2>
      {children}
    </div>
  );
}
