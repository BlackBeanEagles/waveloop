import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/ogfonts";
import { INK, MINT, PAPER, OgBurst, OgCaption, OgPaper, OgSpeedLines, OgSticker, OgTitle } from "@/lib/ogcomic";

// The preview card WhatsApp, LinkedIn and Telegram show when the site link is pasted into a group.
export const alt = "Placements are coming. Build your first AI project in 60 minutes: free live workshop for final-year engineers.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          <OgCaption>Meanwhile, in placement season…</OgCaption>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
            <OgTitle text="Placements are coming." fontSize={90} />
            <div style={{ display: "flex", marginTop: 14 }}>
              <OgTitle text="Build your first AI project" fontSize={74} color="#B4501F" />
            </div>
            <div style={{ display: "flex", marginTop: 6 }}>
              <OgTitle text="in 60 minutes." fontSize={74} color="#B4501F" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: "auto" }}>
            <OgSticker bg={PAPER}>Free · Live · 60 min</OgSticker>
            <OgSticker bg={MINT}>No installs</OgSticker>
            <OgSticker bg="#CFC2FF">For final-year engineers</OgSticker>
          </div>
        </div>
        <OgBurst text="FREE!" size={230} x={920} y={20} />
        <div style={{ position: "absolute", right: 70, bottom: 64, display: "flex", fontFamily: "Bangers", fontSize: 44, color: INK, letterSpacing: 2 }}>
          WAVE<span style={{ color: "#B4501F" }}>LOOP!</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
