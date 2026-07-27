import { loadFichesIndex } from "../lib/data-loader";

export async function renderFichesList(container: HTMLElement): Promise<void> {
  container.innerHTML = `<p class="loading">Chargement des fiches…</p>`;
  const index = await loadFichesIndex();

  container.innerHTML = `
    <section class="page">
      <h1>Fiches de révision</h1>
      <p class="subtitle">${index.fiches.length} sujets disponibles</p>
      <div class="card-grid">
        ${index.fiches
          .map(
            (f) => `
          <a class="card" href="#/fiches/${f.topic}">
            <h2>${f.title}</h2>
            <p>${f.relatedQuestionIds.length} questions liées</p>
          </a>`
          )
          .join("")}
      </div>
      <div class="cta-row">
        <a class="button" href="#/quiz">Lancer une session de 30 questions</a>
      </div>
    </section>
  `;
}
