import { z } from "zod";
import { dashboard } from "./metrics";
import { variantStats } from "./bandit";
import { run, now, one } from "./db";
import { WORKSHOP_TITLE, CHANNEL_LABEL } from "./config";
import { llmJson, type Provider } from "./llm";

export const CopilotSchema = z.object({
  headline_finding: z.string(),
  data_sufficient: z.boolean(),
  biggest_leak: z.object({ from_stage: z.string(), to_stage: z.string(), conversion_pct: z.number(), why_it_matters: z.string() }),
  actions: z.array(
    z.object({
      title: z.string(),
      hypothesis: z.string(),
      change: z.string(),
      success_metric: z.string(),
      effort: z.enum(["low", "medium", "high"]),
    }),
  ),
  new_variants: z.array(z.object({ headline: z.string(), sub: z.string(), rationale: z.string() })),
  whatsapp_post: z.string(),
  risks: z.array(z.string()),
});
export type CopilotOutput = z.infer<typeof CopilotSchema>;

// Typical step conversions for free edtech webinars. Used to find the leak relative to "normal", not in absolute terms.
const BENCH: Record<string, number> = {
  "Visited→Got AI idea": 0.5,
  "Got AI idea→Started form": 0.55,
  "Started form→Registered": 0.7,
  "Registered→Verified": 0.85,
  "Verified→Shared link": 0.35,
};
const MIN_VISITORS = 30;

async function snapshot() {
  const d = await dashboard();
  const variants = await variantStats();
  const steps = d.funnel.slice(1).map((f, i) => {
    const prev = d.funnel[i];
    const rate = prev.value ? f.value / prev.value : 0;
    const key = `${prev.stage}→${f.stage}`;
    return { from: prev.stage, to: f.stage, rate, bench: BENCH[key] ?? 0.5, n: prev.value };
  });
  return { d, variants, steps };
}

export async function runCopilot(): Promise<{ output: CopilotOutput; engine: Provider | "rules"; id: number }> {
  const snap = await snapshot();
  let output: CopilotOutput | null = null;
  let engine: Provider | "rules" = "rules";

  const ai = await aiCopilot(snap);
  if (ai) {
    output = ai.data;
    engine = ai.provider;
  }
  output ??= rulesCopilot(snap);
  const r = await run("INSERT INTO copilot_runs(output, engine, created_at) VALUES (?, ?, ?)", [JSON.stringify(output), engine, now()]);
  return { output, engine, id: Number(r.lastInsertRowid) };
}

export async function lastCopilotRun() {
  const r = await one<{ id: number; output: string; engine: string; created_at: string }>("SELECT * FROM copilot_runs ORDER BY id DESC LIMIT 1");
  return r ? { id: Number(r.id), output: JSON.parse(String(r.output)) as CopilotOutput, engine: String(r.engine), created_at: String(r.created_at) } : null;
}

type Snap = Awaited<ReturnType<typeof snapshot>>;

async function aiCopilot({ d, variants, steps }: Snap) {
  const metrics = {
    campaign_day: d.clock.dayNumber,
    target_verified_registrations: d.kpis.target,
    kpis: d.kpis,
    funnel_steps: steps.map((s) => ({ step: `${s.from} → ${s.to}`, conversion: +s.rate.toFixed(3), typical: s.bench, sample_size: s.n })),
    channels: d.byChannel.map((c) => ({ channel: CHANNEL_LABEL[c.channel] ?? c.channel, registrations: c.regs, verified: c.verified })),
    headline_variants: variants.map((v) => ({ key: v.key, headline: v.headline, active: Boolean(v.active), visitors: v.views, registrations: v.regs, conversion: +v.rate.toFixed(3), prob_best: +v.pBest.toFixed(2) })),
    top_ambassadors: d.ambassadors.slice(0, 5).map((a) => ({ college: a.college, verified: a.verified })),
    fraud_flagged: d.kpis.flagged,
  };
  return llmJson(CopilotSchema, {
    effort: "medium",
    maxTokens: 8000,
    system:
      `You are the growth analyst for a 7-day campaign to get 500 final-year engineering students in India to register for NxtWave's free live workshop "${WORKSHOP_TITLE}". ` +
      "Budget is ₹2,000, spent on referral prizes, not ads. Channels: college WhatsApp groups via campus ambassadors, peer referrals, LinkedIn, Instagram, email. " +
      `You get live funnel metrics. Rules: if fewer than ${MIN_VISITORS} visitors, set data_sufficient=false and say what data is needed instead of drawing conclusions. ` +
      "Never invent numbers that are not in the metrics. Judge each step against its 'typical' benchmark and weigh sample size. " +
      "actions: exactly 3, ranked by expected registrations gained per hour of effort, each a concrete experiment runnable today. " +
      "new_variants: exactly 2 landing-page headline+subline pairs aimed at the biggest leak, under 70 and 160 characters, plain language a final-year student uses. " +
      "whatsapp_post: one ready-to-forward message for ambassadors, under 450 characters, with {link} where the link goes. risks: 1-3 short items.",
    user: `Live metrics:\n${JSON.stringify(metrics, null, 2)}`,
  });
}

