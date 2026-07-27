import { readFileSync } from "node:fs";
import path from "node:path";
import { CONFIG_ROOT, DATA_ROOT } from "./lib/paths";
import { loadSeenUrls, saveSeenUrls } from "./lib/seen-sources";
import { isDuplicateQuestion } from "./lib/similarity";
import { fetchAndExtract } from "./pipeline/fetch-extract";
import { enrichToQuestion } from "./pipeline/enrich";
import { writeQuestion } from "./pipeline/write";
import type { SourceConfig } from "./types";

const sources = JSON.parse(readFileSync(path.join(CONFIG_ROOT, "sources.json"), "utf-8")) as SourceConfig[];
const blocklist = JSON.parse(readFileSync(path.join(CONFIG_ROOT, "blocklist.json"), "utf-8")) as string[];

function loadExistingQuestionTexts(): string[] {
  const indexPath = path.join(DATA_ROOT, "questions", "_index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as { questions: { question: string }[] };
  return index.questions.map((q) => q.question);
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      [
        "GEMINI_API_KEY n'est pas défini.",
        "1. Récupère une clé gratuite sur https://aistudio.google.com/app/apikey",
        "2. Lance localement : GEMINI_API_KEY=... npm run scrape",
        "3. Pour le cron GitHub Actions : ajoute-la comme secret de repo nommé GEMINI_API_KEY",
      ].join("\n")
    );
    process.exit(1);
  }

  const seen = loadSeenUrls();
  let written = 0;
  let skipped = 0;

  for (const source of sources) {
    try {
      if (source.url.startsWith("TODO")) {
        console.log(`[skip] ${source.id}: URL non renseignée (voir sources.json)`);
        skipped++;
        continue;
      }

      if (blocklist.some((domain) => source.url.includes(domain))) {
        console.warn(`[blocked] ${source.id}: domaine sur liste noire`);
        skipped++;
        continue;
      }

      if (seen.has(source.url)) {
        console.log(`[skip] ${source.id}: déjà traité précédemment`);
        skipped++;
        continue;
      }

      console.log(`[fetch] ${source.id} — ${source.url}`);
      const extracted = await fetchAndExtract(source.url, source.type);
      if (!extracted) {
        skipped++;
        continue;
      }

      console.log(`[enrich] ${source.id} via ${process.env.GEMINI_MODEL || "gemini-2.0-flash"}…`);
      const generated = await enrichToQuestion({
        topic: source.topic,
        sourceTitle: extracted.title,
        sourceText: extracted.text,
      });

      // Mark as processed regardless of outcome so a broken/unparseable source isn't retried forever.
      seen.add(source.url);

      if (!generated) {
        skipped++;
        continue;
      }

      const existingTexts = loadExistingQuestionTexts();
      if (isDuplicateQuestion(generated.question, existingTexts)) {
        console.warn(`[skip] ${source.id}: question générée trop similaire à une question existante`);
        skipped++;
        continue;
      }

      const id = writeQuestion(source.topic, generated, {
        type: "generated",
        url: source.url,
        retrievedAt: new Date().toISOString(),
      });
      written++;
      console.log(`[write] ${id} ajoutée pour "${source.topic}"`);
    } catch (err) {
      console.error(`[error] ${source.id}:`, err);
      skipped++;
    }
  }

  saveSeenUrls(seen);
  console.log(`\nTerminé : ${written} nouvelle(s) question(s) écrite(s), ${skipped} source(s) ignorée(s)/en erreur.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
