/* =========================================================
   Refresh a long-lived Instagram access token
   ---------------------------------------------------------
   Long-lived tokens expire after about 60 days. Run this
   before expiry, then update the token on your host if it
   does not read .env directly.

     npm run refresh

   This uses the Instagram Login refresh flow. If you are
   using Facebook Login for Business, refresh the token in
   the Meta app dashboard instead.
   ========================================================= */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env");

try {
  process.loadEnvFile?.(ENV_FILE);
} catch {
  // Optional.
}

async function main() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Missing IG_ACCESS_TOKEN. Add it to .env or export it before running this script.",
    );
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Token refresh failed: ${detail}`);
  }

  const days = payload.expires_in
    ? Math.max(1, Math.round(payload.expires_in / 86_400))
    : null;

  try {
    let env = await readFile(ENV_FILE, "utf8");
    if (/^IG_ACCESS_TOKEN=/m.test(env)) {
      env = env.replace(/^IG_ACCESS_TOKEN=.*$/m, `IG_ACCESS_TOKEN=${payload.access_token}`);
    } else {
      env += `${env.endsWith("\n") ? "" : "\n"}IG_ACCESS_TOKEN=${payload.access_token}\n`;
    }
    await writeFile(ENV_FILE, env, "utf8");
    console.log(`[refresh] Updated IG_ACCESS_TOKEN in .env${days ? ` — valid for about ${days} days.` : "."}`);
  } catch {
    console.log("[refresh] Could not write .env. Copy this token into your environment:");
    console.log(payload.access_token);
    if (days) console.log(`[refresh] Valid for about ${days} days.`);
  }
}

main().catch((error) => {
  console.error(`[refresh] ${error.message}`);
  process.exitCode = 1;
});
