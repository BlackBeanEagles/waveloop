import { NextRequest } from "next/server";
import { z } from "zod";
import { askHelp, getTicket, updateTicket } from "@/lib/helpdesk";
import { body, json, rateLimited, tooMany } from "@/lib/http";

const Ask = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().optional().or(z.literal("")),
  step: z.string().max(120).optional(),
  problem: z.string().trim().min(5, "Paste the error or describe what's wrong").max(6000),
  lang: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const b = await body<Record<string, unknown>>(req);
  // Feedback on an existing ticket: did the answer work?
  if (b.ticketId) {
    if (rateLimited(req, "help-fb", 30, 60000)) return tooMany();
    const action = b.action === "solved" ? "solved" : b.action === "escalate" ? "escalate" : null;
    if (!action) return json({ error: "action must be solved or escalate" }, 400);
    return json({ ok: await updateTicket(Number(b.ticketId), action) });
  }
  if (rateLimited(req, "help", 6, 60000)) return tooMany();
  const parsed = Ask.safeParse(b);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, 400);
  return json(await askHelp({ ...parsed.data, email: parsed.data.email || undefined }));
}

// Students poll this to see a mentor's reply after escalating.
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return json({ error: "id required" }, 400);
  return json({ ticket: await getTicket(id) });
}
