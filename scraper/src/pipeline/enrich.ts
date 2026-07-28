import { QUESTIONS_PER_SOURCE, type GeneratedQuestion } from "../types";

// Google reshuffles which models get free-tier quota every few months (we've already
// hit two dead defaults in testing: 2.0-flash has zero quota, 2.5-flash is 404 for new
// accounts). Try a short list of current-ish free-tier candidates in order rather than
// hardcoding one name; GEMINI_MODEL env var pins a single model if you know which works.
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];

const SCHEMA_HINT = `[
  {
    "question": "string",
    "choices": ["string", "string", "string", "string"],
    "correctIndex": 0,
    "explanation": "string",
    "pieges": ["string"],
    "difficulty": "easy" | "medium" | "hard",
    "tags": ["string"]
  }
]`;

interface EnrichParams {
  topic: string;
  sourceTitle: string;
  sourceText: string;
}

/**
 * Generates a batch of ORIGINAL practice questions grounded in the given documentation
 * excerpt — never reproduces real exam content, which is the whole point (see
 * docs/DECISIONS.md). Asking for several questions per call multiplies the bank's growth
 * rate without multiplying API calls (still one request per source, so free-tier rate
 * limits aren't affected).
 */
export async function enrichToQuestions(params: EnrichParams): Promise<GeneratedQuestion[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant.");
  }

  const prompt = `You are an expert question writer for ServiceNow CSA (Certified System Administrator) exam preparation. The real exam favors applied, scenario-based reasoning over simple recall — you must match that style.

Based on the official documentation excerpt below (topic: "${params.topic}"), generate exactly ${QUESTIONS_PER_SOURCE} ORIGINAL multiple-choice questions at CSA exam level, each with 4 answer choices, a pedagogical explanation of the correct answer, and 1 to 3 common pitfalls (common misunderstandings candidates should avoid).

Strict rules:
- Do not invent anything that contradicts the source content.
- NEVER try to reproduce a real exam question: invent original questions, only inspired by the provided content.
- Favor scenario/application framing over bare definition-recall: e.g. "An admin needs to X — which configuration achieves this?", "A user reports Y — what is the most likely cause?", "Which of the following is NOT true about Z?", combining two related concepts from the source when possible, rather than "What is the definition of X?".
- Aim for a mix skewed toward "medium" and "hard" difficulty — at most one of the ${QUESTIONS_PER_SOURCE} questions may be "easy". Avoid trivial questions answerable without understanding the underlying mechanism.
- The 4 choices must be plausible (all drawn from real, related ServiceNow concepts), with only one strictly correct — avoid choices that are obviously wrong on their face.
- The ${QUESTIONS_PER_SOURCE} questions must each probe a different angle or sub-topic of the source content — do not restate the same fact with different wording.
- Vary the question stems — do not start every question the same way.
- Write everything in English.
- Respond ONLY with a valid JSON array matching this schema, no markdown or surrounding text:
${SCHEMA_HINT}

Source title: ${params.sourceTitle}

Source content (excerpt):
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
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
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

  if (!Array.isArray(parsed)) {
    console.warn("[enrich] Réponse Gemini n'est pas un tableau, ignorée.");
    return null;
  }

  const validated = parsed.map(validateGenerated).filter((q): q is GeneratedQuestion => q !== null);
  if (validated.length === 0) {
    console.warn("[enrich] Aucune question du lot ne respecte le schéma attendu.");
    return null;
  }
  if (validated.length < parsed.length) {
    console.warn(`[enrich] ${parsed.length - validated.length} question(s) du lot rejetée(s) (schéma invalide).`);
  }
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
