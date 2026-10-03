import { NextRequest } from "next/server";
import { all } from "@/lib/db";
import { fitFromAttendance, resetModel, showupReport } from "@/lib/showup";
import { adminAllowed, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const langs = await all<{ lang: string; regs: number; verified: number }>(
    "SELECT lang, COUNT(*) AS regs, SUM(verified) AS verified FROM users GROUP BY lang ORDER BY regs DESC",
  );
  return json({ ...(await showupReport()), languages: langs.map((l) => ({ lang: String(l.lang), regs: Number(l.regs), verified: Number(l.verified ?? 0) })) });
}

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ action?: string }>(req);
  if (b.action === "fit") return json(await fitFromAttendance());
  if (b.action === "reset") {
    await resetModel();
    return json({ ok: true });
  }
  return json({ error: "action must be fit or reset" }, 400);
}
