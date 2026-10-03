import { NextRequest } from "next/server";
import { dashboard } from "@/lib/metrics";
import { integrations } from "@/lib/config";
import { ephemeralDb } from "@/lib/db";
import { adminAllowed, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const data = await dashboard();
  return json({
    ...data,
    ephemeralDb,
    integrations: { claude: integrations.claude(), email: integrations.email(), whatsapp: integrations.metaWhatsApp() || integrations.twilio(), hostedDb: integrations.hostedDb() },
  });
}
