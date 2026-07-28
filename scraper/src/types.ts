export interface SourceConfig {
  id: string;
  type: "servicenow-docs" | "generic";
  topic: string;
  url: string;
}

export interface GeneratedQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  pieges: string[];
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export const QUESTIONS_PER_SOURCE = 3;
