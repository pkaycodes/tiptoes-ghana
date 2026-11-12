/* =========================================================
   Shared Instagram helpers
   ---------------------------------------------------------
   Uses Meta's official Instagram API. No scraping, no login
   cookies, no third-party feed services.

   Supported setups:
   1. Instagram API with Instagram Login
      IG_ACCESS_TOKEN=...
   2. Instagram API with Facebook Login
      IG_ACCESS_TOKEN=...
      IG_USER_ID=...
   ========================================================= */

const DEFAULT_VERSION = process.env.IG_GRAPH_VERSION || "v23.0";
const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "username",
].join(",");

const PRODUCT_WORDS = {
  Heels: /\b(heel|heels|shoe|shoes|sandal|sandals|mule|mules|loafer|loafers|pump|pumps|sneaker|sneakers|boot|boots)\b/i,
  Bags: /\b(bag|bags|tote|purse|handbag|clutch)\b/i,
  Perfume: /\b(perfume|perfumes|fragrance|parfum|musk|eau de)\b/i,
  Beauty: /\b(beauty|makeup|cosmetic|cosmetics|skincare|lipstick|foundation|serum|palette)\b/i,
  Clothes: /\b(dress|dresses|cloth|clothes|clothing|top|tops|jean|jeans|skirt|set|outfit|wear|shirt|blouse|trouser)\b/i,
};

export function extractShortcode(value) {
  const match = String(value ?? "").match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : "";
}

export function cleanCaption(value) {
  return String(value ?? "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleFromCaption(value) {
  const text = cleanCaption(value);
  if (!text) return "New from Tiptoes";
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0].trim();
  return firstSentence.length > 62
    ? `${firstSentence.slice(0, 62).trim()}…`
    : firstSentence;
}

export function inferCategory(value) {
  const text = String(value ?? "");
  for (const [category, pattern] of Object.entries(PRODUCT_WORDS)) {
    if (pattern.test(text)) return category;
  }
  return "New in";
}

export function normalizePost(item) {
  if (!item || typeof item !== "object") return null;

  const mediaType = String(item.media_type || "IMAGE").toUpperCase();
  const image =
    mediaType === "VIDEO"
      ? item.thumbnail_url || item.media_url
      : item.media_url || item.thumbnail_url;

  if (!image) return null;

  const permalink = String(item.permalink || "");
  const shortcode = extractShortcode(permalink);
  const caption = String(item.caption || "");

  return {
    id: String(item.id || shortcode),
    shortcode,
    image: String(image),
    permalink:
      permalink ||
      (shortcode ? `https://www.instagram.com/p/${shortcode}/` : ""),
    timestamp: item.timestamp || new Date().toISOString(),
    caption,
    mediaType,
    category: inferCategory(caption),
    title: titleFromCaption(caption),
    sizes: "",
    username: item.username || "",
  };
}

function graphBase(hasUserId) {
  if (process.env.IG_GRAPH_HOST) {
    return process.env.IG_GRAPH_HOST.replace(/\/$/, "");
  }
  return hasUserId ? "https://graph.facebook.com" : "https://graph.instagram.com";
}

async function requestJson(url, label) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.error?.message || text.slice(0, 240) || "Unknown error";
    throw new Error(`${label} failed (${response.status}): ${detail}`);
  }

  if (payload?.error) {
    throw new Error(`${label} failed: ${payload.error.message || "Unknown error"}`);
  }

  return payload;
}

/**
 * Pull the latest media for the configured Instagram account.
 * Throws with a readable message when the token is missing or invalid.
 */
export async function fetchInstagramFeed({
  token = process.env.IG_ACCESS_TOKEN,
  userId = process.env.IG_USER_ID,
  version = DEFAULT_VERSION,
  limit = 30,
} = {}) {
  if (!token) {
    throw new Error(
      "Missing IG_ACCESS_TOKEN. Add it to .env (see .env.example) to enable live Instagram sync.",
    );
  }

  const hasUserId = Boolean(userId);
  const base = graphBase(hasUserId);
  const mediaEndpoint = hasUserId
    ? `${base}/${version}/${encodeURIComponent(userId)}/media`
    : `${base}/${version}/me/media`;

  const mediaUrl = new URL(mediaEndpoint);
  mediaUrl.searchParams.set("fields", MEDIA_FIELDS);
  mediaUrl.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
  mediaUrl.searchParams.set("access_token", token);

  const mediaPayload = await requestJson(mediaUrl, "Instagram media request");
  const posts = (mediaPayload?.data || []).map(normalizePost).filter(Boolean);

  if (!posts.length) {
    throw new Error("Instagram returned no media for this account.");
  }

  const profileEndpoint = hasUserId
    ? `${base}/${version}/${encodeURIComponent(userId)}`
    : `${base}/${version}/me`;
  const profileUrl = new URL(profileEndpoint);
  profileUrl.searchParams.set("fields", "username,followers_count,profile_picture_url");
  profileUrl.searchParams.set("access_token", token);

  let profile = null;
  try {
    profile = await requestJson(profileUrl, "Instagram profile request");
  } catch {
    // Profile permissions are optional. The media feed is the important part.
  }

  const username =
    profile?.username ||
    process.env.IG_USERNAME ||
    posts.find((post) => post.username)?.username ||
    "tiptoesghana";

  return {
    account: {
      username,
      name: "Tiptoes Ghana",
      avatar: "assets/logo-mark.png",
      followers: Number(profile?.followers_count) || 2045,
      url: `https://www.instagram.com/${username}/`,
    },
    mode: "live",
    source: "instagram-graph",
    updatedAt: new Date().toISOString(),
    posts,
  };
}
