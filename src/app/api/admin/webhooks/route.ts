import { NextRequest } from "next/server";
import { EVENTS, addWebhook, deleteWebhook, listWebhooks, recentDeliveries, sendTestEvent, setWebhookActive, validWebhookUrl } from "@/lib/webhooks";
import { adminAllowed, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  return json({ events: EVENTS, webhooks: await listWebhooks(), deliveries: await recentDeliveries() });
}

export async function POST(req: NextRequest) {
  if (!adminAllowed(req)) return json({ error: "forbidden" }, 403);
  const b = await body<{ action?: string; id?: number; url?: string; events?: string[] }>(req);
  switch (b.action) {
    case "add": {
      const err = validWebhookUrl(b.url ?? "");
      if (err) return json({ error: err }, 400);
      try {
        // The full secret is returned once, at creation, like Stripe does.
        return json(await addWebhook(b.url!, b.events ?? []));
      } catch (e) {
        return json({ error: String((e as Error).message) }, 400);
      }
    }
    case "test":
      return b.id ? json({ result: await sendTestEvent(b.id) }) : json({ error: "id required" }, 400);
    case "pause":
    case "resume":
      if (!b.id) return json({ error: "id required" }, 400);
      await setWebhookActive(b.id, b.action === "resume");
      return json({ ok: true });
    case "delete":
      if (!b.id) return json({ error: "id required" }, 400);
      await deleteWebhook(b.id);
      return json({ ok: true });
    default:
      return json({ error: "unknown action" }, 400);
  }
}
