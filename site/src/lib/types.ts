export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  topic: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  question: string;
  choices: Choice[];
  correctChoiceId: string;
  explanation: string;
  pieges: string[];
  addedAt: string;
}

export interface QuestionsIndex {
  generatedAt: string;
  questions: Question[];
}

export interface FicheSection {
  heading: string;
  content: string;
}

export interface Fiche {
  topic: string;
  title: string;
  sections: FicheSection[];
  pieges: string[];
  relatedQuestionIds: string[];
  updatedAt: string;
}

export interface FichesIndexEntry {
  topic: string;
  title: string;
  relatedQuestionIds: string[];
}

export interface FichesIndex {
  generatedAt: string;
  fiches: FichesIndexEntry[];
}

export interface ProgressRecord {
  questionId: string;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  lastSeenAt: string;
  lastResult: "correct" | "wrong" | null;
  streak: number;
}

export type ProgressMap = Record<string, ProgressRecord>;
