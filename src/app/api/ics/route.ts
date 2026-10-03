import { campaignClock } from "@/lib/growth";
import { WORKSHOP_TITLE, siteUrl } from "@/lib/config";

// Calendar invite: people who add the event to their calendar show up far more often than people who don't.
export async function GET() {
  const { workshop } = await campaignClock();
  const start = new Date(workshop);
  const end = new Date(start.getTime() + 60 * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WaveLoop//Workshop//EN",
    "BEGIN:VEVENT",
    `UID:workshop-${fmt(start)}@waveloop`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${WORKSHOP_TITLE} (NxtWave)`,
    `DESCRIPTION:Free live workshop. Laptop + Chrome only. Join: ${siteUrl()}/live`,
    `URL:${siteUrl()}/live`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Workshop starts in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="ai-workshop.ics"' },
  });
}
