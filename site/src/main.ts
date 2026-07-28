import "./styles/main.css";
import { initRouter } from "./router";
import { registerServiceWorker, getPushStatus, enablePushReminders, disablePushReminders } from "./lib/push-client";
import { flushDailyQueue } from "./lib/daily-client";

const app = document.getElementById("app")!;
app.innerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="#/fiches">CSA Révision</a>
      <nav>
        <a href="#/fiches">Fiches</a>
        <a href="#/quiz">Session libre</a>
        <a href="#/daily">Quiz du jour</a>
        <button class="push-toggle" type="button" id="push-toggle" hidden></button>
      </nav>
    </div>
  </header>
  <main id="view"></main>
`;

initRouter(document.getElementById("view")!);
void registerServiceWorker();
void initPushToggle();

// Retry any daily-quiz answers that failed to sync on a previous visit (e.g. flaky
// mobile connection) as soon as we're back online, so other devices see them promptly.
void flushDailyQueue();
window.addEventListener("online", () => void flushDailyQueue());

async function initPushToggle(): Promise<void> {
  const btn = document.getElementById("push-toggle") as HTMLButtonElement | null;
  if (!btn) return;

  async function refresh(): Promise<void> {
    const status = await getPushStatus();
    if (status === "unsupported") {
      btn!.hidden = true;
      return;
    }
    btn!.hidden = false;
    if (status === "subscribed") {
      btn!.textContent = "🔔 Rappels activés";
      btn!.classList.add("push-toggle-on");
    } else {
      btn!.textContent = "🔕 Activer les rappels";
      btn!.classList.remove("push-toggle-on");
    }
    btn!.disabled = status === "denied";
    if (status === "denied") btn!.title = "Notifications bloquées dans les réglages du navigateur";
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const status = await getPushStatus();
    if (status === "subscribed") {
      await disablePushReminders();
    } else {
      await enablePushReminders();
    }
    btn.disabled = false;
    await refresh();
  });

  await refresh();
}
