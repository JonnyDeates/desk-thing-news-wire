# Ground News Ticker (DeskThing)

A DeskThing app that continuously scrolls your Ground News feed up the screen like a news ticker.

## How it works

- **Server** (`server/`): uses your Ground News session cookies to periodically scrape your feed page, and pushes stories to the client.
- **Client** (`src/`): renders a vertical ticker that scrolls stories upward in a seamless loop. Bias bar + source count are shown when available.
- **Sync CLI** (`scripts/sync-cookie.ts`): pulls your current session cookies out of Firefox or Chromium-family browsers and hands them to the app — no DevTools copy-paste required.

Ground News does **not** publish a public API or RSS feed, so this app relies on scraping behind your authenticated session. If their site layout changes, parsing may break — the fetcher is isolated in `server/groundNews.ts` so it's easy to patch.

> ⚠️ Scraping is against ground.news ToS. Use at your own risk, personal use only.

## Setup

```bash
npm install
npm run build        # produces dist/ground-news-ticker-v0.1.0.zip
```

Sideload the zip into DeskThing via **Downloads → Load App**.

## Sync your Ground News cookies

Sign in to [ground.news](https://ground.news) in Firefox or a Chromium-family browser (Chrome, Chromium, Brave, Edge), then:

```bash
npm run sync-cookie
```

The CLI:

1. Scans Firefox profiles under `~/.mozilla/firefox/` and Chromium-family profiles under `~/.config/`.
2. Picks whichever profile has the most-recently-accessed `ground.news` cookies.
3. Writes the full cookie string to `~/.config/ground-news-ticker/cookie.txt` (chmod 600).
4. Copies the same string to your clipboard (via `wl-copy` on Wayland or `xclip` on X11).

The DeskThing app reads `cookie.txt` on startup when its `session_cookie` setting is empty, so after the first `sync-cookie` run everything should just work.

### Dependencies

- **Firefox**: no extra deps — cookies live in plaintext SQLite.
- **Chromium family**: needs `secret-tool` to retrieve the keyring-stored encryption key.
  - NixOS one-shot: `nix-shell -p libsecret --run 'npm run sync-cookie'`
  - NixOS permanent: add `pkgs.libsecret` to `home.nix` / `configuration.nix`.
  - Debian/Ubuntu: `sudo apt install libsecret-tools`.
  - Fedora: `sudo dnf install libsecret`.
  - If `secret-tool` isn't available, the CLI falls back to Chromium's hard-coded `peanuts` password (only works on installs with no keyring).
- **Clipboard**: `wl-copy` (`pkgs.wl-clipboard`) on Wayland, or `xclip` / `xsel` on X11. Clipboard copy is optional — the file drop is enough.

### Refreshing

Session cookies expire periodically. Re-run `npm run sync-cookie` after signing back in — the DeskThing app will pick up the new cookies on its next refresh tick (default 15 min) or on restart.

To automate: add to crontab or a systemd timer, e.g. weekly:

```cron
0 4 * * 1  cd /home/jonkoi/Documents/Github/desk-thing/ground-news && npm run sync-cookie
```

## Manual fallback (no CLI)

If you'd rather paste cookies by hand:

1. DevTools → Application → Cookies → `https://ground.news`.
2. Grab the values for at least these three cookies: `GN_SESSION_ID`, `GROUND_LOGIN_TOKEN`, `GROUND_USER`.
3. Combine into a single header-style string:
   ```
   GN_SESSION_ID=…; GROUND_LOGIN_TOKEN=…; GROUND_USER=…
   ```
4. Paste into **DeskThing → Ground News Ticker → Settings → Ground News session cookie**.

`GN_SESSION_ID` is `HttpOnly`, which is why the sync CLI is nicer than copy-paste — DevTools shows it but a bookmarklet cannot read it.

## Settings

| Setting | Purpose |
|---|---|
| **Ground News session cookie** | Full `name=value; …` cookie string (set automatically by `sync-cookie`). |
| **Feed path** | Which page to scrape — e.g. `/my/for-you`, `/interest/politics`, `/blindspot`. |
| **Refresh interval (minutes)** | How often to re-fetch. Keep ≥ 5 to be polite. |

## Development

```bash
npm run dev          # DeskThing dev server with Vite + hot reload
```

## Project layout

```
scripts/
  sync-cookie.ts    Companion CLI — pulls cookies out of browser cookie DBs
server/
  index.ts          DeskThing server entrypoint — settings, refresh loop, event wiring
  groundNews.ts     HTML fetch + __NEXT_DATA__ parsing + fallback regex
src/
  App.tsx           Vertical ticker UI (continuous CSS scroll)
  index.css
  main.tsx
deskthing/
  manifest.json     App manifest (id, label, version, platforms)
```

## When it breaks

If stories stop coming:

1. Check the DeskThing server log for `[groundNews]` entries.
2. `parsed 0 stories` or `401`/`403` → cookies likely expired. Re-run `npm run sync-cookie`.
3. If `sync-cookie` reports "0 cookies for ground.news" → sign back in to ground.news in that browser.
4. If still empty after fresh cookies, Ground News' Next.js JSON shape may have shifted. Open `server/groundNews.ts` and update the `walkForStories` heuristic.
