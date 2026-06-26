/**
 * context-search.js — Feature #23
 * Spotify intercepts right-clicks on track rows and the now-playing bar
 * with its own native context menu (a Tippy.js popper portaled to the end
 * of <body>, not nested inside the row you clicked), so a separate
 * competing contextmenu listener never had a chance to show. Instead we
 * watch for Spotify's own menu appearing and inject matching <li> items
 * directly into it, right after "Share", styled identically to Spotify's
 * existing items so they're indistinguishable from native entries.
 */

const SpotifyEnhancerContextSearch = (() => {
  const SERVICE_URLS = {
    genius: (q) => `https://genius.com/search?q=${encodeURIComponent(q)}`,
    youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  };
  const SERVICE_LABELS = { genius: "Search on Genius", youtube: "Search on YouTube" };

  let enabledServices = [];
  let lastRightClickedTrack = null;
  let menuObserver = null;

  /** Spotify's menu items are localized, so matching on text is the most
   *  reliable approach (class names are build-hashed and unstable) — we
   *  scan all menu item label spans for the literal text "Share". */
  function findShareListItem(menuEl) {
    const items = menuEl.querySelectorAll('li[role="presentation"]');
    for (const li of items) {
      const label = li.querySelector("span")?.textContent?.trim();
      if (label === "Share") return li;
    }
    return null;
  }

  /** Builds a Spotify-style <li><button> menu item matching their markup
   *  structure (icon + text) so it renders consistently with native items. */
  function buildMenuItem(label, svgPath, onClick) {
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    li.className = "se-ctx-item";
    li.innerHTML = `
      <button role="menuitem" tabindex="-1" class="se-ctx-item__button">
        <svg viewBox="0 0 16 16" class="se-ctx-item__icon" aria-hidden="true">${svgPath}</svg>
        <span class="se-ctx-item__label">${label}</span>
      </button>
    `;
    li.querySelector("button").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
      // Close Spotify's menu the conventional way overlay libraries (Tippy,
      // and the React menu built on top of it) listen for, rather than
      // simulating a body click which could trigger unrelated handlers.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    });
    return li;
  }

  const ICONS = {
    search: `<path d="M7.25 1a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5M0 7.25a7.25 7.25 0 1 1 13.06 4.39l2.65 2.65a.75.75 0 1 1-1.06 1.06l-2.65-2.65A7.25 7.25 0 0 1 0 7.25" fill="currentColor"></path>`,
    copy: `<path d="M2 2v9.5h1.5V3.5h8V2zm3 3v9h9V5zm1.5 1.5h6v6h-6z" fill="currentColor"></path>`
  };

  function getTrackContext() {
    // Prefer whatever row/track the right-click handler captured just before
    // Spotify opened its menu; this is the most reliable source since the
    // menu itself is portaled away from the row and carries no track data.
    if (lastRightClickedTrack) return lastRightClickedTrack;
    // Fallback: assume the menu refers to the currently playing track.
    return SpotifyEnhancerDOM.getCurrentTrackInfo();
  }

  function injectItems(menuEl) {
    if (menuEl.querySelector(".se-ctx-item")) return; // already injected for this open
    const shareLi = findShareListItem(menuEl);
    if (!shareLi) return;

    const ctx = getTrackContext();
    if (!ctx?.name) return;

    const itemsToInsert = [];

    enabledServices.forEach((service) => {
      itemsToInsert.push(
        buildMenuItem(`${SERVICE_LABELS[service]}`, ICONS.search, () => {
          window.open(SERVICE_URLS[service](`${ctx.name} ${ctx.artist || ""}`.trim()), "_blank", "noopener");
        })
      );
    });

    itemsToInsert.push(
      buildMenuItem("Copy song name and artist", ICONS.copy, () => {
        const text = ctx.artist ? `${ctx.name} by ${ctx.artist}` : ctx.name;
        navigator.clipboard.writeText(text).then(
          () => SpotifyEnhancerDOM.toast(`Copied: ${text}`),
          () => SpotifyEnhancerDOM.toast("Couldn't copy — clipboard permission blocked")
        );
      })
    );

    // Insert right after Share, in order, so reading top-to-bottom gives
    // Share, [our search engines], Copy song name and artist, then whatever
    // Spotify had next (the divider + "Open in Desktop app").
    let anchor = shareLi;
    itemsToInsert.forEach((li) => {
      anchor.after(li);
      anchor = li;
    });
  }

  function watchForSpotifyMenu() {
    menuObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const menuEl = node.querySelector?.('[data-testid="context-menu"]') || (node.matches?.('[data-testid="context-menu"]') ? node : null);
          if (menuEl) {
            // Spotify finishes building the menu's contents in the same tick
            // it's added, but give it a beat in case items render async.
            requestAnimationFrame(() => injectItems(menuEl));
          }
        }
      }
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });
  }

  /** Captures which track a right-click was on, just before Spotify's own
   *  menu opens, since the menu itself is portaled away from that context. */
  function captureRightClickTarget(e) {
    const row = e.target.closest('[data-testid="tracklist-row"]');
    if (row) {
      const artistLink = row.querySelector('a[href^="/artist/"]');
      const trackLink = row.querySelector('a[href^="/track/"]');
      if (trackLink) {
        lastRightClickedTrack = { name: trackLink.textContent, artist: artistLink?.textContent || "" };
        return;
      }
    }
    const widget = e.target.closest('[data-testid="now-playing-widget"]');
    if (widget) {
      lastRightClickedTrack = SpotifyEnhancerDOM.getCurrentTrackInfo();
      return;
    }
    // Right-click happened somewhere we don't recognize; fall back to the
    // currently playing track rather than stale data from a previous click.
    lastRightClickedTrack = null;
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("contextSearch");
    if (!settings?.enabled) return;
    enabledServices = settings.services || ["genius", "youtube"];
    document.addEventListener("contextmenu", captureRightClickTarget, true);
    watchForSpotifyMenu();

    SpotifyEnhancerStorage.onChange((changes) => {
      const updated = changes.settings?.newValue?.contextSearch;
      if (updated) enabledServices = updated.services || enabledServices;
    });
  }

  return { init };
})();

window.SpotifyEnhancerContextSearch = SpotifyEnhancerContextSearch;
