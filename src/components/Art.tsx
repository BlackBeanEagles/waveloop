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
      <Glow className="-left-24 -top-32 h-72 w-72" />
      <div className="relative">
        <span className="sticker -rotate-2 bg-sunny text-xs uppercase tracking-wider">{eyebrow}</span>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-ink-soft">{sub}</p>}
      </div>
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
