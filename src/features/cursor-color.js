/**
 * cursor-color.js — Feature #26
 * Lets the person recolor their mouse cursor while on Spotify. Native CSS
 * `cursor` has no color property — the only way to get an arbitrary color
 * is swapping in a custom cursor image via `cursor: url(...)`. We generate
 * a small arrow-shaped SVG in the chosen color at runtime and inject it as
 * a data URI, rather than shipping a fixed set of pre-rendered images.
 *
 * Off by default: a custom cursor is a fairly intrusive, easy-to-notice
 * change to make unasked-for, so this only activates if explicitly turned
 * on and a color is chosen.
 */

const SpotifyEnhancerCursorColor = (() => {
  let styleEl = null;

  function ensureStyle() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "se-cursor-style";
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  /** Builds a simple arrow-pointer SVG in the given color and returns it
   *  as a data URI usable directly in a CSS `cursor` value. The shape
   *  roughly matches a standard OS pointer so it doesn't feel alien, just
   *  recolored. Hotspot (the two trailing numbers in the cursor value) is
   *  set to the tip of the arrow (1,1) so clicks land where expected. */
  function buildCursorDataUri(hexColor) {
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : "#5ee3a8";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M2 1 L2 19 L7 15 L10 22 L13 21 L10 14 L17 14 Z" fill="${safeColor}" stroke="black" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`;
    const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
    return `data:image/svg+xml,${encoded}`;
  }

  function apply(color) {
    const el = ensureStyle();
    const uri = buildCursorDataUri(color);
    // Apply broadly so it's not limited to body's own background, but
    // skip text inputs/textareas so typing still shows a normal text
    // caret cursor rather than a misleading arrow over editable fields.
    el.textContent = `
      * { cursor: url("${uri}") 1 1, auto !important; }
      input, textarea, [contenteditable="true"] { cursor: text !important; }
      button, a, [role="button"] { cursor: url("${uri}") 1 1, pointer !important; }
    `;
  }

  function remove() {
    styleEl?.remove();
    styleEl = null;
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("cursorColor");
    if (!settings?.enabled || !settings.color) return;
    apply(settings.color);

    SpotifyEnhancerStorage.onChange((changes) => {
      const updated = changes.settings?.newValue?.cursorColor;
      if (!updated) return;
      if (updated.enabled && updated.color) apply(updated.color);
      else remove();
    });
  }

  return { init, apply, remove };
})();

window.SpotifyEnhancerCursorColor = SpotifyEnhancerCursorColor;
