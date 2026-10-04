import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { handleWhatsApp } from "@/lib/wabot";
import { sendWhatsApp } from "@/lib/messaging";

// Meta WhatsApp Cloud API webhook. In the Meta app: WhatsApp > Configuration > Webhook
//   Callback URL: https://<site>/api/whatsapp/meta   Verify token: WHATSAPP_VERIFY_TOKEN   Subscribe: messages

// 1. Verification handshake when you save the webhook in Meta's dashboard.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

type MetaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};

// Meta retries a delivery it thinks failed; remember recent message ids so a retry doesn't double-reply.
const seen = new Map<string, number>();
function firstTime(id: string) {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 10 * 60_000) seen.delete(k);
  if (seen.has(id)) return false;
  seen.set(id, now);
  return true;
}

// 2. Incoming messages.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });

  let payload: { entry?: { changes?: { value?: { messages?: MetaMessage[] } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const messages = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));

  // Answer Meta within its timeout, then do the work (Claude calls can take a few seconds).
  after(async () => {
    for (const msg of messages) {
      if (!firstTime(msg.id)) continue;
      const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;
      if (!text) {
        await sendWhatsApp(msg.from, "I can read text messages only. Reply MENU to see options.");
        continue;
      }
      const replies = await handleWhatsApp(msg.from, text, { ip: `meta:${msg.from}`, trusted: true });
      for (const r of replies) {
        const res = await sendWhatsApp(msg.from, r);
        if (!res.ok) console.error("meta send failed", res.error);
      }
    }
  });
  return new Response("ok", { status: 200 });
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // local testing only
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
