"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/client";

export default function AmbassadorSignup() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", college: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post<{ code?: string; error?: string }>("/api/ambassadors", f);
    setBusy(false);
    if (r.code) router.push(`/ambassador/${r.code}`);
    else setErr(r.error ?? "Could not sign up");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="pill w-fit bg-sun/40">Campus Ambassador program</div>
        <h1 className="text-3xl font-bold">Bring your batch. Lead the leaderboard.</h1>
        <p className="text-ink-soft">
          Ambassadors seed the campaign: each one posts in 3 to 5 class and club WhatsApp groups. Every group gets its own tracked link, so you can see which group
          converted.
        </p>
        <ul className="space-y-2 text-sm text-ink">
          <li>🏆 Top college gets a dedicated NxtWave campus session</li>
          <li>📜 Ambassador certificate + LinkedIn recommendation for the top 5</li>
          <li>📊 Your own live dashboard of clicks and sign-ups per group</li>
        </ul>
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold">Become an ambassador</h2>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <input className="input" required placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input" required placeholder="College" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} />
        <button className="btn-primary py-3" disabled={busy}>
          {busy ? "Creating…" : "Get my ambassador kit →"}
        </button>
      </form>
    </div>
  );
}
