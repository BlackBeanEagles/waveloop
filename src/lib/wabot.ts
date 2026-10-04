import { one, run, now, all } from "./db";
import { BRANCHES, YEARS, WORKSHOP_TITLE } from "./config";
import { campaignClock, checkOtp, fmtIST, referralCount, referralLink, rewardState, track } from "./growth";
import { afterVerified, registerUser } from "./register";
import { answerFaq, generateIdea } from "./ai";
import { detectScript, isLang, m, type Lang } from "./i18n";

type Session = { state: string; data: Record<string, string> };

// trusted = the message really came from that phone number (Meta / Twilio), so the number is already proven.
// Not trusted = the website chat bubble: anyone can type any number, so we ask for it and verify it with a code.
export type BotContext = { ip: string; trusted?: boolean };

const LANG_ORDER: Lang[] = ["en", "hi", "te", "ta"];
const menu = (l: Lang) => m(l, "menu", { title: WORKSHOP_TITLE });

async function load(key: string): Promise<Session> {
  const row = await one<{ state: string; data: string }>("SELECT state, data FROM wa_sessions WHERE phone = ?", [key]);
  return row ? { state: String(row.state), data: JSON.parse(String(row.data)) } : { state: "new", data: {} };
}

async function save(key: string, s: Session) {
  await run(
    `INSERT INTO wa_sessions(phone, state, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET state = excluded.state, data = excluded.data, updated_at = excluded.updated_at`,
    [key, s.state, JSON.stringify(s.data), now()],
  );
}

