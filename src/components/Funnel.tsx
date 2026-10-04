"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES, YEARS, WORKSHOP_TITLE, TARGET } from "@/lib/config";
import { LANGS, t, type Lang } from "@/lib/i18n";
import { post, visitorId } from "@/lib/client";
import { Bubble, Burst, Caption, ReferralNetwork, SpeedLines } from "@/components/Art";

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

  // Fixed locale and zone, so server and browser render the identical string.
  const workshopLabel = new Date(p.workshopAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) + " IST · live, 60 minutes";

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

  const stickerColors = ["bg-sunny", "bg-mint", "bg-lilac", "bg-pink"];
  const tilts = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3"];

  return (
    <div lang={lang}>
      <IdeaMarquee />
      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="relative mb-6 flex flex-wrap justify-end gap-2" role="group" aria-label="Language">
          {(Object.keys(LANGS) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold transition ${l === lang ? "bg-ink text-white" : "bg-paper text-ink hover:bg-sunny"}`}
            >
              {LANGS[l].native}
            </button>
          ))}
        </div>
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <section className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
            {p.inviter && <div className="sticker w-fit -rotate-1 bg-pink">🙌 {tr("invited", { name: p.inviter.name, college: p.inviter.college })}</div>}

            <div className="card-pop relative -rotate-[0.6deg] overflow-hidden bg-[#fff6d6] p-5 sm:p-8">
              <SpeedLines className="-right-24 -top-24 h-[460px] w-[460px] rotate-90" />
              <Burst text="FREE!" className="absolute right-1 top-1 h-[4.5rem] w-[4.5rem] rotate-12 sm:right-5 sm:top-5 sm:h-28 sm:w-28" />
              <Caption className="relative mr-14 text-sm sm:mr-0 sm:text-base">{lang === "en" ? "Meanwhile, in placement season…" : tr("badge")}</Caption>
              <h1 className={`comic-title relative mt-6 text-[2.6rem] transition-opacity sm:pr-28 sm:text-6xl ${copy ? "opacity-100" : "opacity-0"}`}>
                {copy?.headline ?? tr("hero_h")}
              </h1>
              <p className={`relative mt-5 max-w-xl text-lg font-medium text-ink-soft transition-opacity ${copy ? "opacity-100" : "opacity-0"}`}>{copy?.sub ?? " "}</p>
              {lang === "en" && (
                <div className="relative mt-6 flex flex-col items-start">
                  <Bubble>my resume has zero AI projects 😰 and placements start next month…</Bubble>
                  <div className="ml-2 mt-5 flex items-center gap-2">
                    <span className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-ink bg-paper text-2xl" aria-hidden>
                      🧑‍🎓
                    </span>
                    <span className="font-[family-name:var(--font-hand)] text-xl text-ink-soft">every final-year, ever</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {tr("badge")
                .split(" · ")
                .map((part, i) => (
                  <span key={part} className={`sticker ${stickerColors[i % 4]} ${tilts[i % 4]}`}>
                    {part}
                  </span>
                ))}
              <p className="sticker bg-paper">
                <span aria-hidden>📅</span>
                {workshopLabel}
              </p>
            </div>

          </section>

          <div className="flex flex-col gap-6 self-start lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <section className="card-pop relative rotate-[0.4deg] p-6 pt-8">
              <Caption className="absolute -left-2 -top-5 -rotate-2 text-sm">{lang === "en" ? "Chapter 1: your project" : "✨ AI"}</Caption>
              <Burst text="AI!" className="absolute -right-4 -top-6 h-16 w-16 rotate-12" fill="#A6EBCF" />
              <Steps stage={stage} labels={[tr("step_idea"), tr("step_register"), tr("step_verify")]} />
              {error && <div className="mb-4 rounded-xl border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

              {stage === "idea" && (
                <form onSubmit={getIdea} className="flex flex-col gap-4" onFocus={startForm}>
                  <div>
                    <h2 className="comic-title text-4xl [text-shadow:2px_2px_0_#ffd84d]">{tr("idea_title")}</h2>
                    <p className="text-sm text-ink-soft">{tr("idea_sub")}</p>
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
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {INTERESTS.map(([emoji, word]) => (
                        <button
                          type="button"
                          key={word}
                          onClick={() => setIdeaForm({ ...ideaForm, interest: word })}
                          className={`rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold transition ${ideaForm.interest === word ? "border-ink bg-sunny" : "border-ink/20 bg-paper hover:border-ink"}`}
                        >
                          {emoji} {word}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">{tr("skill")}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SKILLS.map(([value, key]) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setIdeaForm({ ...ideaForm, skill: value })}
                          className={`btn border-2 ${ideaForm.skill === value ? "border-ink bg-ink text-white" : "border-ink/20 bg-paper hover:border-ink"}`}
                        >
                          {tr(key)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary py-3.5 text-base" disabled={busy}>
                    {busy ? tr("gen_busy") : tr("gen_btn")}
                  </button>
                </form>
              )}

              {stage !== "idea" && idea && <IdeaCard idea={idea} reveal={stage === "register"} compact={stage === "otp"} labels={{ your: tr("your_project"), ai: tr("ai_generated"), tpl: tr("template") }} />}

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
                  <div className="flex items-center gap-3 text-sm text-ink-soft">
                    {tr("send_code_via")}
                    {(["email", "whatsapp"] as const).map((v) => (
                      <label key={v} className="flex items-center gap-1">
                        <input type="radio" checked={form.otpVia === v} onChange={() => setForm({ ...form, otpVia: v })} /> {v === "email" ? tr("email") : "WhatsApp"}
                      </label>
                    ))}
                  </div>
                  <button className="btn-primary py-3.5 text-base" disabled={busy}>
                    {busy ? tr("saving") : tr("register_btn")}
                  </button>
                  <button type="button" className="text-xs text-ink-soft underline" onClick={() => setStage("idea")}>
                    {tr("try_other")}
                  </button>
                </form>
              )}

              {stage === "otp" && pending && (
                <form onSubmit={verify} className="mt-5 flex flex-col gap-3">
                  <h2 className="text-lg font-bold">{tr("otp_title")}</h2>
                  {pending.via === "demo" ? (
                    <div className="rounded-xl border-2 border-ink bg-sunny/50 px-3 py-2 text-sm">
                      {tr("demo_note")} <b className="font-mono text-base">{pending.demoOtp}</b>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-soft">{tr("otp_sent", { via: pending.via })}</p>
                  )}
                  <input className="input text-center font-mono text-2xl tracking-[0.5em]" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
                  <button className="btn-primary py-3.5" disabled={busy || otp.length !== 6}>
                    {busy ? tr("checking") : tr("verify_btn")}
                  </button>
                  <button type="button" onClick={resend} className="text-xs text-ink-soft underline">
                    {tr("resend")}
                  </button>
                </form>
              )}
              <p className="mt-4 text-center text-xs text-ink-soft/70">{WORKSHOP_TITLE}</p>
            </section>

            <div className="card-pop relative hidden -rotate-[0.5deg] bg-lilac/50 lg:block">
              <Caption className="absolute -top-5 left-4 bg-paper text-sm">The plot twist</Caption>
              <div className="flex items-center gap-4 pt-2">
                <ReferralNetwork className="h-32 w-40 shrink-0" />
                <div>
                                    <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold leading-snug">You → 4 friends → their friends.</p>
                  <p className="mt-1 text-sm text-ink-soft">Every sign-up gets a link. Bring your squad and your college climbs the leaderboard.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
            <div className="mt-4 grid gap-9 sm:grid-cols-2 sm:gap-7">
              <div className="card-pop halftone relative -rotate-1 bg-sunny/60">
                <Caption className="-mt-9 mb-2 bg-paper text-sm">Seats filling up!</Caption>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-[family-name:var(--font-comic)] text-6xl tabular-nums">{p.registered}</span>
                  <span className="text-sm font-semibold text-ink-soft">/ {TARGET}</span>
                </div>
                <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-paper">
                  <div
                    className="h-full bg-brand bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.25)_0_8px,transparent_8px_16px)]"
                    style={{ width: `${Math.max(pct, p.registered > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-ink-soft">{tr("registered_count", { n: p.registered })}</p>
                {p.topColleges.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {p.topColleges.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2">
                        <span aria-hidden>{["🥇", "🥈", "🥉"][i]}</span>
                        <span className="flex-1 truncate font-semibold">{c.name}</span>
                        <span className="tabular-nums">{c.n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ResumeWidget />
            </div>

            <ul className="flex flex-wrap gap-2 text-sm">
              {(["b1", "b2", "b3", "b4"] as const).map((k, i) => (
                <li key={k} className={`flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 font-semibold ${["bg-paper", "bg-mint/50", "bg-lilac/50", "bg-pink/50"][i]}`}>
                  <span aria-hidden>{["🚀", "💻", "🏅", "📄"][i]}</span>
                  {tr(k)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Example projects scrolling across the top. Clearly examples, not claims about users.
const MARQUEE = [
  "🏏 IPL win predictor",
  "🌾 Crop doctor in Telugu",
  "📄 Resume vs JD matcher",
  "🎬 Movie mood recommender",
  "⚡ Electricity bill explainer",
  "🔌 Circuit doubt solver",
  "🏗 Site safety checker",
  "🎮 Game bug summariser",
  "🎵 Lyrics-to-playlist bot",
  "📈 Stock news explainer",
];

function IdeaMarquee() {
  const row = [...MARQUEE, ...MARQUEE];
  return (
    <div className="overflow-hidden border-b-2 border-ink bg-sunny py-2" aria-label="Example projects you could build">
      <div className="flex w-max animate-marquee gap-3 whitespace-nowrap">
        <span className="px-3 text-sm font-bold">Things you could build in 60 min →</span>
        {row.map((t, i) => (
          <span key={i} className="rounded-full border-2 border-ink bg-paper px-3 py-0.5 text-sm font-semibold">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

const INTERESTS: [string, string][] = [
  ["🏏", "cricket"],
  ["🎬", "movies"],
  ["🎮", "gaming"],
  ["🎵", "music"],
  ["📈", "stocks"],
  ["🌾", "farming"],
  ["⚽", "football"],
  ["🍳", "food"],
];

// Before/after: what one workshop adds to a final-year resume.
function ResumeWidget() {
  return (
    <div className="card-pop relative rotate-1 bg-mint/50">
      <Caption className="-mt-9 mb-2 bg-paper text-sm">Resume glow-up</Caption>
      <div className="mt-2 rounded-xl border-2 border-ink bg-paper p-3 text-xs">
        <p className="font-bold uppercase tracking-wide text-ink-soft">Projects</p>
        <p className="mt-1.5 text-ink-soft line-through decoration-2">Library management system (2nd year)</p>
        <p className="mt-1.5 rounded bg-sunny/70 px-1 font-semibold text-ink">+ Built &amp; deployed an AI app live in 60 min</p>
        <p className="mt-1.5 text-ink-soft">+ GitHub link · live demo · certificate</p>
      </div>
      <p className="mt-2 rotate-[-2deg] font-[family-name:var(--font-hand)] text-xl text-brand">the line interviewers ask about</p>
    </div>
  );
}

function Steps({ stage, labels }: { stage: string; labels: string[] }) {
  const keys = ["idea", "register", "otp"];
  const idx = keys.indexOf(stage);
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs font-semibold">
      {keys.map((k, i) => (
        <li key={k} className={`flex items-center gap-2 ${i <= idx ? "text-ink" : "text-ink-soft"}`}>
          <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-ink ${i <= idx ? "bg-brand text-white" : "bg-paper text-ink"}`}>{i + 1}</span>
          {labels[i]}
          {i < keys.length - 1 && <span className="h-0.5 w-6 bg-ink/30" />}
        </li>
      ))}
    </ol>
  );
}

export function IdeaCard({ idea, compact = false, labels, reveal = false }: { idea: Idea; compact?: boolean; labels?: { your: string; ai: string; tpl: string }; reveal?: boolean }) {
  const l = labels ?? { your: "Your workshop project", ai: "AI-generated", tpl: "Template" };
  return (
    <div className={`relative ${reveal ? "animate-pop-in" : ""}`}>
    {reveal && <Burst text="KA-POW!" className="pointer-events-none absolute -right-4 -top-8 z-20 h-28 w-28 animate-kapow" />}
    <div className="relative overflow-hidden rounded-[6px] border-[3px] border-ink bg-gradient-to-br from-ink to-[#24406b] p-5 text-white shadow-[5px_5px_0_0_#f08a4b]">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,216,77,0.35)_1.4px,transparent_1.6px)] [background-size:11px_11px]" />
      <div className="relative mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
        <span>{l.your}</span>
        <span>{idea.source === "template" ? l.tpl : l.ai}</span>
      </div>
      <h3 className="relative text-2xl font-bold">{idea.title}</h3>
      <p className="relative mt-1 text-white/90">{idea.pitch}</p>
      {!compact && (
        <>
          <p className="relative mt-3 text-sm text-white/80">{idea.why_it_fits_you}</p>
          <ol className="relative mt-3 space-y-1 text-sm">
            {idea.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-9 shrink-0 font-mono text-sun">{(i + 1) * 15}m</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="relative mt-3 flex flex-wrap gap-1">
            {idea.tools.map((tool) => (
              <span key={tool} className="pill bg-white/15 text-white">
                {tool}
              </span>
            ))}
          </div>
          <p className="relative mt-3 rounded-xl bg-white/10 p-3 text-sm italic">📄 {idea.resume_line}</p>
        </>
      )}
    </div>
    </div>
  );
}
