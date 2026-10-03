import { NextRequest } from "next/server";
import { processOutbox } from "@/lib/messaging";
import { all } from "@/lib/db";
import { adminAllowed, json } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  return json(await processOutbox());
}

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const rows = await all(
    `SELECT o.id, u.name, o.template, o.body, o.send_at, o.sent_at, o.status, o.provider
     FROM outbox o JOIN users u ON u.id = o.user_id ORDER BY o.send_at ASC LIMIT 40`,
  );
  return json({ messages: rows });
}
