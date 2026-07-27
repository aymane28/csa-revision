export interface Env {
  PROGRESS_KV: KVNamespace;
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

const SUBS_KEY = "push_subscriptions";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Partial<StoredSubscription>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  if (typeof body.endpoint !== "string" || !body.keys?.p256dh || !body.keys?.auth) {
    return jsonResponse({ error: "invalid subscription payload" }, 400);
  }

  const raw = await env.PROGRESS_KV.get(SUBS_KEY);
  const subs: StoredSubscription[] = raw ? JSON.parse(raw) : [];

  const filtered = subs.filter((s) => s.endpoint !== body.endpoint);
  filtered.push({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    expirationTime: body.expirationTime ?? null,
  });

  await env.PROGRESS_KV.put(SUBS_KEY, JSON.stringify(filtered));
  return jsonResponse({ ok: true, count: filtered.length });
};
