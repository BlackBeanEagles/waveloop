"use client";

import { useState } from "react";
import Link from "next/link";
import { post } from "@/lib/client";
import { RUBRIC } from "@/lib/rubric";

type Grade = {
  scores: Record<string, number>;
  total: number;
  strengths: string[];
  improvements: string[];
  next_step: string;
  graded_by: string;
};

export default function Submit() {
  const [f, setF] = useState({ name: "", email: "", title: "", repoUrl: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ id: number; grade: Grade } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await post<{ id?: number; grade?: Grade; error?: string }>("/api/submit", f);
    setBusy(false);
    if (r.grade && r.id) setRes({ id: r.id, grade: r.grade });
    else setErr(r.error ?? "Could not grade");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2">
      <form onSubmit={submit} className="card-pop flex flex-col gap-3 self-start">
        <div className="pill w-fit bg-brand/10 text-brand">After the workshop</div>
        <h1 className="text-2xl font-bold">Submit your project for an AI review</h1>
        <p className="text-sm text-ink-soft">You get a rubric score, specific feedback and a shareable certificate. Your certificate post on LinkedIn is the next campaign&apos;s best ad.</p>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" required placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" type="email" placeholder="Registered email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <input className="input" required placeholder="Project title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="input" placeholder="GitHub repo URL (we read the README)" value={f.repoUrl} onChange={(e) => setF({ ...f, repoUrl: e.target.value })} />
        <textarea className="input min-h-36" required placeholder="What does it do, who is it for, which AI tool/API did you use, and is it deployed?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <button className="btn-primary py-3" disabled={busy}>
          {busy ? "Reviewing your project…" : "Get my AI review"}
        </button>
      </form>

      <div>
        {!res ? (
          <div className="card-pop text-sm text-ink-soft">
            <h2 className="mb-3 font-bold text-ink">Rubric</h2>
            <ul className="space-y-2">
              {RUBRIC.map((r) => (
                <li key={r.key} className="flex justify-between rounded-lg bg-cream px-3 py-2">
                  <span>{r.label}</span>
                  <span className="font-mono">/{r.max}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs">Scored by Claude when an API key is set, otherwise by a transparent keyword heuristic (labelled on the result).</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="card-pop">
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold">Your score</h2>
                <span className="pill bg-sand text-ink-soft">graded by {res.grade.graded_by}</span>
              </div>
              <div className="my-3 text-5xl font-bold text-brand">
                {res.grade.total}
                <span className="text-xl text-ink-soft/70">/100</span>
              </div>
              <ul className="space-y-2">
                {RUBRIC.map((r) => {
                  const v = res.grade.scores[r.key] ?? 0;
                  return (
                    <li key={r.key} className="text-sm">
                      <div className="flex justify-between">
                        <span>{r.label}</span>
                        <span className="font-mono">
                          {v}/{r.max}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                        <div className="h-full bg-brand" style={{ width: `${(v / r.max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="card-pop grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1 font-bold text-green-700">Strengths</h3>
                <ul className="list-disc space-y-1 pl-4">{res.grade.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div>
                <h3 className="mb-1 font-bold text-amber-700">Improve</h3>
                <ul className="list-disc space-y-1 pl-4">{res.grade.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <p className="sm:col-span-2">
                <b>Next step:</b> {res.grade.next_step}
              </p>
            </div>
            <Link href={`/cert/${res.id}`} className="btn-primary py-3">
              View my certificate →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
