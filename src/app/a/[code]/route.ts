import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { track } from "@/lib/growth";

// Ambassador links: /a/AMBXXXX?g=group-name lets one ambassador track each WhatsApp group separately.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const amb = await one<{ id: number }>("SELECT id FROM ambassadors WHERE code = ?", [code.toUpperCase()]);
  const url = new URL("/", req.url);
  url.searchParams.set("utm_source", amb ? "ambassador" : "direct");
  const group = req.nextUrl.searchParams.get("g");
  if (amb) await track("amb_click", { channel: "ambassador", meta: { amb: Number(amb.id), group: group ?? "general" } });
  if (group) url.searchParams.set("utm_content", group);
  const res = NextResponse.redirect(url);
  if (amb) res.cookies.set("wl_amb", code.toUpperCase(), { maxAge: 60 * 60 * 24 * 14, path: "/" });
  return res;
}
