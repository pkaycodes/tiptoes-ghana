/* =========================================================
   Tiptoes Ghana — local / Node server
   ---------------------------------------------------------
   Serves the static site and exposes /api/instagram.

   Run:
     npm start
     open http://localhost:4174

   With no token the API returns the saved edit from
   data/instagram.json, so the site always works.
   ========================================================= */

import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchInstagramFeed } from "./lib/instagram.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile?.(path.join(ROOT, ".env"));
} catch {
  // A .env file is optional. Environment variables can be set by the host.
}

const PORT = Number(process.env.PORT) || 4174;
const HOST = process.env.HOST || "0.0.0.0";
const CACHE_MS = Math.max(10, Number(process.env.FEED_CACHE_SECONDS) || 60) * 1000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

let cache = { at: 0, data: null };

async function readSeedFeed() {
  try {
    const raw = await readFile(path.join(ROOT, "data", "instagram.json"), "utf8");
    const seed = JSON.parse(raw);
    return { ...seed, mode: "seed", source: "seed" };
  } catch (error) {
    console.warn("[feed] Could not read data/instagram.json:", error.message);
    return {
      account: {
        username: "tiptoesghana",
        name: "Tiptoes Ghana",
        avatar: "assets/logo-mark.png",
        followers: 2045,
        url: "https://www.instagram.com/tiptoesghana/",
      },
      mode: "seed",
      source: "seed",
      updatedAt: new Date().toISOString(),
      posts: [],
      notice: "The saved feed could not be loaded.",
    };
  }
}

async function getFeed() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_MS) {
    return cache.data;
  }

  if (!process.env.IG_ACCESS_TOKEN) {
    const seed = await readSeedFeed();
    return {
      ...seed,
      live: false,
      notice: "Live sync is not configured yet — showing the saved edit.",
    };
  }

  try {
    const live = await fetchInstagramFeed();
    cache = { at: now, data: live };
    return live;
  } catch (error) {
    console.warn(`[instagram] ${error.message}`);
    const seed = await readSeedFeed();
    const data = {
      ...seed,
      live: false,
      notice: "Live sync is temporarily unavailable — showing the saved edit.",
    };
    // Cache the fallback briefly so a broken token does not hammer the API.
    cache = { at: now, data };
    return data;
  }
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(text);
}

function notFound(response) {
  const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found — Tiptoes Ghana</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f3eee6;color:#161411;font-family:system-ui,sans-serif;text-align:center">
  <main><p style="font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase">404</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:clamp(2.5rem,7vw,5rem);margin:8px 0 18px">This page slipped away.</h1><a href="/" style="color:#161411">Back to Tiptoes Ghana →</a></main>
</body>
</html>`;
  response.writeHead(404, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/instagram") {
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end();
      return;
    }
    try {
      const feed = await getFeed();
      sendJson(response, 200, feed);
    } catch (error) {
      console.error("[feed]", error);
      sendJson(response, 500, {
        error: "Feed unavailable",
        message: "The Instagram feed could not be loaded.",
      });
    }
    return;
  }

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      liveSyncConfigured: Boolean(process.env.IG_ACCESS_TOKEN),
      cacheSeconds: CACHE_MS / 1000,
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  let target = filePath;
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, "index.html");
    }
    const finalInfo = await stat(target);
    if (!finalInfo.isFile()) {
      notFound(response);
      return;
    }

    const extension = path.extname(target).toLowerCase();
    const isFresh = extension === ".html" || extension === ".json";
    const headers = {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Content-Length": finalInfo.size,
      "Cache-Control": isFresh ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = createReadStream(target);
    stream.on("error", (error) => {
      console.error("[static]", error);
      if (!response.headersSent) {
        sendText(response, 500, "Internal server error");
      } else {
        response.destroy();
      }
    });
    stream.pipe(response);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      notFound(response);
      return;
    }
    console.error("[static]", error);
    sendText(response, 500, "Internal server error");
  }
});

server.listen(PORT, HOST, () => {
  const live = Boolean(process.env.IG_ACCESS_TOKEN);
  console.log(`\n  Tiptoes Ghana is running at http://localhost:${PORT}`);
  console.log(
    live
      ? "  Instagram live sync: ON (official Graph API)\n"
      : "  Instagram live sync: OFF (using the saved edit — add IG_ACCESS_TOKEN to .env)\n",
  );
});

server.on("error", (error) => {
  console.error("[server]", error.message);
  process.exitCode = 1;
});
