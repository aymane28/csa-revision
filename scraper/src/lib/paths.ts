import path from "node:path";

const SCRAPER_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const DATA_ROOT = path.resolve(SCRAPER_ROOT, "..", "data");
export const CONFIG_ROOT = path.resolve(SCRAPER_ROOT, "src", "config");
