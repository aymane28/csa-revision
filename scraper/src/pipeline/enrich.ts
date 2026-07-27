import type { GeneratedQuestion } from "../types";

// Google reshuffles which models get free-tier quota every few months (we've already
// hit two dead defaults in testing: 2.0-flash has zero quota, 2.5-flash is 404 for new
// accounts). Try a short list of current-ish free-tier candidates in order rather than
// hardcoding one name; GEMINI_MODEL env var pins a single model if you know which works.
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];

const SCHEMA_HINT = `{
  "question": "string",
  "choices": ["string", "string", "string", "string"],
  "correctIndex": 0,
  "explanation": "string",
  "pieges": ["string"],
  "difficulty": "easy" | "medium" | "hard",
  "tags": ["string"]
}`;

interface EnrichParams {
  topic: string;
  sourceTitle: string;
  sourceText: string;
}

/**
 * Generates an ORIGINAL practice question grounded in the given documentation excerpt —
 * it never reproduces real exam content, which is the whole point (see docs/DECISIONS.md).
 */
export async function enrichToQuestion(params: EnrichParams): Promise<GeneratedQuestion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant.");
  }

  const prompt = `Tu es un générateur de questions pour la préparation à la certification ServiceNow CSA (Certified System Administrator).

À partir du contenu de documentation officielle ci-dessous (sujet : "${params.topic}"), génère UNE question à choix multiple ORIGINALE de niveau examen CSA, avec 4 choix de réponse, une explication pédagogique de la bonne réponse, et 1 à 3 pièges à éviter (erreurs de compréhension courantes).

Règles strictes :
- N'invente rien qui contredise le contenu source.
- N'essaie JAMAIS de reproduire une vraie question d'examen : invente une question originale, seulement inspirée par le contenu fourni.
- Les 4 choix doivent être plausibles, un seul strictement correct.
- Réponds UNIQUEMENT avec un JSON valide conforme à ce schéma, sans markdown ni texte autour :
${SCHEMA_HINT}

Titre de la source : ${params.sourceTitle}

Contenu source (extrait) :
"""
${params.sourceText}
"""`;

  let text: string | undefined;

  for (const model of MODEL_CANDIDATES) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
        }),
      }
    );

    if (!res.ok) {
      console.warn(`[enrich] ${model} error ${res.status}: ${await res.text()}`);
      continue;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.log(`[enrich] succeeded with model ${model}`);
      break;
    }
    console.warn(`[enrich] ${model} returned an empty response.`);
  }

  if (!text) {
    console.warn("[enrich] Tous les modèles candidats ont échoué.");
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn("[enrich] Réponse Gemini non-JSON, ignorée.");
    return null;
  }

  const validated = validateGenerated(parsed);
  if (!validated) console.warn("[enrich] Réponse Gemini ne respecte pas le schéma attendu, ignorée.");
  return validated;
}

function validateGenerated(raw: unknown): GeneratedQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (
    typeof r.question !== "string" ||
    !Array.isArray(r.choices) ||
    r.choices.length !== 4 ||
    !r.choices.every((c) => typeof c === "string") ||
    typeof r.correctIndex !== "number" ||
    r.correctIndex < 0 ||
    r.correctIndex > 3 ||
    typeof r.explanation !== "string" ||
    !Array.isArray(r.pieges) ||
    !r.pieges.every((p) => typeof p === "string")
  ) {
    return null;
  }

  const difficulty: GeneratedQuestion["difficulty"] = ["easy", "medium", "hard"].includes(r.difficulty as string)
    ? (r.difficulty as GeneratedQuestion["difficulty"])
    : "medium";
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [];

  return {
    question: r.question,
    choices: r.choices as string[],
    correctIndex: r.correctIndex,
    explanation: r.explanation,
    pieges: r.pieges as string[],
    difficulty,
    tags,
  };
}
