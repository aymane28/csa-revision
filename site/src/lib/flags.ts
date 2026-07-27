const FLAGS_KEY = "csa_flagged_questions";

function readFlags(): Set<string> {
  try {
    const raw = localStorage.getItem(FLAGS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeFlags(flags: Set<string>): void {
  try {
    localStorage.setItem(FLAGS_KEY, JSON.stringify([...flags]));
  } catch {
    // localStorage unavailable — flag just won't persist across reloads
  }
}

export function isFlagged(questionId: string): boolean {
  return readFlags().has(questionId);
}

export function toggleFlag(questionId: string): void {
  const flags = readFlags();
  if (flags.has(questionId)) flags.delete(questionId);
  else flags.add(questionId);
  writeFlags(flags);
}
