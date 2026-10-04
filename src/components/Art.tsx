// Decorative shapes shared with the pitch deck. All aria-hidden: they carry no information.

type GlowProps = { className?: string; color?: "orange" | "blue"; opacity?: number };

export function Glow({ className = "", color = "orange", opacity = 0.55 }: GlowProps) {
  const c = color === "orange" ? "#F08A4B" : "#3B6FD8";
  const id = `glow-${color}`;
  return (
    <svg aria-hidden className={`pointer-events-none absolute ${className}`} viewBox="0 0 400 400">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c} stopOpacity={opacity} />
          <stop offset="100%" stopColor={c} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="200" fill={`url(#${id})`} />
    </svg>
  );
}

// One student, their friends, their friends' friends: the referral loop as a picture.
export function ReferralNetwork({ className = "" }: { className?: string }) {
  const kids = [
    [260, 170],
    [530, 150],
    [540, 380],
    [250, 400],
  ];
  const grand = [
    [0, 160, 110],
    [0, 190, 250],
    [1, 620, 80],
    [2, 640, 440],
    [2, 510, 500],
    [3, 150, 470],
  ];
  return (
    <svg aria-hidden className={`pointer-events-none ${className}`} viewBox="80 40 620 500">
      <circle cx="390" cy="270" r="190" fill="none" stroke="#13233D" strokeOpacity="0.1" strokeWidth="2" />
      <circle cx="390" cy="270" r="110" fill="none" stroke="#13233D" strokeOpacity="0.1" strokeWidth="2" />
      <g stroke="#13233D" strokeOpacity="0.35" strokeWidth="3">
        {kids.map(([x, y], i) => (
          <line key={`k${i}`} x1="390" y1="270" x2={x} y2={y} />
        ))}
        {grand.map(([p, x, y], i) => (
          <line key={`g${i}`} x1={kids[p][0]} y1={kids[p][1]} x2={x} y2={y} />
        ))}
      </g>
      <circle cx="390" cy="270" r="26" fill="#B4501F" />
      {kids.map(([x, y], i) => (
        <circle key={`kc${i}`} cx={x} cy={y} r="16" fill="#13233D" />
      ))}
      {grand.map(([, x, y], i) => (
        <circle key={`gc${i}`} cx={x} cy={y} r="10" fill="#F08A4B" />
      ))}
    </svg>
  );
}

export function Rings({ className = "", stroke = "#13233D" }: { className?: string; stroke?: string }) {
  return (
    <svg aria-hidden className={`pointer-events-none absolute ${className}`} viewBox="0 0 400 400" fill="none">
      {[60, 110, 160, 210].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} stroke={stroke} strokeOpacity="0.08" strokeWidth="2" />
      ))}
    </svg>
  );
}

// Page header used by the inner pages: eyebrow, title, one line, with a soft glow behind.
export function PageHeader({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="relative mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="relative">
        <Caption className="-rotate-1">{eyebrow}</Caption>
        <h1 className="comic-title mt-4 text-5xl sm:text-6xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-ink-soft">{sub}</p>}
      </div>
      {children && <div className="relative">{children}</div>}
    </div>
  );
}

// ---------- Comic kit ----------

// Starburst ("POW!" shape) with a word inside.
export function Burst({ text, className = "", fill = "#FFD84D" }: { text: string; className?: string; fill?: string }) {
  const pts: string[] = [];
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 50 : 36 + ((i * 7) % 5);
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <div className={`grid place-items-center ${className.includes("absolute") ? "" : "relative"} ${className}`}>
      <svg aria-hidden viewBox="0 0 120 120" className="absolute inset-0 h-full w-full drop-shadow-[3px_3px_0_#13233d]">
        <polygon points={pts.join(" ")} fill={fill} stroke="#13233d" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <span className="relative -rotate-6 font-[family-name:var(--font-comic)] text-xl leading-none tracking-wide text-ink">{text}</span>
    </div>
  );
}

// Speech bubble with a tail pointing down-left.
export function Bubble({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative w-fit ${className}`}>
      <div className="relative z-10 rounded-[22px] border-[3px] border-ink bg-paper px-4 py-2.5 text-sm font-bold leading-snug text-ink">{children}</div>
      <svg aria-hidden viewBox="0 0 40 28" className="absolute -bottom-[22px] left-7 z-20 h-7 w-10">
        <path d="M2 0 L14 26 L30 0" fill="#FFFDF9" stroke="#13233d" strokeWidth="3" strokeLinejoin="round" />
        <rect x="0" y="-4" width="40" height="5" fill="#FFFDF9" />
      </svg>
    </div>
  );
}

// Narrator caption box, the yellow rectangle in the corner of a comic panel.
export function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-fit border-[3px] border-ink bg-sunny px-3 py-1 font-[family-name:var(--font-comic)] text-base uppercase tracking-wider text-ink shadow-[3px_3px_0_0_#13233d] ${className}`}>
      {children}
    </div>
  );
}

// Action lines radiating from a corner, for drama behind a panel.
export function SpeedLines({ className = "" }: { className?: string }) {
  const lines = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 0.5;
    return <line key={i} x1="0" y1="0" x2={(400 * Math.cos(a)).toFixed(0)} y2={(400 * Math.sin(a)).toFixed(0)} />;
  });
  return (
    <svg aria-hidden viewBox="0 0 400 400" className={`pointer-events-none absolute ${className}`}>
      <g stroke="#13233d" strokeOpacity="0.09" strokeWidth={6}>
        {lines}
      </g>
    </svg>
  );
}
