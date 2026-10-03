import { all, now, run, one } from "./db";
import { integrations } from "./config";
import { referralCount } from "./growth";
import { RESCUE_THRESHOLD, scoreUser } from "./showup";

export type SendResult = { provider: "meta" | "twilio" | "resend" | "no-provider"; ok: boolean; error?: string };

export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  if (integrations.metaWhatsApp()) return sendViaMeta(to, body);
  if (!integrations.twilio()) return { provider: "no-provider", ok: true };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({
    From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:+91${to.replace(/\D/g, "").slice(-10)}`,
    Body: body,
  });
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!r.ok) return { provider: "twilio", ok: false, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
    return { provider: "twilio", ok: true };
  } catch (e) {
    return { provider: "twilio", ok: false, error: String(e) };
  }
}

// Meta WhatsApp Cloud API. Free-form text is allowed within 24h of the student's last message; outside that window
// Meta rejects it (error 131047) unless an approved template is used, and the outbox records the failure.
async function sendViaMeta(to: string, body: string): Promise<SendResult> {
  const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
  const digits = to.replace(/\D/g, "");
  const recipient = digits.length === 10 ? `91${digits}` : digits;
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { preview_url: true, body: body.slice(0, 4096) } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { provider: "meta", ok: false, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
    return { provider: "meta", ok: true };
  } catch (e) {
    return { provider: "meta", ok: false, error: String(e) };
  }
}

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!integrations.email()) return { provider: "no-provider", ok: true };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "WaveLoop <onboarding@resend.dev>", to, subject, text }),
    });
    if (!r.ok) return { provider: "resend", ok: false, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
    return { provider: "resend", ok: true };
  } catch (e) {
    return { provider: "resend", ok: false, error: String(e) };
  }
}

// Sends every due outbox message. Rules that depend on the user's state are checked at send time,
// so a nudge never goes to someone who already did the thing.
export async function processOutbox(limit = 200) {
  const due = await all<{ id: number; user_id: number; template: string; body: string; phone: string; verified: number; attended: number }>(
    `SELECT o.id, o.user_id, o.template, o.body, u.phone, u.verified, u.attended
     FROM outbox o JOIN users u ON u.id = o.user_id
     WHERE o.status = 'queued' AND o.send_at <= ? ORDER BY o.send_at LIMIT ?`,
    [now(), limit],
  );
  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const m of due) {
    let skip: string | null = null;
    if (!Number(m.verified) && m.template !== "welcome") skip = "unverified";
    if (m.template === "referral_nudge" && (await referralCount(Number(m.user_id))) > 0) skip = "already referred";
    if (m.template === "submit_project" && !Number(m.attended)) skip = "did not attend";
    if (m.template.startsWith("rescue_")) {
      const p = await scoreUser(Number(m.user_id));
      if (p != null && p >= RESCUE_THRESHOLD) skip = `likely to attend (${Math.round(p * 100)}%)`;
    }
    if (skip) {
      await run("UPDATE outbox SET status = 'skipped', sent_at = ?, provider = ? WHERE id = ?", [now(), skip, m.id]);
      summary.skipped++;
      continue;
    }
    const res = await sendWhatsApp(String(m.phone), String(m.body));
    await run("UPDATE outbox SET status = ?, sent_at = ?, provider = ? WHERE id = ?", [
      res.ok ? "sent" : "failed",
      now(),
      res.ok ? res.provider : `${res.provider}: ${res.error}`,
      m.id,
    ]);
    if (res.ok) summary.sent++;
    else summary.failed++;
  }
  const remaining = await one<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'queued'");
  return { ...summary, queued: Number(remaining?.n ?? 0) };
}
