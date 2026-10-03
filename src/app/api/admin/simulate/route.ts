import { NextRequest } from "next/server";
import { resetDemo, simulateNextDay } from "@/lib/simulate";
import { adminAllowed, body, json } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ action?: string }>(req);
  if (b.action === "reset") {
    await resetDemo();
    return json({ ok: true });
  }
  if (b.action === "next_day") return json({ ok: true, ...(await simulateNextDay()) });
  return json({ error: "action must be reset or next_day" }, 400);
}
