import { NextRequest, NextResponse } from "next/server";
import { listVariants, pickVariant } from "@/lib/bandit";

export const dynamic = "force-dynamic";

// Sticky assignment: a visitor keeps their headline; new visitors get a Thompson-sampled one.
export async function GET(req: NextRequest) {
  const active = await listVariants(true);
  const forced = req.nextUrl.searchParams.get("v");
  const sticky = req.cookies.get("wl_variant")?.value;
  const chosen = active.find((v) => v.key === forced) ?? active.find((v) => v.key === sticky) ?? (await pickVariant());
  const res = NextResponse.json({ key: chosen.key, headline: chosen.headline, sub: chosen.sub });
  res.cookies.set("wl_variant", chosen.key, { maxAge: 60 * 60 * 24 * 30, path: "/" });
  return res;
}
