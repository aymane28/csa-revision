import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "./paths";

const SEEN_PATH = path.join(DATA_ROOT, "questions", "_sources_seen.json");

export function loadSeenUrls(): Set<string> {
  if (!existsSync(SEEN_PATH)) return new Set();
  const raw = JSON.parse(readFileSync(SEEN_PATH, "utf-8")) as string[];
  return new Set(raw);
}

export function saveSeenUrls(urls: Set<string>): void {
  writeFileSync(SEEN_PATH, JSON.stringify([...urls].sort(), null, 2) + "\n");
}
