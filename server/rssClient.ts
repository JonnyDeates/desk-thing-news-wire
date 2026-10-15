export type Story = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
};

export class RSSClient {
  constructor(private feedUrls: string[]) {}

  async fetchStories(): Promise<Story[]> {
    const results = await Promise.allSettled(
      this.feedUrls.map((url) => this.fetchFeed(url))
    );
    const stories: Story[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        stories.push(...r.value);
      } else {
        console.warn("[rss] feed failed:", r.reason?.message ?? r.reason);
      }
    }
    return stories;
  }

  private async fetchFeed(feedUrl: string): Promise<Story[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(feedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RSS reader)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res!.ok) throw new Error(`HTTP ${res!.status} fetching ${feedUrl}`);
    const xml = await res!.text();
    return this.parseRSS(xml, feedUrl);
  }

  private parseRSS(xml: string, feedUrl: string): Story[] {
    let sourceName: string;
    try {
      sourceName = extractTag(xml, "title") ?? new URL(feedUrl).hostname;
    } catch {
      sourceName = feedUrl;
    }

    const stories: Story[] = [];
    const seen = new Set<string>();
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;

    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1];
      const rawTitle = extractTag(item, "title");
      if (!rawTitle) continue;
      const title = cleanText(rawTitle);
      if (!title || seen.has(title) || isJunk(title)) continue;
      seen.add(title);

      const link =
        extractTag(item, "link") ?? extractTag(item, "guid") ?? undefined;
      const rawDesc =
        extractTag(item, "description") ??
        extractTag(item, "summary") ??
        undefined;

      stories.push({
        id: link ?? title,
        title,
        summary: rawDesc ? cleanText(rawDesc) : undefined,
        url: link ?? undefined,
        source: sourceName,
      });
    }

    return stories;
  }
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}(?:[^>]*)>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/${tag}>`,
    "i"
  );
  const m = re.exec(xml);
  if (!m) return null;
  return (m[1] ?? m[2] ?? "").trim() || null;
}

const JUNK_RE = /\b(sign\s*up|subscribe|newsletter|create\s+an?\s+account|register\s+now|log\s*in|click\s+here|download\s+(the\s+)?app|get\s+the\s+app)\b/i;

function isJunk(title: string): boolean {
  return JUNK_RE.test(title);
}

function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
