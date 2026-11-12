/* =========================================================
   TIPTOES GHANA — interactions + live Instagram feed
   ========================================================= */

(() => {
  "use strict";

  const WA_LINK = "https://wa.me/message/TRYATNHBXQCLL1";
  const WA_PHONE = "https://wa.me/233248132511";
  const IG_URL = "https://www.instagram.com/tiptoesghana/";
  const PRODUCT_CATEGORIES = ["Heels", "Bags", "Perfume", "Beauty", "Clothes"];
  const FEED_REFRESH_MS = 30_000;
  const INITIAL_FEED_COUNT = 8;

  const FALLBACK_FEED = {
    account: {
      username: "tiptoesghana",
      name: "Tiptoes Ghana",
      avatar: "assets/logo-mark.png",
      followers: 2045,
      url: IG_URL,
    },
    mode: "seed",
    updatedAt: "2026-11-12T12:00:00.000Z",
    posts: [
      {
        id: "seed-DfpHe63Mp4G",
        shortcode: "DfpHe63Mp4G",
        image: "assets/img/campaign-black-friday.webp",
        permalink: "https://www.instagram.com/p/DfpHe63Mp4G/",
        timestamp: "2026-11-12T08:00:00.000Z",
        caption: "BLACK FRIDAY + CHRISTMAS SHOPPING AT TIPTOESGHANA… PERFECT COMBI.",
        mediaType: "IMAGE",
        category: "Campaign",
        title: "Black Friday + Christmas",
      },
      {
        id: "seed-DfouATpDKRA",
        shortcode: "DfouATpDKRA",
        image: "assets/img/editorial-green-dress.webp",
        permalink: "https://www.instagram.com/p/DfouATpDKRA/",
        timestamp: "2026-11-12T07:00:00.000Z",
        caption: "New in from the Tiptoes edit.",
        mediaType: "IMAGE",
        category: "Clothes",
        title: "The green stripe midi",
      },
      {
        id: "seed-Dfoq11hjNMw",
        shortcode: "Dfoq11hjNMw",
        image: "assets/img/product-brown-mules.webp",
        permalink: "https://www.instagram.com/p/Dfoq11hjNMw/",
        timestamp: "2026-11-12T06:00:00.000Z",
        caption: "The brown mule. New drop.",
        mediaType: "IMAGE",
        category: "Heels",
        title: "The brown mule",
      },
      {
        id: "seed-DfoqzVFjNSS",
        shortcode: "DfoqzVFjNSS",
        image: "assets/img/product-clear-pumps.webp",
        permalink: "https://www.instagram.com/p/DfoqzVFjNSS/",
        timestamp: "2026-11-12T05:00:00.000Z",
        caption: "A clear favourite.",
        mediaType: "IMAGE",
        category: "Heels",
        title: "The clear pump",
      },
      {
        id: "seed-Dfoqvn4jLoY",
        shortcode: "Dfoqvn4jLoY",
        image: "assets/img/product-white-eyelet-dress.webp",
        permalink: "https://www.instagram.com/p/Dfoqvn4jLoY/",
        timestamp: "2026-11-12T04:00:00.000Z",
        caption: "White eyelet, forever.",
        mediaType: "IMAGE",
        category: "Clothes",
        title: "The eyelet dress",
      },
      {
        id: "seed-Dfn3ZLUjM_Y",
        shortcode: "Dfn3ZLUjM_Y",
        image: "assets/img/product-gold-strappy-heels.webp",
        permalink: "https://www.instagram.com/p/Dfn3ZLUjM_Y/",
        timestamp: "2026-11-11T15:00:00.000Z",
        caption: "These beautiful heels are available as seen. Size 36–42.",
        mediaType: "IMAGE",
        category: "Heels",
        title: "The strappy gold heel",
        sizes: "Sizes 36–42",
      },
      {
        id: "seed-DfkAbNLjMhs",
        shortcode: "DfkAbNLjMhs",
        image: "assets/img/product-pink-loafers.webp",
        permalink: "https://www.instagram.com/p/DfkAbNLjMhs/",
        timestamp: "2026-11-10T13:00:00.000Z",
        caption: "Soft pink loafers, hard to resist.",
        mediaType: "IMAGE",
        category: "Heels",
        title: "The pink loafer",
      },
      {
        id: "seed-DWofvyIjPdn",
        shortcode: "DWofvyIjPdn",
        image: "assets/img/product-black-tote.webp",
        permalink: "https://www.instagram.com/p/DWofvyIjPdn/",
        timestamp: "2026-11-04T12:00:00.000Z",
        caption: "The everyday tote.",
        mediaType: "IMAGE",
        category: "Bags",
        title: "The everyday tote",
        sizes: "One size",
      },
    ],
  };

  const state = {
    feed: null,
    posts: [],
    filter: "all",
    expanded: false,
    newIds: new Set(),
    loading: false,
    initialized: false,
    lastFetch: 0,
    refreshTimer: null,
    toastTimer: null,
    headerTimer: null,
    error: false,
    lastFocused: null,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[character];
    });
  }

  function safeImageUrl(value) {
    const url = String(value ?? "").trim();
    if (!url) return "";
    if (url.startsWith("assets/") || url.startsWith("./assets/") || url.startsWith("data:image/")) {
      return url;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function safePermalink(value) {
    try {
      const parsed = new URL(String(value ?? ""));
      if (parsed.protocol === "https:" && /(^|\.)instagram\.com$/i.test(parsed.hostname)) {
        return parsed.href;
      }
    } catch {
      /* ignore */
    }
    return IG_URL;
  }

  function extractShortcode(value) {
    const match = String(value ?? "").match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
    return match ? match[1] : "";
  }

  function cleanCaption(value) {
    return String(value ?? "")
      .replace(/#[\p{L}\p{N}_]+/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shortCaption(value, limit = 76) {
    const text = cleanCaption(value);
    if (!text) return "View on Instagram";
    return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
  }

  function titleFromCaption(value) {
    const text = cleanCaption(value);
    if (!text) return "New from Tiptoes";
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0].trim();
    return firstSentence.length > 62
      ? `${firstSentence.slice(0, 62).trim()}…`
      : firstSentence;
  }

  function categoryFor(value) {
    const text = String(value ?? "").toLowerCase();
    if (/\b(heel|heels|shoe|shoes|sandal|sandals|mule|mules|loafer|loafers|pump|pumps|sneaker|sneakers|boot|boots)\b/.test(text)) return "Heels";
    if (/\b(bag|bags|tote|purse|handbag|clutch)\b/.test(text)) return "Bags";
    if (/\b(perfume|perfumes|fragrance|parfum|musk|eau de)\b/.test(text)) return "Perfume";
    if (/\b(beauty|makeup|cosmetic|cosmetics|skincare|lipstick|foundation|serum|palette)\b/.test(text)) return "Beauty";
    if (/\b(dress|dresses|cloth|clothes|clothing|top|tops|jean|jeans|skirt|set|outfit|wear|shirt|blouse|trouser)\b/.test(text)) return "Clothes";
    return "New in";
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function timeAgo(value) {
    const then = new Date(value).getTime();
    if (!Number.isFinite(then)) return "just now";
    const difference = Math.max(0, Date.now() - then);
    const minutes = Math.floor(difference / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function normalizeFeed(payload) {
    const rawPosts = Array.isArray(payload?.posts) ? payload.posts : [];
    const posts = rawPosts
      .map((post, index) => {
        if (!post || typeof post !== "object") return null;
        const shortcode = post.shortcode || extractShortcode(post.permalink);
        const image = safeImageUrl(post.image || post.media_url || post.thumbnail_url);
        if (!image) return null;
        const caption = String(post.caption ?? "");
        const category = post.category && post.category !== "New in"
          ? post.category
          : categoryFor(caption);
        return {
          id: String(post.id || shortcode || `post-${index}`),
          shortcode,
          image,
          permalink: safePermalink(
            post.permalink || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : IG_URL),
          ),
          timestamp: post.timestamp || new Date().toISOString(),
          caption,
          mediaType: String(post.mediaType || post.media_type || "IMAGE").toUpperCase(),
          category,
          title: post.title || titleFromCaption(caption),
          sizes: String(post.sizes || ""),
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      account: {
        username: payload?.account?.username || "tiptoesghana",
        name: payload?.account?.name || "Tiptoes Ghana",
        avatar: payload?.account?.avatar || "assets/logo-mark.png",
        followers: Number(payload?.account?.followers) || 2045,
        url: safePermalink(payload?.account?.url || IG_URL),
      },
      mode: payload?.mode === "live" ? "live" : "seed",
      notice: String(payload?.notice || ""),
      updatedAt: payload?.updatedAt || new Date().toISOString(),
      posts,
    };
  }

  function attachImageFallbacks(root) {
    $$("img", root).forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          image.style.opacity = "0";
          image.closest(".product-card__media, .ig-card, figure")?.classList.add("is-broken");
        },
        { once: true },
      );
    });
  }

  /* ---------------------------------------------------------
     Product edit
     --------------------------------------------------------- */

  function productPosts() {
    return state.posts.filter((post) => PRODUCT_CATEGORIES.includes(post.category));
  }

  function renderProducts() {
    const grid = $("#product-grid");
    if (!grid) return;

    const posts = productPosts().filter(
      (post) => state.filter === "all" || post.category === state.filter,
    );

    if (!posts.length) {
      grid.innerHTML = `<p class="grid-empty">No pieces in this edit yet. Send us your wishlist on WhatsApp.</p>`;
      return;
    }

    grid.innerHTML = posts
      .map((post, index) => {
        const title = escapeHtml(post.title);
        const category = escapeHtml(post.category);
        const image = escapeHtml(post.image);
        const sizes = escapeHtml(post.sizes || "Available to preorder");
        const isNew = state.newIds.has(post.id);
        const badge = isNew ? "New in" : index < 4 ? "Just in" : "Preorder";
        const badgeClass = isNew ? " product-card__badge--lime" : "";

        return `
          <article class="product-card" data-category="${category}" data-id="${escapeHtml(post.id)}">
            <button class="product-card__media" type="button" data-post-id="${escapeHtml(post.id)}" aria-label="View ${title}">
              <img src="${image}" alt="${title}" loading="lazy" decoding="async" width="1080" height="1350">
              <span class="product-card__badge${badgeClass}">${badge}</span>
              <span class="product-card__quick" aria-hidden="true">
                Enquire
                <svg class="icon" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>
              </span>
            </button>
            <div class="product-card__info">
              <div>
                <p class="product-card__cat">${category}</p>
                <h3 class="product-card__name">${title}</h3>
                <p class="product-card__sizes">${sizes}</p>
              </div>
              <span class="product-card__arrow" aria-hidden="true">
                <svg class="icon" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>
              </span>
            </div>
          </article>`;
      })
      .join("");

    attachImageFallbacks(grid);
  }

  /* ---------------------------------------------------------
     Instagram grid
     --------------------------------------------------------- */

  function renderFeed() {
    const grid = $("#ig-grid");
    if (!grid) return;

    const posts = state.expanded
      ? state.posts
      : state.posts.slice(0, INITIAL_FEED_COUNT);

    if (!posts.length) {
      grid.innerHTML = `<p class="grid-empty">The feed is resting. Check back soon or follow @tiptoesghana on Instagram.</p>`;
      grid.setAttribute("aria-busy", "false");
      return;
    }

    grid.innerHTML = posts
      .map((post) => {
        const isNew = state.newIds.has(post.id);
        const title = escapeHtml(post.title);
        const image = escapeHtml(post.image);
        const caption = escapeHtml(shortCaption(post.caption));
        const type = post.mediaType === "VIDEO" ? "Reel" : "Post";

        return `
          <button class="ig-card${isNew ? " is-new" : ""}" type="button" data-post-id="${escapeHtml(post.id)}" aria-label="View ${title} on Instagram">
            <img src="${image}" alt="${title}" loading="lazy" decoding="async" width="1080" height="1080">
            ${isNew ? '<span class="ig-card__new">New</span>' : ""}
            <span class="ig-card__overlay">
              <span class="ig-card__top">
                <span class="ig-card__handle">@tiptoesghana</span>
                <span class="ig-card__icon">
                  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M17.5 6.5h.01"/>
                  </svg>
                </span>
              </span>
              <span class="ig-card__bottom">
                <span>${caption}</span>
                <span class="ig-card__type">${type}</span>
              </span>
            </span>
          </button>`;
      })
      .join("");

    grid.setAttribute("aria-busy", "false");
    attachImageFallbacks(grid);

    const showMore = $("#show-more-feed");
    if (showMore) {
      const canExpand = state.posts.length > INITIAL_FEED_COUNT;
      showMore.hidden = !canExpand;
      showMore.setAttribute("aria-expanded", String(state.expanded));
      showMore.innerHTML = state.expanded
        ? `Show fewer posts <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`
        : `Show more posts <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
    }
  }

  /* ---------------------------------------------------------
     Feed loading + live updates
     --------------------------------------------------------- */

  function updateFeedUI() {
    const feed = state.feed;
    if (!feed) return;

    const live = feed.mode === "live";
    const count = state.posts.length;
    const pill = $("#header-feed-pill");
    const label = $("#header-feed-label");
    const status = $("#feed-status");
    const updated = $("#feed-updated");

    if (pill) {
      pill.title = live
        ? "Live Instagram sync is on. The feed refreshes automatically."
        : "Showing the saved Instagram edit. Add a live sync token to pull new posts automatically.";
    }

    if (label && !state.headerTimer) {
      label.textContent = live ? "Live" : "IG feed";
    }

    if (status) {
      if (state.error) {
        status.textContent =
          "Couldn't reach the live feed just now. Showing the latest saved edit and retrying automatically.";
      } else if (live) {
        status.textContent =
          "Live from Instagram. New posts land here automatically — usually within a minute.";
      } else {
        status.textContent =
          "Showing the saved edit. Connect live sync and new posts will appear here automatically.";
      }
    }

    if (updated) {
      const modeLabel = live ? "Live" : "Saved";
      const stateLabel = state.error ? "Retrying" : `Updated ${timeAgo(feed.updatedAt)}`;
      updated.textContent = `${modeLabel} · ${stateLabel} · ${count} post${count === 1 ? "" : "s"} · auto-refresh 30s`;
    }
  }

  function announceNewPosts(posts) {
    if (!posts.length) return;

    const toast = $("#feed-toast");
    if (!toast) return;

    const message = posts.length === 1
      ? "A new post just landed."
      : `${posts.length} new posts just landed.`;

    toast.innerHTML = `
      <span class="live-dot" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
      <a href="#instagram">See it</a>`;
    toast.classList.add("is-visible");

    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 9000);

    const label = $("#header-feed-label");
    if (label) {
      label.textContent = posts.length === 1 ? "New post" : `${posts.length} new`;
      window.clearTimeout(state.headerTimer);
      state.headerTimer = window.setTimeout(() => {
        state.headerTimer = null;
        const live = state.feed?.mode === "live";
        label.textContent = live ? "Live" : "IG feed";
      }, 9000);
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        loadFeed();
      } else {
        scheduleRefresh();
      }
    }, FEED_REFRESH_MS);
  }

  async function loadFeed({ initial = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    state.lastFetch = Date.now();

    const previousIds = new Set(state.posts.map((post) => post.id));
    let payload = null;

    for (const endpoint of ["/api/instagram", "data/instagram.json"]) {
      try {
        const separator = endpoint.includes("?") ? "&" : "?";
        const response = await fetch(`${endpoint}${separator}_=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!json || !Array.isArray(json.posts) || !json.posts.length) {
          throw new Error("Empty feed");
        }
        payload = json;
        break;
      } catch {
        // Try the next endpoint.
      }
    }

    if (!payload) {
      if (!state.feed) {
        state.feed = normalizeFeed(FALLBACK_FEED);
        state.posts = state.feed.posts;
        state.error = true;
        state.initialized = true;
        renderProducts();
        renderFeed();
        updateFeedUI();
      } else {
        state.error = true;
        updateFeedUI();
      }
      state.loading = false;
      scheduleRefresh();
      return;
    }

    const feed = normalizeFeed(payload);
    if (!feed.posts.length) {
      state.loading = false;
      state.error = true;
      updateFeedUI();
      scheduleRefresh();
      return;
    }

    const newPosts = initial
      ? []
      : feed.posts.filter((post) => !previousIds.has(post.id));

    state.feed = feed;
    state.posts = feed.posts;
    state.error = false;
    state.initialized = true;

    if (newPosts.length) {
      newPosts.forEach((post) => state.newIds.add(post.id));
      announceNewPosts(newPosts);
    }

    renderProducts();
    renderFeed();
    updateFeedUI();

    state.loading = false;
    scheduleRefresh();
  }

  /* ---------------------------------------------------------
     Lightbox
     --------------------------------------------------------- */

  function openLightbox(post) {
    const lightbox = $("#lightbox");
    if (!lightbox) return;

    const image = $("#lightbox-image");
    const category = $("#lightbox-category");
    const title = $("#lightbox-title");
    const description = $("#lightbox-description");
    const meta = $("#lightbox-meta");
    const cta = $("#lightbox-cta");
    const ig = $("#lightbox-ig");

    if (image) {
      image.src = post.image;
      image.alt = post.title || cleanCaption(post.caption) || "A piece from the Tiptoes edit";
    }
    if (category) category.textContent = post.category || "The edit";
    if (title) title.textContent = post.title;
    if (description) {
      description.textContent =
        cleanCaption(post.caption) || "A piece from the latest Tiptoes edit.";
    }
    if (meta) {
      const parts = [
        post.sizes,
        formatDate(post.timestamp),
        "Preorder · 7–14 days",
      ].filter(Boolean);
      meta.textContent = parts.join(" · ");
    }
    if (cta) {
      const message = `Hi Tiptoes! I'd like to order "${post.title}". ${post.permalink}`;
      cta.href = `${WA_PHONE}?text=${encodeURIComponent(message)}`;
    }
    if (ig) ig.href = post.permalink;

    if (typeof lightbox.showModal === "function") {
      lightbox.showModal();
    } else {
      lightbox.setAttribute("open", "");
    }
    document.body.classList.add("no-scroll");
    window.requestAnimationFrame(() => {
      lightbox.querySelector(".lightbox__close")?.focus();
    });
  }

  function closeLightbox() {
    const lightbox = $("#lightbox");
    if (!lightbox) return;
    if (typeof lightbox.close === "function") {
      lightbox.close();
    } else {
      lightbox.removeAttribute("open");
    }
    document.body.classList.remove("no-scroll");
  }

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */

  function openMenu() {
    const menu = $("#mobile-menu");
    const toggle = $(".menu-toggle");
    if (!menu || !toggle) return;

    state.lastFocused = document.activeElement;
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    document.body.classList.add("no-scroll");
    window.setTimeout(() => menu.querySelector("a")?.focus(), 80);
  }

  function closeMenu({ restoreFocus = true } = {}) {
    const menu = $("#mobile-menu");
    const toggle = $(".menu-toggle");
    if (!menu || !toggle) return;

    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("no-scroll");

    if (restoreFocus && state.lastFocused instanceof HTMLElement) {
      state.lastFocused.focus();
    }
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */

  function init() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    const header = $("#site-header");
    const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Mobile menu
    const menu = $("#mobile-menu");
    const toggle = $(".menu-toggle");
    const closeButton = $(".mobile-menu__close");
    toggle?.addEventListener("click", () => {
      if (menu?.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    closeButton?.addEventListener("click", () => closeMenu());
    $$("#mobile-menu a").forEach((link) => {
      link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
    });

    // Keep keyboard focus inside the open menu.
    menu?.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = $$(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        menu,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu?.classList.contains("is-open")) {
        closeMenu();
      }
    });

    // Filters
    $$(".filter").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter || "all";
        state.filter = filter;
        $$(".filter").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderProducts();
      });
    });

    // Product grid interactions
    $("#product-grid")?.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-post-id]");
      if (!trigger) return;
      const post = state.posts.find((item) => item.id === trigger.dataset.postId);
      if (post) openLightbox(post);
    });

    // Instagram grid interactions
    $("#ig-grid")?.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-post-id]");
      if (!trigger) return;
      const post = state.posts.find((item) => item.id === trigger.dataset.postId);
      if (post) openLightbox(post);
    });

    // Show more / fewer
    $("#show-more-feed")?.addEventListener("click", () => {
      state.expanded = !state.expanded;
      renderFeed();
    });

    // Toast
    $("#feed-toast")?.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        event.currentTarget.classList.remove("is-visible");
        const firstNew = $(".ig-card.is-new");
        window.setTimeout(() => firstNew?.focus({ preventScroll: true }), 450);
      }
    });

    // Lightbox
    const lightbox = $("#lightbox");
    $(".lightbox__close")?.addEventListener("click", closeLightbox);
    lightbox?.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    lightbox?.addEventListener("close", () => {
      document.body.classList.remove("no-scroll");
    });

    // Accordion: one open at a time
    const details = $$(".accordion details");
    details.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        details.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });

    // Scroll reveal
    const revealElements = $$("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if ("IntersectionObserver" in window && !reducedMotion) {
      const observer = new IntersectionObserver(
        (entries, instance) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            instance.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );
      revealElements.forEach((element) => observer.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add("is-visible"));
    }

    // Scroll spy
    const navLinks = $$(".nav a");
    const sections = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);
    if ("IntersectionObserver" in window && sections.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) => {
              link.classList.toggle(
                "is-active",
                link.getAttribute("href") === `#${entry.target.id}`,
              );
            });
          });
        },
        { rootMargin: "-38% 0px -55% 0px", threshold: 0 },
      );
      sections.forEach((section) => spy.observe(section));
    }

    // Refresh immediately when the tab comes back or the network returns.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - state.lastFetch > 5_000) {
        loadFeed();
      }
    });
    window.addEventListener("focus", () => {
      if (Date.now() - state.lastFetch > 5_000) loadFeed();
    });
    window.addEventListener("online", () => loadFeed());

    // Load the feed.
    loadFeed({ initial: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
