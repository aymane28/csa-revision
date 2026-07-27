import type { Question } from "../lib/types";

export interface SessionQuestionState {
  question: Question;
  chosenChoiceId: string | null;
  answered: boolean;
}

interface QuestionCardCallbacks {
  onSelectChoice: (choiceId: string) => void;
  onToggleFlag: () => void;
  isFlagged: boolean;
}

export function renderQuestionCard(container: HTMLElement, state: SessionQuestionState, cb: QuestionCardCallbacks): void {
  const { question, chosenChoiceId, answered } = state;
  const correctText = question.choices.find((c) => c.id === question.correctChoiceId)?.text ?? "";
  const isCorrect = chosenChoiceId === question.correctChoiceId;

  container.innerHTML = `
    <div class="quiz-card">
      <div class="quiz-card-header">
        <span class="quiz-topic-badge">${question.topic.replace(/-/g, " ")}</span>
        <button class="flag-button ${cb.isFlagged ? "flag-active" : ""}" type="button" title="Marquer cette question pour la revoir">
          ${cb.isFlagged ? "★ Marquée" : "☆ Marquer"}
        </button>
      </div>
      <h2 class="quiz-question">${question.question}</h2>
      <div class="choices">
        ${question.choices
          .map((c) => {
            let cls = "choice";
            if (answered) {
              if (c.id === question.correctChoiceId) cls += " correct";
              else if (c.id === chosenChoiceId) cls += " incorrect";
            }
            return `<button class="${cls}" type="button" data-id="${c.id}" ${answered ? "disabled" : ""}>${c.text}</button>`;
          })
          .join("")}
      </div>
      ${
        answered
          ? `
      <div class="feedback ${isCorrect ? "feedback-ok" : "feedback-wrong"}">
        <p class="feedback-headline">${isCorrect ? "✔ Correct" : `✘ Incorrect — bonne réponse : ${correctText}`}</p>
        <p><strong>Explication :</strong> ${question.explanation}</p>
        ${
          question.pieges.length
            ? `<p class="pieges-label"><strong>Pièges à éviter :</strong></p><ul>${question.pieges
                .map((p) => `<li>${p}</li>`)
                .join("")}</ul>`
            : ""
        }
      </div>`
          : ""
      }
    </div>
  `;

  container.querySelector<HTMLButtonElement>(".flag-button")!.addEventListener("click", cb.onToggleFlag);

  if (!answered) {
    container.querySelectorAll<HTMLButtonElement>(".choice").forEach((btn) => {
      btn.addEventListener("click", () => cb.onSelectChoice(btn.dataset.id!));
    });
  }
}
