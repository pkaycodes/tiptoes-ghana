/* =========================================================
   Sync the latest Instagram posts into data/instagram.json
   ---------------------------------------------------------
   Use this when the site is deployed to a static host, or run
   it from cron / GitHub Actions on a schedule.

     npm run sync

   Requires IG_ACCESS_TOKEN in .env (see .env.example).
   Images are downloaded into assets/live/ so the site does not
   depend on expiring Instagram CDN URLs.
   ========================================================= */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchInstagramFeed } from "../lib/instagram.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(ROOT, "data", "instagram.json");
const LIVE_DIR = path.join(ROOT, "assets", "live");

try {
  process.loadEnvFile?.(path.join(ROOT, ".env"));
} catch {
  // Optional.
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function extensionFor(url) {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    return ALLOWED_EXTENSIONS.has(extension) ? extension : ".jpg";
  } catch {
    return ".jpg";
  }
}

function safeId(value) {
  return String(value || "post").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "post";
}

async function hasImage(destination) {
  try {
    const info = await stat(destination);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function downloadImage(url, destination) {
  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
      "User-Agent": "TiptoesGhanaFeedSync/1.0",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("Image response was empty");
  await writeFile(destination, bytes);
  return bytes.length;
}

async function main() {
  let existing = {
    account: {
      username: "tiptoesghana",
      name: "Tiptoes Ghana",
      avatar: "assets/logo-mark.png",
      followers: 2045,
      url: "https://www.instagram.com/tiptoesghana/",
    },
  };

  try {
    existing = JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    // First sync. A default account is used below.
  }

  const feed = await fetchInstagramFeed();
  await mkdir(LIVE_DIR, { recursive: true });

  const existingById = new Map(
    (Array.isArray(existing.posts) ? existing.posts : []).map((post) => [post.id, post]),
  );

  let downloaded = 0;
  let reused = 0;
  let failed = 0;

  for (const post of feed.posts) {
    const extension = extensionFor(post.image);
    const filename = `${safeId(post.id)}${extension}`;
    const relativePath = `assets/live/${filename}`;
    const destination = path.join(LIVE_DIR, filename);

    if (await hasImage(destination)) {
      post.image = relativePath;
      reused += 1;
      continue;
    }

    try {
      await downloadImage(post.image, destination);
      post.image = relativePath;
      downloaded += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[sync] Could not download ${post.id}: ${error.message}`);
      // Keep the last image we successfully saved for this post.
      const previous = existingById.get(post.id);
      if (previous?.image?.startsWith("assets/")) {
        post.image = previous.image;
      }
    }
  }

  const account = {
    ...existing.account,
    ...feed.account,
    followers: feed.account.followers || existing.account?.followers || 2045,
  };

  const postsChanged =
    JSON.stringify(feed.posts) !== JSON.stringify(existing.posts || []);
  const accountChanged =
    JSON.stringify(account) !== JSON.stringify(existing.account || {});

  if (!postsChanged && !accountChanged && existing.mode === "live") {
    console.log(
      `[sync] No changes · ${feed.posts.length} posts checked · ${reused} images already saved${failed ? ` · ${failed} failed` : ""}.`,
    );
    return;
  }

  const output = {
    account,
    mode: "live",
    source: "instagram-graph",
    updatedAt: new Date().toISOString(),
    notice: "",
    posts: feed.posts,
  };

  await writeFile(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    `[sync] ${feed.posts.length} posts saved · ${downloaded} images downloaded · ${reused} reused${failed ? ` · ${failed} failed` : ""}.`,
  );
  console.log(`[sync] Wrote ${path.relative(ROOT, DATA_FILE)}.`);
}

main().catch((error) => {
  console.error(`[sync] ${error.message}`);
  process.exitCode = 1;
});
