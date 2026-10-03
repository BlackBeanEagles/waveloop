import { all, one } from "./db";
import { FRAUD_THRESHOLD, campaignClock, getSetting, setSetting } from "./growth";

// Show-up prediction. Free webinars typically see 30-40% of registrants attend; this scores each registrant
// so extra reminders go to the people likely to miss it instead of spamming everyone.

export const FEATURES = [
  { key: "verified", label: "Verified their number" },
  { key: "calendar", label: "Added to calendar" },
  { key: "shared", label: "Shared their link" },
  { key: "has_referral", label: "Brought a friend" },
  { key: "came_by_referral", label: "Came via a friend" },
  { key: "whatsapp_bot", label: "Registered on WhatsApp" },
  { key: "final_year", label: "Final-year student" },
  { key: "lead_time", label: "Days between sign-up and workshop (÷7)" },
] as const;
type FeatureKey = (typeof FEATURES)[number]["key"];
type Model = { intercept: number; weights: Record<FeatureKey, number>; source: "prior" | "fitted"; trainedOn?: number; accuracy?: number; fittedAt?: string };

// Prior weights (log-odds) chosen from webinar attendance patterns, used until real attendance exists.
const PRIOR: Model = {
  intercept: -1.2,
  weights: { verified: 1.1, calendar: 0.9, shared: 0.5, has_referral: 0.6, came_by_referral: 0.4, whatsapp_bot: 0.35, final_year: 0.2, lead_time: -0.7 },
  source: "prior",
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export async function currentModel(): Promise<Model> {
  const raw = await getSetting("showup_model");
  return raw ? (JSON.parse(raw) as Model) : PRIOR;
}

type Row = { id: number; name: string; phone: string; lang: string; attended: number; x: Record<FeatureKey, number> };

async function featureRows(): Promise<Row[]> {
  const { workshop } = await campaignClock();
  const w = new Date(workshop).getTime();
  const rows = await all<{
    id: number; name: string; phone: string; lang: string; verified: number; attended: number; channel: string; year: string;
    referred_by: number | null; created_at: string; calendar: number; shared: number; refs: number;
  }>(
    `SELECT u.id, u.name, u.phone, u.lang, u.verified, u.attended, u.channel, u.year, u.referred_by, u.created_at,
       EXISTS(SELECT 1 FROM events e WHERE e.user_id = u.id AND e.type = 'calendar_added') AS calendar,
       EXISTS(SELECT 1 FROM events e WHERE e.user_id = u.id AND e.type = 'shared') AS shared,
       (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.id AND r.verified = 1 AND r.fraud_score < ${FRAUD_THRESHOLD}) AS refs
     FROM users u WHERE u.fraud_score < ${FRAUD_THRESHOLD}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    lang: String(r.lang ?? "en"),
    attended: Number(r.attended),
    x: {
      verified: Number(r.verified) ? 1 : 0,
      calendar: Number(r.calendar) ? 1 : 0,
      shared: Number(r.shared) ? 1 : 0,
      has_referral: Number(r.refs) > 0 ? 1 : 0,
      came_by_referral: r.referred_by != null ? 1 : 0,
      whatsapp_bot: r.channel === "whatsapp_bot" ? 1 : 0,
      final_year: String(r.year).startsWith("Final") ? 1 : 0,
      lead_time: Math.max(0, (w - new Date(String(r.created_at)).getTime()) / 86_400_000) / 7,
    },
  }));
}

function score(model: Model, x: Record<FeatureKey, number>) {
  let z = model.intercept;
  for (const f of FEATURES) z += (model.weights[f.key] ?? 0) * x[f.key];
  return sigmoid(z);
}

function explain(model: Model, x: Record<FeatureKey, number>) {
  // Missing positive signals are the actionable reasons for a low score.
  return FEATURES.filter((f) => f.key !== "lead_time" && (model.weights[f.key] ?? 0) > 0.3 && !x[f.key]).map((f) => `not: ${f.label.toLowerCase()}`);
}

export async function scoreUser(userId: number) {
  const model = await currentModel();
  const r = (await featureRows()).find((u) => u.id === userId);
  return r ? score(model, r.x) : null;
}

export async function showupReport() {
  const model = await currentModel();
  const rows = await featureRows();
  const scored = rows.map((r) => ({ ...r, p: score(model, r.x) }));
  const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}%`, people: 0 }));
  for (const s of scored) buckets[Math.min(9, Math.floor(s.p * 10))].people++;
  const expected = scored.reduce((sum, s) => sum + s.p, 0);
  const atRisk = scored
    .filter((s) => s.p < RESCUE_THRESHOLD)
    .sort((a, b) => a.p - b.p)
    .slice(0, 15)
    .map((s) => ({ id: s.id, name: maskName(s.name), p: s.p, reasons: explain(model, s.x) }));
  const labelled = await canFit();
  return {
    model: { ...model, weights: FEATURES.map((f) => ({ key: f.key, label: f.label, weight: model.weights[f.key] ?? 0 })) },
    registrants: scored.length,
    expectedAttendees: Math.round(expected),
    expectedRate: scored.length ? expected / scored.length : 0,
    atRiskCount: scored.filter((s) => s.p < RESCUE_THRESHOLD).length,
    buckets,
    atRisk,
    canFit: labelled,
    threshold: RESCUE_THRESHOLD,
  };
}

