import { loadFiche } from "../lib/data-loader";
import type { Fiche } from "../lib/types";

export async function renderFicheDetail(container: HTMLElement, topic: string): Promise<void> {
  container.innerHTML = `<p class="loading">Chargement…</p>`;

  let fiche: Fiche;
  try {
    fiche = await loadFiche(topic);
  } catch {
    container.innerHTML = `<p class="error">Fiche introuvable.</p><a class="back-link" href="#/fiches">← Retour aux fiches</a>`;
    return;
  }

  container.innerHTML = `
    <section class="page">
      <a class="back-link" href="#/fiches">← Retour aux fiches</a>
      <h1>${fiche.title}</h1>
      ${fiche.sections
        .map(
          (s) =>
            `<section class="fiche-section"><h2>${s.heading}</h2><p>${s.content.replace(/\n/g, "<br/>")}</p></section>`
        )
        .join("")}
      <section class="pieges-block">
        <h2>⚠ Pièges à éviter</h2>
        <ul>${fiche.pieges.map((p) => `<li>${p}</li>`).join("")}</ul>
      </section>
      <div class="cta-row">
        <a class="button" href="#/quiz?topic=${encodeURIComponent(fiche.topic)}">S'entraîner sur ce sujet</a>
      </div>
    </section>
  `;
}
