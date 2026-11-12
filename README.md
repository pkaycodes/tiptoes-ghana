# Tiptoes Ghana

A one-page editorial storefront for **Tiptoes Ghana** — a personal shopper sourcing heels, bags, perfumes and clothes from the UK & US for customers in Ghana.

Built as a fast, dependency-free static site with a small Node server that adds a **live Instagram feed**.

---

## Run it locally

```bash
cd tiptoes-ghana
npm start
```

Open **http://localhost:4174**.

The site works immediately. With no Instagram token, it uses the curated feed saved in `data/instagram.json`.

```bash
npm run dev    # restarts automatically when files change
npm run check  # syntax-check the JavaScript files
```

---

## Live Instagram feed

The site polls the feed every **30 seconds**, and refreshes immediately when you return to the tab or come back online. New posts are highlighted with a “New” badge and a toast.

There are two ways to power it:

### 1. Live server sync (recommended — updates within seconds)

The Node server exposes `GET /api/instagram`. When `IG_ACCESS_TOKEN` is set, it pulls the latest media from Meta’s official Instagram API. The browser polls that endpoint, so new posts appear automatically without a rebuild.

**Setup**

1. Make sure `@tiptoesghana` is an Instagram **professional** account (Business or Creator).
2. Create an app at [developers.facebook.com](https://developers.facebook.com/).
3. Add the **Instagram** product and choose **API setup with Instagram login**.
4. Generate an access token for `@tiptoesghana`.
5. Copy the env file and paste the token:

   ```bash
   cp .env.example .env
   ```

   ```env
   IG_ACCESS_TOKEN=your-token-here
   ```

6. Restart the server:

   ```bash
   npm start
   ```

Check that live sync is on:

```bash
curl http://localhost:4174/api/health
```

```json
{ "ok": true, "liveSyncConfigured": true, "cacheSeconds": 60 }
```

The server caches Instagram responses for 60 seconds by default (`FEED_CACHE_SECONDS`), which keeps the site well inside Meta’s rate limits while still feeling instant.

**Using Facebook Login for Business instead?** Add `IG_USER_ID` to `.env`. The server will call `graph.facebook.com/{IG_USER_ID}/media` instead of `graph.instagram.com/me/media`.

### 2. Scheduled sync (for static hosting)

If you deploy to a static host, run:

```bash
npm run sync
```

This pulls the latest posts, downloads their images into `assets/live/`, and rewrites `data/instagram.json`. Run it from cron, a scheduled GitHub Action, or your host’s scheduler. The site’s 30-second polling will pick up the new JSON automatically.

Example cron (every 10 minutes):

```cron
*/10 * * * * cd /path/to/tiptoes-ghana && /usr/bin/node scripts/sync-instagram.mjs >> sync.log 2>&1
```

> Static hosting can only update as often as the sync runs. For true “new post appears at once” behaviour, deploy the Node server (Render, Railway, Fly.io, a VPS, etc.) with `IG_ACCESS_TOKEN` set.

### 3. GitHub Pages (free demo hosting)

The demo is live at:

```text
https://pkaycodes.github.io/tiptoes-ghana/
```

It is deployed from the `main` branch root, so every push republishes the site. The page uses the saved `data/instagram.json` feed on GitHub Pages (the Node API is not available there).

**Refresh the saved feed:**

```bash
npm run sync
git add data/instagram.json assets/live
git commit -m "Sync Instagram feed"
git push
```

The ready-to-use GitHub Actions workflows are kept in `deploy/github-actions/`:

- `pages.yml` — deploy the static site to GitHub Pages.
- `sync-instagram.yml` — check Instagram every 15 minutes, download new images into `assets/live/`, update `data/instagram.json`, and commit the change. That commit triggers a fresh Pages deploy.

GitHub blocked automatic workflow installation when this repo was created because the CLI token lacks the `workflow` scope. To install them:

```bash
gh auth refresh -h github.com -s workflow
mkdir -p .github/workflows
cp deploy/github-actions/*.yml .github/workflows/
git add .github/workflows
git commit -m "Add GitHub Actions workflows"
git push
```

Then add the token as a repository secret: **Settings → Secrets and variables → Actions → New repository secret**, named `IG_ACCESS_TOKEN` (and optionally `IG_USER_ID`). The sync workflow skips safely when the secret is missing.

> GitHub’s scheduled workflows are not real-time and can be delayed during busy periods. The site still polls `data/instagram.json` every 30 seconds, so as soon as the workflow commits a new post, the open page picks it up on its next poll. For guaranteed instant updates, use the Node server option above.

### Why not scrape Instagram?

Instagram blocks logged-out scraping and requires authentication for profile/post data. The official API is the reliable, policy-compliant way to keep the feed current. No login cookies or third-party scraper is used.

### Token expiry

Long-lived Instagram tokens expire after about 60 days. Refresh the token before it expires and update `IG_ACCESS_TOKEN` in your host’s environment variables. Meta’s refresh endpoint is:

```text
https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
```

---

## Project structure

```text
tiptoes-ghana/
├── index.html                  # the page
├── styles.css                  # editorial design system + responsive layout
├── script.js                   # filters, lightbox, menu, live feed polling
├── server.mjs                  # static server + /api/instagram
├── lib/instagram.mjs           # official Instagram API client + normalisation
├── scripts/sync-instagram.mjs  # scheduled static-site sync
├── scripts/refresh-instagram-token.mjs
├── data/instagram.json         # saved/curated feed (also the offline fallback)
├── assets/
│   ├── img/                    # optimised post imagery
│   ├── live/                   # images downloaded by the sync script
│   ├── logo-full.png
│   ├── logo-mark.png
│   └── favicon.png
├── deploy/github-actions/
│   ├── pages.yml               # optional GitHub Pages deploy workflow
│   └── sync-instagram.yml      # optional scheduled feed sync
├── .env.example
└── package.json
```

---

## Editing the saved edit

`data/instagram.json` is a normal JSON file. Each post looks like this:

```json
{
  "id": "seed-DfWyxuOiB6s",
  "shortcode": "DfWyxuOiB6s",
  "image": "assets/img/hero-floral-bag.webp",
  "permalink": "https://www.instagram.com/p/DfWyxuOiB6s/",
  "timestamp": "2026-11-04T12:00:00.000Z",
  "caption": "Your vision, exclusively curated for you.",
  "mediaType": "IMAGE",
  "category": "Bags",
  "title": "The olive shoulder bag",
  "sizes": "One size"
}
```

Categories used by the shop filters are `Heels`, `Bags`, `Perfume`, `Beauty` and `Clothes`. Anything else (for example `Campaign` or `Tribe`) still appears in the Instagram grid but is left out of the product edit.

---

## Notes

- WhatsApp CTA: `https://wa.me/message/TRYATNHBXQCLL1`
- Phone: `+233 24 813 2511`
- Instagram: [@tiptoesghana](https://www.instagram.com/tiptoesghana/)
- Tiptoes is an independent personal shopping service and is not affiliated with the brands featured.
