import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// One door to whichever model has a key: Gemini and Groq have free tiers, Claude is paid.
// LLM_PROVIDER forces one; otherwise the first key found wins. Every answer is checked against the
// feature's zod schema, so a model that returns the wrong shape falls back to the built-in rules.

export type Provider = "gemini" | "groq" | "claude";
export const PROVIDER_LABEL: Record<string, string> = { gemini: "Gemini", groq: "Groq", claude: "Claude" };

const KEYS: Record<Provider, string> = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", claude: "ANTHROPIC_API_KEY" };

export function activeProvider(): Provider | null {
  const forced = process.env.LLM_PROVIDER as Provider | undefined;
  if (forced && KEYS[forced] && process.env[KEYS[forced]]) return forced;
  for (const p of ["gemini", "groq", "claude"] as Provider[]) if (process.env[KEYS[p]]) return p;
  return null;
}

type Effort = "low" | "medium";
type Ask = { system: string; user: string; effort?: Effort; maxTokens?: number };

// ---------- structured (JSON) answers ----------

export async function llmJson<S extends z.ZodType>(schema: S, ask: Ask): Promise<{ data: z.infer<S>; provider: Provider } | null> {
  const provider = activeProvider();
  if (!provider) return null;
  try {
    if (provider === "claude") {
      const res = await claudeClient().messages.parse({
        model: "claude-opus-5-5",
        max_tokens: ask.maxTokens ?? 6000,
        output_config: { effort: ask.effort ?? "low", format: zodOutputFormat(schema) },
        system: ask.system,
        messages: [{ role: "user", content: ask.user }],
      });
      if (res.stop_reason === "refusal" || !res.parsed_output) return null;
      return { data: res.parsed_output as z.infer<S>, provider };
    }

    // Gemini and Groq: describe the schema in the prompt, ask for JSON, validate, and retry once with the error.
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
    const system = `${ask.system}\n\nReply with ONLY a JSON object (no markdown, no code fences) that matches this JSON Schema exactly:\n${jsonSchema}`;
    let user = ask.user;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = provider === "gemini" ? await gemini(system, user, true, ask.maxTokens) : await groq(system, user, true, ask.maxTokens);
      const parsed = schema.safeParse(parseLooseJson(text));
      if (parsed.success) return { data: parsed.data, provider };
      user = `${ask.user}\n\nYour previous reply did not match the schema (${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}). Return the corrected JSON only.`;
    }
    return null;
  } catch (e) {
    console.error(`llmJson via ${provider} failed`, e);
    return null;
  }
}

// ---------- plain text answers ----------

export async function llmText(ask: Ask): Promise<{ text: string; provider: Provider } | null> {
  const provider = activeProvider();
  if (!provider) return null;
  try {
    if (provider === "claude") {
      const res = await claudeClient().messages.create({
        model: "claude-opus-5-5",
        max_tokens: ask.maxTokens ?? 1000,
        output_config: { effort: ask.effort ?? "low" },
        system: ask.system,
        messages: [{ role: "user", content: ask.user }],
      });
      if (res.stop_reason === "refusal") return null;
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? { text: block.text, provider } : null;
    }
    const text = provider === "gemini" ? await gemini(ask.system, ask.user, false, ask.maxTokens) : await groq(ask.system, ask.user, false, ask.maxTokens);
    return text.trim() ? { text: text.trim(), provider } : null;
  } catch (e) {
    console.error(`llmText via ${provider} failed`, e);
    return null;
  }
}

// ---------- providers ----------

let anthropic: Anthropic | null = null;
function claudeClient() {
  anthropic ??= new Anthropic();
  return anthropic;
}

async function gemini(system: string, user: string, json: boolean, maxTokens = 4000) {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function groq(system: string, user: string, json: boolean, maxTokens = 4000) {
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return d.choices?.[0]?.message?.content ?? "";
}

// Models sometimes wrap JSON in ```json fences or add a sentence; pull out the object.
function parseLooseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
