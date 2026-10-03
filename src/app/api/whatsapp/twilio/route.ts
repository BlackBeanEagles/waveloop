import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { handleWhatsApp } from "@/lib/wabot";
import { clientIp } from "@/lib/http";

// Real WhatsApp: point the Twilio sandbox "When a message comes in" webhook here.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  if (!validTwilioSignature(req, params)) return new Response("invalid signature", { status: 403 });
  const replies = await handleWhatsApp(params.From ?? "", params.Body ?? "", { ip: clientIp(req) });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${replies.map((r) => `<Message>${escapeXml(r)}</Message>`).join("")}</Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

function validTwilioSignature(req: NextRequest, params: Record<string, string>) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true; // not configured: local testing only
  const url = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") + "/api/whatsapp/twilio";
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  return req.headers.get("x-twilio-signature") === expected;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
