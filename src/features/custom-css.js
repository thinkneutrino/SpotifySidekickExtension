/**
 * custom-css.js — Feature #10
 * Free-form CSS injection for advanced users, applied after all other
 * style features so it always has the final say. Sandboxed to a single
 * <style> tag; no eval, no script execution, just CSS text.
 */

const SpotifyEnhancerCustomCss = (() => {
  let styleEl = null;

  function ensureStyle() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "se-custom-css";
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  function apply(css) {
    const el = ensureStyle();
    el.textContent = css || "";
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("customCss");
    if (!settings?.enabled) return;
    apply(settings.css);

    SpotifyEnhancerStorage.onChange((changes) => {
      const updated = changes.settings?.newValue?.customCss;
      if (updated) apply(updated.css);
    });
  }

  return { init, apply };
})();

window.SpotifyEnhancerCustomCss = SpotifyEnhancerCustomCss;
