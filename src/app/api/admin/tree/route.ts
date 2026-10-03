import { NextRequest } from "next/server";
import { referralForest } from "@/lib/tree";
import { adminAllowed, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  return json(await referralForest());
}
