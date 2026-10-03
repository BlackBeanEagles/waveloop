"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES, YEARS, WORKSHOP_TITLE, TARGET } from "@/lib/config";
import { LANGS, t, type Lang } from "@/lib/i18n";
import { post, visitorId } from "@/lib/client";

type Idea = { title: string; pitch: string; why_it_fits_you: string; steps: string[]; tools: string[]; resume_line: string; source: string };

type Props = {
  refCode?: string;
  inviter?: { name: string; college: string };
  channel: string;
  colleges: string[];
  registered: number;
  topColleges: { name: string; n: number }[];
  workshopAt: string;
  initialLang: Lang;
};

const SKILLS = [
  ["beginner", "skill_beginner"],
  ["some projects", "skill_some"],
  ["confident", "skill_confident"],
] as const;

export default function Funnel(p: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(p.initialLang);
  const [variant, setVariant] = useState<string>("");
  const [copy, setCopy] = useState<{ headline: string; sub: string } | null>(null);
  const [vid, setVid] = useState("");
  const [stage, setStage] = useState<"idea" | "register" | "otp">("idea");
  const [idea, setIdea] = useState<Idea | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideaForm, setIdeaForm] = useState({ branch: "CSE", interest: "", skill: "beginner" });
  const [form, setForm] = useState({ name: "", email: "", phone: "", college: "", year: YEARS[0], otpVia: "email" as "email" | "whatsapp" });
  const [pending, setPending] = useState<{ userId: number; refCode: string; via: string; demoOtp?: string } | null>(null);
  const [otp, setOtp] = useState("");
  const formStarted = useRef(false);
  const tracked = useRef(false);
  const tr = (k: Parameters<typeof t>[1], v?: Record<string, string | number>) => t(lang, k, v);

  useEffect(() => {
    const id = visitorId();
    setVid(id);
    // The headline bandit runs on the English page. Other languages show their translated hero and are
    // tracked as lang:xx so they never pollute the English arms' statistics.
    if (lang !== "en") {
      setVariant(`lang:${lang}`);
      setCopy({ headline: t(lang, "hero_h"), sub: t(lang, "hero_s") });
      if (!tracked.current) {
        tracked.current = true;
        post("/api/track", { type: "page_view", visitorId: id, variant: `lang:${lang}`, channel: p.channel });
      }
      return;
    }
    const forced = new URLSearchParams(location.search).get("v");
    fetch(`/api/variant${forced ? `?v=${encodeURIComponent(forced)}` : ""}`)
      .then((r) => r.json())
      .then((v: { key: string; headline: string; sub: string }) => {
        setVariant(v.key);
        setCopy({ headline: v.headline, sub: v.sub });
        if (!tracked.current) {
          tracked.current = true;
          post("/api/track", { type: "page_view", visitorId: id, variant: v.key, channel: p.channel });
        }
      });
  }, [p.channel, lang]);

  function switchLang(l: Lang) {
    setLang(l);
    try {
      localStorage.setItem("wl_lang", l);
    } catch {}
    const u = new URL(location.href);
    u.searchParams.set("lang", l);
    history.replaceState(null, "", u);
  }

  const countdown = useCountdown(p.workshopAt);

  function startForm() {
    if (formStarted.current) return;
    formStarted.current = true;
    post("/api/track", { type: "form_started", visitorId: vid, variant, channel: p.channel });
  }

  async function getIdea(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post<{ idea?: Idea; error?: string }>("/api/idea", { ...ideaForm, lang, visitorId: vid, variant, channel: p.channel });
    setBusy(false);
    if (r.idea) {
      setIdea(r.idea);
      setStage("register");
    } else setError(r.error ?? "Something went wrong");
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await post<{ ok: boolean; error?: string; userId: number; refCode: string; otpSentVia: string; demoOtp?: string; existing?: boolean }>(
      "/api/register",
      { ...form, branch: ideaForm.branch, ref: p.refCode, channel: p.channel, variant, visitorId: vid, idea, lang },
    );
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not register");
    if (r.existing) return router.push(`/u/${r.refCode}`);
    setPending({ userId: r.userId, refCode: r.refCode, via: r.otpSentVia, demoOtp: r.demoOtp });
    setStage("otp");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    const r = await post<{ ok: boolean; error?: string }>("/api/verify", { userId: pending.userId, code: otp });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Wrong code");
    router.push(`/u/${pending.refCode}?new=1`);
  }

  async function resend() {
    if (!pending) return;
    const r = await post<{ ok: boolean; demoOtp?: string; otpSentVia?: string }>("/api/verify", { userId: pending.userId, resend: true });
    if (r.ok) setPending({ ...pending, demoOtp: r.demoOtp, via: r.otpSentVia ?? pending.via });
  }

  const pct = useMemo(() => Math.min(100, Math.round((p.registered / TARGET) * 100)), [p.registered]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" lang={lang}>
      <div className="mb-6 flex flex-wrap justify-end gap-1" role="group" aria-label="Language">
        {(Object.keys(LANGS) as Lang[]).map((l) => (
          <button key={l} onClick={() => switchLang(l)} className={`rounded-full px-3 py-1 text-sm ${l === lang ? "bg-ink text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
            {LANGS[l].native}
          </button>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="flex flex-col justify-center gap-6">
          {p.inviter && <div className="pill w-fit bg-sun/30 text-ink">🙌 {tr("invited", { name: p.inviter.name, college: p.inviter.college })}</div>}
          <div className="pill w-fit bg-brand/10 text-brand">{tr("badge")}</div>
          <h1 className={`text-4xl font-extrabold leading-tight tracking-tight transition-opacity sm:text-5xl ${copy ? "opacity-100" : "opacity-0"}`}>
            {copy?.headline ?? tr("hero_h")}
          </h1>
          <p className={`text-lg text-slate-600 transition-opacity ${copy ? "opacity-100" : "opacity-0"}`}>{copy?.sub ?? " "}</p>

          <div className="grid grid-cols-3 gap-3 text-center">
            {countdown.map(([n, k]) => (
              <div key={k} className="card p-3">
                <div className="text-2xl font-bold tabular-nums">{n}</div>
                <div className="text-xs text-slate-500">{tr(k)}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold">{tr("registered_count", { n: p.registered })}</span>
              <span className="text-slate-500">{tr("seats", { n: TARGET })}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            {p.topColleges.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {tr("leading")}: {p.topColleges.map((c) => `${c.name} (${c.n})`).join(" · ")}
              </p>
            )}
          </div>

          <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {(["b1", "b2", "b3", "b4"] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <span className="text-brand">✓</span>
                {tr(k)}
              </li>
            ))}
          </ul>
        </section>

        <section className="card self-start p-6">
          <Steps stage={stage} labels={[tr("step_idea"), tr("step_register"), tr("step_verify")]} />
          {error && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {stage === "idea" && (
            <form onSubmit={getIdea} className="flex flex-col gap-4" onFocus={startForm}>
              <div>
                <h2 className="text-xl font-bold">{tr("idea_title")}</h2>
                <p className="text-sm text-slate-500">{tr("idea_sub")}</p>
              </div>
              <div>
                <label className="label">{tr("branch")}</label>
                <select className="input" value={ideaForm.branch} onChange={(e) => setIdeaForm({ ...ideaForm, branch: e.target.value })}>
                  {BRANCHES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{tr("interest")}</label>
                <input className="input" required maxLength={80} placeholder={tr("interest_ph")} value={ideaForm.interest} onChange={(e) => setIdeaForm({ ...ideaForm, interest: e.target.value })} />
              </div>
              <div>
                <label className="label">{tr("skill")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {SKILLS.map(([value, key]) => (
                    <button type="button" key={value} onClick={() => setIdeaForm({ ...ideaForm, skill: value })} className={`btn ${ideaForm.skill === value ? "bg-brand text-white" : "border border-slate-300 bg-white"}`}>
                      {tr(key)}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn-primary py-3 text-base" disabled={busy}>
                {busy ? tr("gen_busy") : tr("gen_btn")}
              </button>
            </form>
          )}

          {stage !== "idea" && idea && <IdeaCard idea={idea} compact={stage === "otp"} labels={{ your: tr("your_project"), ai: tr("ai_generated"), tpl: tr("template") }} />}

          {stage === "register" && (
            <form onSubmit={register} className="mt-5 flex flex-col gap-3">
              <h2 className="text-lg font-bold">{tr("lock_title")}</h2>
              <input className="input" required placeholder={tr("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input" required type="email" placeholder={tr("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="input" required inputMode="numeric" placeholder={tr("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <input className="input" required list="colleges" placeholder={tr("college")} value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
              <datalist id="colleges">
                {p.colleges.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <select className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {tr("send_code_via")}
                {(["email", "whatsapp"] as const).map((v) => (
                  <label key={v} className="flex items-center gap-1">
                    <input type="radio" checked={form.otpVia === v} onChange={() => setForm({ ...form, otpVia: v })} /> {v === "email" ? tr("email") : "WhatsApp"}
                  </label>
                ))}
              </div>
              <button className="btn-primary py-3 text-base" disabled={busy}>
                {busy ? tr("saving") : tr("register_btn")}
              </button>
              <button type="button" className="text-xs text-slate-500 underline" onClick={() => setStage("idea")}>
                {tr("try_other")}
              </button>
            </form>
          )}

          {stage === "otp" && pending && (
            <form onSubmit={verify} className="mt-5 flex flex-col gap-3">
              <h2 className="text-lg font-bold">{tr("otp_title")}</h2>
              {pending.via === "demo" ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {tr("demo_note")} <b className="font-mono text-base">{pending.demoOtp}</b>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{tr("otp_sent", { via: pending.via })}</p>
              )}
              <input className="input text-center font-mono text-2xl tracking-[0.5em]" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              <button className="btn-primary py-3" disabled={busy || otp.length !== 6}>
                {busy ? tr("checking") : tr("verify_btn")}
              </button>
              <button type="button" onClick={resend} className="text-xs text-slate-500 underline">
                {tr("resend")}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-xs text-slate-400">{WORKSHOP_TITLE}</p>
        </section>
      </div>
    </div>
  );
}

function Steps({ stage, labels }: { stage: string; labels: string[] }) {
  const keys = ["idea", "register", "otp"];
  const idx = keys.indexOf(stage);
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs font-semibold">
      {keys.map((k, i) => (
        <li key={k} className={`flex items-center gap-2 ${i <= idx ? "text-brand" : "text-slate-400"}`}>
          <span className={`grid h-6 w-6 place-items-center rounded-full ${i <= idx ? "bg-brand text-white" : "bg-slate-100"}`}>{i + 1}</span>
          {labels[i]}
          {i < keys.length - 1 && <span className="h-px w-6 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}

export function IdeaCard({ idea, compact = false, labels }: { idea: Idea; compact?: boolean; labels?: { your: string; ai: string; tpl: string } }) {
  const l = labels ?? { your: "Your workshop project", ai: "AI-generated", tpl: "Template" };
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-dark to-brand p-5 text-white">
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
        <span>{l.your}</span>
        <span>{idea.source === "claude" ? l.ai : l.tpl}</span>
      </div>
      <h3 className="text-2xl font-extrabold">{idea.title}</h3>
      <p className="mt-1 text-white/90">{idea.pitch}</p>
      {!compact && (
        <>
          <p className="mt-3 text-sm text-white/80">{idea.why_it_fits_you}</p>
          <ol className="mt-3 space-y-1 text-sm">
            {idea.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-sun">{(i + 1) * 15}m</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-1">
            {idea.tools.map((tool) => (
              <span key={tool} className="pill bg-white/15 text-white">
                {tool}
              </span>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm italic">📄 {idea.resume_line}</p>
        </>
      )}
    </div>
  );
}

function useCountdown(iso: string): [string, "days" | "hours" | "mins"][] {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [iso]);
  if (left === null)
    return [
      ["–", "days"],
      ["–", "hours"],
      ["–", "mins"],
    ];
  return [
    [String(Math.floor(left / 86_400_000)), "days"],
    [String(Math.floor((left % 86_400_000) / 3_600_000)), "hours"],
    [String(Math.floor((left % 3_600_000) / 60_000)), "mins"],
  ];
}
