import { renderFichesList } from "./views/fiches-list";
import { renderFicheDetail } from "./views/fiche-detail";
import { renderQuizSession } from "./views/quiz-session";
import { renderDailyList } from "./views/daily-list";
import { renderDailyQuiz } from "./views/daily-quiz";

function parseHash(): { segments: string[]; query: URLSearchParams } {
  const hash = location.hash.replace(/^#/, "") || "/fiches";
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  return { segments, query: new URLSearchParams(queryPart ?? "") };
}

export function initRouter(container: HTMLElement): void {
  const handle = () => void route(container);
  window.addEventListener("hashchange", handle);
  handle();
}

async function route(container: HTMLElement): Promise<void> {
  const { segments, query } = parseHash();

  try {
    if (segments[0] === "fiches" && segments[1]) {
      await renderFicheDetail(container, segments[1]);
    } else if (segments[0] === "quiz") {
      await renderQuizSession(container, query.get("topic") ?? undefined, query.get("r") !== null);
    } else if (segments[0] === "daily" && segments[1]) {
      await renderDailyQuiz(container, segments[1]);
    } else if (segments[0] === "daily") {
      await renderDailyList(container);
    } else {
      await renderFichesList(container);
    }
  } catch (err) {
    container.innerHTML = `<p class="error">Something went wrong: ${(err as Error).message}</p>`;
  }
}
