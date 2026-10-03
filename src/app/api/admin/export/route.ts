import { NextRequest } from "next/server";
import { all } from "@/lib/db";
import { adminAllowed, json } from "@/lib/http";

const COLS = ["id", "name", "email", "phone", "college", "branch", "year", "channel", "variant", "ref_code", "referred_by_code", "ambassador_code", "verified", "fraud_score", "attended", "created_at"];

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const rows = await all<Record<string, unknown>>(
    `SELECT u.id, u.name, u.email, u.phone, c.name AS college, u.branch, u.year, u.channel, u.variant, u.ref_code,
            r.ref_code AS referred_by_code, a.code AS ambassador_code, u.verified, u.fraud_score, u.attended, u.created_at
     FROM users u JOIN colleges c ON c.id = u.college_id
     LEFT JOIN users r ON r.id = u.referred_by LEFT JOIN ambassadors a ON a.id = u.ambassador_id
     ORDER BY u.id`,
  );
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Neutralise spreadsheet formula injection, then quote.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registrations-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
