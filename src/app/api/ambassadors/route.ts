import { NextRequest } from "next/server";
import { z } from "zod";
import { one, run, now } from "@/lib/db";
import { collegeIdByName, makeCode } from "@/lib/growth";
import { body, json, rateLimited, tooMany } from "@/lib/http";

const Schema = z.object({ name: z.string().trim().min(2), email: z.string().trim().toLowerCase().email(), college: z.string().trim().min(2) });

export async function POST(req: NextRequest) {
  if (rateLimited(req, "amb", 5, 600000)) return tooMany();
  const parsed = Schema.safeParse(await body(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  const existing = await one<{ code: string }>("SELECT code FROM ambassadors WHERE email = ?", [d.email]);
  if (existing) return json({ code: existing.code });
  let code = makeCode("AMB", 4);
  while (await one("SELECT 1 FROM ambassadors WHERE code = ?", [code])) code = makeCode("AMB", 4);
  await run("INSERT INTO ambassadors(name, email, college_id, code, created_at) VALUES (?, ?, ?, ?, ?)", [d.name, d.email, await collegeIdByName(d.college), code, now()]);
  return json({ code });
}
