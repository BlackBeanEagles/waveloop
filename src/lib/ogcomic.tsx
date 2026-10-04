// Comic pieces for server-rendered images (next/og). Every div is display:flex, as the image renderer requires.

export const INK = "#13233D";
export const PAPER = "#FFFDF9";
export const SUNNY = "#FFD84D";
export const BRAND = "#B4501F";
export const MINT = "#A6EBCF";
export const CREAM = "#F7F1E3";

export function burstPoints(cx: number, cy: number, outer: number, inner: number, spikes = 14) {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner + ((i * 7) % 5);
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function OgBurst({ text, size, x, y, fill = SUNNY, rotate = 12, fontSize = 52 }: { text: string; size: number; x: number; y: number; fill?: string; rotate?: number; fontSize?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${rotate}deg)` }}>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ position: "absolute", left: 0, top: 0 }}>
        <polygon points={burstPoints(64, 64, 52, 38)} fill={INK} />
        <polygon points={burstPoints(60, 60, 52, 38)} fill={fill} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", fontFamily: "Bangers", fontSize, color: INK, transform: "rotate(-8deg)", letterSpacing: 1 }}>{text}</div>
    </div>
  );
}

export function OgCaption({ children, bg = SUNNY, fontSize = 34 }: { children: React.ReactNode; bg?: string; fontSize?: number }) {
  return (
    <div style={{ display: "flex", alignSelf: "flex-start", background: bg, border: `5px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, padding: "6px 18px", fontFamily: "Bangers", fontSize, letterSpacing: 2, color: INK, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

// Big hand-lettered line with a printed two-colour shadow (drawn as stacked copies, which renders reliably).
export function OgTitle({ text, fontSize, color = INK, shadow1 = SUNNY, shadow2 = INK, lineHeight = 0.95 }: { text: string; fontSize: number; color?: string; shadow1?: string; shadow2?: string; lineHeight?: number }) {
  const base = { fontFamily: "Bangers", fontSize, lineHeight, letterSpacing: 1.5, textTransform: "uppercase" as const };
  return (
    // Every layer gets the same width so multi-line titles wrap identically.
    <div style={{ display: "flex", position: "relative", width: "100%" }}>
      <div style={{ ...base, display: "flex", position: "absolute", left: 7, top: 7, width: "100%", color: shadow2 }}>{text}</div>
      <div style={{ ...base, display: "flex", position: "absolute", left: 4, top: 4, width: "100%", color: shadow1 }}>{text}</div>
      <div style={{ ...base, display: "flex", position: "relative", width: "100%", color }}>{text}</div>
    </div>
  );
}

export function OgSticker({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <div style={{ display: "flex", background: bg, border: `4px solid ${INK}`, borderRadius: 999, boxShadow: `4px 4px 0 ${INK}`, padding: "6px 20px", fontFamily: "Public Sans", fontWeight: 800, fontSize: 26, color: INK }}>
      {children}
    </div>
  );
}

// Halftone paper background as a full-bleed layer.
export function OgPaper() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: CREAM,
        backgroundImage: `radial-gradient(circle, rgba(240,138,75,0.22) 2px, transparent 2.5px)`,
        backgroundSize: "22px 22px",
      }}
    />
  );
}

export function OgSpeedLines({ x, y, size }: { x: number; y: number; size: number }) {
  const lines = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 0.5 + Math.PI / 2;
    return <line key={i} x1={size} y1="0" x2={(size + size * Math.cos(a)).toFixed(0)} y2={(size * Math.sin(a)).toFixed(0)} stroke={INK} strokeOpacity="0.1" strokeWidth="10" />;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", left: x, top: y }}>
      {lines}
    </svg>
  );
}
