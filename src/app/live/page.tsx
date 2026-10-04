"use client";

import { useState } from "react";
import { post } from "@/lib/client";
import { PageHeader } from "@/components/Art";

// Workshop-day page: attendance check-in (feeds the show-up rate and unlocks the certificate flow).
export default function LivePage() {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader eyebrow="Workshop day" title="Check in" sub="Tell us you're here. Checking in unlocks your project review and certificate after the session." />
      <form
        className="card flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await post<{ ok: boolean; name?: string; error?: string }>("/api/checkin", { id });
          setBusy(false);
          setMsg(r.ok ? { ok: true, text: `You're checked in, ${r.name}! Submit your project after the session to get your certificate.` } : { ok: false, text: r.error ?? "Could not check in" });
        }}
      >
        <label className="label" htmlFor="who">
          Registered email or phone
        </label>
        <input id="who" className="input" required placeholder="you@college.edu or 9876543210" value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn-primary py-3" disabled={busy}>
          {busy ? "Checking in…" : "Check in"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
      </form>
      <p className="mt-4 text-center text-sm text-ink-soft">
        Stuck on something while building?{" "}
        <a href="/help" className="font-semibold text-brand underline">
          Get help
        </a>
      </p>
    </div>
  );
}
