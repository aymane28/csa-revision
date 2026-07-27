export interface StoredAnswer {
  chosenChoiceId: string | null;
  answered: boolean;
}

export interface StoredSession {
  topic?: string;
  questionIds: string[];
  answers: Record<string, StoredAnswer>;
  currentIndex: number;
  startedAt: string;
}

const KEY = "csa_active_session";

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // localStorage unavailable — session just won't resume across reloads
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
