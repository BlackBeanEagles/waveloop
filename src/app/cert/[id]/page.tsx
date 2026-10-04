import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { WORKSHOP_TITLE, siteUrl } from "@/lib/config";
import { Burst, Caption, SpeedLines } from "@/components/Art";

export const dynamic = "force-dynamic";

export default async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await one<{ id: number; name: string; title: string; total: number; created_at: string; graded_by: string }>(
    "SELECT id, name, title, total, created_at, graded_by FROM submissions WHERE id = ?",
    [Number(id)],
  );
  if (!s) notFound();
  const total = Number(s.total);
  const level = total >= 80 ? "with Distinction" : total >= 60 ? "with Merit" : "";
  const badge = total >= 80 ? "LEGEND!" : total >= 60 ? "NAILED IT!" : "SHIPPED!";
  const url = `${siteUrl()}/cert/${s.id}`;
  const shareText = `I built "${s.title}" in NxtWave's "${WORKSHOP_TITLE}" workshop and scored ${total}/100 on the AI review. Verify: ${url}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Outer frame: a comic page border with a thin inner rule, like a printed certificate */}
      <div className="card-pop relative overflow-hidden bg-[#fff6d6] p-3 sm:p-4">
        <SpeedLines className="-right-28 -top-28 h-[520px] w-[520px] rotate-90" />
        <Burst text={badge} className="absolute right-3 top-3 z-10 h-28 w-28 rotate-12 sm:right-6 sm:top-6 sm:h-36 sm:w-36" />
        <div className="relative border-[3px] border-dashed border-ink/40 px-6 py-10 text-center sm:px-12">
          <Caption className="mx-auto">Certificate of completion</Caption>
          <p className="mt-8 font-[family-name:var(--font-hand)] text-2xl text-ink-soft">this is to certify that</p>
          <h1 className="comic-title mt-2 text-5xl sm:text-7xl">{s.name}</h1>
          <p className="mt-6 font-[family-name:var(--font-hand)] text-2xl text-ink-soft">built &amp; shipped</p>
          <h2 className="comic-title mt-1 text-3xl text-brand [text-shadow:2px_2px_0_#13233d] sm:text-4xl">“{s.title}”</h2>
          <p className="mx-auto mt-5 max-w-lg font-medium text-ink-soft">
            live, in the workshop <b className="text-ink">{WORKSHOP_TITLE}</b>
            {level && (
              <>
                {" "}
                <span className="rounded border-2 border-ink bg-mint px-1.5 font-bold text-ink">{level}</span>
              </>
            )}
          </p>
          <div className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-3 text-xs font-semibold">
            <div className="rounded-[6px] border-[3px] border-ink bg-paper p-2">
              <div className="font-[family-name:var(--font-comic)] text-3xl text-brand">{total}/100</div>
              AI review score
            </div>
            <div className="rounded-[6px] border-[3px] border-ink bg-paper p-2">
              <div className="font-[family-name:var(--font-comic)] text-2xl leading-9">WL-{String(s.id).padStart(5, "0")}</div>
              certificate ID
            </div>
            <div className="rounded-[6px] border-[3px] border-ink bg-paper p-2">
              <div className="font-[family-name:var(--font-comic)] text-2xl leading-9">{new Date(String(s.created_at)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
              issued
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <a className="btn-primary px-6" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          Flex it on LinkedIn
        </a>
        <a className="btn-wa px-6" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          Share on WhatsApp
        </a>
      </div>
      <p className="mt-4 text-center font-[family-name:var(--font-hand)] text-xl text-ink-soft">every share brings your batchmates into the next workshop ✌️</p>
    </div>
  );
}
