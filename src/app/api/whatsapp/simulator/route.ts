import { NextRequest } from "next/server";
import { handleWhatsApp } from "@/lib/wabot";
import { all } from "@/lib/db";
import { body, clientIp, json, rateLimited, tooMany } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (rateLimited(req, "wa", 30, 60000)) return tooMany();
  const b = await body<{ phone?: string; text?: string }>(req);
  const phone = (b.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone) || !b.text?.trim()) return json({ error: "phone and text required" }, 400);
  const replies = await handleWhatsApp(phone, b.text, { ip: clientIp(req) });
  return json({ replies });
}

export async function GET(req: NextRequest) {
  const phone = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  const rows = await all("SELECT direction, body, created_at FROM wa_messages WHERE phone = ? ORDER BY id DESC LIMIT 60", [phone]);
  return json({ messages: rows.reverse() });
}
