import { z } from "zod";
import { one, run, now } from "./db";
import { collegeIdByName, hash, issueOtp, refCodeFor, scheduleDrip, scoreFraud, track, FRAUD_THRESHOLD } from "./growth";
import { sendEmail, sendWhatsApp } from "./messaging";
import { WORKSHOP_TITLE, integrations } from "./config";

export const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, "").slice(-10))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  college: z.string().trim().min(2).max(120),
  branch: z.string().min(1),
  year: z.string().min(1),
  ref: z.string().optional().nullable(),
  amb: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  variant: z.string().optional().nullable(),
  visitorId: z.string().optional().nullable(),
  idea: z.unknown().optional(),
  otpVia: z.enum(["email", "whatsapp"]).default("email"),
  lang: z.enum(["en", "hi", "te", "ta"]).default("en"),
});
export type RegisterInput = z.input<typeof RegisterSchema>;

export type RegisterResult =
  | { ok: true; userId: number; refCode: string; otpSentVia: string; demoOtp?: string; flagged: boolean; existing?: boolean }
  | { ok: false; error: string };

export async function registerUser(raw: RegisterInput, ctx: { ip: string; device: string }): Promise<RegisterResult> {
  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const existing = await one<{ id: number; ref_code: string; verified: number; email: string; phone: string }>(
    "SELECT id, ref_code, verified, email, phone FROM users WHERE email = ? OR phone = ?",
    [d.email, d.phone],
  );
  if (existing) {
    if (Number(existing.verified)) {
      return { ok: true, userId: Number(existing.id), refCode: String(existing.ref_code), otpSentVia: "none", flagged: false, existing: true };
    }
    // Unverified duplicate: resend the code instead of creating a second row.
    const code = await issueOtp(Number(existing.id));
    const via = await deliverOtp(d.otpVia, String(existing.email), String(existing.phone), code);
    return { ok: true, userId: Number(existing.id), refCode: String(existing.ref_code), otpSentVia: via, demoOtp: via === "demo" ? code : undefined, flagged: false };
  }

  const referrer = d.ref ? await one<{ id: number }>("SELECT id FROM users WHERE ref_code = ?", [d.ref.toUpperCase()]) : undefined;
  const amb = d.amb ? await one<{ id: number }>("SELECT id FROM ambassadors WHERE code = ?", [d.amb.toUpperCase()]) : undefined;
  const channel = referrer ? "referral" : amb ? "ambassador" : d.channel || "direct";

  const ipHash = hash(ctx.ip);
  const deviceHash = hash(ctx.device);
  const fraud = await scoreFraud({ name: d.name, email: d.email, phone: d.phone, ipHash, deviceHash, referrerId: referrer ? Number(referrer.id) : null });

  const collegeId = await collegeIdByName(d.college);
  let refCode = refCodeFor(d.name);
  while (await one("SELECT 1 FROM users WHERE ref_code = ?", [refCode])) refCode = refCodeFor(d.name);

  const r = await run(
    `INSERT INTO users(name, email, phone, college_id, branch, year, ref_code, referred_by, ambassador_id, channel, variant, lang, idea_json,
       ip_hash, device_hash, fraud_score, fraud_reasons, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.name,
      d.email,
      d.phone,
      collegeId,
      d.branch,
      d.year,
      refCode,
      referrer ? Number(referrer.id) : null,
      amb ? Number(amb.id) : null,
      channel,
      d.variant ?? null,
      d.lang,
      d.idea ? JSON.stringify(d.idea) : null,
      ipHash,
      deviceHash,
      fraud.score,
      fraud.reasons.length ? JSON.stringify(fraud.reasons) : null,
      now(),
    ],
  );
  const userId = Number(r.lastInsertRowid);
  await track("registered", { visitorId: d.visitorId ?? undefined, userId, channel, variant: d.variant ?? undefined });
  const ideaTitle = (d.idea as { title?: string } | undefined)?.title;
  await scheduleDrip(userId, d.name, refCode, d.lang, ideaTitle);

  const code = await issueOtp(userId);
  const via = await deliverOtp(d.otpVia, d.email, d.phone, code);
  return { ok: true, userId, refCode, otpSentVia: via, demoOtp: via === "demo" ? code : undefined, flagged: fraud.score >= FRAUD_THRESHOLD };
}

async function deliverOtp(via: "email" | "whatsapp", email: string, phone: string, code: string): Promise<string> {
  const msg = `Your verification code for "${WORKSHOP_TITLE}" is ${code}. It expires in 10 minutes.`;
  if (via === "whatsapp" && integrations.twilio()) {
    const r = await sendWhatsApp(phone, msg);
    if (r.ok) return "whatsapp";
  }
  if (integrations.email()) {
    const r = await sendEmail(email, `${code} is your workshop verification code`, msg);
    if (r.ok) return "email";
  }
  // No provider configured: demo mode shows the code on screen.
  return "demo";
}
