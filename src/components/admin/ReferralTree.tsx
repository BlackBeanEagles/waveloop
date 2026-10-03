"use client";

import { useEffect, useMemo, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";

type Node = { id: number; name: string; college: string; status: "counted" | "unverified" | "flagged"; createdAt: string; children: Node[] };
type Data = {
  stats: { users: number; referred: number; cascades: number; largestCascade: number; maxDepth: number; sameCollegeShare: number; crossCollege: number; generations: { generation: number; people: number }[] };
  cascades: { size: number; depth: number; tree: Node }[];
};

// Status colours carry an icon/label in the legend, never colour alone.
const STATUS = {
  counted: { fill: "#2a78d6", label: "Verified (counts)", icon: "●" },
  unverified: { fill: "#c3c2b7", label: "Not verified yet", icon: "○" },
  flagged: { fill: "#e34948", label: "Flagged", icon: "⚠" },
};

const ROW = 26;
const COL = 170;

export default function ReferralTree({ refreshKey }: { refreshKey: number }) {
  const [d, setD] = useState<Data | null>(null);
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<Node | null>(null);

  useEffect(() => {
    fetch("/api/admin/tree", { cache: "no-store" })
      .then((r) => r.json())
      .then(setD);
  }, [refreshKey]);

  const layout = useMemo(() => {
    const c = d?.cascades[sel];
    if (!c) return null;
    const root = hierarchy<Node>(c.tree);
    tree<Node>().nodeSize([ROW, COL])(root);
    const nodes = root.descendants();
    const xs = nodes.map((n) => n.x ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const width = (root.height + 1) * COL + 40;
    const height = maxX - minX + ROW * 2;
    return { root, nodes, links: root.links(), minX, width, height };
  }, [d, sel]);

  if (!d) return <div className="card text-sm text-slate-500">Loading referral graph…</div>;
  const s = d.stats;

  return (
    <div className="card">
      <h2 className="mb-1 font-bold">Referral cascades</h2>
      <p className="mb-4 text-xs text-slate-500">Who brought whom. Each tree starts at a student who registered on their own and shows every generation their link set off.</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          [s.referred, "joined via a friend"],
          [s.cascades, "cascades"],
          [s.largestCascade, "largest cascade"],
          [s.maxDepth, "deepest chain (gens)"],
          [`${Math.round(s.sameCollegeShare * 100)}%`, "same-college refs"],
        ].map(([n, l]) => (
          <div key={String(l)} className="rounded-xl bg-slate-50 p-3 text-center">
            <div className="text-2xl font-extrabold tabular-nums">{n}</div>
            <div className="text-xs text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      {d.cascades.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No referral chains yet. They appear as soon as someone registers through another student&apos;s <code className="font-mono">/r/CODE</code> link or a <code className="font-mono">JOIN CODE</code> WhatsApp message.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {d.cascades.map((c, i) => (
              <button key={c.tree.id} onClick={() => setSel(i)} className={`btn px-2.5 py-1 text-xs ${i === sel ? "bg-brand text-white" : "border border-slate-300 bg-white"}`}>
                {c.tree.name} · {c.size} people · {c.depth} gen
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
            {Object.values(STATUS).map((st) => (
              <span key={st.label} className="flex items-center gap-1">
                <span style={{ color: st.fill }}>{st.icon}</span>
                {st.label}
              </span>
            ))}
          </div>
          {layout && (
            <div className="relative overflow-x-auto rounded-xl border border-slate-100 bg-[#fcfcfb]">
              <svg width={layout.width} height={layout.height} role="img" aria-label="Referral tree">
                <g transform={`translate(20, ${-layout.minX + ROW})`}>
                  {layout.links.map((l, i) => (
                    <path
                      key={i}
                      d={`M${l.source.y},${l.source.x} C${(l.source.y! + l.target.y!) / 2},${l.source.x} ${(l.source.y! + l.target.y!) / 2},${l.target.x} ${l.target.y},${l.target.x}`}
                      fill="none"
                      stroke="#d4d4d0"
                      strokeWidth={1.5}
                    />
                  ))}
                  {layout.nodes.map((n) => {
                    const st = STATUS[n.data.status];
                    return (
                      <g key={n.data.id} transform={`translate(${n.y},${n.x})`} onMouseEnter={() => setHover(n.data)} onMouseLeave={() => setHover(null)} className="cursor-default">
                        <circle r={12} fill="transparent" />
                        <circle r={5} fill={st.fill} stroke="#fcfcfb" strokeWidth={2} />
                        <text x={10} dy="0.32em" fontSize={11} fill="#0b0b0b">
                          {n.data.name}
                          {n.children ? ` (${n.children.length})` : ""}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              {hover && (
                <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
                  <div className="font-semibold">{hover.name}</div>
                  <div className="text-slate-500">{hover.college}</div>
                  <div>
                    {STATUS[hover.status].icon} {STATUS[hover.status].label}
                  </div>
                  <div className="text-slate-500">{new Date(hover.createdAt).toLocaleString("en-IN")}</div>
                  <div>{hover.children.length} direct referrals</div>
                </div>
              )}
            </div>
          )}
          {s.generations.length > 1 && (
            <p className="mt-3 text-xs text-slate-500">
              People per generation: {s.generations.map((g) => `gen ${g.generation}: ${g.people}`).join(" → ")}. A loop is self-sustaining when each generation is at least as big as the last.
            </p>
          )}
        </>
      )}
    </div>
  );
}
