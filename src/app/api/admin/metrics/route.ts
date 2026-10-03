import { NextRequest } from "next/server";
import { dashboard } from "@/lib/metrics";
import { getSetting } from "@/lib/growth";
import { integrations } from "@/lib/config";
import { adminAllowed, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const data = await dashboard();
  return json({
    ...data,
    simulated: (await getSetting("simulated")) === "1",
    integrations: { claude: integrations.claude(), email: integrations.email(), twilio: integrations.twilio(), hostedDb: integrations.hostedDb() },
  });
}
