// Exchanges a temporary WhatsApp token for a ~60-day one and writes the WhatsApp values into .env.vercel.
// Run: node scripts/meta-token.mjs   (input is hidden; nothing secret is printed)
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ENV_FILE = path.join(process.cwd(), ".env.vercel");
const VERSION = "v23.0";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Swallow echoed characters so secrets never appear on screen.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function setLine(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
}

if (!fs.existsSync(ENV_FILE)) {
  console.error(`Can't find ${ENV_FILE}. Run this from the waveloop folder.`);
  process.exit(1);
}

console.log("Paste each value and press Enter. Secret values stay hidden while you paste.\n");
const appId = await ask("App ID (App settings > Basic): ");
const appSecret = await ask("App Secret (App settings > Basic > Show): ", true);
const tempToken = await ask("Temporary access token (WhatsApp > API Setup): ", true);
const phoneId = await ask("Phone number ID (WhatsApp > API Setup): ");

if (!/^\d+$/.test(appId) || !/^\d+$/.test(phoneId) || !appSecret || !tempToken) {
  console.error("\nApp ID and Phone number ID must be numbers, and the secret/token can't be empty. Nothing was changed.");
  process.exit(1);
}

const url = new URL(`https://graph.facebook.com/${VERSION}/oauth/access_token`);
url.search = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: tempToken }).toString();
const res = await fetch(url);
const data = await res.json();
if (!res.ok || !data.access_token) {
  console.error(`\nMeta refused the exchange: ${data.error?.message ?? res.status}`);
  console.error("Most common fix: the temporary token expired (they last ~24h). Copy a fresh one from API Setup and run this again.");
  process.exit(1);
}
const longToken = data.access_token;

// Check the real expiry with Meta's debug endpoint (app token = id|secret).
let expiry = "unknown";
try {
  const dbg = new URL(`https://graph.facebook.com/${VERSION}/debug_token`);
  dbg.search = new URLSearchParams({ input_token: longToken, access_token: `${appId}|${appSecret}` }).toString();
  const d = (await (await fetch(dbg)).json()).data;
  if (d) expiry = d.expires_at === 0 ? "never" : new Date(d.expires_at * 1000).toDateString();
  if (d && d.is_valid === false) expiry += " (Meta says this token is NOT valid)";
} catch {
  // Expiry check is a nice-to-have; the token is still written.
}

let env = fs.readFileSync(ENV_FILE, "utf8");
env = setLine(env, "WHATSAPP_TOKEN", longToken);
env = setLine(env, "WHATSAPP_APP_SECRET", appSecret);
env = setLine(env, "WHATSAPP_PHONE_NUMBER_ID", phoneId);
fs.writeFileSync(ENV_FILE, env);

console.log(`\nDone. Wrote WHATSAPP_TOKEN, WHATSAPP_APP_SECRET and WHATSAPP_PHONE_NUMBER_ID to .env.vercel.`);
console.log(`Token expires: ${expiry}. Put a reminder in your calendar a few days before that date.`);
