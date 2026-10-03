import { one } from "@/lib/db";
import { campaignClock } from "@/lib/growth";
import { listColleges } from "@/lib/growth";
import { leaderboard } from "@/lib/metrics";
import Funnel from "@/components/Funnel";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ref = sp.ref?.toUpperCase();
  const inviter = ref ? await one<{ name: string; college: string }>(
    "SELECT u.name, c.name AS college FROM users u JOIN colleges c ON c.id = u.college_id WHERE u.ref_code = ?",
    [ref],
  ) : undefined;
  const [colleges, board, clock] = await Promise.all([listColleges(), leaderboard(), campaignClock()]);

  return (
    <Funnel
      refCode={inviter ? ref : undefined}
      inviter={inviter ? { name: String(inviter.name).split(" ")[0], college: String(inviter.college) } : undefined}
      channel={sp.utm_source ?? (inviter ? "referral" : "direct")}
      colleges={colleges.map((c) => c.name)}
      registered={board.total}
      topColleges={board.colleges.slice(0, 3).map((c) => ({ name: c.name, n: c.verified }))}
      workshopAt={clock.workshop}
    />
  );
}
