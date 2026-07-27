# CSA Révision

Plateforme personnelle de révision pour la certification ServiceNow CSA (Certified System Administrator) : fiches par sujet (avec pièges à éviter), sessions de QCM avec feedback immédiat, quiz du jour, et rappels push matin/soir. Installable comme PWA sur mobile.

Voir [docs/DECISIONS.md](docs/DECISIONS.md) pour le détail des choix d'architecture.

## Structure

- `site/` — application front (Vite + TypeScript vanilla) + Cloudflare Pages Functions (`site/functions/`)
- `data/` — fiches et questions au format JSON, versionnées dans le repo (`data/fiches`, `data/questions`)
- `scraper/` — génère de nouvelles questions à partir de docs ServiceNow officielles + LLM gratuit (voir plus bas)
- `docs/` — notes de décisions d'architecture

## Développement local

```bash
cd site
npm install
npm run dev        # serveur Vite (front seul, l'API /api/progress n'est pas disponible ici)
```

Pour tester avec l'API de progression (Cloudflare Pages Functions + KV simulé) :

```bash
cd site
npm run build
npx wrangler pages dev dist --kv PROGRESS_KV
```

## Déploiement (Cloudflare Pages)

1. Connecter ce repo GitHub à un projet Cloudflare Pages (dashboard Cloudflare → Pages → "Connect to Git").
2. Build settings : root directory `site`, build command `npm run build`, output directory `dist`.
3. Créer un namespace KV (`wrangler kv namespace create PROGRESS_KV` ou via le dashboard), puis l'ajouter comme binding `PROGRESS_KV` dans Pages → Settings → Functions → KV namespace bindings (environnement Production **et** Preview).
4. Pour activer les rappels push (voir section suivante) : générer des clés VAPID et les ajouter comme variables d'environnement Pages.
5. Chaque push sur la branche principale redéploie automatiquement le site et les Functions.

## PWA + rappels push (matin/soir)

Le site est installable sur mobile (Ajouter à l'écran d'accueil) et peut envoyer une notification à ~9h et ~20h heure de Paris pour rappeler de faire le quiz du jour.

1. Générer les clés VAPID (une seule fois, en local — la clé privée ne doit jamais transiter ailleurs) :
   ```bash
   cd site
   npm install
   npm run generate-vapid-keys
   ```
2. Ajouter dans Cloudflare Pages → Settings → Environment variables (Production **et** Preview) : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:ton-email`), `REMINDER_SECRET` (chaîne aléatoire, ex. `openssl rand -hex 32`).
3. Ajouter dans GitHub → Settings → Secrets and variables → Actions : `REMINDER_SECRET` (même valeur) et `SITE_URL` (ex. `https://csa-revision.pages.dev`).
4. Une fois déployé, ouvrir le site sur mobile, l'ajouter à l'écran d'accueil, puis cliquer sur "🔕 Activer les rappels" dans la barre de nav et accepter la permission de notification.
5. Le workflow `.github/workflows/reminders.yml` (cron GitHub Actions, ~9h/~20h Paris) déclenche l'envoi. Testable manuellement via l'onglet Actions → "Push reminders" → "Run workflow".

Le chiffrement des notifications utilise uniquement l'API Web Crypto standard (`webpush-webcrypto`, compatible Cloudflare Workers). Testé localement de bout en bout jusqu'à l'étape de chiffrement/signature ; **la livraison réelle sur un appareil n'a pas pu être vérifiée dans cet environnement de dev** (pas de vrai abonnement push disponible) — à confirmer après déploiement.

## Scraper (génération automatique de nouvelles questions)

Ne recopie jamais de vraies questions d'examen : il lit une page de doc officielle ServiceNow et demande à un LLM gratuit de générer une question originale inspirée du contenu (voir `docs/DECISIONS.md` pour le détail).

```bash
cd scraper
npm install
GEMINI_API_KEY=ta_clé npm run scrape
```

Clé gratuite : https://aistudio.google.com/app/apikey

Avant de compter dessus au quotidien :
1. Complète les 3 URLs marquées `TODO` dans `scraper/src/config/sources.json` (ACL, update sets, service catalog) — va sur docs.servicenow.com, cherche le sujet, colle l'URL de la page.
2. Ajoute le secret `GEMINI_API_KEY` dans GitHub → Settings → Secrets and variables → Actions, pour que le cron (`.github/workflows/scrape.yml`, tous les matins à 04:00 UTC) puisse tourner. Tu peux aussi le déclencher manuellement via l'onglet Actions ("Run workflow").

## Quiz du jour

En plus de la session libre (`#/quiz`, pondérée selon ta progression), `#/daily` propose un quiz fixe de 30 questions par jour calendaire (généré une seule fois et mémorisé côté serveur — stable même si la banque de questions grossit ensuite). La liste affiche les jours récents avec leur statut (pas commencé / en cours / terminé), donc un jour manqué reste accessible et rattrapable.

## Contenu actuel

5 sujets, 43 questions écrites à la main (Milestone 1) : gestion des incidents, contrôle d'accès (ACL), update sets, business rules & client scripts, service catalog. Le scraper peut désormais en ajouter automatiquement (voir ci-dessus).
