import { notFound } from "next/navigation";
import { all, one } from "@/lib/db";
import { siteUrl } from "@/lib/config";
import { FRAUD_THRESHOLD } from "@/lib/growth";
import GroupLinks from "@/components/GroupLinks";

export const dynamic = "force-dynamic";

export default async function AmbassadorPortal({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const a = await one<{ id: number; name: string; college: string; code: string }>(
    "SELECT a.id, a.name, c.name AS college, a.code FROM ambassadors a JOIN colleges c ON c.id = a.college_id WHERE a.code = ?",
    [code.toUpperCase()],
  );
  if (!a) notFound();

  const stats = await one<{ regs: number; verified: number }>(
    `SELECT COUNT(*) AS regs, SUM(CASE WHEN verified = 1 AND fraud_score < ${FRAUD_THRESHOLD} THEN 1 ELSE 0 END) AS verified FROM users WHERE ambassador_id = ?`,
    [a.id],
  );
  const groups = await all<{ grp: string; clicks: number }>(
    `SELECT json_extract(meta, '$.group') AS grp, COUNT(*) AS clicks FROM events
     WHERE type = 'amb_click' AND json_extract(meta, '$.amb') = ? GROUP BY grp ORDER BY clicks DESC`,
    [a.id],
  );
  const rank = await all(
    `SELECT ambassador_id FROM users WHERE ambassador_id IS NOT NULL AND verified = 1 AND fraud_score < ${FRAUD_THRESHOLD}
     GROUP BY ambassador_id HAVING COUNT(*) > ?`,
    [Number(stats?.verified ?? 0)],
  );
  const clicks = groups.reduce((s, g) => s + Number(g.clicks), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <div className="pill bg-sun/40">Ambassador · {a.college}</div>
        <h1 className="mt-2 text-3xl font-bold">Hi {String(a.name).split(" ")[0]}, here&apos;s your campaign</h1>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [clicks, "link clicks"],
          [Number(stats?.regs ?? 0), "registrations"],
          [Number(stats?.verified ?? 0), "verified"],
          [`#${rank.length + 1}`, "ambassador rank"],
        ].map(([n, l]) => (
          <div key={String(l)} className="card-pop text-center">
            <div className="text-3xl font-bold text-brand">{n}</div>
            <div className="text-xs text-ink-soft">{l}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GroupLinks base={`${siteUrl()}/a/${a.code}`} college={String(a.college)} />
        <div className="card-pop">
          <h2 className="mb-3 font-bold">Clicks by group</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-ink-soft">No clicks yet. Post your first group link!</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {groups.map((g) => (
                <li key={String(g.grp)} className="flex justify-between rounded-lg bg-cream px-3 py-2">
                  <span className="font-mono">{String(g.grp)}</span>
                  <span className="font-semibold">{Number(g.clicks)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink-soft">Tip: post in the evening (7 to 9 PM). Then reply to questions in the group yourself. That doubles conversion.</p>
        </div>
      </div>
    </div>
  );
}
