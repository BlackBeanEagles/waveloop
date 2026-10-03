import { NextRequest } from "next/server";
import { registerUser, type RegisterInput } from "@/lib/register";
import { body, clientIp, deviceKey, json, rateLimited, tooMany } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (rateLimited(req, "register", 5, 600000)) return tooMany();
  const b = await body<RegisterInput>(req);
  const res = await registerUser(
    { ...b, ref: b.ref ?? req.cookies.get("wl_ref")?.value ?? null, amb: b.amb ?? req.cookies.get("wl_amb")?.value ?? null },
    { ip: clientIp(req), device: deviceKey(req, b.visitorId) },
  );
  return json(res, res.ok ? 200 : 400);
}
