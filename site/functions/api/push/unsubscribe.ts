export interface Env {
  PROGRESS_KV: KVNamespace;
}

const SUBS_KEY = "push_subscriptions";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (typeof body.endpoint !== "string") return jsonResponse({ error: "endpoint required" }, 400);

  const raw = await env.PROGRESS_KV.get(SUBS_KEY);
  const subs: { endpoint: string }[] = raw ? JSON.parse(raw) : [];
  const filtered = subs.filter((s) => s.endpoint !== body.endpoint);

  await env.PROGRESS_KV.put(SUBS_KEY, JSON.stringify(filtered));
  return jsonResponse({ ok: true, count: filtered.length });
};
