export interface Env {
  VAPID_PUBLIC_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.VAPID_PUBLIC_KEY) {
    return new Response(JSON.stringify({ error: "VAPID_PUBLIC_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ publicKey: env.VAPID_PUBLIC_KEY }), {
    headers: { "Content-Type": "application/json" },
  });
};
