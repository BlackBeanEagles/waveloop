import { ImageResponse } from "next/og";
import { one } from "@/lib/db";
import { WORKSHOP_TITLE } from "@/lib/config";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const u = await one<{ name: string; college: string; idea_json: string | null }>(
    "SELECT u.name, c.name AS college, u.idea_json FROM users u JOIN colleges c ON c.id = u.college_id WHERE u.ref_code = ?",
    [code.toUpperCase()],
  );
  const first = u ? String(u.name).split(" ")[0] : "A friend";
  const idea = u?.idea_json ? (JSON.parse(String(u.idea_json)) as { title?: string }).title : undefined;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg, #0b1020 0%, #1b2a6b 60%, #3b5bdb 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85 }}>NxtWave · Free live workshop</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 40, opacity: 0.9 }}>
            {first}
            {u ? ` from ${u.college}` : ""} is building
          </div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{idea ? `“${idea}”` : WORKSHOP_TITLE}</div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>{idea ? `live in "${WORKSHOP_TITLE}"` : "Free. Live. 60 minutes."}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, background: "#ffd43b", color: "#0b1020", padding: "14px 28px", borderRadius: 16, fontWeight: 700 }}>
            Get your own AI project idea →
          </div>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.8 }}>code {code.toUpperCase()}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
