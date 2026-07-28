import { getRecentDailyRecords, todayISO } from "../lib/daily-client";

export async function renderDailyList(container: HTMLElement): Promise<void> {
  container.innerHTML = `<p class="loading">Loading daily quizzes…</p>`;

  const records = await getRecentDailyRecords(14);
  const today = todayISO();
  const dates = Object.keys(records).sort((a, b) => (a < b ? 1 : -1));

  container.innerHTML = `
    <section class="page">
      <h1>Daily Quiz</h1>
      <p class="subtitle">30 fixed questions every day — miss a day, catch up whenever you like.</p>
      <div class="daily-list">
        ${dates
          .map((d) => {
            const r = records[d];
            const total = r.questionIds.length;
            const answeredCount = Object.keys(r.answers).length;
            const correctCount = Object.values(r.answers).filter((a) => a.correct).length;
            const done = total > 0 && answeredCount >= total;
            const statusClass = done ? "daily-status-done" : answeredCount > 0 ? "daily-status-progress" : "daily-status-todo";
            const statusText = done
              ? `Done · ${correctCount}/${total}`
              : answeredCount > 0
                ? `In progress · ${answeredCount}/${total}`
                : "Not started";

            return `
              <a class="daily-row" href="#/daily/${d}">
                <span class="daily-date-block">
                  <span class="daily-date">${formatLabel(d, today)}</span>
                  <span class="daily-date-sub">${d}</span>
                </span>
                <span class="daily-status ${statusClass}">${statusText}</span>
              </a>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function formatLabel(date: string, today: string): string {
  const diffDays = Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
