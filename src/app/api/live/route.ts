import { NextRequest } from "next/server";
import { all, one, run, now } from "@/lib/db";
import { body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const poll = await one<{ id: number; question: string; options: string }>("SELECT id, question, options FROM polls WHERE active = 1 ORDER BY id DESC");
  let results: number[] = [];
  if (poll) {
    const options = JSON.parse(String(poll.options)) as string[];
    const votes = await all<{ option_index: number; n: number }>(
      "SELECT option_index, COUNT(*) AS n FROM votes WHERE poll_id = ? GROUP BY option_index",
      [poll.id],
    );
    results = options.map((_, i) => Number(votes.find((v) => Number(v.option_index) === i)?.n ?? 0));
  }
  const polls = await all("SELECT id, question, active FROM polls ORDER BY id");
  const questions = await all("SELECT id, author, body, upvotes, answered FROM questions ORDER BY answered ASC, upvotes DESC, id DESC LIMIT 30");
  return json({
    poll: poll ? { id: Number(poll.id), question: poll.question, options: JSON.parse(String(poll.options)), results } : null,
    polls,
    questions,
  });
}

type LiveAction =
  | { action: "vote"; pollId: number; voter: string; option: number }
  | { action: "ask"; author: string; body: string }
  | { action: "upvote"; id: number }
  | { action: "activate"; pollId: number }
  | { action: "create_poll"; question: string; options: string[] }
  | { action: "answered"; id: number };

export async function POST(req: NextRequest) {
  const b = await body<LiveAction>(req);
  switch (b.action) {
    case "vote":
      await run(
        "INSERT INTO votes(poll_id, voter, option_index) VALUES (?, ?, ?) ON CONFLICT(poll_id, voter) DO UPDATE SET option_index = excluded.option_index",
        [b.pollId, String(b.voter).slice(0, 64), b.option],
      );
      break;
    case "ask":
      if (!b.body?.trim()) return json({ error: "empty question" }, 400);
      await run("INSERT INTO questions(author, body, created_at) VALUES (?, ?, ?)", [(b.author || "Anonymous").slice(0, 40), b.body.slice(0, 300), now()]);
      break;
    case "upvote":
      await run("UPDATE questions SET upvotes = upvotes + 1 WHERE id = ?", [b.id]);
      break;
    case "activate":
      await run("UPDATE polls SET active = CASE WHEN id = ? THEN 1 ELSE 0 END", [b.pollId]);
      break;
    case "create_poll": {
      const options = (b.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (!b.question?.trim() || options.length < 2) return json({ error: "question and 2+ options" }, 400);
      await run("UPDATE polls SET active = 0");
      await run("INSERT INTO polls(question, options, active, created_at) VALUES (?, ?, 1, ?)", [b.question.trim(), JSON.stringify(options), now()]);
      break;
    }
    case "answered":
      await run("UPDATE questions SET answered = 1 WHERE id = ?", [b.id]);
      break;
    default:
      return json({ error: "unknown action" }, 400);
  }
  return json({ ok: true });
}
