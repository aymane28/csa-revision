function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const setB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Safety-net dedupe: flags a generated question as duplicate if it's too textually close to an existing one. */
export function isDuplicateQuestion(candidateText: string, existingTexts: string[], threshold = 0.6): boolean {
  return existingTexts.some((t) => jaccardSimilarity(candidateText, t) >= threshold);
}
