import { NextRequest } from "next/server";
import { addVariant, setVariantActive, variantStats } from "@/lib/bandit";
import { adminAllowed, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  return json({ variants: await variantStats() });
}

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ action?: string; key?: string; headline?: string; sub?: string; source?: "manual" | "copilot" }>(req);
  if (b.action === "add") {
    if (!b.headline?.trim() || !b.sub?.trim()) return json({ error: "headline and sub required" }, 400);
    return json({ key: await addVariant(b.headline.slice(0, 140), b.sub.slice(0, 240), b.source === "copilot" ? "copilot" : "manual") });
  }
  if ((b.action === "pause" || b.action === "resume") && b.key) {
    await setVariantActive(b.key, b.action === "resume");
    return json({ ok: true });
  }
  return json({ error: "unknown action" }, 400);
}
