import { NextRequest } from "next/server";
import { checkOtp, issueOtp } from "@/lib/growth";
import { afterVerified } from "@/lib/register";
import { one } from "@/lib/db";
import { integrations } from "@/lib/config";
import { sendEmail } from "@/lib/messaging";
import { body, json, rateLimited, tooMany } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (rateLimited(req, "verify", 15, 600000)) return tooMany();
  const b = await body<{ userId?: number; code?: string; resend?: boolean }>(req);
  if (!b.userId) return json({ ok: false, error: "missing userId" }, 400);
  if (b.resend) {
    const u = await one<{ email: string }>("SELECT email FROM users WHERE id = ?", [b.userId]);
    if (!u) return json({ ok: false, error: "unknown user" }, 404);
    const code = await issueOtp(b.userId);
    if (integrations.email()) {
      await sendEmail(String(u.email), `${code} is your workshop verification code`, `Your code is ${code}. It expires in 10 minutes.`);
      return json({ ok: true, otpSentVia: "email" });
    }
    return json({ ok: true, otpSentVia: "demo", demoOtp: code });
  }
  const res = await checkOtp(b.userId, b.code ?? "");
  if (res.ok) {
    // checkOtp also returns ok for an already-verified user; only fire events on the first verification.
    if (res.firstTime) await afterVerified(b.userId);
    const u = await one<{ ref_code: string }>("SELECT ref_code FROM users WHERE id = ?", [b.userId]);
    return json({ ok: true, refCode: u?.ref_code });
  }
  return json(res, 400);
}
