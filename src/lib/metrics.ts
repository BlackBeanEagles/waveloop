import { all, one } from "./db";
import { CAMPAIGN_DAYS, TARGET, BUDGET_INR } from "./config";
import { COUNTED, FRAUD_THRESHOLD, campaignClock } from "./growth";

const n = (v: unknown) => Number(v ?? 0);

export async function leaderboard() {
  const colleges = await all<{ name: string; city: string; regs: number; verified: number }>(
    `SELECT c.name, c.city, COUNT(u.id) AS regs, SUM(CASE WHEN u.verified = 1 AND u.fraud_score < ${FRAUD_THRESHOLD} THEN 1 ELSE 0 END) AS verified
     FROM colleges c JOIN users u ON u.college_id = c.id
     GROUP BY c.id ORDER BY verified DESC, regs DESC LIMIT 15`,
  );
  const people = await all<{ name: string; college: string; refs: number; ref_code: string }>(
    `SELECT r.name, c.name AS college, r.ref_code, COUNT(u.id) AS refs
     FROM users u JOIN users r ON r.id = u.referred_by JOIN colleges c ON c.id = r.college_id
     WHERE u.verified = 1 AND u.fraud_score < ${FRAUD_THRESHOLD}
     GROUP BY r.id ORDER BY refs DESC, MIN(u.created_at) ASC LIMIT 15`,
  );
  const total = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE ${COUNTED}`);
  return {
    colleges: colleges.map((c) => ({ ...c, regs: n(c.regs), verified: n(c.verified) })),
    people: people.map((p) => ({ name: maskName(String(p.name)), college: p.college, refs: n(p.refs) })),
    total: n(total?.n),
    target: TARGET,
  };
}

function maskName(name: string) {
  const [first, ...rest] = name.split(" ");
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export async function dashboard() {
  const clock = await campaignClock();

  const totals = await one<Record<string, number>>(
    `SELECT COUNT(*) AS registered,
            SUM(verified) AS verified,
            SUM(CASE WHEN fraud_score >= ${FRAUD_THRESHOLD} THEN 1 ELSE 0 END) AS flagged,
            SUM(CASE WHEN referred_by IS NOT NULL AND ${COUNTED} THEN 1 ELSE 0 END) AS via_referral,
            SUM(attended) AS attended
     FROM users`,
  );
  const visitors = await one<{ n: number }>("SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE type = 'page_view'");
  const ideas = await one<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE type = 'idea_generated'");
  const formStarts = await one<{ n: number }>("SELECT COUNT(DISTINCT visitor_id) AS n FROM events WHERE type = 'form_started'");
  const sharers = await one<{ n: number }>("SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE type = 'shared'");

  const registered = n(totals?.registered);
  const verified = n(totals?.verified);
  const counted = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE ${COUNTED}`);

  const funnel = [
    { stage: "Visited", value: n(visitors?.n) },
    { stage: "Got AI idea", value: n(ideas?.n) },
    { stage: "Started form", value: n(formStarts?.n) },
    { stage: "Registered", value: registered },
    { stage: "Verified", value: verified },
    { stage: "Shared link", value: n(sharers?.n) },
  ];

  const daily = await all<{ day: string; regs: number; refs: number }>(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS regs,
            SUM(CASE WHEN referred_by IS NOT NULL THEN 1 ELSE 0 END) AS refs
     FROM users WHERE ${COUNTED} GROUP BY day ORDER BY day`,
  );
  let cum = 0;
  const startDay = new Date(clock.start);
  const series = Array.from({ length: CAMPAIGN_DAYS }, (_, i) => {
    const d = new Date(startDay.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const row = daily.find((x) => x.day === d);
    const isFuture = i > clock.dayIndex;
    if (!isFuture) cum += n(row?.regs);
    return {
      day: `Day ${i + 1}`,
      registrations: isFuture ? null : n(row?.regs),
      cumulative: isFuture ? null : cum,
      target: Math.round((TARGET / CAMPAIGN_DAYS) * (i + 1)),
    };
  });

  const byChannel = await all<{ channel: string; regs: number; verified: number }>(
    `SELECT channel, COUNT(*) AS regs, SUM(CASE WHEN ${COUNTED} THEN 1 ELSE 0 END) AS verified
     FROM users GROUP BY channel ORDER BY verified DESC`,
  );

  // A/B: conversion = registrations / unique visitors per variant
  const abViews = await all<{ variant: string; n: number }>(
    "SELECT variant, COUNT(DISTINCT visitor_id) AS n FROM events WHERE type = 'page_view' AND variant IS NOT NULL GROUP BY variant",
  );
  const abRegs = await all<{ variant: string; n: number }>("SELECT variant, COUNT(*) AS n FROM users WHERE variant IS NOT NULL GROUP BY variant");
  const ab = ["A", "B"].map((v) => {
    const views = n(abViews.find((x) => x.variant === v)?.n);
    const regs = n(abRegs.find((x) => x.variant === v)?.n);
    return { variant: v, views, regs, rate: views ? regs / views : 0 };
  });
  const abSignificance = twoProportionZ(ab[0].regs, ab[0].views, ab[1].regs, ab[1].views);

  const ambassadors = await all<{ name: string; code: string; college: string; regs: number; verified: number; groups: number }>(
    `SELECT a.name, a.code, c.name AS college, a.groups_reached AS groups, COUNT(u.id) AS regs,
            SUM(CASE WHEN u.verified = 1 AND u.fraud_score < ${FRAUD_THRESHOLD} THEN 1 ELSE 0 END) AS verified
     FROM ambassadors a JOIN colleges c ON c.id = a.college_id LEFT JOIN users u ON u.ambassador_id = a.id
     GROUP BY a.id ORDER BY verified DESC LIMIT 12`,
  );

  const fraudQueue = await all<{ id: number; name: string; email: string; fraud_score: number; fraud_reasons: string; created_at: string }>(
    `SELECT id, name, email, fraud_score, fraud_reasons, created_at FROM users WHERE fraud_score >= ${FRAUD_THRESHOLD} ORDER BY created_at DESC LIMIT 20`,
  );

  const outbox = await all<{ template: string; status: string; n: number }>("SELECT template, status, COUNT(*) AS n FROM outbox GROUP BY template, status");

  // Viral coefficient: referral sign-ups generated per non-referral sign-up.
  const seeds = counted ? n(counted.n) - n(totals?.via_referral) : 0;
  const kFactor = seeds > 0 ? n(totals?.via_referral) / seeds : 0;

  const elapsedDays = Math.max(1, Math.min(clock.dayIndex + 1, CAMPAIGN_DAYS));
  const pace = n(counted?.n) / elapsedDays;
  const projected = Math.round(pace * CAMPAIGN_DAYS);
  const remainingDays = Math.max(0, CAMPAIGN_DAYS - elapsedDays);
  const neededPerDay = remainingDays ? Math.max(0, Math.ceil((TARGET - n(counted?.n)) / remainingDays)) : 0;

  const prizePool = Math.round(BUDGET_INR);

  return {
    clock,
    kpis: {
      counted: n(counted?.n),
      registered,
      verified,
      flagged: n(totals?.flagged),
      viaReferral: n(totals?.via_referral),
      attended: n(totals?.attended),
      kFactor,
      projected,
      neededPerDay,
      costPerReg: n(counted?.n) ? prizePool / n(counted?.n) : 0,
      target: TARGET,
    },
    funnel,
    series,
    byChannel: byChannel.map((c) => ({ channel: String(c.channel), regs: n(c.regs), verified: n(c.verified) })),
    ab,
    abSignificance,
    ambassadors: ambassadors.map((a) => ({ ...a, regs: n(a.regs), verified: n(a.verified), groups: n(a.groups) })),
    fraudQueue: fraudQueue.map((f) => ({ ...f, fraud_score: n(f.fraud_score), reasons: f.fraud_reasons ? (JSON.parse(String(f.fraud_reasons)) as string[]) : [] })),
    outbox: outbox.map((o) => ({ ...o, n: n(o.n) })),
  };
}

// Two-proportion z-test, returns the z score and an approximate two-sided p-value.
function twoProportionZ(x1: number, n1: number, x2: number, n2: number) {
  if (!n1 || !n2) return { z: 0, p: 1, winner: null as string | null };
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return { z: 0, p: 1, winner: null };
  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, p: pValue, winner: pValue < 0.05 ? (z > 0 ? "B" : "A") : null };
}

function normalCdf(x: number) {
  // Abramowitz-Stegun approximation
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - prob;
}
