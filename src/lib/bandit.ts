import { all, one, run, now } from "./db";
import { VARIANTS } from "./config";

export type VariantRow = { key: string; headline: string; sub: string; source: string; active: number };
export type VariantStats = VariantRow & { views: number; regs: number; rate: number; pBest: number; share: number };

// The two hand-written headlines are the starting arms. They are copy, not data.
async function ensureBaseVariants() {
  const n = await one<{ n: number }>("SELECT COUNT(*) AS n FROM variants");
  if (Number(n?.n ?? 0) > 0) return;
  for (const [key, v] of Object.entries(VARIANTS)) {
    await run("INSERT OR IGNORE INTO variants(key, headline, sub, source, created_at) VALUES (?, ?, ?, 'manual', ?)", [key, v.headline, v.sub, now()]);
  }
}

export async function listVariants(activeOnly = false) {
  await ensureBaseVariants();
  return all<VariantRow>(`SELECT key, headline, sub, source, active FROM variants ${activeOnly ? "WHERE active = 1" : ""} ORDER BY created_at, key`);
}

export async function addVariant(headline: string, sub: string, source: "manual" | "copilot") {
  await ensureBaseVariants();
  const count = await one<{ n: number }>("SELECT COUNT(*) AS n FROM variants");
  const key = `V${Number(count?.n ?? 0) + 1}`;
  await run("INSERT INTO variants(key, headline, sub, source, created_at) VALUES (?, ?, ?, ?, ?)", [key, headline.trim(), sub.trim(), source, now()]);
  return key;
}

export async function setVariantActive(key: string, active: boolean) {
  await run("UPDATE variants SET active = ? WHERE key = ?", [active ? 1 : 0, key]);
}

async function counts() {
  const views = await all<{ variant: string; n: number }>(
    "SELECT variant, COUNT(DISTINCT visitor_id) AS n FROM events WHERE type = 'page_view' AND variant IS NOT NULL GROUP BY variant",
  );
  const regs = await all<{ variant: string; n: number }>("SELECT variant, COUNT(*) AS n FROM users WHERE variant IS NOT NULL GROUP BY variant");
  const get = (rows: { variant: string; n: number }[], k: string) => Number(rows.find((r) => r.variant === k)?.n ?? 0);
  return { views: (k: string) => get(views, k), regs: (k: string) => get(regs, k) };
}

// ---------- Thompson sampling ----------

function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Marsaglia-Tsang gamma sampler (shape >= 1; we always pass >= 1).
function gamma(shape: number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function beta(a: number, b: number) {
  const x = gamma(a);
  return x / (x + gamma(b));
}

// Each arm's conversion rate gets a Beta(1 + regs, 1 + views - regs) posterior. Draw once from each, show the highest.
export async function pickVariant(): Promise<VariantRow> {
  const arms = await listVariants(true);
  if (arms.length === 0) return (await listVariants())[0];
  const c = await counts();
  let best = arms[0];
  let bestDraw = -1;
  for (const a of arms) {
    const v = c.views(a.key);
    const r = Math.min(c.regs(a.key), v);
    const draw = beta(1 + r, 1 + v - r);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = a;
    }
  }
  return best;
}

// Probability each active arm is the best, by Monte Carlo over the posteriors. This also equals its expected traffic share.
export async function variantStats(): Promise<VariantStats[]> {
  const rows = await listVariants();
  const c = await counts();
  const active = rows.filter((r) => Number(r.active));
  const wins: Record<string, number> = {};
  const SIMS = 4000;
  for (let i = 0; i < SIMS && active.length; i++) {
    let best = "";
    let bestDraw = -1;
    for (const a of active) {
      const v = c.views(a.key);
      const r = Math.min(c.regs(a.key), v);
      const d = beta(1 + r, 1 + v - r);
      if (d > bestDraw) {
        bestDraw = d;
        best = a.key;
      }
    }
    wins[best] = (wins[best] ?? 0) + 1;
  }
  const totalViews = rows.reduce((s, r) => s + c.views(r.key), 0);
  return rows.map((r) => {
    const views = c.views(r.key);
    const regs = c.regs(r.key);
    return {
      ...r,
      active: Number(r.active),
      views,
      regs,
      rate: views ? regs / views : 0,
      pBest: Number(r.active) ? (wins[r.key] ?? 0) / SIMS : 0,
      share: totalViews ? views / totalViews : 0,
    };
  });
}
