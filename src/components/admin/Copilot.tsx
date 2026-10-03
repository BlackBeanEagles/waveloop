"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";

type Output = {
  headline_finding: string;
  data_sufficient: boolean;
  biggest_leak: { from_stage: string; to_stage: string; conversion_pct: number; why_it_matters: string };
  actions: { title: string; hypothesis: string; change: string; success_metric: string; effort: string }[];
  new_variants: { headline: string; sub: string; rationale: string }[];
  whatsapp_post: string;
  risks: string[];
};
type Run = { id: number; output: Output; engine: string; created_at: string };

export default function Copilot({ onVariantAdded }: { onVariantAdded: () => void }) {
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/copilot")
      .then((r) => r.json())
      .then((d) => setRun(d.run));
  }, []);

  async function analyse() {
    setBusy(true);
    setErr(null);
    const r = await post<{ run?: Run; error?: string }>("/api/admin/copilot", {});
    setBusy(false);
    if (r.run) {
      setRun(r.run);
      setAdded({});
    } else setErr(r.error ?? "Copilot failed");
  }

  async function addVariant(i: number) {
    if (!run) return;
    const v = run.output.new_variants[i];
    const r = await post<{ key?: string }>("/api/admin/variants", { action: "add", headline: v.headline, sub: v.sub, source: "copilot" });
    if (r.key) {
      setAdded({ ...added, [i]: r.key });
      onVariantAdded();
    }
  }

  const o = run?.output;
  return (
    <div className="card mb-6 border-brand/30 bg-gradient-to-br from-white to-brand/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🧠 Growth copilot</h2>
          <p className="text-xs text-slate-500">
            Reads the live numbers, finds the biggest leak, proposes the next 3 experiments and writes new headlines for the bandit.
            {run && ` Last run ${new Date(run.created_at).toLocaleTimeString()} · ${run.engine === "claude" ? "Claude" : "rules engine (no API key)"}`}
          </p>
        </div>
        <button className="btn-primary" disabled={busy} onClick={analyse}>
          {busy ? "Analysing live data…" : run ? "↻ Re-analyse" : "Analyse my campaign"}
        </button>
      </div>
      {err && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {!o ? (
        <p className="text-sm text-slate-500">No analysis yet. Click the button. It only uses your real data.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl px-4 py-3 text-sm ${o.data_sufficient ? "bg-brand/10 text-ink" : "bg-amber-50 text-amber-900"}`}>
            <b>{o.data_sufficient ? "Finding: " : "⚠ "}</b>
            {o.headline_finding}
          </div>
          {o.data_sufficient && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="pill bg-red-100 text-red-800">
                ⚠ Leak: {o.biggest_leak.from_stage} → {o.biggest_leak.to_stage} · {o.biggest_leak.conversion_pct}%
              </span>
              <span className="text-slate-600">{o.biggest_leak.why_it_matters}</span>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-3">
            {o.actions.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-bold">
                    {i + 1}. {a.title}
                  </span>
                  <span className="pill shrink-0 bg-slate-100 text-slate-600">{a.effort}</span>
                </div>
                <p className="text-slate-600">
                  <b className="text-ink">Why:</b> {a.hypothesis}
                </p>
                <p className="mt-1 text-slate-600">
                  <b className="text-ink">Do:</b> {a.change}
                </p>
                <p className="mt-1 text-xs text-slate-500">Measure: {a.success_metric}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-bold">New headlines to test</h3>
              <ul className="space-y-3">
                {o.new_variants.map((v, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className="flex-1">
                      <div className="font-semibold">{v.headline}</div>
                      <div className="text-slate-600">{v.sub}</div>
                      <div className="text-xs text-slate-400">{v.rationale}</div>
                    </div>
                    <button className="btn-ghost shrink-0 px-2 py-1 text-xs" disabled={!!added[i]} onClick={() => addVariant(i)}>
                      {added[i] ? `✓ live as ${added[i]}` : "+ Add to bandit"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="mb-2 font-bold">Ambassador post</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-[#d9fdd3] p-3 font-sans">{o.whatsapp_post}</pre>
              <button className="btn-ghost mt-2 px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(o.whatsapp_post)}>
                Copy
              </button>
              <h3 className="mb-1 mt-3 font-bold">Risks</h3>
              <ul className="list-disc space-y-1 pl-4 text-slate-600">
                {o.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
