import { createHmac, randomBytes } from "crypto";
import { all, one, run, now } from "./db";

// Outgoing webhooks so NxtWave's own tools (n8n, Zapier, a CRM, a Slack bot) can react to campaign events.
export const EVENTS = ["user.registered", "user.verified", "referral.counted", "user.checked_in", "submission.graded", "help.escalated"] as const;
export type WebhookEvent = (typeof EVENTS)[number];

const MAX_ATTEMPTS = 6;
const BACKOFF_MIN = [0, 1, 5, 30, 120, 720]; // minutes before attempt n+1

export function validWebhookUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Not a valid URL";
  }
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local && process.env.NODE_ENV !== "production")) return "Use an https:// URL";
  // Basic SSRF guard: no private-network or metadata targets in production.
  if (process.env.NODE_ENV === "production" && (local || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(u.hostname))) return "Private network addresses are not allowed";
  return null;
}

export async function addWebhook(url: string, events: string[]) {
  const evs = events.filter((e): e is WebhookEvent => (EVENTS as readonly string[]).includes(e));
  if (!evs.length) throw new Error("Pick at least one event");
  const secret = `whsec_${randomBytes(18).toString("hex")}`;
  const r = await run("INSERT INTO webhooks(url, events, secret, created_at) VALUES (?, ?, ?, ?)", [url, JSON.stringify(evs), secret, now()]);
  return { id: Number(r.lastInsertRowid), secret };
}

export async function listWebhooks() {
  const hooks = await all<{ id: number; url: string; events: string; secret: string; active: number; created_at: string }>("SELECT * FROM webhooks ORDER BY id");
  const stats = await all<{ webhook_id: number; status: string; n: number }>("SELECT webhook_id, status, COUNT(*) AS n FROM webhook_deliveries GROUP BY webhook_id, status");
  return hooks.map((h) => ({
    id: Number(h.id),
    url: String(h.url),
    events: JSON.parse(String(h.events)) as string[],
    // Show only a hint of the secret after creation.
    secretHint: `${String(h.secret).slice(0, 10)}…`,
    active: Boolean(Number(h.active)),
    stats: Object.fromEntries(stats.filter((s) => Number(s.webhook_id) === Number(h.id)).map((s) => [s.status, Number(s.n)])),
  }));
}

export async function setWebhookActive(id: number, active: boolean) {
  await run("UPDATE webhooks SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}
export async function deleteWebhook(id: number) {
  await run("DELETE FROM webhook_deliveries WHERE webhook_id = ?", [id]);
  await run("DELETE FROM webhooks WHERE id = ?", [id]);
}

export async function recentDeliveries(limit = 25) {
  return all("SELECT d.id, d.webhook_id, w.url, d.event, d.status, d.attempts, d.response_code, d.error, d.created_at FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id ORDER BY d.id DESC LIMIT ?", [limit]);
}

// Queue the event for every subscribed endpoint, then try delivering right away. Never throws into the caller:
// a broken webhook must not break registration.
export async function emit(event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const hooks = await all<{ id: number; events: string }>("SELECT id, events FROM webhooks WHERE active = 1");
    const targets = hooks.filter((h) => (JSON.parse(String(h.events)) as string[]).includes(event));
    if (!targets.length) return;
    const payload = JSON.stringify({ id: `evt_${randomBytes(8).toString("hex")}`, event, created_at: now(), data });
    const ids: number[] = [];
    for (const h of targets) {
      const r = await run("INSERT INTO webhook_deliveries(webhook_id, event, payload, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?)", [h.id, event, payload, now(), now()]);
      ids.push(Number(r.lastInsertRowid));
    }
    await Promise.all(ids.map((id) => attempt(id)));
  } catch (e) {
    console.error("webhook emit failed", e);
  }
}

export function sign(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

async function attempt(deliveryId: number) {
  const d = await one<{ id: number; payload: string; attempts: number; url: string; secret: string; event: string }>(
    "SELECT d.id, d.payload, d.attempts, d.event, w.url, w.secret FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id WHERE d.id = ?",
    [deliveryId],
  );
  if (!d) return;
  const ts = String(Math.floor(Date.now() / 1000));
  const body = String(d.payload);
  let code: number | null = null;
  let error: string | null = null;
  try {
    const r = await fetch(String(d.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "WaveLoop-Webhooks/1.0",
        "X-WaveLoop-Event": String(d.event),
        "X-WaveLoop-Timestamp": ts,
        "X-WaveLoop-Signature": `sha256=${sign(String(d.secret), ts, body)}`,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    code = r.status;
    if (!r.ok) error = `HTTP ${r.status}`;
  } catch (e) {
    error = String(e).slice(0, 200);
  }
  const attempts = Number(d.attempts) + 1;
  const ok = !error;
  const dead = !ok && attempts >= MAX_ATTEMPTS;
  const next = new Date(Date.now() + (BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)] ?? 720) * 60_000).toISOString();
  await run("UPDATE webhook_deliveries SET status = ?, attempts = ?, response_code = ?, error = ?, next_attempt_at = ? WHERE id = ?", [
    ok ? "delivered" : dead ? "failed" : "retrying",
    attempts,
    code,
    error,
    next,
    deliveryId,
  ]);
}

// Called from the cron route alongside the drip engine.
export async function retryDueDeliveries(limit = 100) {
  const due = await all<{ id: number }>("SELECT id FROM webhook_deliveries WHERE status IN ('pending','retrying') AND next_attempt_at <= ? ORDER BY id LIMIT ?", [now(), limit]);
  for (const d of due) await attempt(Number(d.id));
  return due.length;
}

export async function sendTestEvent(webhookId: number) {
  const payload = JSON.stringify({ id: `evt_test_${randomBytes(4).toString("hex")}`, event: "ping", created_at: now(), data: { message: "WaveLoop test event" } });
  const r = await run("INSERT INTO webhook_deliveries(webhook_id, event, payload, next_attempt_at, created_at) VALUES (?, 'ping', ?, ?, ?)", [webhookId, payload, now(), now()]);
  await attempt(Number(r.lastInsertRowid));
  return one("SELECT status, response_code, error FROM webhook_deliveries WHERE id = ?", [Number(r.lastInsertRowid)]);
}
