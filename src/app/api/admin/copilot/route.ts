import { NextRequest } from "next/server";
import { lastCopilotRun, runCopilot } from "@/lib/copilot";
import { adminAllowed, json, rateLimited, tooMany } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  return json({ run: await lastCopilotRun() });
}

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  if (rateLimited(req, "copilot", 6, 600000)) return tooMany();
  const r = await runCopilot();
  return json({ run: { ...r, created_at: new Date().toISOString() } });
}
