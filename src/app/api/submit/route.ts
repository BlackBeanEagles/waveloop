import { NextRequest } from "next/server";
import { z } from "zod";
import { gradeProject } from "@/lib/ai";
import { one, run, now } from "@/lib/db";
import { body, json } from "@/lib/http";

const Schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(30, "Describe your project in at least 30 characters").max(4000),
  repoUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await body(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message }, 400);
  const d = parsed.data;
  const user = d.email ? await one<{ id: number }>("SELECT id FROM users WHERE email = ?", [d.email]) : undefined;
  if (user) await run("UPDATE users SET attended = 1 WHERE id = ?", [user.id]);
  const grade = await gradeProject({ title: d.title, description: d.description, repoUrl: d.repoUrl || undefined });
  const r = await run(
    `INSERT INTO submissions(user_id, name, title, repo_url, description, scores, total, feedback, graded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user ? Number(user.id) : null,
      d.name,
      d.title,
      d.repoUrl || null,
      d.description,
      JSON.stringify(grade.scores),
      grade.total,
      JSON.stringify({ strengths: grade.strengths, improvements: grade.improvements, next_step: grade.next_step }),
      grade.graded_by,
      now(),
    ],
  );
  return json({ id: Number(r.lastInsertRowid), grade });
}
