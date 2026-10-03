import { NextRequest } from "next/server";
import { run } from "@/lib/db";
import { adminAllowed, body, json } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ id?: number; action?: "approve" | "reject" }>(req);
  if (!b.id || !b.action) return json({ error: "id and action required" }, 400);
  if (b.action === "approve") {
    await run("UPDATE users SET fraud_score = 0, fraud_reasons = NULL WHERE id = ?", [b.id]);
  } else {
    await run("UPDATE users SET fraud_score = 100, verified = 0 WHERE id = ?", [b.id]);
  }
  return json({ ok: true });
}
