import { z } from "zod";
import { all, one, run, now } from "./db";
import { WORKSHOP_TITLE } from "./config";
import { LANGS, isLang } from "./i18n";
import { emit } from "./webhooks";
import { llmJson, type Provider } from "./llm";

// Live-workshop help desk: 500 people building at once and a handful of mentors. Claude answers first,
// mentors only see what Claude couldn't solve.

export const WORKSHOP_STEPS = [
  "Step 1 (0-15 min): write and test the core prompt",
  "Step 2 (15-30 min): wrap it in a Streamlit or Lovable app",
  "Step 3 (30-45 min): add one 'wow' feature (file upload, voice, regional language)",
  "Step 4 (45-60 min): deploy for free and record a demo",
];

export const AnswerSchema = z.object({
  diagnosis: z.string(),
  fix_steps: z.array(z.string()),
  code_fix: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  needs_mentor: z.boolean(),
});
export type Answer = z.infer<typeof AnswerSchema> & { engine: Provider | "rules" };

type Rule = { re: RegExp; answer: Omit<Answer, "engine"> };

// The errors beginners actually hit in a browser-only, 60-minute AI build.
const RULES: Rule[] = [
  {
    re: /(api[_ ]?key|401|unauthori[sz]ed|invalid.*key|permission denied|PERMISSION_DENIED)/i,
    answer: { diagnosis: "The AI API is rejecting your key: it's missing, mistyped, or not loaded.", fix_steps: ["Copy the key again from the provider's console (no spaces at the ends).", "In Colab: put it in the 🔑 Secrets panel and read it with userdata.get('GEMINI_API_KEY').", "In Streamlit: put it in .streamlit/secrets.toml and read st.secrets['GEMINI_API_KEY'].", "Re-run the cell or restart the app after changing it."], code_fix: "from google.colab import userdata\nimport google.generativeai as genai\ngenai.configure(api_key=userdata.get('GEMINI_API_KEY'))", confidence: "high", needs_mentor: false },
  },
  {
    re: /(429|quota|rate.?limit|RESOURCE_EXHAUSTED|too many requests)/i,
    answer: { diagnosis: "You hit the free tier's rate limit. Your code is fine; you're calling the API too fast.", fix_steps: ["Wait 60 seconds and try again.", "Don't call the model inside a loop while testing; test on one input.", "Switch to the 'flash' model, which has higher free limits."], code_fix: "model = genai.GenerativeModel('gemini-1.5-flash')", confidence: "high", needs_mentor: false },
  },
  {
    re: /No module named ['"]?([\w.-]+)/i,
    answer: { diagnosis: "A Python package isn't installed in this environment.", fix_steps: ["In Colab, run the install line below in a new cell, then re-run your code.", "On Hugging Face Spaces, add the package name to requirements.txt.", "Watch for name differences: the package for 'google.generativeai' is 'google-generativeai'."], code_fix: "!pip install -q google-generativeai streamlit", confidence: "high", needs_mentor: false },
  },
  {
    re: /(streamlit.*(not recognized|not found)|command not found: streamlit)/i,
    answer: { diagnosis: "Your terminal can't find the streamlit command.", fix_steps: ["Run it through Python instead (below).", "If it says 'No module named streamlit', install it first."], code_fix: "python -m streamlit run app.py", confidence: "high", needs_mentor: false },
  },
  {
    re: /(IndentationError|unexpected indent|expected an indented block)/i,
    answer: { diagnosis: "Python is strict about spaces at the start of lines, and one line is misaligned.", fix_steps: ["Go to the line number in the error.", "Make every line in the same block start with exactly 4 spaces (no tabs).", "Lines after if/for/def/with must be indented one level more."], code_fix: "", confidence: "high", needs_mentor: false },
  },
  {
    re: /(SyntaxError)/i,
    answer: { diagnosis: "There's a typo Python can't read, often a missing bracket, quote or colon.", fix_steps: ["Look at the line in the error AND the line just above it.", "Check that every ( [ { and quote is closed.", "Lines starting with if/for/def must end with a colon."], code_fix: "", confidence: "medium", needs_mentor: false },
  },
  {
    re: /(JSONDecodeError|Expecting value|Unexpected token)/i,
    answer: { diagnosis: "The AI replied with text (often wrapped in ```json fences) instead of pure JSON.", fix_steps: ["Print the raw response once to see what came back.", "Strip the code fences before parsing (below).", "Add 'Reply with JSON only, no explanation' to your prompt."], code_fix: "import json, re\ntext = response.text\ntext = re.sub(r'^```(json)?|```$', '', text.strip(), flags=re.M)\ndata = json.loads(text)", confidence: "high", needs_mentor: false },
  },
  {
    re: /('NoneType'|NoneType object|has no attribute 'text'|KeyError|IndexError)/i,
    answer: { diagnosis: "The response was empty or blocked, so the field you're reading doesn't exist.", fix_steps: ["Print the whole response object to see what came back.", "Check if it was blocked for safety; rephrase the prompt.", "Guard the read: only use response.text if it exists."], code_fix: "print(response)\nif response.candidates:\n    print(response.text)", confidence: "medium", needs_mentor: false },
  },
  {
    re: /(CORS|Access-Control-Allow-Origin|blocked by CORS)/i,
    answer: { diagnosis: "The browser blocks calling the AI API directly from your web page.", fix_steps: ["Call the API from the Python/Streamlit side, not browser JavaScript.", "In Lovable, use its built-in backend function to make the call.", "Never put your API key in front-end code."], code_fix: "", confidence: "medium", needs_mentor: false },
  },
  {
    re: /(requirements\.txt|build (failed|error)|Space.*(error|failed)|runtime error)/i,
    answer: { diagnosis: "The Hugging Face Space can't build because a dependency is missing or the app file is misnamed.", fix_steps: ["Name your main file app.py.", "Add requirements.txt listing every package you import.", "Add your API key under Settings → Variables and secrets, not in the code.", "Open the Logs tab and look at the first red line."], code_fix: "streamlit\ngoogle-generativeai", confidence: "medium", needs_mentor: false },
  },
];

const FALLBACK: Omit<Answer, "engine"> = {
  diagnosis: "I couldn't match this to a known issue.",
  fix_steps: ["Copy the LAST 10 lines of the error (that's where the real cause is).", "Check you ran every cell/file from the top in order.", "If it still fails, tap 'Still stuck' and a mentor will look at it."],
  code_fix: "",
  confidence: "low",
  needs_mentor: true,
};

export async function askHelp(input: { name: string; email?: string; step?: string; problem: string; lang?: string }) {
  const user = input.email ? await one<{ id: number; idea_json: string | null; lang: string }>("SELECT id, idea_json, lang FROM users WHERE email = ?", [input.email.toLowerCase()]) : undefined;
  const idea = user?.idea_json ? (JSON.parse(String(user.idea_json)) as { title?: string; pitch?: string; tools?: string[] }) : null;
  const lang = isLang(input.lang) ? input.lang : isLang(user?.lang) ? user!.lang : "en";

  let answer: Answer | null = null;
  const res = await llmJson(AnswerSchema, {
    effort: "low",
    maxTokens: 6000,
    system:
          `You are a patient TA in the live workshop "${WORKSHOP_TITLE}" for Indian final-year engineering students, many coding beginners. ` +
          `Workshop plan:\n${WORKSHOP_STEPS.join("\n")}\nTools: Google Colab, Gemini/ChatGPT/Claude free tiers, Streamlit, Lovable, Hugging Face Spaces. ` +
          "Diagnose the student's problem in one or two plain sentences. fix_steps: 2-4 short, concrete steps they can do in under 3 minutes. " +
          "code_fix: the smallest code snippet that fixes it, or an empty string if no code is needed. Never ask them to paste API keys. " +
          "Set needs_mentor=true if the problem is unclear, needs their screen, or you are guessing. " +
          `Write diagnosis and fix_steps in ${isLang(lang) ? LANGS[lang].label : "English"}; keep code and error names in English.`,
    user:
              (idea ? `Student's project: ${idea.title} — ${idea.pitch} (tools: ${idea.tools?.join(", ")})\n` : "") +
              (input.step ? `They are on: ${input.step}\n` : "") +
              `Problem / error:\n${input.problem.slice(0, 6000)}`,
  });
  if (res) answer = { ...res.data, engine: res.provider };
  if (!answer) {
    const hit = RULES.find((r) => r.re.test(input.problem));
    answer = { ...(hit?.answer ?? FALLBACK), engine: "rules" };
  }

  const r = await run(
    "INSERT INTO help_tickets(user_id, name, step, problem, answer, engine, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [user ? Number(user.id) : null, input.name.slice(0, 60), input.step ?? null, input.problem.slice(0, 6000), JSON.stringify(answer), answer.engine, "answered", now()],
  );
  return { ticketId: Number(r.lastInsertRowid), answer };
}

export async function updateTicket(id: number, action: "solved" | "escalate" | "mentor_resolve", note?: string) {
  const t = await one<{ id: number; name: string; problem: string; step: string | null }>("SELECT id, name, problem, step FROM help_tickets WHERE id = ?", [id]);
  if (!t) return false;
  if (action === "solved") await run("UPDATE help_tickets SET status = 'solved', resolved_at = ? WHERE id = ?", [now(), id]);
  if (action === "escalate") {
    await run("UPDATE help_tickets SET status = 'escalated' WHERE id = ?", [id]);
    await emit("help.escalated", { ticket_id: id, name: t.name, step: t.step, problem: String(t.problem).slice(0, 500) });
  }
  if (action === "mentor_resolve") await run("UPDATE help_tickets SET status = 'mentor_resolved', mentor_note = ?, resolved_at = ? WHERE id = ?", [note?.slice(0, 1000) ?? null, now(), id]);
  return true;
}

export async function getTicket(id: number) {
  const t = await one<{ id: number; status: string; mentor_note: string | null }>("SELECT id, status, mentor_note FROM help_tickets WHERE id = ?", [id]);
  return t ? { id: Number(t.id), status: String(t.status), mentorNote: t.mentor_note } : null;
}

export async function mentorQueue() {
  return all<{ id: number; name: string; step: string | null; problem: string; answer: string; created_at: string }>(
    "SELECT id, name, step, problem, answer, created_at FROM help_tickets WHERE status = 'escalated' ORDER BY id ASC LIMIT 50",
  );
}

export async function helpStats() {
  const rows = await all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM help_tickets GROUP BY status");
  const by = Object.fromEntries(rows.map((r) => [String(r.status), Number(r.n)]));
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const selfSolved = by.solved ?? 0;
  const escalated = (by.escalated ?? 0) + (by.mentor_resolved ?? 0);
  return {
    total,
    selfSolved,
    escalated,
    waiting: by.escalated ?? 0,
    noFeedback: by.answered ?? 0,
    // Of tickets where the student told us the outcome, how many did the AI fix without a mentor?
    deflection: selfSolved + escalated ? selfSolved / (selfSolved + escalated) : 0,
  };
}
