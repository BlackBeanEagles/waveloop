import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { all, one } from "@/lib/db";
import { campaignClock, fmtIST, referralCount, referralLink, rewardState, whatsappShareText, FRAUD_THRESHOLD } from "@/lib/growth";
import { REWARDS } from "@/lib/config";
import ShareKit from "@/components/ShareKit";
import { IdeaCard } from "@/components/Funnel";

export const dynamic = "force-dynamic";

export default async function Me({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ new?: string }> }) {
  const { code } = await params;
  const { new: isNew } = await searchParams;
  const u = await one<{ id: number; name: string; college: string; verified: number; idea_json: string | null; ref_code: string }>(
    "SELECT u.id, u.name, c.name AS college, u.verified, u.idea_json, u.ref_code FROM users u JOIN colleges c ON c.id = u.college_id WHERE u.ref_code = ?",
    [code.toUpperCase()],
  );
  if (!u) notFound();

  const refs = await referralCount(Number(u.id));
  const pending = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND NOT (verified = 1 AND fraud_score < ${FRAUD_THRESHOLD})`,
    [u.id],
  );
  const above = await all(
    `SELECT referred_by FROM users WHERE referred_by IS NOT NULL AND verified = 1 AND fraud_score < ${FRAUD_THRESHOLD}
     GROUP BY referred_by HAVING COUNT(*) > ?`,
    [refs],
  );
  const reward = rewardState(refs);
  const idea = u.idea_json ? JSON.parse(String(u.idea_json)) : null;
  const link = referralLink(String(u.ref_code));
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 220 });
  const clock = await campaignClock();
  const first = String(u.name).split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {isNew && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
          🎉 <b>You&apos;re in, {first}!</b> See you on {fmtIST(clock.workshop)}. We&apos;ll remind you on WhatsApp.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="card">
            <h1 className="text-2xl font-extrabold">Bring your friends, unlock rewards</h1>
            <p className="mt-1 text-sm text-slate-500">A referral counts once your friend verifies their number. {refs > 0 ? `Rank #${above.length + 1} right now.` : "Get your first referral to enter the leaderboard."}</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <Stat n={refs} l="verified referrals" />
              <Stat n={Number(pending?.n ?? 0)} l="pending" />
              <Stat n={reward.toNext} l={reward.next ? "to next reward" : "all unlocked!"} />
            </div>
            <ol className="mt-5 space-y-2">
              {REWARDS.map((r) => {
                const done = refs >= r.refs;
                return (
                  <li key={r.refs} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${done ? "border-green-200 bg-green-50" : "border-slate-200"}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {done ? "✓" : r.refs}
                    </span>
                    <span className={done ? "font-semibold" : ""}>{r.label}</span>
                    {!done && reward.next?.refs === r.refs && (
                      <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-brand" style={{ width: `${Math.round((refs / r.refs) * 100)}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          {idea && <IdeaCard idea={idea} />}
        </div>
        <ShareKit
          userId={Number(u.id)}
          code={String(u.ref_code)}
          link={link}
          qr={qr}
          waText={whatsappShareText(String(u.name), String(u.ref_code), idea?.title)}
          verified={Boolean(Number(u.verified))}
        />
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-3xl font-extrabold text-brand tabular-nums">{n}</div>
      <div className="text-xs text-slate-500">{l}</div>
    </div>
  );
}
