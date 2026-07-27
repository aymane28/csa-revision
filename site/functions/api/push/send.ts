import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

export interface Env {
  PROGRESS_KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  REMINDER_SECRET: string;
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

// Triggered by a GitHub Actions cron (see .github/workflows/reminders.yml) via a shared
// secret header — this is not called from the browser, so no user auth beyond that secret.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.REMINDER_SECRET || request.headers.get("x-reminder-secret") !== env.REMINDER_SECRET) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return jsonResponse({ error: "VAPID env vars not configured" }, 500);
  }

  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") === "evening" ? "evening" : "morning";

  const raw = await env.PROGRESS_KV.get(SUBS_KEY);
  const subs: StoredSubscription[] = raw ? JSON.parse(raw) : [];

  if (subs.length === 0) {
    return jsonResponse({ sent: 0, total: 0, removed: 0, message: "no subscriptions" });
  }

  const applicationServerKeys = await ApplicationServerKeys.fromJSON({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  });

  const payload = JSON.stringify(
    slot === "morning"
      ? {
          title: "CSA Révision — session du matin",
          body: "30 questions t'attendent avant de commencer la journée.",
          url: "/#/daily",
        }
      : {
          title: "CSA Révision — session du soir",
          body: "Un dernier tour de 30 questions avant de terminer la journée.",
          url: "/#/daily",
        }
  );

  let sent = 0;
  const stillValid: StoredSubscription[] = [];

  for (const sub of subs) {
    try {
      const { headers, body, endpoint } = await generatePushHTTPRequest({
        applicationServerKeys,
        payload,
        target: { endpoint: sub.endpoint, keys: sub.keys },
        adminContact: env.VAPID_SUBJECT,
        ttl: 3600,
        urgency: "normal",
      });

      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (res.ok) {
        sent++;
        stillValid.push(sub);
      } else if (res.status === 404 || res.status === 410) {
        // subscription expired/revoked on the browser side — drop it silently
      } else {
        console.warn(`[push] send failed for ${sub.endpoint}: HTTP ${res.status}`);
        stillValid.push(sub);
      }
    } catch (err) {
      console.warn(`[push] send error for ${sub.endpoint}:`, err);
      stillValid.push(sub);
    }
  }

  if (stillValid.length !== subs.length) {
    await env.PROGRESS_KV.put(SUBS_KEY, JSON.stringify(stillValid));
  }

  return jsonResponse({ sent, total: subs.length, removed: subs.length - stillValid.length });
};
