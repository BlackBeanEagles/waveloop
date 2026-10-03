import { NextRequest, NextResponse } from "next/server";
import { body } from "@/lib/http";

export async function POST(req: NextRequest) {
  const { key } = await body<{ key?: string }>(req);
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return NextResponse.json({ ok: false, error: "Wrong key" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("wl_admin", key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 14, path: "/" });
  return res;
}
