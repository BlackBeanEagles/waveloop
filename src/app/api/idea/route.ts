import { NextRequest } from "next/server";
import { generateIdea } from "@/lib/ai";
import { track } from "@/lib/growth";
import { body, json, rateLimited, tooMany } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (rateLimited(req, "idea", 8, 60000)) return tooMany();
  const b = await body<{ branch?: string; interest?: string; skill?: string; visitorId?: string; variant?: string; channel?: string }>(req);
  if (!b.branch || !b.interest) return json({ error: "branch and interest are required" }, 400);
  const idea = await generateIdea({ branch: b.branch, interest: b.interest.slice(0, 80), skill: b.skill ?? "beginner" });
  await track("idea_generated", { visitorId: b.visitorId, variant: b.variant, channel: b.channel, meta: { source: idea.source } });
  return json({ idea });
}
