import { NextRequest } from "next/server";
import { processOutbox } from "@/lib/messaging";
import { retryDueDeliveries } from "@/lib/webhooks";
import { json } from "@/lib/http";

// Vercel Cron calls this on the schedule in vercel.json.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "forbidden" }, 403);
  return json({ ...(await processOutbox()), webhookRetries: await retryDueDeliveries() });
}
