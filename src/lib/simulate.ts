import type { InStatement } from "@libsql/client";
import { db, ready, one, all } from "./db";
import { BRANCHES, YEARS } from "./config";
import { ensureColleges, hash, makeCode, setSetting, getSetting, FRAUD_THRESHOLD } from "./growth";

// Deterministic RNG so the demo looks the same every time it is reset.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIRST = ["Aarav", "Sai", "Rahul", "Priya", "Sneha", "Karthik", "Ananya", "Vikram", "Divya", "Rohit", "Lakshmi", "Arjun", "Meghana", "Harsha", "Pooja", "Nikhil", "Keerthi", "Vamsi", "Bhavana", "Teja", "Ishaan", "Swathi", "Manoj", "Ritika", "Akhil", "Sravani", "Varun", "Navya", "Yash", "Tanvi"];
const LAST = ["Reddy", "Sharma", "Rao", "Naidu", "Kumar", "Iyer", "Patel", "Gupta", "Varma", "Nair", "Chowdary", "Singh", "Joshi", "Menon", "Das"];

// Expected sign-ups by channel per campaign day, before referrals. Shaped to the plan:
// ambassadors seed WhatsApp groups on days 1-2, LinkedIn and email support, referrals compound.
const DAILY_VISITS: Record<string, number[]> = {
  whatsapp_groups: [520, 610, 480, 420, 380, 350, 400],
  ambassador: [240, 300, 260, 230, 210, 190, 220],
  linkedin: [90, 110, 130, 120, 110, 100, 140],
  instagram: [60, 70, 80, 75, 70, 65, 90],
  email: [0, 180, 40, 30, 120, 30, 160],
};
const VISIT_SCALE = 0.42;
const P_IDEA = 0.52;
const P_FORM = 0.58;
const P_REG = { A: 0.36, B: 0.45 } as const; // B (placement hook) converts better
const P_VERIFY = 0.86;
const P_SHARE = 0.34;
const REFS_PER_SHARER = 0.95;

