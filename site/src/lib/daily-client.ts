export interface DailyAnswer {
  chosenChoiceId: string;
  correct: boolean;
  answeredAt: string;
}

export interface DailyRecord {
  date: string;
  questionIds: string[];
  answers: Record<string, DailyAnswer>;
}

const QUEUE_KEY = "csa_daily_queue";

interface QueuedDailyAnswer {
  date: string;
  questionId: string;
  chosenChoiceId: string;
  correct: boolean;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function readQueue(): QueuedDailyAnswer[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedDailyAnswer[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedDailyAnswer[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage unavailable (e.g. private mode quota) — silently skip
  }
}

async function postDailyAnswer(item: QueuedDailyAnswer): Promise<boolean> {
  try {
    const res = await fetch("/api/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Retries any daily answers that failed to sync to KV on a previous attempt — e.g. a
 * request that never landed because a phone lost signal or backgrounded the PWA mid-quiz.
 * Without this, an answer recorded on one device could silently never reach the shared
 * KV store and therefore never appear as "done" on another device.
 */
export async function flushDailyQueue(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;
  const remaining: QueuedDailyAnswer[] = [];
  for (const item of queue) {
    const ok = await postDailyAnswer(item);
    if (!ok) remaining.push(item);
  }
  writeQueue(remaining);
}

export async function getDailyRecord(date: string): Promise<DailyRecord> {
  await flushDailyQueue();
  const res = await fetch(`/api/daily?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(`Could not load the quiz for ${date}`);
  return (await res.json()) as DailyRecord;
}

export async function getRecentDailyRecords(days = 14): Promise<Record<string, DailyRecord>> {
  await flushDailyQueue();
  const res = await fetch(`/api/daily?days=${days}`);
  if (!res.ok) throw new Error("Could not load the daily quiz history");
  return (await res.json()) as Record<string, DailyRecord>;
}

export async function recordDailyAnswer(
  date: string,
  questionId: string,
  chosenChoiceId: string,
  correct: boolean
): Promise<void> {
  const item: QueuedDailyAnswer = { date, questionId, chosenChoiceId, correct };
  const ok = await postDailyAnswer(item);
  if (!ok) {
    const queue = readQueue();
    queue.push(item);
    writeQueue(queue);
  }
}
