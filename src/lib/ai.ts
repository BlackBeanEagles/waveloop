import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { WORKSHOP_TITLE } from "./config";
import { LANGS, isLang } from "./i18n";

const langName = (l?: string) => (isLang(l) ? LANGS[l].label : "English");

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

// ---------- 1. Project idea generator (the registration hook) ----------

export const IdeaSchema = z.object({
  title: z.string(),
  pitch: z.string(),
  why_it_fits_you: z.string(),
  steps: z.array(z.string()),
  tools: z.array(z.string()),
  resume_line: z.string(),
});
export type Idea = z.infer<typeof IdeaSchema> & { source: "claude" | "template" };

export async function generateIdea(input: { branch: string; interest: string; skill: string; lang?: string }): Promise<Idea> {
  const c = claude();
  if (c) {
    try {
      const res = await c.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(IdeaSchema) },
        system:
          `You design starter AI projects for Indian final-year engineering students attending a free 60-minute live workshop called "${WORKSHOP_TITLE}". ` +
          "The project must be buildable in 60 minutes in a browser by a beginner using free tools (Google Colab, Gemini/ChatGPT/Claude free tiers, Streamlit, Hugging Face Spaces, Lovable, n8n). " +
          "Tie it to the student's branch so it reads well on a placement resume. Keep it concrete and specific, never generic like 'a chatbot'. " +
          "steps: exactly 4 short steps, each doable in about 15 minutes. tools: 2-4 free tools. resume_line: one line starting with a past-tense verb. " +
          `Write title, pitch, why_it_fits_you and steps in ${langName(input.lang)} (simple, conversational, the way students actually speak; English tech words like 'app' or 'API' are fine). ` +
          "Always write tools and resume_line in English, since the resume is in English.",
        messages: [
          {
            role: "user",
            content: `Branch: ${input.branch}\nInterested in: ${input.interest}\nCoding comfort: ${input.skill}`,
          },
        ],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        return { ...res.parsed_output, source: "claude" };
      }
    } catch (err) {
      console.error("generateIdea: falling back to template", err);
    }
  }
  return templateIdea(input);
}

const IDEA_BANK: Record<string, { title: string; pitch: string; tools: string[] }[]> = {
  CSE: [
    { title: "Placement Prep Copilot", pitch: "An AI that turns any job description into a 7-day prep plan with mock questions.", tools: ["Gemini API", "Streamlit", "Google Colab"] },
    { title: "Code Review Buddy", pitch: "Paste a function and get a plain-English review with bugs and fixes ranked by severity.", tools: ["Claude free tier", "Hugging Face Spaces"] },
  ],
  IT: [
    { title: "Resume vs JD Matcher", pitch: "Upload your resume and a job post; get a match score and the 5 lines to rewrite.", tools: ["Gemini API", "Streamlit"] },
  ],
  ECE: [
    { title: "Circuit Doubt Solver", pitch: "Snap a photo of a circuit diagram and get a step-by-step analysis with the key equations.", tools: ["Gemini Vision", "Google Colab"] },
  ],
  EEE: [
    { title: "Home Energy Bill Explainer", pitch: "Upload an electricity bill and get the appliance-level savings plan in Telugu or Hindi.", tools: ["Gemini Vision", "Lovable"] },
  ],
  Mechanical: [
    { title: "Machine Fault Spotter", pitch: "Describe a vibration or noise and get likely faults ranked by probability with fixes.", tools: ["ChatGPT free tier", "Streamlit"] },
  ],
  Civil: [
    { title: "Site Safety Inspector", pitch: "Upload a construction-site photo and get a checklist of visible safety violations.", tools: ["Gemini Vision", "Hugging Face Spaces"] },
  ],
  default: [
    { title: "Study Notes to Quiz Generator", pitch: "Turn lecture notes into a 10-question quiz with explanations, so revision takes 10 minutes.", tools: ["Gemini API", "Google Colab", "Streamlit"] },
  ],
};

function templateIdea(input: { branch: string; interest: string }): Idea {
  const bank = IDEA_BANK[input.branch] ?? IDEA_BANK.default;
  const pick = bank[Math.abs(hashStr(input.interest)) % bank.length];
  return {
    ...pick,
    why_it_fits_you: `It uses what ${input.branch} students already know and connects to your interest in ${input.interest}, so it's easy to explain in an interview.`,
    steps: [
      "Write the prompt that does the core job and test it on 3 examples",
      "Wrap it in a simple app (Streamlit or Lovable) with one input box",
      "Add one 'wow' feature: file upload, voice, or a regional language",
      "Deploy it free and record a 30-second demo for LinkedIn",
    ],
    resume_line: `Built and deployed "${pick.title}", an AI app using ${pick.tools[0]}, in a 60-minute live build.`,
    source: "template",
  };
}

