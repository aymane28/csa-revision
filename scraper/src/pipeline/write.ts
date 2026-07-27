import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../lib/paths";
import type { GeneratedQuestion } from "../types";

interface SourceMeta {
  type: string;
  url: string;
  retrievedAt: string;
}

const LETTERS = ["a", "b", "c", "d"];

export function writeQuestion(topic: string, generated: GeneratedQuestion, source: SourceMeta): string {
  const id = `q_${topic.replace(/-/g, "")}_scr_${Date.now().toString(36)}`;
  const choices = generated.choices.map((text, i) => ({ id: LETTERS[i], text }));
  const addedAt = new Date().toISOString();

  const question = {
    id,
    topic,
    tags: generated.tags,
    difficulty: generated.difficulty,
    question: generated.question,
    choices,
    correctChoiceId: LETTERS[generated.correctIndex],
    explanation: generated.explanation,
    pieges: generated.pieges,
    source,
    addedAt,
  };

  const topicDir = path.join(DATA_ROOT, "questions", topic);
  mkdirSync(topicDir, { recursive: true });
  writeFileSync(path.join(topicDir, `${id}.json`), JSON.stringify(question, null, 2) + "\n");

  const indexPath = path.join(DATA_ROOT, "questions", "_index.json");
  const index = JSON.parse(readFileSync(indexPath, "utf-8")) as { generatedAt: string; questions: unknown[] };
  index.questions.push({
    id,
    topic,
    tags: question.tags,
    difficulty: question.difficulty,
    question: question.question,
    choices: question.choices,
    correctChoiceId: question.correctChoiceId,
    explanation: question.explanation,
    pieges: question.pieges,
    addedAt,
  });
  index.generatedAt = addedAt;
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

  const fichePath = path.join(DATA_ROOT, "fiches", `${topic}.json`);
  if (existsSync(fichePath)) {
    const fiche = JSON.parse(readFileSync(fichePath, "utf-8")) as {
      relatedQuestionIds: string[];
      updatedAt: string;
    };
    fiche.relatedQuestionIds.push(id);
    fiche.updatedAt = addedAt;
    writeFileSync(fichePath, JSON.stringify(fiche, null, 2) + "\n");

    const fichesIndexPath = path.join(DATA_ROOT, "fiches", "_index.json");
    const fichesIndex = JSON.parse(readFileSync(fichesIndexPath, "utf-8")) as {
      generatedAt: string;
      fiches: { topic: string; relatedQuestionIds: string[] }[];
    };
    const entry = fichesIndex.fiches.find((f) => f.topic === topic);
    if (entry) entry.relatedQuestionIds.push(id);
    fichesIndex.generatedAt = addedAt;
    writeFileSync(fichesIndexPath, JSON.stringify(fichesIndex, null, 2) + "\n");
  }

  return id;
}
