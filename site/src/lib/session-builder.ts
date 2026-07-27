import type { ProgressMap, Question } from "./types";

const UNSEEN_WEIGHT = 100;
const BASE_SEEN_WEIGHT = 10;
const WRONG_RATIO_WEIGHT = 60;
const STALENESS_WEIGHT = 20;
const STALENESS_HALF_LIFE_DAYS = 14;

function weightFor(question: Question, progress: ProgressMap, now: number): number {
  const record = progress[question.id];
  if (!record || record.timesSeen === 0) return UNSEEN_WEIGHT;

  const wrongRatio = record.timesWrong / record.timesSeen;
  const daysSinceSeen = (now - new Date(record.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  const staleness = 1 - Math.exp(-daysSinceSeen / STALENESS_HALF_LIFE_DAYS);

  return BASE_SEEN_WEIGHT + wrongRatio * WRONG_RATIO_WEIGHT + staleness * STALENESS_WEIGHT;
}

/**
 * Picks up to `count` questions, weighted-random without replacement: unseen
 * questions are favored first, then questions with a higher wrong ratio, then
 * questions not seen in a while. Intentionally not a strict sort so the same
 * "worst" questions don't appear in identical order every session.
 */
export function buildSession(
  allQuestions: Question[],
  progress: ProgressMap,
  count = 30,
  topicFilter?: string
): Question[] {
  const now = Date.now();
  const pool = (topicFilter ? allQuestions.filter((q) => q.topic === topicFilter) : allQuestions).map((q) => ({
    question: q,
    weight: weightFor(q, progress, now),
  }));

  const selected: Question[] = [];
  const n = Math.min(count, pool.length);

  for (let i = 0; i < n; i++) {
    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let threshold = Math.random() * totalWeight;
    let pickedIndex = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      threshold -= pool[j].weight;
      if (threshold <= 0) {
        pickedIndex = j;
        break;
      }
    }
    selected.push(pool[pickedIndex].question);
    pool.splice(pickedIndex, 1);
  }

  return selected;
}
