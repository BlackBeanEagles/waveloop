"use client";

import { useState } from "react";
import { post } from "@/lib/client";
import { Caption } from "@/components/Art";

type Props = { userId: number; code: string; link: string; qr: string; waText: string; verified: boolean };

export default function ShareKit(p: Props) {
  const [copied, setCopied] = useState(false);
  const shared = (via: string) => post("/api/track", { type: "shared", userId: p.userId, channel: via });

  const linkedInText = `I just signed up for a free live workshop where I'll build and deploy my first AI project in 60 minutes. Final-year folks, join me: ${p.link}`;

  return (
    <div className="card-pop relative flex flex-col gap-4 self-start rotate-[0.4deg] pt-7">
      <Caption className="absolute -top-5 left-4 text-sm">Your share kit</Caption>
      <h2 className="comic-title text-3xl [text-shadow:2px_2px_0_#ffd84d]">Spread the word</h2>
      {!p.verified && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Verify your number first, or your link won&apos;t count referrals.</div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/og/${p.code}`} alt="Your share card" className="w-full rounded-[6px] border-[3px] border-ink" />
      <div className="flex gap-2">
        <input readOnly value={p.link} className="input font-mono text-xs" />
        <button
          className="btn-ghost shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(p.link);
            setCopied(true);
            shared("copy");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <a className="btn-wa py-3 text-base" href={`https://wa.me/?text=${encodeURIComponent(p.waText)}`} target="_blank" rel="noreferrer" onClick={() => shared("whatsapp")}>
        Share on WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2">
        <a className="btn-ghost" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedInText)}`} target="_blank" rel="noreferrer" onClick={() => shared("linkedin")}>
          LinkedIn
        </a>
        <a className="btn-ghost" href={`/api/og/${p.code}`} download={`waveloop-${p.code}.png`} onClick={() => shared("card_download")}>
          Download card
        </a>
      </div>
      <a className="btn-ghost" href="/api/ics" onClick={() => post("/api/track", { type: "calendar_added", userId: p.userId })}>
        📅 Add workshop to my calendar
      </a>
      <div className="flex items-center gap-4 rounded-[6px] border-[3px] border-ink bg-mint/40 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.qr} alt="QR code for your link" className="h-24 w-24 rounded-lg" />
        <p className="text-xs text-ink-soft">Show this QR in class or put it on your college notice board. Every scan is tracked to you.</p>
      </div>
      <details className="text-xs text-ink-soft">
        <summary className="cursor-pointer">Message we pre-fill on WhatsApp</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-cream p-2 font-sans">{p.waText}</pre>
      </details>
    </div>
  );
}