export const RESCUE_THRESHOLD = 0.4;

function maskName(name: string) {
  const [first, ...rest] = name.split(" ");
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

// ---------- learning from real attendance ----------

async function canFit() {
  const { workshop } = await campaignClock();
  const over = Date.now() > new Date(workshop).getTime() + 60 * 60_000;
  const c = await one<{ n: number; pos: number }>(`SELECT COUNT(*) AS n, SUM(attended) AS pos FROM users WHERE fraud_score < ${FRAUD_THRESHOLD}`);
  const n = Number(c?.n ?? 0);
  const pos = Number(c?.pos ?? 0);
  const ok = n >= 30 && pos >= 5 && n - pos >= 5;
  return { ok: ok && over, n, attended: pos, workshopOver: over, reason: !over ? "Workshop hasn't happened yet: no attendance labels." : !ok ? "Need 30+ registrants with 5+ who attended and 5+ who didn't." : "Ready to learn from real attendance." };
}

// L2-regularised logistic regression by gradient descent. Small n, so we shrink towards the prior instead of zero.
export async function fitFromAttendance() {
  const status = await canFit();
  if (!status.ok) return { ok: false, reason: status.reason };
  const rows = await featureRows();
  const keys = FEATURES.map((f) => f.key);
  let b = PRIOR.intercept;
  const w: Record<string, number> = { ...PRIOR.weights };
  const lr = 0.1;
  const lambda = 0.05;
  for (let iter = 0; iter < 2000; iter++) {
    let gb = 0;
    const gw: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const r of rows) {
      let z = b;
      for (const k of keys) z += w[k] * r.x[k];
      const err = sigmoid(z) - r.attended;
      gb += err;
      for (const k of keys) gw[k] += err * r.x[k];
    }
    b -= (lr * gb) / rows.length;
    for (const k of keys) w[k] -= lr * (gw[k] / rows.length + lambda * (w[k] - PRIOR.weights[k as FeatureKey]));
  }
  const model: Model = { intercept: b, weights: w as Record<FeatureKey, number>, source: "fitted", trainedOn: rows.length, fittedAt: new Date().toISOString() };
  const correct = rows.filter((r) => (score(model, r.x) >= 0.5 ? 1 : 0) === r.attended).length;
  model.accuracy = correct / rows.length;
  await setSetting("showup_model", JSON.stringify(model));
  return { ok: true, model };
}

export async function resetModel() {
  await setSetting("showup_model", JSON.stringify(PRIOR));
}
