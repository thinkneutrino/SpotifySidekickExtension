/**
 * now-playing-bar.js — Feature #11
 * Adjusts the height of the now-playing bar via CSS, since Spotify only
 * ships one fixed size.
 *
 * This used to also support relocating the bar to the top of the page,
 * but that consistently collided with Spotify's own top navigation bar
 * (search field, Explore Premium, etc.) since there's no reliably
 * confirmed selector/height for that element to offset against — so the
 * top-position option was removed rather than keep shipping a feature
 * that visibly breaks the layout. Bottom-docked is the only supported
 * position now.
 */

const SpotifyEnhancerNowPlayingBar = (() => {
  const HEIGHTS = { compact: "64px", normal: "90px", large: "120px" };
  let styleEl = null;

  function ensureStyle() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "se-bar-style";
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  function apply({ height }) {
    const el = ensureStyle();
    const h = HEIGHTS[height] || HEIGHTS.normal;
    document.documentElement.style.setProperty("--se-bar-height", h);
    el.textContent = `[data-testid="now-playing-bar"] { height: ${h} !important; }`;
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("nowPlayingBar");
    if (!settings?.enabled) {
      // Even if the user disabled bar resizing, the dock still needs a
      // sane default offset to anchor against.
      document.documentElement.style.setProperty("--se-bar-height", HEIGHTS.normal);
      return;
    }
    apply(settings);

    SpotifyEnhancerStorage.onChange((changes) => {
      const updated = changes.settings?.newValue?.nowPlayingBar;
      if (updated) apply(updated);
    });
  }

  return { init, apply };
})();

window.SpotifyEnhancerNowPlayingBar = SpotifyEnhancerNowPlayingBar;

