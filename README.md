# WaveLoop

A campus growth engine built for the NxtWave Growth Challenge: get **500 final-year engineering students** to register for the free workshop *"Build Your First AI Project in 60 Minutes"* in **7 days on ₹2,000**.

The core bet: ₹2,000 cannot buy 500 sign-ups through ads (roughly ₹20–40 per lead means 50–100 sign-ups at best). So the budget goes into **referral prizes**, and the product turns every registrant into a distribution channel.

## What's inside

| Module | Route | What it does |
|---|---|---|
| AI idea hook | `/` | The student picks a branch and an interest, and Claude designs a 60-minute project for them. They register to "build it live". A/B tests two headlines. |
| Registration + verification | `/` | Validation, Indian mobile check, a 6-digit code by email (Resend) or WhatsApp (Twilio), and a 5-attempt cap |
| Referral engine | `/r/[code]`, `/u/[code]` | Unique codes, a pre-filled WhatsApp message, a LinkedIn post, an auto-generated share card, a QR code and a reward ladder |
| Fraud scoring | server | Flags disposable emails, placeholder phones, IP bursts, self-referral from the same device and referral bursts. A referral counts only when the friend is **verified and not flagged**. |
| College leaderboard | `/leaderboard` | Live rankings of colleges and top referrers (names masked) |
| WhatsApp bot | `/whatsapp`, `/api/whatsapp/twilio` | One step-by-step engine behind both a phone simulator and a real Twilio webhook (signature-checked). Covers registering, the idea, status and FAQ (answered by Claude, then falls back to keywords). No code is needed because the number is already proven. |
| Ambassador program | `/ambassador`, `/a/[code]?g=group` | Tracked links per WhatsApp group, a ready-to-post message and a per-ambassador dashboard |
| Drip engine | `/api/cron/drip` | A 6-step WhatsApp sequence (welcome, referral nudge, reminders 24h and 1h before, live now, submit your project). Rules are checked at send time. |
| Live workshop room | `/live` | Polls and upvoted Q&A, with host controls |
| AI project grading | `/submit`, `/cert/[id]` | Claude scores the project on a 5-part rubric (reading the GitHub README) and issues a shareable certificate that loops back into the next campaign |
| Growth copilot | `/admin` | Reads live metrics, compares each funnel step to typical rates, names the biggest leak, proposes 3 ranked experiments, writes 2 new headlines (one click sends them into the bandit) and an ambassador post. Uses Claude with structured output; without a key, a rules engine produces the same shape. Says "not enough data" below 30 visitors instead of guessing. |
| Self-optimising headlines | `/`, `/admin` | Thompson-sampling bandit: each visitor gets the headline drawn from each arm's Beta posterior (sticky per visitor), so traffic shifts to winners automatically. Shows P(best) per arm by Monte Carlo; pause, resume or add challengers. |
| Referral cascades | `/admin` | A tree graph of who brought whom (d3-hierarchy), with the largest cascade, deepest chain, people per generation and the same-college vs cross-college spread. |
| Regional languages | `/?lang=te`, bot | Student page, idea generator, WhatsApp bot and drip messages in Telugu, Hindi and Tamil. Detected from the browser language or by typing in that script on WhatsApp; referral links open in the referrer's language; ambassadors can make per-language group links. The bandit runs on English only, so translations never pollute its stats. Translations need a native-speaker review before launch. |
| Show-up prediction | `/admin` | Logistic model scoring each registrant's chance of attending (verified, calendar, shared, referred, channel, lead time). People under 40% get 2 extra "rescue" messages, checked at send time. Starts from prior weights; after the workshop, "Learn from real attendance" refits it (L2-regularised towards the prior) on actual check-ins. |
| Live help desk | `/help`, `/mentor` | Students paste an error and get a diagnosis, 2-4 steps and a code fix matched to their workshop step and registered project (Claude, in their language; without a key, a matcher for the 10 most common beginner errors). "Still stuck" escalates to the mentor queue; the mentor's reply appears on the student's screen. Tracks how many problems were solved without a mentor. |
| Webhooks (n8n / Zapier) | `/admin` | Signed outgoing events: `user.registered`, `user.verified`, `referral.counted`, `user.checked_in`, `submission.graded`, `help.escalated`. HMAC-SHA256 over `timestamp.body`, secret shown once, retries with backoff (up to 6 tries, also run by the cron), delivery log, test ping, pause/delete, SSRF guard on URLs. |
| Growth dashboard | `/admin` | Progress against target pace, the funnel, channels, A/B significance (z-test), viral coefficient, end-of-week projection, the fraud review queue and the outbox. Refreshes every 5 seconds from real activity only. **Clear all data** wipes everything and restarts the 7-day clock. |

## Mock vs real

Everything runs with **zero keys**. Each integration switches to the real service when its environment variable is set (see `.env.example`):

- `ANTHROPIC_API_KEY`: real Claude ideas, grading and FAQ answers (otherwise templates and a heuristic, labelled in the UI)
- `RESEND_API_KEY`: real email verification codes (otherwise demo mode shows the code on screen)
- `TWILIO_*`: real WhatsApp bot and drip messages (otherwise sends are logged as "no-provider")
- `DATABASE_URL=libsql://…`: Turso hosted database (otherwise a local SQLite file)

The dashboard shows which integrations are live. There is no synthetic data: every number comes from real visits, sign-ups and messages.

## Run

```bash
npm install
npm run dev
```
Open `/admin`. It starts at zero and fills in as you register through `/`, the WhatsApp simulator or referral links. The 7-day clock starts on the first request (or when you click **Clear all data**).

## Deploy (Vercel + Turso)
1. Create a Turso database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.
2. Set `NEXT_PUBLIC_SITE_URL`, `APP_SECRET`, `ADMIN_KEY` and any API keys you have.
3. Deploy to Vercel. `vercel.json` runs the drip once a day (the free-plan limit); use cron-job.org for hourly runs.

## Known limits
- The verification attempt counter is per server instance (move it to Redis when scaling out).
- The admin is open unless `ADMIN_KEY` is set.
