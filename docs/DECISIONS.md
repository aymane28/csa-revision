# Décisions d'architecture

## Git comme base de données pour les fiches/questions
`/data` (racine du repo) est la source de vérité pour les fiches et les questions, versionnée avec le code. Écrit à la main pour l'instant (Milestone 1) ; un scraper automatisé (session future) y écrira via un commit GitHub Actions quotidien. Un fichier JSON par question/fiche pour garder des diffs git lisibles.

`/site/public/data` est un symlink vers `../../data` : ça permet à Vite de servir `/data` comme fichiers statiques sans dupliquer le contenu, tout en gardant `/data` à la racine (accessible au futur scraper qui tourne depuis la racine du repo).

## Cloudflare KV pour la progression, pas Git
La progression (questions réussies/ratées) nécessite des écritures fréquentes depuis le navigateur à chaque réponse — commit git par réponse impraticable, et exposer un token GitHub côté client serait un risque de sécurité. Cloudflare Pages Functions + KV résout ça : écritures serveur (edge), même origine que le site, pas de token exposé. Choisi dès Milestone 1 (pas différé) pour avoir la synchro multi-appareil (session du matin sur un appareil, du soir sur un autre) dès le départ.

Stockage KV en un seul blob JSON (clé `progress_map`) plutôt qu'une clé par question : volume trivial pour un utilisateur unique (quelques centaines d'entrées), évite la pagination/consistance éventuelle de `KV.list()`.

`progress-client.ts` (front) garde un cache localStorage en parallèle du KV : lecture instantanée, écriture optimiste immédiate, et file d'attente de retry si la requête réseau vers `/api/progress` échoue (mode hors-ligne).

## Scraper : génération de questions originales, pas extraction de vraies questions d'examen
`/scraper` (Node/TS) ne cherche pas à extraire des questions d'examen réelles depuis des sites de dumps — ça reste hors des limites qu'on s'est fixées (NDA ServiceNow). À la place : il récupère le contenu de pages de documentation officielle ServiceNow (`docs.servicenow.com`), et demande à un LLM gratuit (Gemini Flash) de **générer une question originale** inspirée de ce contenu, avec explication et pièges à éviter. Zéro risque de reproduire une vraie question d'examen, tout en gardant l'esprit "questions type" demandé au départ.

Pipeline : `fetch-extract.ts` (cheerio, sélecteur `.body.conbody` propre aux pages docs ServiceNow) → `enrich.ts` (appel Gemini, JSON mode, validation stricte du schéma) → dedupe (URL déjà traitée dans `data/questions/_sources_seen.json`, puis similarité Jaccard contre les questions existantes en garde-fou) → `write.ts` (écrit le fichier question + met à jour `_index.json` et la fiche du sujet si elle existe).

Testé : l'extraction fonctionne réellement sur 2 sources (`c_IncidentManagement.html`, `c_BusinessRules.html`). Les 3 autres entrées de `scraper/src/config/sources.json` sont des `TODO` à remplir à la main (chercher l'URL exacte sur docs.servicenow.com et la coller) — le moteur de recherche de docs.servicenow.com est une SPA côté client, donc pas moyen de la scraper pour découvrir automatiquement de nouvelles URLs sans un vrai navigateur headless. `sources.json` reste donc une liste organisée manuellement, pas une découverte automatique.

Nécessite une clé `GEMINI_API_KEY` (gratuite sur aistudio.google.com) en variable d'env locale ou en secret GitHub Actions — sans elle le script s'arrête proprement avec les instructions.

## Push notifications sans backend Node ni service payant
Web Push classique (librairie `web-push`) dépend de `node:crypto`, indisponible tel quel sur le runtime Cloudflare Workers (Pages Functions). Plutôt que de parier sur le flag `nodejs_compat` (support partiel, non garanti), on utilise `webpush-webcrypto` : une implémentation qui ne dépend que de la Web Crypto API standard, nativement supportée par Workers — donc pas de risque de compatibilité côté edge.

Les clés VAPID sont générées une fois par l'utilisateur en local (`npm run generate-vapid-keys`, jamais exécuté par l'assistant) pour que la clé privée ne transite jamais dans une conversation. La clé publique seule est exposée via `/api/push/vapid-public-key` (sans risque, elle est publique par design). Les abonnements push (un par appareil) sont stockés dans le même KV `PROGRESS_KV` que la progression, sous la clé `push_subscriptions` — pas besoin d'un second namespace pour un seul utilisateur.

L'envoi est déclenché par un cron GitHub Actions (`.github/workflows/reminders.yml`, ~9h/~20h Paris) qui appelle `/api/push/send` protégé par un secret partagé (`REMINDER_SECRET`) plutôt qu'un vrai système d'auth — suffisant pour un endpoint appelé uniquement par un cron de confiance.

Testé localement jusqu'au chiffrement/signature (voir logs de session) ; la livraison réelle sur un appareil physique n'a pas pu être vérifiée dans cet environnement (pas de vrai `PushSubscription` disponible) — à confirmer après le premier déploiement.

## Quiz du jour : génération déterministe et persistée, pas juste un seed côté client
Un simple PRNG seedé par la date suffirait pour la reproductibilité, mais son résultat dépend de l'ordre/taille du pool de questions au moment du calcul — si le scraper ajoute des questions plus tard, un recalcul à la volée changerait rétroactivement le quiz d'un jour déjà commencé. La liste de questions du jour est donc générée une seule fois (Pages Function `/api/daily`) puis persistée dans KV (`daily:{date}`), qui devient la source de vérité pour ce jour-là, peu importe l'évolution ultérieure de la banque de questions.

Les réponses données dans le quiz du jour sont doublement enregistrées : dans `progress_map` (global, pour la pondération de la session libre) et dans `daily:{date}` (pour l'état "terminé/en cours" par jour, visible depuis n'importe quel appareil).

## Pas d'authentification
Usage personnel mono-utilisateur. Si un jour un minimum de protection est voulu, Cloudflare Access peut se mettre devant le projet Pages sans toucher au code de l'app.