export async function resetDemo() {
  await ready();
  await db.executeMultiple(`
    DELETE FROM votes; DELETE FROM polls; DELETE FROM questions; DELETE FROM submissions;
    DELETE FROM outbox; DELETE FROM wa_messages; DELETE FROM wa_sessions; DELETE FROM events;
    DELETE FROM users; DELETE FROM ambassadors; DELETE FROM settings;
  `);
  await ensureColleges();
  const start = new Date(Date.now() - 4.4 * 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  await setSetting("campaign_start", start.toISOString());
  await setSetting("simulated", "1");
  await seedAmbassadors();
  for (let d = 0; d <= 4; d++) await simulateDay(d);
  await seedLive();
}

export async function simulateNextDay() {
  const done = Number((await getSetting("sim_days_done")) ?? "0");
  if (done >= 7) return { day: done, message: "Campaign already complete" };
  // Shift the campaign start back a day so the new day is "today".
  const start = await getSetting("campaign_start");
  if (start) await setSetting("campaign_start", new Date(new Date(start).getTime() - 86_400_000).toISOString());
  await simulateDay(done, true);
  return { day: done + 1 };
}

async function seedAmbassadors() {
  const colleges = await all<{ id: number; name: string }>("SELECT id, name FROM colleges ORDER BY id");
  const r = rng(7);
  const stmts: InStatement[] = colleges.slice(0, 22).map((c, i) => {
    const name = `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
    return {
      sql: "INSERT INTO ambassadors(name, email, college_id, code, groups_reached, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [name, `amb${i}@student.demo`, c.id, makeCode("AMB", 4), 2 + Math.floor(r() * 4), new Date().toISOString()],
    };
  });
  await db.batch(stmts, "write");
}

async function simulateDay(day: number, shifted = false) {
  const start = new Date((await getSetting("campaign_start"))!);
  const r = rng(1000 + day);
  const colleges = await all<{ id: number }>("SELECT id FROM colleges");
  const ambassadors = await all<{ id: number; college_id: number }>("SELECT id, college_id FROM ambassadors");
  const existingSharers = await all<{ id: number; college_id: number }>(
    `SELECT DISTINCT u.id, u.college_id FROM users u JOIN events e ON e.user_id = u.id AND e.type = 'shared'`,
  );
  const dayStart = start.getTime() + day * 86_400_000;
  // The current day is only partly over.
  const isToday = !shifted && day === 4;
  const dayFraction = isToday ? Math.max(0.05, Math.min(1, (Date.now() - dayStart) / 86_400_000)) : 1;
  const ts = () => new Date(dayStart + r() * 86_400_000 * dayFraction).toISOString();

  const stmts: InStatement[] = [];
  const newUsers: { tmp: number; college: number; channel: string; refBy: number | null; amb: number | null; sharer: boolean; t: string }[] = [];
  let counter = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM users"))?.n ?? 0);

  const visit = (channel: string, college: number, amb: number | null, refBy: number | null) => {
    const vid = `sim-${day}-${Math.floor(r() * 1e9)}`;
    const variant = r() < 0.5 ? "A" : "B";
    const t = ts();
    stmts.push({ sql: "INSERT INTO events(type, visitor_id, channel, variant, created_at) VALUES ('page_view', ?, ?, ?, ?)", args: [vid, channel, variant, t] });
    if (r() > P_IDEA) return;
    stmts.push({ sql: "INSERT INTO events(type, visitor_id, channel, variant, created_at) VALUES ('idea_generated', ?, ?, ?, ?)", args: [vid, channel, variant, t] });
    if (r() > P_FORM) return;
    stmts.push({ sql: "INSERT INTO events(type, visitor_id, channel, variant, created_at) VALUES ('form_started', ?, ?, ?, ?)", args: [vid, channel, variant, t] });
    if (r() > P_REG[variant] / P_FORM) return;
    counter++;
    newUsers.push({ tmp: counter, college, channel, refBy, amb, sharer: r() < P_SHARE, t });
    const first = FIRST[Math.floor(r() * FIRST.length)];
    const last = LAST[Math.floor(r() * LAST.length)];
    const fraud = r() < 0.035;
    const verified = !fraud && r() < P_VERIFY ? 1 : 0;
    const phone = `9${String(100000000 + counter * 7919).slice(-9)}`;
    stmts.push({
      sql: `INSERT INTO users(name, email, phone, college_id, branch, year, ref_code, referred_by, ambassador_id, channel, variant,
              verified, ip_hash, device_hash, fraud_score, fraud_reasons, created_at, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `${first} ${last}`,
        fraud ? `${first.toLowerCase()}${counter}@mailinator.com` : `${first.toLowerCase()}.${last.toLowerCase()}${counter}@student.demo`,
        phone,
        college,
        BRANCHES[Math.floor(r() * 6)],
        YEARS[r() < 0.85 ? 0 : 1],
        makeCode(first.slice(0, 4).toUpperCase(), 4),
        refBy,
        amb,
        channel,
        variant,
        verified,
        hash(`ip-${counter}`),
        hash(`dev-${counter}`),
        fraud ? FRAUD_THRESHOLD + Math.floor(r() * 40) : Math.floor(r() * 15),
        fraud ? JSON.stringify(r() < 0.5 ? ["disposable email domain", "same device as referrer (self-referral)"] : ["4 sign-ups from the same network in the last hour", "disposable email domain"]) : null,
        t,
        verified ? t : null,
      ],
    });
  };

  for (const [channel, perDay] of Object.entries(DAILY_VISITS)) {
    const visits = Math.round(perDay[day] * VISIT_SCALE * dayFraction * (0.9 + r() * 0.2));
    for (let i = 0; i < visits; i++) {
      if (channel === "ambassador") {
        const a = ambassadors[Math.floor(Math.pow(r(), 1.6) * ambassadors.length)]; // a few ambassadors carry most of it
        visit(channel, Number(a.college_id), Number(a.id), null);
      } else {
        visit(channel, Number(colleges[Math.floor(Math.pow(r(), 1.3) * colleges.length)].id), null, null);
      }
    }
  }
  // Referral visits from people who shared on earlier days (their friends are mostly same-college).
  for (const s of existingSharers) {
    const visits = Math.round((REFS_PER_SHARER / 0.36) * 0.35 * dayFraction * (r() * 2));
    for (let i = 0; i < visits; i++) visit("referral", Number(s.college_id), null, Number(s.id));
  }

  if (stmts.length) await db.batch(stmts, "write");

  // Share events for today's sharers (need real ids now).
  const created = await all<{ id: number }>("SELECT id FROM users ORDER BY id DESC LIMIT ?", [newUsers.length]);
  const ids = created.map((c) => Number(c.id)).reverse();
  const shareStmts: InStatement[] = [];
  newUsers.forEach((u, i) => {
    if (u.sharer && ids[i]) {
      shareStmts.push({ sql: "INSERT INTO events(type, user_id, channel, created_at) VALUES ('shared', ?, 'whatsapp', ?)", args: [ids[i], u.t] });
    }
  });
  if (shareStmts.length) await db.batch(shareStmts, "write");
  await setSetting("sim_days_done", String(day + 1));
}

async function seedLive() {
  const t = new Date().toISOString();
  await db.batch(
    [
      { sql: "INSERT INTO polls(question, options, active, created_at) VALUES (?, ?, 1, ?)", args: ["Which AI tool have you used the most?", JSON.stringify(["ChatGPT", "Gemini", "Claude", "None yet"]), t] },
      { sql: "INSERT INTO polls(question, options, active, created_at) VALUES (?, ?, 0, ?)", args: ["How confident are you deploying an app today?", JSON.stringify(["Not at all", "A little", "Fairly", "Very"]), t] },
      { sql: "INSERT INTO questions(author, body, upvotes, created_at) VALUES (?, ?, ?, ?)", args: ["Sneha", "Can we use this project in our final-year project submission?", 14, t] },
      { sql: "INSERT INTO questions(author, body, upvotes, created_at) VALUES (?, ?, ?, ?)", args: ["Karthik", "Will the Gemini API free tier be enough for the demo?", 9, t] },
    ],
    "write",
  );
}
