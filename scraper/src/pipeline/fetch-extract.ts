import * as cheerio from "cheerio";

export interface ExtractedContent {
  title: string;
  text: string;
}

const USER_AGENT =
  "csa-revision-bot/0.1 (personal, non-commercial CSA study tool; source: github.com repo owner)";

export async function fetchAndExtract(url: string, type: string): Promise<ExtractedContent | null> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    console.warn(`[fetch-extract] network error for ${url}:`, err);
    return null;
  }

  if (!res.ok) {
    console.warn(`[fetch-extract] fetch failed for ${url}: HTTP ${res.status}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  if (type === "servicenow-docs") {
    const title = $(".title.topictitle1").first().text().trim() || $("title").first().text().trim();
    const body = $(".body.conbody").first();
    body.find("script, style").remove();
    const text = body.text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 200) {
      console.warn(`[fetch-extract] extracted body too short for ${url} (${text.length} chars) — page structure may have changed`);
      return null;
    }
    return { title, text: text.slice(0, 8000) };
  }

  // Generic fallback for any other allow-listed page.
  $("script, style, nav, header, footer").remove();
  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (!text || text.length < 200) {
    console.warn(`[fetch-extract] extracted body too short for ${url} (${text.length} chars)`);
    return null;
  }
  return { title, text: text.slice(0, 8000) };
}
