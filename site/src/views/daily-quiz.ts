import { loadQuestionsIndex } from "../lib/data-loader";
import { getDailyRecord, recordDailyAnswer, todayISO } from "../lib/daily-client";
import { recordAnswer as recordGlobalAnswer } from "../lib/progress-client";
import { isFlagged, toggleFlag } from "../lib/flags";
import { renderQuestionCard, type SessionQuestionState } from "./quiz-question";
import type { Question } from "../lib/types";

export async function renderDailyQuiz(container: HTMLElement, date: string): Promise<void> {
  container.innerHTML = `<p class="loading">Préparation du quiz du ${date}…</p>`;

  let index, daily;
  try {
    [index, daily] = await Promise.all([loadQuestionsIndex(), getDailyRecord(date)]);
  } catch (err) {
    container.innerHTML = `<p class="error">${(err as Error).message}</p><a class="back-link" href="#/daily">← Retour</a>`;
    return;
  }

  const byId = new Map(index.questions.map((q) => [q.id, q]));
  const state: SessionQuestionState[] = daily.questionIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const q = byId.get(id) as Question;
      const a = daily.answers[id];
      return { question: q, chosenChoiceId: a?.chosenChoiceId ?? null, answered: !!a };
    });

  if (state.length === 0) {
    container.innerHTML = `<p class="error">Aucune question disponible pour ce jour.</p><a class="back-link" href="#/daily">← Retour</a>`;
    return;
  }

  const firstUnanswered = state.findIndex((s) => !s.answered);
  let currentIndex = firstUnanswered === -1 ? 0 : firstUnanswered;
  let showSummary = false;

  function goTo(i: number): void {
    currentIndex = Math.max(0, Math.min(state.length - 1, i));
    showSummary = false;
    render();
  }

  function handleAnswer(choiceId: string): void {
    const s = state[currentIndex];
    if (s.answered) return;
    s.answered = true;
    s.chosenChoiceId = choiceId;
    const correct = choiceId === s.question.correctChoiceId;
    recordGlobalAnswer(s.question.id, correct);
    void recordDailyAnswer(date, s.question.id, choiceId, correct);
    render();
  }

  function handleToggleFlag(): void {
    toggleFlag(state[currentIndex].question.id);
    render();
  }

  function handleFinish(): void {
    const unanswered = state.filter((s) => !s.answered).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) sans réponse. Terminer quand même ?`)) return;
    showSummary = true;
    render();
  }

  function render(): void {
    if (showSummary) {
      renderSummary();
      return;
    }

    const answeredCount = state.filter((s) => s.answered).length;

    container.innerHTML = `
      <div class="quiz-shell">
        <a class="back-link" href="#/daily">← Tous les jours</a>
        <div class="quiz-toolbar">
          <span class="quiz-count">${formatDateLabel(date)} · ${answeredCount} / ${state.length} répondues</span>
          <button class="button button-secondary finish-button" type="button">Terminer</button>
        </div>
        <div class="quiz-dots">
          ${state
            .map((s, i) => {
              const classes = ["dot"];
              if (i === currentIndex) classes.push("dot-current");
              if (s.answered) classes.push(s.chosenChoiceId === s.question.correctChoiceId ? "dot-correct" : "dot-wrong");
              if (isFlagged(s.question.id)) classes.push("dot-flagged");
              return `<button class="${classes.join(" ")}" type="button" data-i="${i}" title="Question ${i + 1}">${i + 1}</button>`;
            })
            .join("")}
        </div>
        <div id="quiz-question-slot"></div>
        <div class="quiz-pager">
          <button class="button button-secondary prev-button" type="button" ${currentIndex === 0 ? "disabled" : ""}>← Précédente</button>
          <button class="button next-button" type="button" ${currentIndex === state.length - 1 ? "disabled" : ""}>Suivante →</button>
        </div>
      </div>
    `;

    renderQuestionCard(document.getElementById("quiz-question-slot")!, state[currentIndex], {
      onSelectChoice: handleAnswer,
      onToggleFlag: handleToggleFlag,
      isFlagged: isFlagged(state[currentIndex].question.id),
    });

    container.querySelectorAll<HTMLButtonElement>(".dot").forEach((btn) => {
      btn.addEventListener("click", () => goTo(Number(btn.dataset.i)));
    });
    container.querySelector<HTMLButtonElement>(".prev-button")!.addEventListener("click", () => goTo(currentIndex - 1));
    container.querySelector<HTMLButtonElement>(".next-button")!.addEventListener("click", () => goTo(currentIndex + 1));
    container.querySelector<HTMLButtonElement>(".finish-button")!.addEventListener("click", handleFinish);
  }

  function renderSummary(): void {
    const answered = state.filter((s) => s.answered);
    const correctCount = answered.filter((s) => s.chosenChoiceId === s.question.correctChoiceId).length;
    const wrongOnes = answered.filter((s) => s.chosenChoiceId !== s.question.correctChoiceId);

    container.innerHTML = `
      <section class="page quiz-summary">
        <a class="back-link" href="#/daily">← Tous les jours</a>
        <h1>Quiz du ${formatDateLabel(date)}</h1>
        <p class="score">${correctCount} / ${answered.length} bonnes réponses</p>
        ${
          wrongOnes.length
            ? `<div class="summary-block"><h2>À revoir (${wrongOnes.length})</h2>
                <ul class="summary-list">
                  ${wrongOnes
                    .map(
                      (s) =>
                        `<li><button class="summary-item" type="button" data-i="${state.indexOf(s)}">${s.question.question}</button></li>`
                    )
                    .join("")}
                </ul>
              </div>`
            : ""
        }
        <div class="cta-row">
          <a class="button button-secondary" href="#/daily">Retour aux jours</a>
        </div>
      </section>
    `;

    container.querySelectorAll<HTMLButtonElement>(".summary-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        showSummary = false;
        goTo(Number(btn.dataset.i));
      });
    });
  }

  render();
}

function formatDateLabel(date: string): string {
  if (date === todayISO()) return "aujourd'hui";
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