function hashStr(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

// ---------- 2. Post-workshop project grader ----------

export const GradeSchema = z.object({
  scores: z.object({
    problem_clarity: z.number().int().min(0).max(20),
    ai_usage: z.number().int().min(0).max(25),
    working_demo: z.number().int().min(0).max(25),
    originality: z.number().int().min(0).max(15),
    presentation: z.number().int().min(0).max(15),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  next_step: z.string(),
});
export type Grade = z.infer<typeof GradeSchema> & { total: number; graded_by: "claude" | "heuristic" };

export { RUBRIC } from "./rubric";

export async function fetchReadme(repoUrl: string): Promise<string | null> {
  const m = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const [, owner, repo] = m;
  for (const branch of ["main", "master"]) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, "")}/${branch}/README.md`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return (await r.text()).slice(0, 12000);
    } catch {
      // try the next branch
    }
  }
  return null;
}

export async function gradeProject(p: { title: string; description: string; repoUrl?: string }): Promise<Grade> {
  const readme = p.repoUrl ? await fetchReadme(p.repoUrl) : null;
  const c = claude();
  if (c) {
    try {
      const res = await c.messages.parse({
        model: MODEL,
        max_tokens: 6000,
        output_config: { effort: "medium", format: zodOutputFormat(GradeSchema) },
        system:
          "You grade beginner AI projects built in a 60-minute workshop by final-year engineering students. " +
          "Be encouraging but honest: a project with no evidence of a working demo cannot score above 10 on working_demo. " +
          "Score against the rubric maxima in the schema (problem_clarity 20, ai_usage 25, working_demo 25, originality 15, presentation 15). " +
          "strengths and improvements: 2-3 items each, specific to this project. next_step: one concrete thing to build next.",
        messages: [
          {
            role: "user",
            content:
              `Project title: ${p.title}\n\nStudent's description:\n${p.description}\n\n` +
              (readme ? `README from ${p.repoUrl}:\n${readme}` : p.repoUrl ? `Repo link given (${p.repoUrl}) but README could not be fetched.` : "No repo link given."),
          },
        ],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        const s = res.parsed_output.scores;
        const total = s.problem_clarity + s.ai_usage + s.working_demo + s.originality + s.presentation;
        return { ...res.parsed_output, total, graded_by: "claude" };
      }
    } catch (err) {
      console.error("gradeProject: falling back to heuristic", err);
    }
  }
  return heuristicGrade(p, readme);
}

function heuristicGrade(p: { title: string; description: string; repoUrl?: string }, readme: string | null): Grade {
  const text = `${p.description}\n${readme ?? ""}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => text.includes(x));
  const words = p.description.split(/\s+/).length;
  const scores = {
    problem_clarity: Math.min(20, 6 + Math.floor(words / 8) + (has("problem", "students", "users", "because") ? 4 : 0)),
    ai_usage: Math.min(25, 8 + (has("prompt") ? 5 : 0) + (has("gemini", "gpt", "claude", "llm", "api") ? 7 : 0) + (has("vision", "voice", "rag", "embedding") ? 5 : 0)),
    working_demo: Math.min(25, (p.repoUrl ? 8 : 2) + (readme ? 7 : 0) + (has("deployed", "streamlit", "huggingface", "vercel", "demo", "live") ? 8 : 0)),
    originality: Math.min(15, 6 + (has("telugu", "hindi", "tamil", "farmer", "rural", "local") ? 6 : 0) + (words > 60 ? 3 : 0)),
    presentation: Math.min(15, 5 + (readme ? 5 : 0) + (words > 40 ? 3 : 0)),
  };
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return {
    scores,
    total,
    strengths: [
      p.repoUrl ? "Code is published, which recruiters can check" : "Clear idea that fits a 60-minute build",
      has("gemini", "gpt", "claude", "llm") ? "Uses a real LLM rather than a mock" : "Problem statement is easy to explain",
    ],
    improvements: [
      readme ? "Add a GIF or screenshot of the app working to the README" : "Push the code to GitHub with a README so it can be verified",
      "Add one example input and output so reviewers see the value in 10 seconds",
    ],
    next_step: "Deploy it on Hugging Face Spaces and post a 30-second demo video on LinkedIn tagging @NxtWave.",
    graded_by: "heuristic",
  };
}

// ---------- 3. WhatsApp bot FAQ fallback ----------

const FAQ: [RegExp, string][] = [
  [/(cost|fee|free|price|paid)/i, "It's 100% free. No payment, no card, ever."],
  [/(when|time|date|timing)/i, "It's a live 60-minute session at 7 PM IST on the workshop day. Reply STATUS to see your exact date."],
  [/(laptop|install|software|setup|need)/i, "Just a laptop with Chrome. Everything runs in the browser, no installs."],
  [/(certificate|cert)/i, "Yes! Submit your project after the session and you get an AI review plus a certificate."],
  [/(coding|beginner|code|experience)/i, "No AI experience needed. If you can write a basic if-else, you'll be fine."],
  [/(record|recording|miss)/i, "Registered students who refer 1 friend get the recording too."],
];

export async function answerFaq(question: string, lang: string = "en"): Promise<string> {
  // Keyword FAQ answers are English-only; non-English questions go to Claude when available.
  if (lang === "en" || !process.env.ANTHROPIC_API_KEY) for (const [re, ans] of FAQ) if (re.test(question)) return ans;
  const c = claude();
  if (c) {
    try {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: 1000,
        output_config: { effort: "low" },
        system:
          `You are the WhatsApp assistant for NxtWave's free 60-minute live workshop "${WORKSHOP_TITLE}" for final-year engineering students. ` +
          "Facts: free; 7 PM IST; laptop + Chrome only; certificate after submitting a project; referral rewards. " +
          "Answer in at most 2 short sentences, WhatsApp style. If you don't know, say a team member will reply. Never invent dates or prices. " +
          `Reply in ${langName(lang)}.`,
        messages: [{ role: "user", content: question }],
      });
      if (res.stop_reason !== "refusal") {
        const text = res.content.find((b) => b.type === "text");
        if (text && text.type === "text") return text.text;
      }
    } catch (err) {
      console.error("answerFaq failed", err);
    }
  }
  return "Good question! A team member will reply shortly. Meanwhile, reply MENU to see options.";
}
