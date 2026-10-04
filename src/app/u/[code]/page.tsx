import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { all, one } from "@/lib/db";
import { campaignClock, fmtIST, referralCount, referralLink, rewardState, whatsappShareText, FRAUD_THRESHOLD } from "@/lib/growth";
import { REWARDS } from "@/lib/config";
import ShareKit from "@/components/ShareKit";
import { IdeaCard } from "@/components/Funnel";
import { Bubble, Burst, Caption, SpeedLines } from "@/components/Art";

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
      <div className={`card-pop relative mb-8 -rotate-[0.4deg] overflow-hidden p-6 sm:p-8 ${isNew ? "bg-[#fff6d6]" : "bg-paper"}`}>
        <SpeedLines className="-right-24 -top-24 h-[420px] w-[420px] rotate-90" />
        {isNew && <Burst text="YOU'RE IN!" className="absolute right-3 top-3 h-28 w-28 rotate-12 sm:right-6 sm:h-36 sm:w-36" />}
        <Caption className="relative">{isNew ? "Chapter 2: the squad" : `${first}'s squad HQ`}</Caption>
        <h1 className="comic-title relative mt-5 pr-28 text-5xl sm:pr-40 sm:text-6xl">{isNew ? `Welcome aboard, ${first}!` : `Hey ${first}, how's the squad?`}</h1>
        <p className="relative mt-4 max-w-xl font-medium text-ink-soft">
          📅 {fmtIST(clock.workshop)} IST · we&apos;ll remind you on WhatsApp. Now the fun part: bring your friends and unlock rewards.
        </p>
        <div className="relative mt-5">
          <Bubble>{refs === 0 ? "1 friend = recording access. 3 = the prompt pack. Who's first? 👀" : `${refs} down! ${reward.next ? `${reward.toNext} more for: ${reward.next.label}` : "every reward unlocked 🏆"}`}</Bubble>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="card-pop relative pt-7">
            <Caption className="absolute -top-5 left-4 text-sm">Reward ladder</Caption>
            <h2 className="comic-title text-3xl [text-shadow:2px_2px_0_#ffd84d]">Bring friends, level up</h2>
            <p className="mt-1 text-sm text-ink-soft">A referral counts once your friend verifies their number. {refs > 0 ? `Rank #${above.length + 1} right now.` : "Get your first referral to enter the leaderboard."}</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <Stat n={refs} l="verified referrals" />
              <Stat n={Number(pending?.n ?? 0)} l="pending" />
              <Stat n={reward.toNext} l={reward.next ? "to next reward" : "all unlocked!"} />
            </div>
            <ol className="mt-5 space-y-2">
              {REWARDS.map((r) => {
                const done = refs >= r.refs;
                return (
                  <li key={r.refs} className={`flex items-center gap-3 rounded-[6px] border-[3px] p-3 text-sm ${done ? "border-ink bg-mint" : "border-ink/20 bg-paper"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] border-ink font-[family-name:var(--font-comic)] text-lg ${done ? "bg-sunny" : "bg-paper"}`}>
                      {done ? "✓" : r.refs}
                    </span>
                    <span className={done ? "font-semibold" : ""}>{r.label}</span>
                    {!done && reward.next?.refs === r.refs && (
                      <div className="ml-auto h-3 w-24 overflow-hidden rounded-full border-2 border-ink bg-paper">
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
    <div className="rounded-[6px] border-[3px] border-ink bg-sunny/40 p-3">
      <div className="font-[family-name:var(--font-comic)] text-4xl text-brand tabular-nums">{n}</div>
      <div className="text-xs text-ink-soft">{l}</div>
    </div>
  );
}