// Deterministic fallback so the copilot still works without an API key. Same output shape, every claim traceable to a number.
function rulesCopilot({ d, variants, steps }: Snap): CopilotOutput {
  const visitors = d.funnel[0].value;
  const sufficient = visitors >= MIN_VISITORS;
  const scored = steps.filter((s) => s.n > 0).map((s) => ({ ...s, gap: s.rate / s.bench }));
  const leak = scored.sort((a, b) => a.gap - b.gap)[0] ?? { from: "Visited", to: "Got AI idea", rate: 0, bench: 0.5, n: 0, gap: 0 };
  const key = `${leak.from}→${leak.to}`;
  const pct = Math.round(leak.rate * 100);

  const PLAYBOOK: Record<string, CopilotOutput["actions"]> = {
    "Visited→Got AI idea": [
      { title: "Cut the idea form to one field", hypothesis: "Two inputs plus a skill choice feels like work before any payoff.", change: "Pre-fill branch from the referrer's branch and ask only 'what are you into?'.", success_metric: "Visit → idea rate", effort: "low" },
      { title: "Show a sample idea above the fold", hypothesis: "Students don't know what they'd get.", change: "Rotate 3 real generated ideas as examples above the form.", success_metric: "Visit → idea rate", effort: "low" },
    ],
    "Got AI idea→Started form": [
      { title: "Put the seat CTA inside the idea card", hypothesis: "The idea is the peak of interest, and the form sits below it.", change: "Add 'Build this live, claim your seat' inside the card, scrolling to the form.", success_metric: "Idea → form rate", effort: "low" },
      { title: "Add a seats-left counter", hypothesis: "Scarcity converts curiosity into action.", change: "Show remaining seats out of 500 next to the CTA.", success_metric: "Idea → form rate", effort: "low" },
    ],
    "Started form→Registered": [
      { title: "Drop the year field", hypothesis: "Every extra field costs about 5-10% of completions.", change: "Default to final year; ask the rest after registration.", success_metric: "Form → registered rate", effort: "low" },
      { title: "Push form-abandoners to the WhatsApp bot", hypothesis: "Phone users find chat easier than forms.", change: "Add 'Register on WhatsApp instead' under the form.", success_metric: "Total registrations", effort: "low" },
    ],
    "Registered→Verified": [
      { title: "Default the code to WhatsApp", hypothesis: "Students check WhatsApp faster than email; codes expire unread.", change: "Make WhatsApp the default code channel.", success_metric: "Registered → verified rate", effort: "low" },
      { title: "Re-send the code to unverified sign-ups after 30 min", hypothesis: "Most unverified people simply missed the message.", change: "Add a 'finish verifying' message to the drip.", success_metric: "Registered → verified rate", effort: "medium" },
    ],
    "Verified→Shared link": [
      { title: "Lower the first reward to 1 referral and say it louder", hypothesis: "The first reward feels far away.", change: "Show 'Invite 1 friend → recording access' as a banner on the success page.", success_metric: "Verified → shared rate", effort: "low" },
      { title: "Pre-write college-specific share text", hypothesis: "Generic messages get ignored in groups.", change: "Mention the student's college rank in the WhatsApp text.", success_metric: "Referral sign-ups", effort: "low" },
    ],
  };
  // Too little traffic to judge any step: the only useful advice is how to get traffic.
  const SEED: CopilotOutput["actions"] = [
    { title: "Recruit 5 ambassadors today", hypothesis: "Nothing else in the plan works until links are in real groups.", change: "DM 5 club or class reps the /ambassador link; ask each to post in 3 groups tonight.", success_metric: "Visitors per day", effort: "medium" },
    { title: "Post your own link in 3 groups", hypothesis: "Your network is the fastest first 30 visitors.", change: "Share the student page in 3 WhatsApp groups you're already in, 7-9 PM.", success_metric: "First 30 visitors", effort: "low" },
    { title: "Register the first 5 friends yourself", hypothesis: "Early sign-ups start the referral tree and the leaderboard.", change: "Ask 5 friends to register through your /r/ link so the loop has seeds.", success_metric: "Verified sign-ups", effort: "low" },
  ];
  const actions = sufficient ? [...(PLAYBOOK[key] ?? PLAYBOOK["Visited→Got AI idea"])] : SEED;
  const bestChannel = d.byChannel[0];
  if (sufficient) actions.push(
    bestChannel
      ? { title: `Double down on ${CHANNEL_LABEL[bestChannel.channel] ?? bestChannel.channel}`, hypothesis: `It is the top channel with ${bestChannel.verified} verified sign-ups.`, change: "Recruit 5 more ambassadors in colleges not yet on the leaderboard.", success_metric: "Verified registrations per day", effort: "medium" }
      : { title: "Recruit the first 10 ambassadors", hypothesis: "Without seed distribution the referral loop has nothing to multiply.", change: "Message 10 club leads with the ambassador link today.", success_metric: "Visitors per day", effort: "medium" },
  );

  const leader = [...variants].filter((v) => v.active).sort((a, b) => b.pBest - a.pBest)[0];
  const risks: string[] = [];
  if (!sufficient) risks.push(`Only ${visitors} visitors so far; conversion rates will swing a lot until ~${MIN_VISITORS}+.`);
  if (d.kpis.flagged > 0 && d.kpis.registered && d.kpis.flagged / d.kpis.registered > 0.05) risks.push(`${d.kpis.flagged} sign-ups flagged as fraud (over 5%). Review before paying prizes.`);
  if (d.kpis.projected < d.kpis.target && d.kpis.counted > 0) risks.push(`Projected ${d.kpis.projected} vs target ${d.kpis.target}: need ${d.kpis.neededPerDay}/day from here.`);

  return {
    headline_finding: sufficient
      ? `Biggest leak is ${leak.from} → ${leak.to} at ${pct}% (typical ~${Math.round(leak.bench * 100)}%).${leader ? ` Headline ${leader.key} is most likely best (${Math.round(leader.pBest * 100)}%).` : ""}`
      : `Not enough data yet: ${visitors} visitors. Share the link in 2-3 real groups first; findings start at ${MIN_VISITORS}+ visitors.`,
    data_sufficient: sufficient,
    biggest_leak: { from_stage: leak.from, to_stage: leak.to, conversion_pct: pct, why_it_matters: `Each step multiplies: lifting this step to the typical ${Math.round(leak.bench * 100)}% raises every stage after it.` },
    actions: actions.slice(0, 3),
    new_variants: [
      { headline: "Your branch. Your AI project. 60 minutes.", sub: "Tell us your branch and we design an AI project you build live, free, and put on your resume tonight.", rationale: "Leads with personalisation, the hook that drives the idea step." },
      { headline: "Freshers with an AI project get shortlisted first.", sub: "Build and deploy one in a free 60-minute live session. Laptop + Chrome is all you need.", rationale: "Placement anxiety framing for final-years." },
    ],
    whatsapp_post: `🚨 Final years: free 60-min live workshop by NxtWave. You build + deploy your own AI project (laptop + Chrome only). Great for the placement resume. Get your personal project idea here 👉 {link}`,
    risks: risks.length ? risks : ["No major risks detected in current data."],
  };
}
