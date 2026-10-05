"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BRANCHES, YEARS, TARGET } from "@/lib/config";
import { LANGS, t, type Lang } from "@/lib/i18n";
import { post, visitorId } from "@/lib/client";
import Link from "next/link";
import CampusCover from "@/components/CampusCover";
import QuestConsole from "@/components/QuestConsole";
import { useQuestGame } from "@/components/QuestGame";

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
  const { award } = useQuestGame();
  const [lang, setLang] = useState<Lang>(p.initialLang);
  const [englishVariant, setVariant] = useState<string>("");
  const [englishCopy, setCopy] = useState<{ headline: string; sub: string } | null>(null);
  const variant = lang === "en" ? englishVariant : `lang:${lang}`;
  const copy = lang === "en" ? englishCopy : { headline: t(lang, "hero_h"), sub: t(lang, "hero_s") };
  const vid = useRef("");
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
    vid.current = id;
    let active = true;
    // The headline bandit runs on the English page. Other languages show their translated hero and are
    // tracked as lang:xx so they never pollute the English arms' statistics.
    if (lang !== "en") {
      if (!tracked.current) {
        tracked.current = true;
        post("/api/track", { type: "page_view", visitorId: id, variant: `lang:${lang}`, channel: p.channel }).catch(() => {});
      }
      return;
    }
    const forced = new URLSearchParams(location.search).get("v");
    fetch(`/api/variant${forced ? `?v=${encodeURIComponent(forced)}` : ""}`)
      .then((r) => r.json())
      .then((v: { key: string; headline: string; sub: string }) => {
        if (!active) return;
        setVariant(v.key);
        setCopy({ headline: v.headline, sub: v.sub });
        if (!tracked.current) {
          tracked.current = true;
          post("/api/track", { type: "page_view", visitorId: id, variant: v.key, channel: p.channel }).catch(() => {});
        }
      }).catch(() => {
        if (!active) return;
        setVariant("unavailable");
        setCopy({ headline: t(lang, "hero_h"), sub: t(lang, "hero_s") });
      });
    return () => { active = false; };
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
    post("/api/track", { type: "form_started", visitorId: vid.current || visitorId(), variant, channel: p.channel }).catch(() => {});
  }

  async function request(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch { setError("We couldn’t connect. Please try again; your details are still here."); }
    finally { setBusy(false); }
  }

  async function getIdea(e: React.FormEvent) {
    e.preventDefault();
    await request(async () => {
      const r = await post<{ idea?: Idea; error?: string }>("/api/idea", { ...ideaForm, lang, visitorId: vid.current, variant, channel: p.channel });
      if (r.idea) { setIdea(r.idea); setStage("register"); award("choose_project"); award("build_plan"); }
      else setError(r.error ?? "Something went wrong");
    });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    await request(async () => {
    const r = await post<{ ok: boolean; error?: string; userId: number; refCode: string; otpSentVia: string; demoOtp?: string; existing?: boolean }>(
      "/api/register",
      { ...form, branch: ideaForm.branch, ref: p.refCode, channel: p.channel, variant, visitorId: vid.current, idea, lang },
    );
    if (!r.ok) return setError(r.error ?? "Could not register");
    if (r.existing) return router.push(`/u/${r.refCode}`);
    setPending({ userId: r.userId, refCode: r.refCode, via: r.otpSentVia, demoOtp: r.demoOtp });
    setStage("otp");
    award("register");
    });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    await request(async () => {
    const r = await post<{ ok: boolean; error?: string }>("/api/verify", { userId: pending.userId, code: otp });
    if (!r.ok) return setError(r.error ?? "Wrong code");
    award("verified");
    router.push(`/u/${pending.refCode}?new=1`);
    });
  }

  async function resend() {
    if (!pending) return;
    await request(async () => {
      const r = await post<{ ok: boolean; error?: string; demoOtp?: string; otpSentVia?: string }>("/api/verify", { userId: pending.userId, resend: true });
      if (r.ok) setPending({ ...pending, demoOtp: r.demoOtp, via: r.otpSentVia ?? pending.via });
      else setError(r.error ?? "Could not resend the code. Please try again.");
    });
  }

  const pct = useMemo(() => Math.min(100, Math.round((p.registered / TARGET) * 100)), [p.registered]);

  return (
    <div lang={lang} className="landing">
      <div className="workshop-meta">
        <p className="meta-label"><span className="live-dot" /> THE CAMPUS BUILD SERIES <span className="mx-1 text-line">/</span> WORKSHOP 001</p>
        <div className="language-picker" role="group" aria-label="Language">
          {(Object.keys(LANGS) as Lang[]).map((l) => <button key={l} onClick={() => switchLang(l)} aria-pressed={l === lang}>{LANGS[l].native}</button>)}
        </div>
      </div>
      <CampusCover
        busy={busy}
        headline={copy?.headline ?? tr("hero_h")}
        sub={copy?.sub ?? tr("hero_s")}
        isEnglish={lang === "en"}
        workshopDate={workshopLabel}
        onChoose={(interest) => {
          award("choose_project");
          setIdeaForm({ ...ideaForm, interest });
          setStage("idea");
          setError(null);
          startForm();
          requestAnimationFrame(() => {
            document.getElementById("project-builder")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
            document.getElementById("interest")?.focus({ preventScroll: true });
          });
        }}
      />
      <div className="hero-grid">
        <section className="mission-intro">
          <p className="chapter-label">02 / CREATE YOUR LOADOUT</p>
          <h2>Not all heroes<br />wear capes.<br /><em>Some bring laptops.</em></h2>
          <p>Your branch + your interests + a little AI.<br />Let’s find a project that feels like you.</p>
          {p.inviter && <p className="invitation-note">{tr("invited", { name: p.inviter.name, college: p.inviter.college })}</p>}
          <QuestConsole branch={ideaForm.branch} interest={ideaForm.interest} skill={ideaForm.skill} stage={stage} />
          <p className="mission-aside">No coding confidence? Borrow some of ours. ↗</p>
        </section>
        <section className="builder-card" id="project-builder" aria-label="Find your project and register">
          <div className="builder-top"><strong>NEW PLAYER SETUP</strong><span>PRESS START ↙</span></div>
          <div className="builder-body" aria-busy={busy}>
            <Steps stage={stage} labels={[tr("step_idea"), tr("step_register"), tr("step_verify")]} />
            {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
              {stage === "idea" && (
                <form onSubmit={getIdea} className="flex flex-col gap-4" onFocus={startForm}>
                  <div>
                    <h2>{lang === "en" ? "Choose your powers." : tr("idea_title")}</h2>
                    <p className="text-sm text-ink-soft">{lang === "en" ? "Tell us your thing. We’ll help you build a thing." : tr("idea_sub")}</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="branch">{tr("branch")}</label>
                    <select id="branch" className="input" value={ideaForm.branch} onChange={(e) => setIdeaForm({ ...ideaForm, branch: e.target.value })}>
                      {BRANCHES.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="interest">{tr("interest")}</label>
                    <input id="interest" className="input" required maxLength={80} placeholder={tr("interest_ph")} value={ideaForm.interest} onChange={(e) => setIdeaForm({ ...ideaForm, interest: e.target.value })} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {INTERESTS.map((word) => (
                        <button
                          type="button"
                          key={word}
                          onClick={() => setIdeaForm({ ...ideaForm, interest: word })}
                          className="interest-chip" aria-pressed={ideaForm.interest === word}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="label" id="skill-label">{tr("skill")}</p>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="skill-label">
                      {SKILLS.map(([value, key]) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setIdeaForm({ ...ideaForm, skill: value })}
                          className="skill-choice" aria-pressed={ideaForm.skill === value}
                        >
                          {tr(key)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary py-3.5 text-base" disabled={busy}>
                    {busy ? tr("gen_busy") : lang === "en" ? "Generate my quest  →" : tr("gen_btn")}
                  </button>
                </form>
              )}

              {stage !== "idea" && idea && <IdeaCard idea={idea} reveal={stage === "register"} compact={stage === "otp"} labels={{ your: tr("your_project"), ai: tr("ai_generated"), tpl: tr("template") }} />}

              {stage === "register" && (
                <form onSubmit={register} className="mt-5 flex flex-col gap-3">
                  <h2 className="text-lg font-bold">{tr("lock_title")}</h2>
                  <input className="input" required aria-label={tr("name")} autoComplete="name" placeholder={tr("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="input" required type="email" aria-label={tr("email")} autoComplete="email" placeholder={tr("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <input className="input" required inputMode="numeric" aria-label={tr("phone")} autoComplete="tel" placeholder={tr("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <input className="input" required list="colleges" aria-label={tr("college")} placeholder={tr("college")} value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
                  <datalist id="colleges">
                    {p.colleges.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <select aria-label="Year of study" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
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
                  <button type="button" disabled={busy} className="text-xs text-ink-soft underline" onClick={() => { setError(null); setStage("idea"); }}>
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
                  <input className="input text-center font-mono text-2xl tracking-[0.5em]" aria-label={tr("otp_title")} autoComplete="one-time-code" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
                  <button className="btn-primary py-3.5" disabled={busy || otp.length !== 6}>
                    {busy ? tr("checking") : tr("verify_btn")}
                  </button>
                  <button type="button" disabled={busy} onClick={resend} className="text-xs text-ink-soft underline">
                    {tr("resend")}
                  </button>
                </form>
              )}

            <p className="builder-privacy"><Icon name="lock" /> {stage === "idea" ? "Explore your idea before you sign up. No commitment." : "Your details are used for workshop updates."}</p>
          </div>
          <div className="builder-foot"><span>Already registered?</span><Link href="/live">Head to the workshop ↗</Link></div>
        </section>
      </div>
      <section className="mission-manual" aria-labelledby="manual-title">
        <div className="chapter-heading"><div><p className="chapter-label">03 / THE GAME PLAN</p><h2 id="manual-title">One hour.<br /><em>Three plot twists.</em></h2></div><p>A workshop where you actually make stuff.<br />Here’s how the story goes.</p></div>
        <div className="manual-panels">
          <article><div className="manual-scene scene-plan" aria-hidden><span className="scene-note">what if...?</span><span className="scene-cursor">↖</span><span className="scene-star">✳</span></div><span className="manual-time">00—15 MIN / THE ORIGIN</span><h3>Find your superproblem.</h3><p>Pick your idea, meet the tools, and figure out what your first version needs to do.</p></article>
          <article><div className="manual-scene scene-build" aria-hidden><div className="mini-terminal"><span>my-first-build</span><code>&gt; idea + curiosity<br />&gt; building something cool_<br /><b>✓ it works!</b></code></div></div><span className="manual-time">15—40 MIN / THE POWER-UP</span><h3>Make the thing work.</h3><p>Write a prompt. Build your app. Break a little, fix a little. Get help when you need it.</p></article>
          <article><div className="manual-scene scene-ship" aria-hidden><span className="ship-burst">I MADE<br />THIS!</span><span className="ship-arrow">↗</span></div><span className="manual-time">40—60 MIN / THE BIG REVEAL</span><h3>Ship it. Show your people.</h3><p>Test your project, publish a demo, and leave with something you can put your name on.</p></article>
        </div>
      </section>
      <section className="campus-section" aria-labelledby="campus-title">
        <div><p className="section-kicker mb-3">04 / UNLOCK MULTIPLAYER</p><h2 id="campus-title">Good solo. Better with your squad.</h2><p>Register, get your personal invite link, and bring a friend. Verified referrals unlock rewards and move your college up the board.</p><Link className="text-link" href="/leaderboard">Explore the campus leaderboard ↗</Link></div>
        <div className="campaign-progress">
          <div className="progress-label"><span><strong>{p.registered}</strong> / {TARGET} students</span><span>CAMPAIGN GOAL</span></div>
          <div className="progress-track" role="progressbar" aria-label="Verified registration goal" aria-valuenow={Math.min(p.registered, TARGET)} aria-valuemin={0} aria-valuemax={TARGET}><div style={{ width: `${pct}%` }} /></div>
          <p>{p.registered === 0 ? "A new cohort starts with one person. Bring your college along." : `${p.registered} verified registrations. Every new builder counts.`}</p>
          {p.topColleges.length > 0 && <p>Leading the way: {p.topColleges.map(c => `${c.name} (${c.n})`).join(" · ")}</p>}
        </div>
      </section>
      <section className="faq-section" aria-labelledby="faq-title">
        <div><p className="section-kicker">THE FAQ SIDE QUEST</p><h2 className="section-title" id="faq-title">Plot holes? Let’s fix ’em.</h2><Link className="text-link" href="/help">Need a hand? Visit the help desk ↗</Link></div>
        <div className="faq-list">
          <details><summary>Do I need to know how to code?</summary><p>You can start as a beginner. Tell us your skill level in the project finder so your suggested build matches your experience. Bring a laptop and a reliable internet connection.</p></details>
          <details><summary>Is the workshop really free?</summary><p>Yes. Registration is free. This site is a working prototype for the NxtWave Growth Challenge; the campaign and rewards are a simulation.</p></details>
          <details><summary>Can I join if I’m not from CSE?</summary><p>Yes. The project finder supports engineering branches including ECE, EEE, Mechanical, and Civil, with ideas based on your interests.</p></details>
          <details><summary>What happens after I register?</summary><p>Verify your email or WhatsApp number, then get your personal project and referral page. You can add the workshop to your calendar, invite friends, and return for workshop check-in.</p></details>
        </div>
      </section>
    </div>
  );
}

const INTERESTS = ["cricket", "movies", "gaming", "music", "stocks", "farming"];

function Steps({ stage, labels }: { stage: string; labels: string[] }) {
  const idx = ["idea", "register", "otp"].indexOf(stage);
  return <ol className="form-steps" aria-label="Registration progress">{labels.map((label, i) => <li key={label} aria-current={i === idx ? "step" : undefined} className={i === idx ? "is-current" : i < idx ? "is-done" : ""}><span>{i < idx ? "✓" : `0${i + 1}`}</span>{label}</li>)}</ol>;
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    check: <path d="m5 12 4 4 10-10" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)" /></>,
    file: <><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h6" /></>,
  };
  return <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.code}</svg>;
}

export function IdeaCard({ idea, compact = false, labels, reveal = false }: { idea: Idea; compact?: boolean; labels?: { your: string; ai: string; tpl: string }; reveal?: boolean }) {
  const l = labels ?? { your: "Your workshop project", ai: "AI-generated", tpl: "Template" };
  return (
    <div className={`project-result ${reveal ? "animate-pop-in" : ""}`} aria-live="polite">
      <div className="result-label"><span>{l.your}</span><span>{idea.source === "template" ? l.tpl : l.ai}</span></div>
      <h3>{idea.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{idea.pitch}</p>
      {!compact && <>
        <p className="mt-3 text-xs leading-relaxed text-white/65">{idea.why_it_fits_you}</p>
        <ol className="mt-4 space-y-2">{idea.steps.map((s, i) => <li key={i} className="flex gap-3"><span className="shrink-0 font-mono text-[#c1d7a4]">{String(i + 1).padStart(2, "0")}</span>{s}</li>)}</ol>
        <div className="mt-4 flex flex-wrap gap-1">{idea.tools.map(tool => <span key={tool} className="pill bg-white/10 text-white/80">{tool}</span>)}</div>
        <p className="mt-4 rounded-md bg-white/5 p-3 text-xs leading-relaxed text-white/75">{idea.resume_line}</p>
      </>}
    </div>
  );
}
