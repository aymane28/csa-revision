import type { ProgressMap, ProgressRecord } from "./types";

const CACHE_KEY = "csa_progress_cache";
const QUEUE_KEY = "csa_progress_queue";

interface QueuedAnswer {
  questionId: string;
  correct: boolean;
  at: string;
}

function readCache(): ProgressMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: ProgressMap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (e.g. private mode quota) — silently skip caching
  }
}

function readQueue(): QueuedAnswer[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAnswer[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAnswer[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

function applyAnswer(existing: ProgressRecord | undefined, questionId: string, correct: boolean, at: string): ProgressRecord {
  const prev: ProgressRecord = existing ?? {
    questionId,
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    lastSeenAt: at,
    lastResult: null,
    streak: 0,
  };
  return {
    questionId,
    timesSeen: prev.timesSeen + 1,
    timesCorrect: prev.timesCorrect + (correct ? 1 : 0),
    timesWrong: prev.timesWrong + (correct ? 0 : 1),
    lastSeenAt: at,
    lastResult: correct ? "correct" : "wrong",
    streak: correct ? prev.streak + 1 : 0,
  };
}

async function postAnswer(questionId: string, correct: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, correct }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Retries any answers that failed to sync to KV on a previous attempt. */
export async function flushQueue(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;
  const remaining: QueuedAnswer[] = [];
  for (const item of queue) {
    const ok = await postAnswer(item.questionId, item.correct);
    if (!ok) remaining.push(item);
  }
  writeQueue(remaining);
}

/** Returns the full progress map, preferring KV (source of truth) with a localStorage fallback if offline. */
export async function getProgressMap(): Promise<ProgressMap> {
  await flushQueue();
  try {
    const res = await fetch("/api/progress");
    if (res.ok) {
      const map = (await res.json()) as ProgressMap;
      writeCache(map);
      return map;
    }
  } catch {
    // offline or Functions not deployed (e.g. local `vite` dev without wrangler) — fall back below
  }
  return readCache();
}

/**
 * Records an answer: updates the local cache immediately (instant UI feedback,
 * works offline), then syncs to KV in the background. On failure the answer is
 * queued and retried on the next getProgressMap() call.
 */
export function recordAnswer(questionId: string, correct: boolean): void {
  const at = new Date().toISOString();
  const cache = readCache();
  cache[questionId] = applyAnswer(cache[questionId], questionId, correct, at);
  writeCache(cache);

  void postAnswer(questionId, correct).then((ok) => {
    if (!ok) {
      const queue = readQueue();
      queue.push({ questionId, correct, at });
      writeQueue(queue);
    }
  });
}
