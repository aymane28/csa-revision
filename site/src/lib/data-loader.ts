import type { Fiche, FichesIndex, QuestionsIndex } from "./types";

let questionsCache: QuestionsIndex | null = null;
let fichesCache: FichesIndex | null = null;

export async function loadQuestionsIndex(): Promise<QuestionsIndex> {
  if (questionsCache) return questionsCache;
  const res = await fetch("/data/questions/_index.json");
  if (!res.ok) throw new Error(`Could not load the questions (${res.status})`);
  questionsCache = await res.json();
  return questionsCache!;
}

export async function loadFichesIndex(): Promise<FichesIndex> {
  if (fichesCache) return fichesCache;
  const res = await fetch("/data/fiches/_index.json");
  if (!res.ok) throw new Error(`Could not load the study sheets (${res.status})`);
  fichesCache = await res.json();
  return fichesCache!;
}

export async function loadFiche(topic: string): Promise<Fiche> {
  const res = await fetch(`/data/fiches/${topic}.json`);
  if (!res.ok) throw new Error(`Study sheet not found: ${topic}`);
  return (await res.json()) as Fiche;
}
