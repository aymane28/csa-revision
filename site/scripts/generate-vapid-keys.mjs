// Run this yourself (npm run generate-vapid-keys) — the private key should never
// pass through a chat/AI session. Requires Node 19+ (global WebCrypto).
import { ApplicationServerKeys, setWebCrypto } from "webpush-webcrypto";

// The library expects a browser/Worker-style `self.crypto`; Node has no `self`,
// so point it at the global WebCrypto instance explicitly.
setWebCrypto(globalThis.crypto);

const keys = await ApplicationServerKeys.generate();
const json = await keys.toJSON();

console.log("Ajoute ces variables dans Cloudflare Pages → Settings → Environment variables");
console.log("(coche Production ET Preview) :\n");
console.log(`VAPID_PUBLIC_KEY=${json.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${json.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:ton-email@example.com`);
console.log(`REMINDER_SECRET=<génère une valeur aléatoire, ex: openssl rand -hex 32>`);
console.log("\nEt dans GitHub → Settings → Secrets and variables → Actions :");
console.log("  REMINDER_SECRET (même valeur que ci-dessus)");
console.log("  SITE_URL (ex: https://csa-revision.pages.dev)");
