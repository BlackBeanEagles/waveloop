import { createHash, randomInt } from "crypto";
import { all, one, run, now } from "./db";
import { COLLEGES, REWARDS, WORKSHOP_TITLE, siteUrl } from "./config";
import { m } from "./i18n";

const SECRET = process.env.APP_SECRET ?? "waveloop-dev-secret";

export const hash = (s: string) => createHash("sha256").update(SECRET + s).digest("hex").slice(0, 32);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(prefix: string, len = 5) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${prefix}${s}`;
}

export function refCodeFor(name: string) {
  const stem = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "WAVE";
  return makeCode(stem, 4);
}

// ---------- settings ----------

export async function getSetting(key: string) {
  const row = await one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value;
}
export async function setSetting(key: string, value: string) {
  await run("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function campaignClock() {
  let start = await getSetting("campaign_start");
  if (!start) {
    start = new Date().toISOString();
    await setSetting("campaign_start", start);
  }
  let workshop = await getSetting("workshop_at");
  if (!workshop) {
    // Workshop runs the evening after the 7-day push ends.
    const w = new Date(start);
    w.setUTCDate(w.getUTCDate() + 7);
    w.setUTCHours(13, 30, 0, 0); // 7:00 PM IST
    workshop = w.toISOString();
    await setSetting("workshop_at", workshop);
  }
  const startMs = new Date(start).getTime();
  const dayIndex = Math.max(0, Math.floor((Date.now() - startMs) / 86_400_000));
  return { start, workshop, dayIndex, dayNumber: Math.min(dayIndex + 1, 7) };
}

// ---------- colleges ----------

export async function ensureColleges() {
  const row = await one<{ n: number }>("SELECT COUNT(*) AS n FROM colleges");
  if (row && Number(row.n) > 0) return;
  for (const c of COLLEGES) {
    await run("INSERT OR IGNORE INTO colleges(name, city, tier) VALUES (?, ?, ?)", [c.name, c.city, c.tier]);
  }
}

export async function listColleges() {
  await ensureColleges();
  return all<{ id: number; name: string; city: string }>("SELECT id, name, city FROM colleges ORDER BY name");
}

export async function collegeIdByName(name: string) {
  await ensureColleges();
  const clean = name.trim();
  const found = await one<{ id: number }>("SELECT id FROM colleges WHERE lower(name) = lower(?)", [clean]);
  if (found) return Number(found.id);
  const r = await run("INSERT INTO colleges(name, city, tier) VALUES (?, ?, 3)", [clean, "Unknown"]);
  return Number(r.lastInsertRowid);
}

// ---------- events ----------

export async function track(type: string, e: { visitorId?: string; userId?: number; channel?: string; variant?: string; meta?: unknown; at?: string } = {}) {
  await run("INSERT INTO events(type, visitor_id, user_id, channel, variant, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    type,
    e.visitorId ?? null,
    e.userId ?? null,
    e.channel ?? null,
    e.variant ?? null,
    e.meta ? JSON.stringify(e.meta) : null,
    e.at ?? now(),
  ]);
}

// ---------- fraud ----------

const DISPOSABLE = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "yopmail.com", "trashmail.com", "getnada.com", "sharklasers.com"];

export type FraudInput = {
  name: string;
  email: string;
  phone: string;
  ipHash: string;
  deviceHash: string;
  referrerId?: number | null;
};

export async function scoreFraud(f: FraudInput) {
  const reasons: string[] = [];
  let score = 0;
  const domain = f.email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE.includes(domain)) {
    score += 40;
    reasons.push("disposable email domain");
  }
  if (/^(\d)\1{9}$/.test(f.phone) || /^(0123456789|1234567890|9876543210)$/.test(f.phone)) {
    score += 35;
    reasons.push("placeholder phone number");
  }
  if (!/^[a-zA-Z][a-zA-Z .'-]{2,}$/.test(f.name.trim())) {
    score += 15;
    reasons.push("implausible name");
  }
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const sameIp = await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE ip_hash = ? AND created_at > ?", [f.ipHash, hourAgo]);
  if (Number(sameIp?.n ?? 0) >= 3) {
    score += 30;
    reasons.push(`${sameIp?.n} sign-ups from the same network in the last hour`);
  }
  if (f.referrerId) {
    const ref = await one<{ device_hash: string; ip_hash: string }>("SELECT device_hash, ip_hash FROM users WHERE id = ?", [f.referrerId]);
    if (ref && ref.device_hash === f.deviceHash) {
      score += 50;
      reasons.push("same device as referrer (self-referral)");
    }
    const tenMin = new Date(Date.now() - 600_000).toISOString();
    const burst = await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND created_at > ?", [f.referrerId, tenMin]);
    if (Number(burst?.n ?? 0) >= 5) {
      score += 20;
      reasons.push("referral burst (5+ in 10 minutes)");
    }
  }
  return { score: Math.min(score, 100), reasons };
}

export const FRAUD_THRESHOLD = 50;

// ---------- OTP ----------

// Per-instance attempt counter; a new code resets it. Good enough for one server, use Redis when scaled out.
const MAX_OTP_TRIES = 5;
const otpFailures = new Map<number, number>();

export async function issueOtp(userId: number) {
  const code = String(randomInt(100000, 999999));
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  await run("UPDATE users SET otp_hash = ?, otp_expires = ? WHERE id = ?", [hash(code), expires, userId]);
  otpFailures.delete(userId);
  return code;
}

export async function checkOtp(userId: number, code: string) {
  const u = await one<{ otp_hash: string | null; otp_expires: string | null; verified: number }>(
    "SELECT otp_hash, otp_expires, verified FROM users WHERE id = ?",
    [userId],
  );
  if (!u) return { ok: false, error: "Unknown registration" };
  if (Number(u.verified)) return { ok: true, firstTime: false };
  if (!u.otp_hash || !u.otp_expires || new Date(u.otp_expires).getTime() < Date.now()) return { ok: false, error: "Code expired. Request a new one." };
  const tries = (otpFailures.get(userId) ?? 0) + 1;
  if (tries > MAX_OTP_TRIES) return { ok: false, error: "Too many attempts. Request a new code." };
  if (u.otp_hash !== hash(code.trim())) {
    otpFailures.set(userId, tries);
    return { ok: false, error: `Wrong code (${MAX_OTP_TRIES - tries} tries left)` };
  }
  otpFailures.delete(userId);
  await run("UPDATE users SET verified = 1, verified_at = ?, otp_hash = NULL WHERE id = ?", [now(), userId]);
  return { ok: true, firstTime: true };
}

// ---------- referrals ----------

// A referral only counts once the referee verified and was not flagged.
export const COUNTED = `verified = 1 AND fraud_score < ${FRAUD_THRESHOLD}`;

export async function referralCount(userId: number) {
  const r = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND ${COUNTED}`, [userId]);
  return Number(r?.n ?? 0);
}

