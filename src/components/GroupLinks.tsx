"use client";

import { useState } from "react";
import { WORKSHOP_TITLE } from "@/lib/config";

export default function GroupLinks({ base, college }: { base: string; college: string }) {
  const [group, setGroup] = useState("cse-final-year");
  const [copied, setCopied] = useState(false);
  const slug = group.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
  const link = `${base}?g=${slug}`;
  const post = [
    `🚨 Free live workshop for final years: *${WORKSHOP_TITLE}* by NxtWave`,
    `You build + deploy a real AI app in 60 min (laptop + Chrome only). Great for the placement resume.`,
    `${college} is on the leaderboard right now. Let's take #1 👇`,
    link,
  ].join("\n\n");

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="font-bold">Make a tracked link for each group</h2>
      <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. ece-section-b" />
      <pre className="whitespace-pre-wrap rounded-xl bg-[#d9fdd3] p-3 font-sans text-sm">{post}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(post);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy post"}
        </button>
        <a className="btn-wa" href={`https://wa.me/?text=${encodeURIComponent(post)}`} target="_blank" rel="noreferrer">
          Post to WhatsApp
        </a>
      </div>
    </div>
  );
}
