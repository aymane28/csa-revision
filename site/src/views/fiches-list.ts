import { loadFichesIndex } from "../lib/data-loader";

export async function renderFichesList(container: HTMLElement): Promise<void> {
  container.innerHTML = `<p class="loading">Loading study sheets…</p>`;
  const index = await loadFichesIndex();

  container.innerHTML = `
    <section class="page">
      <h1>Study Sheets</h1>
      <p class="subtitle">${index.fiches.length} topics available</p>
      <div class="card-grid">
        ${index.fiches
          .map(
            (f) => `
          <a class="card" href="#/fiches/${f.topic}">
            <h2>${f.title}</h2>
            <p>${f.relatedQuestionIds.length} related questions</p>
          </a>`
          )
          .join("")}
      </div>
      <div class="cta-row">
        <a class="button" href="#/quiz">Start a 30-question session</a>
      </div>
    </section>
  `;
}
