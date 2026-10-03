import { one, run, now, all } from "./db";
import { BRANCHES, YEARS, WORKSHOP_TITLE } from "./config";
import { campaignClock, fmtIST, referralCount, referralLink, rewardState, track } from "./growth";
import { registerUser } from "./register";
import { answerFaq, generateIdea } from "./ai";

type Session = { state: string; data: Record<string, string> };

const MENU = [
  `👋 Welcome to *${WORKSHOP_TITLE}* by NxtWave. It's free, live and takes 60 minutes.`,
  "Reply with a number:\n1️⃣ Register (30 sec)\n2️⃣ Get my personal AI project idea\n3️⃣ My referrals & rewards\n4️⃣ Ask a question",
].join("\n\n");

async function load(phone: string): Promise<Session> {
  const row = await one<{ state: string; data: string }>("SELECT state, data FROM wa_sessions WHERE phone = ?", [phone]);
  return row ? { state: String(row.state), data: JSON.parse(String(row.data)) } : { state: "new", data: {} };
}

async function save(phone: string, s: Session) {
  await run(
    `INSERT INTO wa_sessions(phone, state, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET state = excluded.state, data = excluded.data, updated_at = excluded.updated_at`,
    [phone, s.state, JSON.stringify(s.data), now()],
  );
}