const numbered = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}`).join("\n");
const pickFrom = (items: string[], text: string) => {
  const n = parseInt(text, 10);
  if (n >= 1 && n <= items.length) return items[n - 1];
  return items.find((x) => x.toLowerCase() === text.toLowerCase());
};

export async function handleWhatsApp(identity: string, text: string, ctx: BotContext): Promise<string[]> {
  const trusted = ctx.trusted ?? true;
  const key = trusted ? identity.replace(/\D/g, "").slice(-10) : identity;
  const msg = text.trim();
  await run("INSERT INTO wa_messages(phone, direction, body, created_at) VALUES (?, 'in', ?, ?)", [key, msg, now()]);
  const replies = await step(key, msg, { ip: ctx.ip, trusted });
  for (const r of replies) await run("INSERT INTO wa_messages(phone, direction, body, created_at) VALUES (?, 'out', ?, ?)", [key, r, now()]);
  return replies;
}

async function step(key: string, msg: string, ctx: { ip: string; trusted: boolean }): Promise<string[]> {
  const { trusted } = ctx;
  const s = await load(key);
  const upper = msg.toUpperCase();
  // The phone being registered: the sender's own number on WhatsApp, the number they typed in the web chat.
  const phoneNow = () => (trusted ? key : s.data.phone);
  const uid = () => (s.data.uid ? Number(s.data.uid) : null);

  // Typing in Telugu/Hindi/Tamil script switches the conversation to that language.
  const script = detectScript(msg);
  if (script) s.data.lang = script;
  const L: Lang = isLang(s.data.lang) ? s.data.lang : "en";

  // "JOIN ABCD1234" is the pre-filled text in every referral wa.me link.
  const join = upper.match(/^JOIN\s+([A-Z0-9]{4,12})$/);
  if (join) {
    s.data.ref = join[1];
    await track("wa_referral_open", { channel: trusted ? "whatsapp_bot" : "web_chat", meta: { ref: join[1] } });
  }
  if (["HI", "HELLO", "MENU", "START", "0"].includes(upper) || join || s.state === "new" || (script && s.state === "menu")) {
    s.state = "menu";
    await save(key, s);
    return [join ? `${m(L, "invited")}\n\n${menu(L)}` : menu(L)];
  }
  if (upper === "STATUS") return statusReply(trusted ? { phone: key } : { uid: uid() });

  switch (s.state) {
    case "menu": {
      if (msg === "1") {
        const existing = trusted ? await one("SELECT 1 FROM users WHERE phone = ?", [key]) : uid();
        if (existing) return statusReply(trusted ? { phone: key } : { uid: uid() });
        s.state = "ask_name";
        await save(key, s);
        return [m(L, "ask_name")];
      }
      if (msg === "2") {
        s.state = "idea_branch";
        await save(key, s);
        return [m(L, "ask_branch_idea", { list: numbered(BRANCHES) })];
      }
      if (msg === "3") return statusReply(trusted ? { phone: key } : { uid: uid() });
      if (msg === "4") {
        s.state = "faq";
        await save(key, s);
        return [m(L, "faq_prompt")];
      }
      if (msg === "5") {
        s.state = "pick_lang";
        await save(key, s);
        return [m(L, "pick_lang")];
      }
      return [await answerFaq(msg, L), "MENU"];
    }
    case "faq":
      return [await answerFaq(msg, L), "MENU"];

    case "pick_lang": {
      const n = parseInt(msg, 10);
      const chosen = n >= 1 && n <= LANG_ORDER.length ? LANG_ORDER[n - 1] : script;
      if (!chosen) return [m(L, "pick_lang")];
      s.data.lang = chosen;
      s.state = "menu";
      await save(key, s);
      if (phoneNow()) await run("UPDATE users SET lang = ? WHERE phone = ?", [chosen, phoneNow()]);
      return [m(chosen, "lang_set"), menu(chosen)];
    }

    case "idea_branch": {
      const branch = pickFrom(BRANCHES, msg);
      if (!branch) return [m(L, "reply_number", { n: BRANCHES.length })];
      s.data.branch = branch;
      s.state = "idea_interest";
      await save(key, s);
      return [m(L, "ask_interest")];
    }
    case "idea_interest": {
      const idea = await generateIdea({ branch: s.data.branch, interest: msg, skill: "beginner", lang: L });
      s.data.interest = msg;
      s.data.idea = JSON.stringify(idea);
      await track("idea_generated", { channel: trusted ? "whatsapp_bot" : "web_chat" });
      const registered = trusted ? await one("SELECT 1 FROM users WHERE phone = ?", [key]) : uid();
      s.state = registered ? "menu" : "idea_then_register";
      await save(key, s);
      return [
        `🚀 *${idea.title}*\n${idea.pitch}\n\n${idea.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n📄 _${idea.resume_line}_`,
        registered ? m(L, "idea_registered") : m(L, "idea_register"),
      ];
    }
    case "idea_then_register": {
      if (upper === "YES" || msg === "1") {
        s.state = "ask_name";
        await save(key, s);
        return [m(L, "ask_name")];
      }
      s.state = "menu";
      await save(key, s);
      return [menu(L)];
    }
    case "ask_name":
      if (msg.length < 2) return [m(L, "ask_name")];
      s.data.name = msg;
      s.state = trusted ? "ask_email" : "ask_phone";
      await save(key, s);
      return [trusted ? m(L, "ask_email", { first: msg.split(" ")[0] }) : m(L, "ask_phone")];
    case "ask_phone": {
      const digits = msg.replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(digits)) return [m(L, "bad_phone")];
      s.data.phone = digits;
      s.state = "ask_email";
      await save(key, s);
      return [m(L, "ask_email", { first: s.data.name.split(" ")[0] })];
    }
    case "ask_email":
      if (!/^\S+@\S+\.\S+$/.test(msg)) return [m(L, "bad_email")];
      s.data.email = msg.toLowerCase();
      s.state = "ask_college";
      await save(key, s);
      return [m(L, "ask_college")];
    case "ask_college":
      s.data.college = msg;
      if (s.data.branch) {
        s.state = "ask_year";
        await save(key, s);
        return [m(L, "ask_year", { list: numbered(YEARS) })];
      }
      s.state = "ask_branch";
      await save(key, s);
      return [m(L, "ask_branch", { list: numbered(BRANCHES) })];
    case "ask_branch": {
      const branch = pickFrom(BRANCHES, msg);
      if (!branch) return [m(L, "reply_number", { n: BRANCHES.length })];
      s.data.branch = branch;
      s.state = "ask_year";
      await save(key, s);
      return [m(L, "ask_year", { list: numbered(YEARS) })];
    }
    case "ask_year": {
      const year = pickFrom(YEARS, msg);
      if (!year) return [m(L, "reply_number", { n: YEARS.length })];
      const res = await registerUser(
        {
          name: s.data.name,
          email: s.data.email,
          phone: phoneNow(),
          college: s.data.college,
          branch: s.data.branch,
          year,
          ref: s.data.ref,
          channel: trusted ? "whatsapp_bot" : "web_chat",
          idea: s.data.idea ? JSON.parse(s.data.idea) : undefined,
          lang: L,
        },
        { ip: ctx.ip, device: trusted ? `wa:${key}` : `chat:${key}` },
      );
      if (!res.ok) {
        const badPhone = !trusted && /phone|mobile/i.test(res.error);
        s.state = badPhone ? "ask_phone" : "ask_email";
        await save(key, s);
        return [`⚠ ${res.error}`, badPhone ? m(L, "ask_phone") : m(L, "ask_email", { first: s.data.name.split(" ")[0] })];
      }
      if (trusted) {
        // The message came from this number, so WhatsApp has already proven the phone. No OTP needed.
        const upd = await run("UPDATE users SET verified = 1, verified_at = ?, otp_hash = NULL WHERE id = ? AND verified = 0", [now(), res.userId]);
        if (upd.rowsAffected) await afterVerified(res.userId);
        s.state = "menu";
        s.data = { lang: L };
        await save(key, s);
        const { workshop } = await campaignClock();
        return [m(L, "registered", { title: WORKSHOP_TITLE, when: fmtIST(workshop) }), m(L, "share", { link: referralLink(res.refCode) })];
      }
      // Web chat: prove the number/email with a code before anything counts.
      s.data.uid = String(res.userId);
      if (res.existing) {
        s.state = "menu";
        await save(key, s);
        return statusReply({ uid: res.userId });
      }
      s.state = "ask_otp";
      await save(key, s);
      return res.demoOtp ? [m(L, "ask_otp"), m(L, "otp_demo", { code: res.demoOtp })] : [m(L, "ask_otp")];
    }
    case "ask_otp": {
      const id = uid();
      if (!id) {
        s.state = "menu";
        await save(key, s);
        return [menu(L)];
      }
      const r = await checkOtp(id, msg);
      if (!r.ok) return [`⚠ ${r.error ?? "Wrong code"}`, m(L, "ask_otp")];
      if (r.firstTime) await afterVerified(id);
      const u = await one<{ ref_code: string }>("SELECT ref_code FROM users WHERE id = ?", [id]);
      s.state = "menu";
      s.data = { lang: L, uid: String(id) };
      await save(key, s);
      const { workshop } = await campaignClock();
      return [m(L, "registered", { title: WORKSHOP_TITLE, when: fmtIST(workshop) }), m(L, "share", { link: referralLink(String(u?.ref_code ?? "")) })];
    }
    default:
      s.state = "menu";
      await save(key, s);
      return [menu(L)];
  }
}

async function statusReply(who: { phone?: string; uid?: number | null }): Promise<string[]> {
  const u = who.phone
    ? await one<{ id: number; name: string; ref_code: string }>("SELECT id, name, ref_code FROM users WHERE phone = ? AND verified = 1", [who.phone])
    : who.uid
      ? await one<{ id: number; name: string; ref_code: string }>("SELECT id, name, ref_code FROM users WHERE id = ? AND verified = 1", [who.uid])
      : undefined;
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
