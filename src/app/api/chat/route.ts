import { NextRequest } from "next/server";
import { handleWhatsApp } from "@/lib/wabot";
import { all } from "@/lib/db";
import { body, clientIp, json, rateLimited, tooMany } from "@/lib/http";

// Website chat bubble. The session id is a random, unguessable string kept in the visitor's browser, so
// one visitor cannot read or continue another's conversation.
const SID = /^w_[a-z0-9]{16,40}$/;

export async function POST(req: NextRequest) {
  if (rateLimited(req, "chat", 40, 60000)) return tooMany();
  const b = await body<{ sid?: string; text?: string }>(req);
  if (!b.sid || !SID.test(b.sid) || !b.text?.trim()) return json({ error: "sid and text required" }, 400);
  const replies = await handleWhatsApp(b.sid, b.text.slice(0, 1000), { ip: clientIp(req), trusted: false });
  return json({ replies });
}

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid") ?? "";
  if (!SID.test(sid)) return json({ messages: [] });
  const rows = await all("SELECT direction, body FROM wa_messages WHERE phone = ? ORDER BY id DESC LIMIT 60", [sid]);
  return json({ messages: rows.reverse() });
}
