import { leaderboard } from "@/lib/metrics";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await leaderboard());
}
