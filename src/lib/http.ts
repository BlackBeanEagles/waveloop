import { NextRequest, NextResponse } from "next/server";

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function deviceKey(req: NextRequest, visitorId?: string | null) {
  return `${visitorId ?? "anon"}|${req.headers.get("user-agent") ?? ""}`;
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

// Demo deployments leave the admin open; set ADMIN_KEY to lock it.
export function adminAllowed(req: NextRequest) {
  const key = process.env.ADMIN_KEY;
  if (!key) return true;
  return req.headers.get("x-admin-key") === key || req.cookies.get("wl_admin")?.value === key;
}

// Per-instance sliding-window limiter. Stops one client from draining Claude credits or spamming sign-ups.
const hits = new Map<string, number[]>();
export function rateLimited(req: NextRequest, bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${clientIp(req)}`;
  const t = Date.now();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  recent.push(t);
  hits.set(key, recent);
  return recent.length > max;
}
export const tooMany = () => json({ ok: false, error: "Too many requests. Try again in a minute." }, 429);
