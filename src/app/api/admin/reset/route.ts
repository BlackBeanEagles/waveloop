import { NextRequest } from "next/server";
import { clearAllData } from "@/lib/admin";
import { adminAllowed, body, json } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ action?: string }>(req);
  if (b.action !== "clear") return json({ error: "action must be clear" }, 400);
  await clearAllData();
  return json({ ok: true });
}
