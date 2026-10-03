import { NextRequest, NextResponse } from "next/server";
import { one } from "@/lib/db";
import { track } from "@/lib/growth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ref = code.toUpperCase();
  const owner = await one<{ id: number; lang: string }>("SELECT id, lang FROM users WHERE ref_code = ?", [ref]);
  const url = new URL("/", req.url);
  if (owner) {
    url.searchParams.set("ref", ref);
    url.searchParams.set("utm_source", "referral");
    // Friends usually share a language: open the page in the referrer's language.
    if (owner.lang && owner.lang !== "en") url.searchParams.set("lang", String(owner.lang));
    await track("referral_click", { userId: Number(owner.id), channel: "referral" });
  }
  const res = NextResponse.redirect(url);
  if (owner) res.cookies.set("wl_ref", ref, { maxAge: 60 * 60 * 24 * 14, path: "/" });
  return res;
}
