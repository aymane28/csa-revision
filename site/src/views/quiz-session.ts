import { loadQuestionsIndex } from "../lib/data-loader";
import { getProgressMap, recordAnswer } from "../lib/progress-client";
import { buildSession } from "../lib/session-builder";
import { isFlagged, toggleFlag } from "../lib/flags";
import { clearSession, loadSession, saveSession } from "../lib/session-store";
import { renderQuestionCard, type SessionQuestionState } from "./quiz-question";
import type { Question } from "../lib/types";

export async function renderQuizSession(container: HTMLElement, topic?: string, forceNew = false): Promise<void> {
  container.innerHTML = `<p class="loading">Preparing the session…</p>`;

  const [index, progress] = await Promise.all([loadQuestionsIndex(), getProgressMap()]);
  const byId = new Map(index.questions.map((q) => [q.id, q]));

  let state: SessionQuestionState[];
  let currentIndex = 0;
  let resumed = false;

  const saved = forceNew ? null : loadSession();
  if (saved && saved.topic === topic && saved.questionIds.length > 0 && saved.questionIds.every((id) => byId.has(id))) {
    state = saved.questionIds.map((id) => {
      const q = byId.get(id) as Question;
      const a = saved.answers[id];
      return { question: q, chosenChoiceId: a?.chosenChoiceId ?? null, answered: a?.answered ?? false };
    });
    currentIndex = Math.max(0, Math.min(state.length - 1, saved.currentIndex));
    resumed = true;
  } else {
    const questions = buildSession(index.questions, progress, 30, topic);
    state = questions.map((q) => ({ question: q, chosenChoiceId: null, answered: false }));
  }

  if (state.length === 0) {
    container.innerHTML = `
      <p class="error">No questions available${topic ? ` for topic "${topic}"` : ""}.</p>
      <a class="back-link" href="#/fiches">← Back to study sheets</a>
    `;
    return;
  }

  let showSummary = false;

  function persist(): void {
    saveSession({
      topic,
      questionIds: state.map((s) => s.question.id),
      answers: Object.fromEntries(
        state.map((s) => [s.question.id, { chosenChoiceId: s.chosenChoiceId, answered: s.answered }])
      ),
      currentIndex,
      startedAt: new Date().toISOString(),
    });
  }

  if (!resumed) persist();

  function goTo(i: number): void {
    currentIndex = Math.max(0, Math.min(state.length - 1, i));
    showSummary = false;
    persist();
    render();
  }

  function handleAnswer(choiceId: string): void {
    const s = state[currentIndex];
    if (s.answered) return;
    s.answered = true;
    s.chosenChoiceId = choiceId;
    recordAnswer(s.question.id, choiceId === s.question.correctChoiceId);
    persist();
    render();
  }

  function handleToggleFlag(): void {
    toggleFlag(state[currentIndex].question.id);
    render();
  }

  function handleFinish(): void {
    const unanswered = state.filter((s) => !s.answered).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Finish anyway?`)) return;
    showSummary = true;
    clearSession();
    render();
  }

  function render(): void {
    if (showSummary) {
      renderSummary();
      return;
    }

    const answeredCount = state.filter((s) => s.answered).length;
    const newSessionHref = `#/quiz?${topic ? `topic=${encodeURIComponent(topic)}&` : ""}r=${Date.now()}`;

    container.innerHTML = `
      <div class="quiz-shell">
        <div class="quiz-toolbar">
          <span class="quiz-count">${answeredCount} / ${state.length} answered${resumed ? " · session resumed" : ""}</span>
          <div class="quiz-toolbar-actions">
            <a class="link-muted" href="${newSessionHref}">New session</a>
            <button class="button button-secondary finish-button" type="button">Finish session</button>
          </div>
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
          <button class="button button-secondary prev-button" type="button" ${currentIndex === 0 ? "disabled" : ""}>← Previous</button>
          <button class="button next-button" type="button" ${currentIndex === state.length - 1 ? "disabled" : ""}>Next →</button>
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
    const flaggedOnes = state.filter((s) => isFlagged(s.question.id));
    const restartHref = `#/quiz?${topic ? `topic=${encodeURIComponent(topic)}&` : ""}r=${Date.now()}`;

    const renderList = (items: SessionQuestionState[]) =>
      `<ul class="summary-list">
        ${items
          .map(
            (s) =>
              `<li><button class="summary-item" type="button" data-i="${state.indexOf(s)}">${s.question.question}</button></li>`
          )
          .join("")}
      </ul>`;

    container.innerHTML = `
      <section class="page quiz-summary">
        <h1>Session complete</h1>
        <p class="score">${correctCount} / ${answered.length} correct answers</p>
        ${wrongOnes.length ? `<div class="summary-block"><h2>To review (${wrongOnes.length})</h2>${renderList(wrongOnes)}</div>` : ""}
        ${
          flaggedOnes.length
            ? `<div class="summary-block"><h2>Flagged (${flaggedOnes.length})</h2>${renderList(flaggedOnes)}</div>`
            : ""
        }
        <div class="cta-row">
          <a class="button" href="${restartHref}">Start another session</a>
          <a class="button button-secondary" href="#/fiches">Back to study sheets</a>
        </div>
      </section>
    `;

    container.querySelectorAll<HTMLButtonElement>(".summary-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Re-enter the session view at this question (summary already cleared the saved session,
        // so restore it first so navigation/answers keep working normally).
        persist();
        showSummary = false;
        goTo(Number(btn.dataset.i));
      });
    });
  }

  render();
}
