import { NextRequest } from "next/server";
import { one, run } from "@/lib/db";
import { track } from "@/lib/growth";
import { emit } from "@/lib/webhooks";
import { body, json, rateLimited, tooMany } from "@/lib/http";

// Attendance: a registered student checks in from the live room with their email or phone.
export async function POST(req: NextRequest) {
  if (rateLimited(req, "checkin", 10, 60000)) return tooMany();
  const b = await body<{ id?: string }>(req);
  const raw = (b.id ?? "").trim().toLowerCase();
  if (!raw) return json({ ok: false, error: "Enter your email or phone" }, 400);
  const phone = raw.replace(/\D/g, "").slice(-10);
  const u = await one<{ id: number; name: string; attended: number }>(
    "SELECT id, name, attended FROM users WHERE email = ? OR (length(?) = 10 AND phone = ?)",
    [raw, phone, phone],
  );
  if (!u) return json({ ok: false, error: "Not registered. You can still watch, but register to get the certificate." }, 404);
  if (!Number(u.attended)) {
    await run("UPDATE users SET attended = 1 WHERE id = ?", [u.id]);
    await track("checked_in", { userId: Number(u.id) });
    await emit("user.checked_in", { user_id: Number(u.id), name: u.name });
  }
  return json({ ok: true, name: String(u.name).split(" ")[0] });
}
