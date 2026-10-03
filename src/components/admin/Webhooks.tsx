"use client";

import { useEffect, useState } from "react";
import { post } from "@/lib/client";

type Hook = { id: number; url: string; events: string[]; secretHint: string; active: boolean; stats: Record<string, number> };
type Delivery = { id: number; url: string; event: string; status: string; attempts: number; response_code: number | null; error: string | null; created_at: string };

export default function Webhooks({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<string[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<string[]>(["user.registered", "user.verified"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const d = await fetch("/api/admin/webhooks", { cache: "no-store" }).then((r) => r.json());
    setEvents(d.events ?? []);
    setHooks(d.webhooks ?? []);
    setDeliveries(d.deliveries ?? []);
  };
  useEffect(() => {
    load();
  }, [refreshKey]);

  const act = async (body: Record<string, unknown>) => {
    const r = await post<{ error?: string; result?: { status: string; response_code: number | null; error: string | null } }>("/api/admin/webhooks", body);
    if (r.error) setMsg(r.error);
    if (r.result) setMsg(`Test ping: ${r.result.status}${r.result.response_code ? ` (HTTP ${r.result.response_code})` : ""}${r.result.error ? ` – ${r.result.error}` : ""}`);
    load();
  };

  return (
    <div className="card mb-6">
      <h2 className="mb-1 font-bold">Integrations: webhooks for n8n / Zapier / CRM</h2>
      <p className="mb-4 text-xs text-ink-soft">
        Every event is POSTed as JSON, signed with HMAC-SHA256 (<code className="font-mono">X-WaveLoop-Signature: sha256=…</code> over <code className="font-mono">timestamp.body</code>), and retried with backoff up to 6 times.
      </p>
      {msg && <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">{msg}</div>}
      {secret && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Signing secret (shown once, store it in n8n now): <code className="select-all font-mono">{secret}</code>
        </div>
      )}
      <form
        className="mb-4 flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          const r = await post<{ secret?: string; error?: string }>("/api/admin/webhooks", { action: "add", url, events: picked });
          if (r.secret) {
            setSecret(r.secret);
            setUrl("");
          } else setMsg(r.error ?? "Could not add");
          load();
        }}
      >
        <input className="input font-mono text-xs" required placeholder="https://your-n8n.app.n8n.cloud/webhook/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex flex-wrap gap-2 text-xs">
          {events.map((ev) => (
            <label key={ev} className="flex items-center gap-1 rounded-full bg-sand px-2 py-1">
              <input type="checkbox" checked={picked.includes(ev)} onChange={(e) => setPicked(e.target.checked ? [...picked, ev] : picked.filter((x) => x !== ev))} />
              <span className="font-mono">{ev}</span>
            </label>
          ))}
        </div>
        <button className="btn-ghost w-fit">+ Add endpoint</button>
      </form>

      {hooks.length > 0 && (
        <ul className="mb-4 space-y-2">
          {hooks.map((h) => (
            <li key={h.id} className={`rounded-xl border border-line p-3 text-xs ${h.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-mono">{h.url}</span>
                <div className="flex gap-2">
                  <button className="underline" onClick={() => act({ action: "test", id: h.id })}>
                    send test
                  </button>
                  <button className="underline" onClick={() => act({ action: h.active ? "pause" : "resume", id: h.id })}>
                    {h.active ? "pause" : "resume"}
                  </button>
                  <button className="text-red-700 underline" onClick={() => confirm("Delete this endpoint and its delivery log?") && act({ action: "delete", id: h.id })}>
                    delete
                  </button>
                </div>
              </div>
              <div className="mt-1 text-ink-soft">
                {h.events.join(", ")} · secret {h.secretHint} · ✓ {h.stats.delivered ?? 0} delivered · ↻ {h.stats.retrying ?? 0} retrying · ✕ {h.stats.failed ?? 0} failed
              </div>
            </li>
          ))}
        </ul>
      )}

      {deliveries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left uppercase text-ink-soft">
              <tr>
                <th className="py-1">Event</th>
                <th>Status</th>
                <th>Tries</th>
                <th>Response</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t border-line">
                  <td className="py-1.5 font-mono">{d.event}</td>
                  <td>{d.status === "delivered" ? "✓ delivered" : d.status === "failed" ? "✕ failed" : `↻ ${d.status}`}</td>
                  <td className="tabular-nums">{d.attempts}</td>
                  <td className="text-ink-soft">{d.response_code ? `HTTP ${d.response_code}` : (d.error ?? "–").slice(0, 60)}</td>
                  <td className="text-ink-soft">{new Date(d.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