const numbered = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}`).join("\n");
const pickFrom = (items: string[], text: string) => {
  const n = parseInt(text, 10);
  if (n >= 1 && n <= items.length) return items[n - 1];
  return items.find((x) => x.toLowerCase() === text.toLowerCase());
};

export async function handleWhatsApp(phoneRaw: string, text: string, ctx: { ip: string }): Promise<string[]> {
  const phone = phoneRaw.replace(/\D/g, "").slice(-10);
  const msg = text.trim();
  await run("INSERT INTO wa_messages(phone, direction, body, created_at) VALUES (?, 'in', ?, ?)", [phone, msg, now()]);
  const replies = await step(phone, msg, ctx);
  for (const r of replies) await run("INSERT INTO wa_messages(phone, direction, body, created_at) VALUES (?, 'out', ?, ?)", [phone, r, now()]);
  return replies;
}

async function step(phone: string, msg: string, ctx: { ip: string }): Promise<string[]> {
  const s = await load(phone);
  const upper = msg.toUpperCase();

  // "JOIN ABCD1234" is the pre-filled text in every referral wa.me link.
  const join = upper.match(/^JOIN\s+([A-Z0-9]{4,12})$/);
  if (join) {
    s.data.ref = join[1];
    await track("wa_referral_open", { channel: "whatsapp_bot", meta: { ref: join[1] } });
  }
  if (["HI", "HELLO", "MENU", "START", "0"].includes(upper) || join || s.state === "new") {
    s.state = "menu";
    await save(phone, s);
    return [join ? `Your friend invited you! 🙌\n\n${MENU}` : MENU];
  }
  if (upper === "STATUS") return statusReply(phone);

  switch (s.state) {
    case "menu": {
      if (msg === "1") {
        const existing = await one("SELECT 1 FROM users WHERE phone = ?", [phone]);
        if (existing) return statusReply(phone);
        s.state = "ask_name";
        await save(phone, s);
        return ["Great! What's your full name?"];
      }
      if (msg === "2") {
        s.state = "idea_branch";
        await save(phone, s);
        return [`Which branch are you in?\n${numbered(BRANCHES)}`];
      }
      if (msg === "3") return statusReply(phone);
      if (msg === "4") {
        s.state = "faq";
        await save(phone, s);
        return ["Ask me anything about the workshop 👇"];
      }
      return [await answerFaq(msg), "Reply MENU for options."];
    }
    case "faq":
      return [await answerFaq(msg), "Ask another, or reply MENU."];

    case "idea_branch": {
      const branch = pickFrom(BRANCHES, msg);
      if (!branch) return [`Reply with a number 1-${BRANCHES.length}.`];
      s.data.branch = branch;
      s.state = "idea_interest";
      await save(phone, s);
      return ["What are you into? (e.g. cricket, movies, finance, farming, music, gaming)"];
    }
    case "idea_interest": {
      const idea = await generateIdea({ branch: s.data.branch, interest: msg, skill: "beginner" });
      s.data.interest = msg;
      s.data.idea = JSON.stringify(idea);
      await track("idea_generated", { channel: "whatsapp_bot" });
      const registered = await one("SELECT 1 FROM users WHERE phone = ?", [phone]);
      s.state = registered ? "menu" : "idea_then_register";
      await save(phone, s);
      return [
        `🚀 *${idea.title}*\n${idea.pitch}\n\n${idea.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n📄 Resume line: _${idea.resume_line}_`,
        registered ? "You'll build this live in the workshop! Reply MENU for options." : "You'll build this live in the workshop. Reply *YES* to lock your free seat.",
      ];
    }
    case "idea_then_register": {
      if (upper === "YES" || msg === "1") {
        s.state = "ask_name";
        await save(phone, s);
        return ["What's your full name?"];
      }
      s.state = "menu";
      await save(phone, s);
      return [MENU];
    }
    case "ask_name":
      if (msg.length < 2) return ["Please send your full name."];
      s.data.name = msg;
      s.state = "ask_email";
      await save(phone, s);
      return [`Thanks ${msg.split(" ")[0]}! Your email? (we send the joining link there too)`];
    case "ask_email":
      if (!/^\S+@\S+\.\S+$/.test(msg)) return ["That doesn't look like an email. Try again?"];
      s.data.email = msg.toLowerCase();
      s.state = "ask_college";
      await save(phone, s);
      return ["Which college are you from? (full name)"];
    case "ask_college":
      s.data.college = msg;
      if (s.data.branch) {
        s.state = "ask_year";
        await save(phone, s);
        return [`Which year?\n${numbered(YEARS)}`];
      }
      s.state = "ask_branch";
      await save(phone, s);
      return [`Your branch?\n${numbered(BRANCHES)}`];
    case "ask_branch": {
      const branch = pickFrom(BRANCHES, msg);
      if (!branch) return [`Reply with a number 1-${BRANCHES.length}.`];
      s.data.branch = branch;
      s.state = "ask_year";
      await save(phone, s);
      return [`Which year?\n${numbered(YEARS)}`];
    }
    case "ask_year": {
      const year = pickFrom(YEARS, msg);
      if (!year) return [`Reply with a number 1-${YEARS.length}.`];
      const res = await registerUser(
        {
          name: s.data.name,
          email: s.data.email,
          phone,
          college: s.data.college,
          branch: s.data.branch,
          year,
          ref: s.data.ref,
          channel: "whatsapp_bot",
          idea: s.data.idea ? JSON.parse(s.data.idea) : undefined,
        },
        { ip: ctx.ip, device: `wa:${phone}` },
      );
      if (!res.ok) {
        s.state = "ask_email";
        await save(phone, s);
        return [`Hmm, ${res.error}. Let's retry. What's your email?`];
      }
      // The message came from this number, so WhatsApp has already proven the phone. No OTP needed.
      await run("UPDATE users SET verified = 1, verified_at = ?, otp_hash = NULL WHERE id = ? AND verified = 0", [now(), res.userId]);
      await track("verified", { userId: res.userId, channel: "whatsapp_bot" });
      s.state = "menu";
      s.data = {};
      await save(phone, s);
      const { workshop } = await campaignClock();
      return [
        `✅ You're registered for *${WORKSHOP_TITLE}*!\n🗓 ${fmtIST(workshop)}\n💻 Laptop + Chrome is all you need.`,
        `🎁 Bring friends, unlock rewards. Forward this:\n\n${referralLink(res.refCode)}\n\nReply STATUS anytime to see your referrals.`,
      ];
    }
    default:
      s.state = "menu";
      await save(phone, s);
      return [MENU];
  }
}

async function statusReply(phone: string): Promise<string[]> {
  const u = await one<{ id: number; name: string; ref_code: string; verified: number }>("SELECT id, name, ref_code, verified FROM users WHERE phone = ?", [phone]);
  if (!u) return ["You're not registered yet. Reply 1 to register in 30 seconds."];
  const refs = await referralCount(Number(u.id));
  const rw = rewardState(refs);
  const rank = await all<{ id: number }>(
    `SELECT referred_by AS id FROM users WHERE referred_by IS NOT NULL AND verified = 1 AND fraud_score < 50
     GROUP BY referred_by HAVING COUNT(*) > ? `,
    [refs],
  );
  return [
    `📊 *${String(u.name).split(" ")[0]}*, you have *${refs}* verified referral${refs === 1 ? "" : "s"}${refs > 0 ? ` (rank #${rank.length + 1})` : ""}.` +
      (rw.next ? `\n🎯 ${rw.toNext} more to unlock: ${rw.next.label}` : "\n🏆 You've unlocked every reward!") +
      `\n\nYour link: ${referralLink(String(u.ref_code))}`,
  ];
}
