export interface Env {
  PROGRESS_KV: KVNamespace;
  REMINDER_SECRET: string;
}

interface DailyAnswer {
  chosenChoiceId: string;
  correct: boolean;
  answeredAt: string;
}

interface DailyRecord {
  date: string;
  questionIds: string[];
  answers: Record<string, DailyAnswer>;
}

function keyFor(date: string): string {
  return `daily:${date}`;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Small deterministic PRNG so a given date always maps to the same shuffle order.
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function generateQuestionIds(date: string, request: Request): Promise<string[]> {
  const indexUrl = new URL("/data/questions/_index.json", request.url);
  const res = await fetch(indexUrl.toString());
  const data = (await res.json()) as { questions: { id: string }[] };
  const ids = data.questions.map((q) => q.id);

  const rand = mulberry32(seedFromString(date));
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(30, shuffled.length));
}

// Persisted after first generation so later growth of the question bank doesn't
// retroactively change what a past day's quiz was.
async function loadOrCreate(env: Env, date: string, request: Request): Promise<DailyRecord> {
  const raw = await env.PROGRESS_KV.get(keyFor(date));
  if (raw) return JSON.parse(raw) as DailyRecord;

  const questionIds = await generateQuestionIds(date, request);
  const record: DailyRecord = { date, questionIds, answers: {} };
  await env.PROGRESS_KV.put(keyFor(date), JSON.stringify(record));
  return record;
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (date) {
    return jsonResponse(await loadOrCreate(env, date, request));
  }

  const days = Math.min(31, Number(url.searchParams.get("days") ?? "14") || 14);
  const records: Record<string, DailyRecord> = {};
  for (const d of lastNDates(days)) {
    records[d] = await loadOrCreate(env, d, request);
  }
  return jsonResponse(records);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { date?: unknown; questionId?: unknown; chosenChoiceId?: unknown; correct?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const { date, questionId, chosenChoiceId, correct } = body;
  if (
    typeof date !== "string" ||
    typeof questionId !== "string" ||
    typeof chosenChoiceId !== "string" ||
    typeof correct !== "boolean"
  ) {
    return jsonResponse({ error: "date, questionId, chosenChoiceId (strings) and correct (boolean) are required" }, 400);
  }

  const record = await loadOrCreate(env, date, request);
  record.answers[questionId] = { chosenChoiceId, correct, answeredAt: new Date().toISOString() };
  await env.PROGRESS_KV.put(keyFor(date), JSON.stringify(record));
  return jsonResponse(record);
};

// Admin-only reset (same shared secret as the reminder cron) — clears every persisted
// daily-quiz selection so dates regenerate against the current question bank (a date's
// question list is otherwise cached in KV the first time it's loaded, by design).
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.REMINDER_SECRET || request.headers.get("x-reminder-secret") !== env.REMINDER_SECRET) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.PROGRESS_KV.list({ prefix: "daily:", cursor });
    for (const key of page.keys) {
      await env.PROGRESS_KV.delete(key.name);
      deleted++;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return jsonResponse({ ok: true, deleted });
};
