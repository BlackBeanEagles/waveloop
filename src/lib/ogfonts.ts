import { readFile } from "node:fs/promises";
import path from "node:path";

// Fonts for server-rendered images (link previews, share cards). Both are SIL Open Font License.
// next.config.ts includes src/assets/fonts in the serverless bundle so these reads work on Vercel.
let cache: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | null = null;

export function ogFonts() {
  cache ??= (async () => {
    const dir = path.join(process.cwd(), "src", "assets", "fonts");
    const [bangers, sans800, sans700] = await Promise.all([
      readFile(path.join(dir, "Bangers.woff")),
      readFile(path.join(dir, "PublicSans-800.woff")),
      readFile(path.join(dir, "PublicSans-700.woff")),
    ]);
    return [
      { name: "Bangers", data: bangers, weight: 400 as const, style: "normal" as const },
      { name: "Public Sans", data: sans800, weight: 800 as const, style: "normal" as const },
      { name: "Public Sans", data: sans700, weight: 700 as const, style: "normal" as const },
    ];
  })();
  return cache;
}
