import { all } from "./db";
import { FRAUD_THRESHOLD } from "./growth";

export type TreeNode = {
  id: number;
  name: string;
  college: string;
  status: "counted" | "unverified" | "flagged";
  createdAt: string;
  children: TreeNode[];
};

export async function referralForest() {
  const rows = await all<{ id: number; name: string; college: string; referred_by: number | null; verified: number; fraud_score: number; created_at: string; college_id: number }>(
    `SELECT u.id, u.name, c.name AS college, u.college_id, u.referred_by, u.verified, u.fraud_score, u.created_at
     FROM users u JOIN colleges c ON c.id = u.college_id ORDER BY u.id`,
  );
  const byId = new Map<number, TreeNode & { collegeId: number; parent: number | null }>();
  for (const r of rows) {
    const [first, ...rest] = String(r.name).split(" ");
    byId.set(Number(r.id), {
      id: Number(r.id),
      name: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first,
      college: String(r.college),
      collegeId: Number(r.college_id),
      parent: r.referred_by == null ? null : Number(r.referred_by),
      status: Number(r.fraud_score) >= FRAUD_THRESHOLD ? "flagged" : Number(r.verified) ? "counted" : "unverified",
      createdAt: String(r.created_at),
      children: [],
    });
  }
  const roots: (TreeNode & { collegeId: number })[] = [];
  for (const n of byId.values()) {
    const p = n.parent != null ? byId.get(n.parent) : undefined;
    if (p) p.children.push(n);
    else roots.push(n);
  }

  const size = (n: TreeNode): number => 1 + n.children.reduce((s, c) => s + size(c), 0);
  const depth = (n: TreeNode): number => (n.children.length ? 1 + Math.max(...n.children.map(depth)) : 0);
  const cascades = roots.filter((r) => r.children.length > 0).map((r) => ({ root: r, size: size(r), depth: depth(r) }));
  cascades.sort((a, b) => b.size - a.size);

  // Same-college vs cross-college referral edges: how far the loop spreads on its own.
  let same = 0;
  let cross = 0;
  for (const n of byId.values()) {
    if (n.parent == null) continue;
    const p = byId.get(n.parent);
    if (!p) continue;
    if (p.collegeId === n.collegeId) same++;
    else cross++;
  }
  const referred = same + cross;
  const generations: Record<number, number> = {};
  const walk = (n: TreeNode, g: number) => {
    generations[g] = (generations[g] ?? 0) + 1;
    n.children.forEach((c) => walk(c, g + 1));
  };
  cascades.forEach((c) => walk(c.root, 0));

  return {
    stats: {
      users: rows.length,
      referred,
      cascades: cascades.length,
      largestCascade: cascades[0]?.size ?? 0,
      maxDepth: cascades.reduce((m, c) => Math.max(m, c.depth), 0),
      sameCollegeShare: referred ? same / referred : 0,
      crossCollege: cross,
      generations: Object.entries(generations).map(([g, n]) => ({ generation: Number(g), people: n })),
    },
    cascades: cascades.slice(0, 12).map((c) => ({ size: c.size, depth: c.depth, tree: strip(c.root) })),
  };
}

function strip(n: TreeNode): TreeNode {
  return { id: n.id, name: n.name, college: n.college, status: n.status, createdAt: n.createdAt, children: n.children.map(strip) };
}
