import { NextRequest } from "next/server";
import { helpStats, mentorQueue, updateTicket } from "@/lib/helpdesk";
import { adminAllowed, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Mentor view. Open like the admin (ADMIN_KEY) so mentors can be given the key during the workshop.
export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const queue = await mentorQueue();
  return json({ stats: await helpStats(), queue: queue.map((q) => ({ ...q, id: Number(q.id), answer: JSON.parse(String(q.answer)) })) });
}

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ id?: number; note?: string }>(req);
  if (!b.id || !b.note?.trim()) return json({ error: "id and note required" }, 400);
  return json({ ok: await updateTicket(b.id, "mentor_resolve", b.note) });
}
