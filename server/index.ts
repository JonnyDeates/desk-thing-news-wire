import { createDeskThing } from "@deskthing/server";
import { DESKTHING_EVENTS, SETTING_TYPES } from "@deskthing/types";
import { RSSClient, Story } from "./rssClient";

type ToServerEvent =
  | { type: "request_stories" }
  | { type: "force_refresh" }
  | { type: "open_url"; payload: string };
type ToClientEvent =
  | { type: "stories"; payload: Story[] }
  | { type: "status"; payload: string }
  | { type: "config"; payload: { scrollSpeed: number } };

const DeskThing = createDeskThing<ToServerEvent, ToClientEvent>();

const DEFAULT_FEED_URLS = [
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://www.theguardian.com/world/rss",
  "https://feeds.skynews.com/feeds/rss/world.xml",
  "https://feeds.npr.org/1001/rss.xml",
].join(", ");

const REFRESH_MS = 15 * 60 * 1000;

let client: RSSClient | null = null;
let latest: Story[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let settingsDebounce: ReturnType<typeof setTimeout> | null = null;
let starting = false;
// DeskThing.getSettings() internally fires a SETTINGS event to deliver its response,
// which would re-trigger our SETTINGS handler and loop forever. Suppress while reading.
let suppressSettings = 0;

const setupSettings = async () => {
  await DeskThing.initSettings({
    feed_urls: {
      id: "feed_urls",
      type: SETTING_TYPES.STRING,
      label: "RSS feed URLs",
      description:
        "Comma-separated RSS feed URLs to display. Default includes BBC, Reuters, AP News, and NPR.",
      value: DEFAULT_FEED_URLS,
    },
    refresh_minutes: {
      id: "refresh_minutes",
      type: SETTING_TYPES.NUMBER,
      label: "Refresh interval (minutes)",
      description: "How often to re-fetch stories. Keep this >= 5 to be polite.",
      value: 15,
      min: 5,
      max: 240,
    },
    scroll_speed: {
      id: "scroll_speed",
      type: SETTING_TYPES.NUMBER,
      label: "Scroll speed",
      description: "Auto-scroll speed. 1 is very slow, 10 is very fast. Default 3.",
      value: 3,
      min: 1,
      max: 10,
    },
  });
};

const readSettings = async () => {
  suppressSettings++;
  try {
    const s = await DeskThing.getSettings();
    const rawUrls = (s?.feed_urls?.value as string | undefined) ?? DEFAULT_FEED_URLS;
    const feedUrls = rawUrls
      .split(/[,\n]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    const refreshMin = Number(s?.refresh_minutes?.value ?? 15);
    const scrollSpeed = Math.max(1, Math.min(10, Number(s?.scroll_speed?.value ?? 3)));
    return { feedUrls, refreshMin, scrollSpeed };
  } finally {
    // Release after a microtask so any sync SETTINGS listener triggered by the
    // getSettings response has already fired and been ignored.
    queueMicrotask(() => { suppressSettings--; });
  }
};

const refresh = async () => {
  if (!client) return;
  try {
    latest = await client.fetchStories();
    console.log(`[rss] got ${latest.length} stories`);
    DeskThing.send({ type: "stories", payload: latest });
  } catch (err) {
    console.error("[rss] fetch failed:", err);
  }
};

const rebuildClient = async () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const { feedUrls, refreshMin, scrollSpeed } = await readSettings();
  DeskThing.send({ type: "config", payload: { scrollSpeed } });
  if (!feedUrls.length) {
    console.warn("[rss] no feed URLs configured");
    client = null;
    latest = [];
    DeskThing.send({ type: "stories", payload: [] });
    return;
  }
  client = new RSSClient(feedUrls);
  await refresh();
  const ms = Math.max(5, refreshMin) * 60 * 1000;
  timer = setInterval(refresh, ms || REFRESH_MS);
};

const setupActions = () => {
  DeskThing.registerAction({
    id: "refresh_now",
    name: "Refresh stories now",
    description: "Fetch the latest RSS stories immediately.",
    version: "0.2.0",
    enabled: true,
    tag: "basic",
  });
};

(DeskThing as any).on("action", async (data: any) => {
  if (data?.payload?.id === "refresh_now") {
    console.log("[rss] action: refresh_now");
    if (!client) await rebuildClient();
    else await refresh();
  }
});

DeskThing.on(DESKTHING_EVENTS.START, async () => {
  console.log("[rss] starting");
  starting = true;
  await setupSettings();
  setupActions();
  await rebuildClient();
  starting = false;
});

DeskThing.on(DESKTHING_EVENTS.SETTINGS, () => {
  // initSettings during START fires this too; debounce so we only rebuild once.
  // getSettings also fires it (as its response channel); suppressSettings blocks that.
  if (starting || suppressSettings > 0) return;
  if (settingsDebounce) clearTimeout(settingsDebounce);
  settingsDebounce = setTimeout(async () => {
    settingsDebounce = null;
    console.log("[rss] settings changed, rebuilding client");
    await rebuildClient();
  }, 500);
});

DeskThing.on(DESKTHING_EVENTS.STOP, async () => {
  console.log("[rss] stopping");
  if (timer) clearInterval(timer);
  timer = null;
});

DeskThing.on("request_stories", async () => {
  const { scrollSpeed } = await readSettings();
  DeskThing.send({ type: "config", payload: { scrollSpeed } });
  DeskThing.send({ type: "stories", payload: latest });
});

DeskThing.on("open_url", (data) => {
  const url = typeof data?.payload === "string" ? data.payload : null;
  if (!url) return;
  console.log(`[rss] opening ${url}`);
  DeskThing.openUrl(url);
});

DeskThing.on("force_refresh", async () => {
  console.log("[rss] client requested force_refresh");
  DeskThing.send({ type: "status", payload: "Refreshing stories…" });
  if (!client) await rebuildClient();
  else await refresh();
  DeskThing.send({ type: "status", payload: "Stories refreshed." });
});
