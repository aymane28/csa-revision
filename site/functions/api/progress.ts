export interface Env {
  PROGRESS_KV: KVNamespace;
}

interface ProgressRecord {
  questionId: string;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  lastSeenAt: string;
  lastResult: "correct" | "wrong" | null;
  streak: number;
}

type ProgressMap = Record<string, ProgressRecord>;

// Single-blob storage: trivial read/write volume for one user, avoids KV list()
// pagination/consistency concerns that a per-question key scheme would introduce.
const KEY = "progress_map";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.PROGRESS_KV.get(KEY);
  const map: ProgressMap = raw ? JSON.parse(raw) : {};
  return jsonResponse(map);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { questionId?: unknown; correct?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const { questionId, correct } = body;
  if (typeof questionId !== "string" || typeof correct !== "boolean") {
    return jsonResponse({ error: "questionId (string) and correct (boolean) are required" }, 400);
  }

  const raw = await env.PROGRESS_KV.get(KEY);
  const map: ProgressMap = raw ? JSON.parse(raw) : {};

  const now = new Date().toISOString();
  const prev = map[questionId];
  map[questionId] = {
    questionId,
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    timesCorrect: (prev?.timesCorrect ?? 0) + (correct ? 1 : 0),
    timesWrong: (prev?.timesWrong ?? 0) + (correct ? 0 : 1),
    lastSeenAt: now,
    lastResult: correct ? "correct" : "wrong",
    streak: correct ? (prev?.streak ?? 0) + 1 : 0,
  };

  await env.PROGRESS_KV.put(KEY, JSON.stringify(map));
  return jsonResponse(map[questionId]);
};
