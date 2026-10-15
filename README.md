# Newswire — DeskThing News Ticker

A DeskThing app that scrolls world news headlines up the screen like a classic newsroom ticker. Pulls from public RSS feeds (BBC, The Guardian, Sky News, NPR by default) with no accounts, cookies, or scraping involved.

## Features

- Continuous auto-scrolling ticker with a seamless loop
- Pause by touching the screen and drag to scroll manually
- Tap an article to open the full story in your browser (opens on the DeskThing host)
- Adjustable scroll speed (1–10) from the DeskThing settings panel
- Configurable RSS feed list — add or swap any public feeds you want
- Automatic refresh every N minutes (default 15)
- "Force refresh" button in the in-app settings for immediate updates
- Filters out subscription/promo junk titles automatically

## Install

### From GitHub release (recommended)

1. Go to the [latest release](https://github.com/JonnyDeates/desk-thing-news-wire/releases/latest).
2. Download `newswire-v{version}.zip`.
3. In DeskThing, open **Downloads → Load App** and select the zip.

### From source

```bash
git clone https://github.com/JonnyDeates/desk-thing-news-wire
cd desk-thing-news-wire
npm install
npm run build          # produces dist/newswire-v{version}.zip
```

Sideload the resulting zip via **Downloads → Load App**.

## Compatibility

- DeskThing **client ≥ 0.11.0**
- DeskThing **server ≥ 0.11.0**

## Settings

Open **DeskThing → Newswire → Settings** to configure:

| Setting | Default | Purpose |
|---|---|---|
| **RSS feed URLs** | BBC + Guardian + Sky News + NPR | Comma-separated list of RSS/Atom feed URLs |
| **Refresh interval (minutes)** | 15 | How often to re-fetch stories (minimum 5) |
| **Scroll speed** | 3 | 1 = very slow, 10 = very fast |

Changes apply live (debounced ~500 ms). The in-app settings panel (gear icon in the top-right) also has a **Force refresh** button.

## How it works

- **Server** (`server/`): fetches each RSS feed on an interval, parses it with a dependency-free regex-based XML walker, de-duplicates by title, filters out signup/subscribe/newsletter titles, and pushes the combined story list to the client.
- **Client** (`src/`): renders the stories twice in a vertical column and uses `requestAnimationFrame` to continuously bump `scrollTop`. When the first copy has fully scrolled past, it wraps by exactly one copy's height so the loop is visually seamless.
- **URL opening**: tapping a story sends an `open_url` event to the server, which calls `DeskThing.openUrl()` (uses Electron's `shell.openExternal` on the DeskThing host machine).

## Development

```bash
npm run dev            # DeskThing dev server + Vite with hot reload
npm run build          # production zip in dist/
npm run lint
```

## Project layout

```
server/
  index.ts             DeskThing server entry — settings, refresh loop, event handlers
  rssClient.ts         RSS fetch + parse + junk filtering
src/
  App.tsx              Ticker UI, settings panel, touch/wheel handlers
  index.css            Tailwind + custom scroll-hiding
  main.tsx
deskthing/
  manifest.json        App manifest
  icons/               App icons
.github/workflows/
  release.yml          GitHub Actions release workflow
```

## Releases

Releases are published automatically by GitHub Actions when a semver tag is pushed. See [the Releases section below](#publishing-a-new-release) for details.

## Publishing a new release

DeskThing fetches updates by looking at a repo's latest GitHub release for `newswire-v{version}.zip` and a `latest.json` metadata file. The included GitHub Action (`.github/workflows/release.yml`) handles this automatically:

```bash
# 1. Bump the version in both package.json and deskthing/manifest.json
# 2. Commit the version bump
git add package.json deskthing/manifest.json
git commit -m "chore: release v1.7.0"

# 3. Tag and push — the workflow builds and publishes the release
git tag v1.7.0
git push --tags
```

The workflow will:

1. Run `npm ci && npm run build`
2. Create a GitHub release named `v{version}`
3. Attach `newswire-v{version}.zip` and `latest.json` as release assets

Once the release is live, DeskThing clients that already have the app installed will pick up the update on their next refresh.

## License

MIT
