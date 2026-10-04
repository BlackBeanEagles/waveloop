"use client";

import { useEffect, useState } from "react";
import { Burst, Caption } from "@/components/Art";

type Board = {
  colleges: { name: string; city: string; regs: number; verified: number }[];
  people: { name: string; college: string; refs: number }[];
  total: number;
  target: number;
};

export default function Leaderboard() {
  const [b, setB] = useState<Board | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetch("/api/leaderboard", { cache: "no-store" });
      if (alive && r.ok) {
        setB(await r.json());
        setUpdated(new Date());
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const max = Math.max(1, ...(b?.colleges.map((c) => c.verified) ?? [1]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="sticker -rotate-2 bg-sunny text-xs uppercase tracking-wider">🏆 Live championship</span>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Which college brings the most?</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">The college with the most verified sign-ups gets a dedicated NxtWave campus session. Updates live.</p>
        </div>
        <div className="sticker bg-paper text-xs">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
          live · {updated ? updated.toLocaleTimeString() : "loading"}
        </div>
      </div>
      {b && (
        <div className="card-pop mb-6 bg-sunny/40">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-bold tabular-nums">{b.total}</span>
            <span className="text-ink-soft">of {b.target} verified registrations</span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-paper">
            <div className="h-full bg-brand bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.25)_0_8px,transparent_8px_16px)] transition-all" style={{ width: `${Math.min(100, (b.total / b.target) * 100)}%` }} />
          </div>
        </div>
      )}
      {b && b.colleges.length > 0 && <Podium colleges={b.colleges.slice(0, 3)} />}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-pop relative pt-8">
          <Caption className="absolute -top-5 left-4 text-sm">The showdown</Caption>
          {b && b.colleges.length === 0 && (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="comic-title text-3xl [text-shadow:2px_2px_0_#ffd84d]">The arena is empty…</p>
              <p className="text-sm text-ink-soft">No college has a verified sign-up yet. Yours could be first on the board.</p>
              <a href="/" className="btn-primary">Claim the #1 spot →</a>
            </div>
          )}
          <ol className="space-y-2">
            {b?.colleges.map((c, i) => (
              <li key={c.name}>
                {i > 0 && i < 6 && (
                  <div className="my-1 flex items-center gap-2" aria-hidden>
                    <span className="h-0.5 flex-1 bg-ink/15" />
                    <span className="rounded-full border-2 border-ink bg-pink px-2 font-[family-name:var(--font-comic)] text-sm tracking-wider">VS</span>
                    <span className="h-0.5 flex-1 bg-ink/15" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-[3px] border-ink font-[family-name:var(--font-comic)] text-lg ${i < 3 ? "bg-sunny" : "bg-paper"}`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{c.name}</span>
                      <span className="font-[family-name:var(--font-comic)] text-xl tabular-nums">{c.verified}</span>
                    </div>
                    <div className="mt-1 h-3.5 overflow-hidden rounded-full border-2 border-ink bg-paper">
                      <div
                        className={`h-full transition-all ${i === 0 ? "bg-brand" : "bg-sun"} bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.25)_0_8px,transparent_8px_16px)]`}
                        style={{ width: `${Math.max(4, (c.verified / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="card-pop relative rotate-[0.5deg] bg-lilac/30 pt-8">
          <Caption className="absolute -top-5 left-4 text-sm">Hall of fame</Caption>
          <ol className="space-y-2">
            {b?.people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center gap-3 rounded-[6px] border-[3px] border-ink bg-paper px-3 py-2 text-sm">
                <span className="text-xl" aria-hidden>
                  {["🥇", "🥈", "🥉"][i] ?? "⭐"}
                </span>
                <div className="flex-1">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-ink-soft">{p.college}</div>
                </div>
                <span className="rounded-full border-2 border-ink bg-sunny px-2.5 font-[family-name:var(--font-comic)] text-base tracking-wide">{p.refs} refs</span>
              </li>
            ))}
            {b && b.people.length === 0 && <p className="text-sm text-ink-soft">No referrals yet. The first person to bring a friend lands here.</p>}
          </ol>
          <p className="mt-4 text-xs text-ink-soft">Prize pool: ₹1,000 / ₹500 / ₹500 for the top 3. Flagged or unverified referrals don&apos;t count.</p>
        </div>
      </div>
    </div>
  );
}

// Top 3 colleges on a comic podium: 2nd, 1st, 3rd.
function Podium({ colleges }: { colleges: { name: string; verified: number }[] }) {
  const order = [colleges[1], colleges[0], colleges[2]];
  const heights = ["h-24", "h-36", "h-16"];
  const fills = ["bg-sun", "bg-sunny", "bg-pink"];
  const places = [2, 1, 3];
  return (
    <div className="card-pop relative mb-10 overflow-hidden bg-[#fff6d6] px-4 pb-0 pt-10">
      <Caption className="absolute left-4 top-3 text-sm">Podium</Caption>
      <div className="mx-auto flex max-w-2xl items-end justify-center gap-3 sm:gap-5">
        {order.map((c, i) =>
          c ? (
            <div key={c.name} className="flex w-1/3 flex-col items-center">
              {places[i] === 1 && <Burst text="#1" className="mb-1 h-16 w-16 rotate-6" />}
              <p className="mb-2 line-clamp-2 text-center text-xs font-bold sm:text-sm">{c.name}</p>
              <div className={`flex w-full flex-col items-center justify-start rounded-t-[6px] border-[3px] border-b-0 border-ink pt-2 ${heights[i]} ${fills[i]}`}>
                <span className="font-[family-name:var(--font-comic)] text-3xl leading-none">{places[i]}</span>
                <span className="text-xs font-semibold">{c.verified} in</span>
              </div>
            </div>
          ) : (
            <div key={i} className="w-1/3" />
          ),
        )}
      </div>
    </div>
  );
}
