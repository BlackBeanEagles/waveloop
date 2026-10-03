import { NextRequest } from "next/server";
import { track } from "@/lib/growth";
import { body, json } from "@/lib/http";

const ALLOWED = new Set(["page_view", "form_started", "shared", "referral_page_view"]);

export async function POST(req: NextRequest) {
  const b = await body<{ type?: string; visitorId?: string; variant?: string; channel?: string; userId?: number; meta?: unknown }>(req);
  if (!b.type || !ALLOWED.has(b.type)) return json({ error: "unknown event" }, 400);
  await track(b.type, { visitorId: b.visitorId, variant: b.variant, channel: b.channel, userId: b.userId, meta: b.meta });
  return json({ ok: true });
}
