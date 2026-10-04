import { ImageResponse } from "next/og";
import { one } from "@/lib/db";
import { ogFonts } from "@/lib/ogfonts";
import { BRAND, INK, MINT, PAPER, SUNNY, OgBurst, OgCaption, OgPaper, OgSpeedLines, OgSticker, OgTitle } from "@/lib/ogcomic";

// The card each student forwards with their referral link: their name, college and project as a comic panel.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const u = await one<{ name: string; college: string; idea_json: string | null }>(
    "SELECT u.name, c.name AS college, u.idea_json FROM users u JOIN colleges c ON c.id = u.college_id WHERE u.ref_code = ?",
    [code.toUpperCase()],
  );
  const first = u ? String(u.name).split(" ")[0] : "Your friend";
  const college = u ? String(u.college) : "";
  const rawIdea = u?.idea_json ? (JSON.parse(String(u.idea_json)) as { title?: string }).title : undefined;
  // Keep the title short enough for two lines of comic lettering.
  const idea = rawIdea && rawIdea.length > 46 ? `${rawIdea.slice(0, 44).trimEnd()}…` : rawIdea;
  const ideaSize = !idea ? 80 : idea.length > 30 ? 66 : 82;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <OgPaper />
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 36,
            width: 1110,
            height: 548,
            display: "flex",
            flexDirection: "column",
            background: "#FFF6D6",
            border: `7px solid ${INK}`,
            boxShadow: `12px 12px 0 ${INK}`,
            padding: "40px 48px",
            overflow: "hidden",
          }}
        >
          <OgSpeedLines x={560} y={-10} size={560} />
          <OgCaption fontSize={32}>{college ? `${first} from ${college} is building…` : `${first} is building…`}</OgCaption>
          <div style={{ display: "flex", marginTop: 34, width: 820 }}>
            <OgTitle text={idea ?? "Their first AI project"} fontSize={ideaSize} color={BRAND} lineHeight={1} />
          </div>
          <div style={{ display: "flex", fontFamily: "Public Sans", fontWeight: 700, fontSize: 30, color: INK, marginTop: 22 }}>
            …live, in NxtWave’s free 60-minute AI workshop.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: "auto" }}>
            <div style={{ display: "flex", background: BRAND, border: `5px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: "10px 26px", fontFamily: "Bangers", fontSize: 40, letterSpacing: 2, color: PAPER }}>
              Get your own project idea →
            </div>
            <OgSticker bg={MINT}>code {code.toUpperCase()}</OgSticker>
          </div>
        </div>
        <OgBurst text="JOIN!" size={230} x={920} y={20} fill={SUNNY} />
      </div>
    ),
    { width: 1200, height: 630, fonts: await ogFonts() },
  );
}