export function rewardState(refs: number) {
  const unlocked = REWARDS.filter((r) => refs >= r.refs);
  const next = REWARDS.find((r) => refs < r.refs) ?? null;
  return { unlocked, next, toNext: next ? next.refs - refs : 0 };
}

export function referralLink(code: string) {
  return `${siteUrl()}/r/${code}`;
}

export function whatsappShareText(name: string, code: string, ideaTitle?: string) {
  const first = name.split(" ")[0];
  return [
    `Hey! ${first} here. NxtWave is running a free live workshop: "${WORKSHOP_TITLE}".`,
    ideaTitle ? `I'm building "${ideaTitle}" in it. You get your own AI project idea when you sign up.` : `You get your own AI project idea when you sign up.`,
    `Takes 30 seconds: ${referralLink(code)}`,
  ].join("\n\n");
}

// ---------- drip schedule ----------

export async function scheduleDrip(userId: number, name: string, code: string, lang: string = "en", ideaTitle?: string) {
  const { workshop } = await campaignClock();
  const w = new Date(workshop).getTime();
  const first = name.split(" ")[0];
  const link = referralLink(code);
  const live = `${siteUrl()}/live`;
  const v = { first, link, live, title: WORKSHOP_TITLE, when: fmtIST(workshop), idea: ideaTitle ?? "your AI project" };
  const steps: { template: string; at: number; body: string }[] = [
    { template: "welcome", at: Date.now(), body: m(lang, "welcome", v) },
    { template: "referral_nudge", at: Date.now() + 6 * 3_600_000, body: `${first}, you're 1 referral away from a priority seat + recording access. Share your link: ${link}` },
    { template: "reminder_24h", at: w - 24 * 3_600_000, body: m(lang, "reminder_24h", v) },
    // Rescue messages: queued for everyone, sent only if the show-up model scores the person as likely to miss it.
    { template: "rescue_3h", at: w - 3 * 3_600_000, body: m(lang, "rescue_3h", v) },
    { template: "reminder_1h", at: w - 3_600_000, body: m(lang, "reminder_1h", v) },
    { template: "rescue_15m", at: w - 15 * 60_000, body: m(lang, "rescue_15m", v) },
    { template: "live_now", at: w, body: m(lang, "live_now", v) },
    { template: "submit_project", at: w + 2 * 3_600_000, body: `Great session! Submit your project for an AI review + certificate: ${live.replace("/live", "/submit")}` },
  ];
  for (const s of steps) {
    // Steps whose time already passed (late sign-ups) are skipped, except the welcome.
    if (s.template !== "welcome" && s.at < Date.now()) continue;
    await run("INSERT INTO outbox(user_id, channel, template, body, send_at) VALUES (?, 'whatsapp', ?, ?, ?)", [
      userId,
      s.template,
      s.body,
      new Date(s.at).toISOString(),
    ]);
  }
}

export function fmtIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
