import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { WORKSHOP_TITLE, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await one<{ id: number; name: string; title: string; total: number; created_at: string; graded_by: string }>(
    "SELECT id, name, title, total, created_at, graded_by FROM submissions WHERE id = ?",
    [Number(id)],
  );
  if (!s) notFound();
  const level = Number(s.total) >= 80 ? "with Distinction" : Number(s.total) >= 60 ? "with Merit" : "";
  const url = `${siteUrl()}/cert/${s.id}`;
  const shareText = `I built "${s.title}" in NxtWave's "${WORKSHOP_TITLE}" workshop and scored ${s.total}/100 on the AI review. Verify: ${url}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl border-8 border-double border-brand-dark bg-paper p-10 text-center shadow-xl">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sun/30" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-brand/10" />
        <div className="relative">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-soft">Certificate of Completion</div>
          <p className="mt-6 text-ink-soft">This certifies that</p>
          <h1 className="mt-2 text-4xl font-bold text-ink sm:text-5xl">{s.name}</h1>
          <p className="mt-4 text-ink-soft">built and submitted</p>
          <h2 className="mt-1 text-2xl font-bold text-brand">“{s.title}”</h2>
          <p className="mt-4 text-ink-soft">
            in the live workshop <b>{WORKSHOP_TITLE}</b> {level && <b className="text-ink">{level}</b>}
          </p>
          <div className="mx-auto mt-8 flex max-w-md justify-between border-t border-line pt-4 text-xs text-ink-soft">
            <span>AI review score: {s.total}/100</span>
            <span>ID WL-{String(s.id).padStart(5, "0")}</span>
            <span>{new Date(String(s.created_at)).toLocaleDateString("en-IN")}</span>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a className="btn-primary" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          Share on LinkedIn
        </a>
        <a className="btn-wa" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          Share on WhatsApp
        </a>
      </div>
      <p className="mt-4 text-center text-xs text-ink-soft/70">Each certificate links back here, so every share brings people into the next workshop.</p>
    </div>
  );
}
