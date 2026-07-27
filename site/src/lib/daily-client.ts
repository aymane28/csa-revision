export interface DailyAnswer {
  chosenChoiceId: string;
  correct: boolean;
  answeredAt: string;
}

export interface DailyRecord {
  date: string;
  questionIds: string[];
  answers: Record<string, DailyAnswer>;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyRecord(date: string): Promise<DailyRecord> {
  const res = await fetch(`/api/daily?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(`Impossible de charger le quiz du ${date}`);
  return (await res.json()) as DailyRecord;
}

export async function getRecentDailyRecords(days = 14): Promise<Record<string, DailyRecord>> {
  const res = await fetch(`/api/daily?days=${days}`);
  if (!res.ok) throw new Error("Impossible de charger l'historique des quiz du jour");
  return (await res.json()) as Record<string, DailyRecord>;
}

export async function recordDailyAnswer(
  date: string,
  questionId: string,
  chosenChoiceId: string,
  correct: boolean
): Promise<void> {
  await fetch("/api/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, questionId, chosenChoiceId, correct }),
  }).catch(() => {
    // best-effort — the global progress map (progress-client.ts) already captured this answer
  });
}
