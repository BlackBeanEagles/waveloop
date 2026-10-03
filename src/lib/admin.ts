import { db, ready } from "./db";
import { ensureColleges, setSetting } from "./growth";

// Wipes all campaign data and restarts the 7-day clock from now. Colleges list is reference data and stays.
export async function clearAllData() {
  await ready();
  await db.executeMultiple(`
    -- Children before parents: help_tickets, submissions and outbox reference users; users reference ambassadors.
    DELETE FROM votes; DELETE FROM polls; DELETE FROM questions; DELETE FROM submissions;
    DELETE FROM outbox; DELETE FROM help_tickets; DELETE FROM webhook_deliveries;
    DELETE FROM wa_messages; DELETE FROM wa_sessions; DELETE FROM events;
    DELETE FROM users; DELETE FROM ambassadors; DELETE FROM settings; DELETE FROM variants; DELETE FROM copilot_runs;
  `);
  await ensureColleges();
  await setSetting("campaign_start", new Date().toISOString());
}
