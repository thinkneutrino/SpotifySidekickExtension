/**
 * themes.js — Feature #6
 * Re-skins Spotify's web player.
 *
 * IMPORTANT: --spice-* variables are a Spicetify convention (Spicetify
 * parses Spotify's desktop client bundle and writes that variable layer
 * itself). The stock open.spotify.com web player does NOT expose those
 * variables, so overriding them does nothing. Instead we target Spotify's
 * actual layout containers directly via their stable data-testid hooks,
 * with !important, which is the same resilient strategy the rest of this
 * extension uses.
 */

const SpotifyEnhancerThemes = (() => {
  const PRESETS = {
    default: null, // no overrides — Spotify's own theme
    midnight: { bg: "#0b0e1a", surface: "#141a2e", text: "#e4e8ff", subtext: "#8890b5", accent: "#6c7bff" },
    sunset: { bg: "#1a0f14", surface: "#2b1620", text: "#ffe8d6", subtext: "#d99a7a", accent: "#ff7a59" },
    forest: { bg: "#0e1a13", surface: "#16261c", text: "#e3f5e8", subtext: "#88b89a", accent: "#3ddc84" },
    mono: { bg: "#0a0a0a", surface: "#181818", text: "#f5f5f5", subtext: "#a0a0a0", accent: "#ffffff" }
  };

  const FONT_STACKS = {
    default: null,
    system: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    serif: `"Georgia", "Times New Roman", serif`,
    mono: `"JetBrains Mono", "Fira Code", monospace`,
    rounded: `"Quicksand", "Comfortaa", sans-serif`
  };

  // Containers that make up Spotify's main chrome, targeted directly since
  // the web player has no public CSS variable API for theming.
  const SURFACE_SELECTORS = [
    '[data-testid="Root__nav-bar"]',
    '[data-testid="Root__top-container"]',
    '[data-testid="now-playing-bar"]',
    '[data-testid="Root__right-sidebar"]'
  ].join(", ");

  const MAIN_BG_SELECTORS = [
    '[data-testid="Root__main-view"]',
    "#main",
    'main[role="main"]'
  ].join(", ");

  const TEXT_SELECTORS = [
    '[data-testid="now-playing-bar"] *',
    '[data-testid="Root__nav-bar"] *'
  ].join(", ");

  let styleEl = null;

  function ensureStyleEl() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "se-theme-style";
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  function buildCss(colors) {
    if (!colors) return "";
    return `
      ${MAIN_BG_SELECTORS} { background-color: ${colors.bg} !important; }
      ${SURFACE_SELECTORS} { background-color: ${colors.surface} !important; }
      body, ${MAIN_BG_SELECTORS}, ${SURFACE_SELECTORS} { color: ${colors.text} !important; }
      [data-testid="context-item-info-subtitles"],
      [data-testid="context-item-info-artist"],
      .se-dock { color: ${colors.subtext} !important; }
      [data-testid="control-button-playpause"] {
        background-color: ${colors.accent} !important;
        border-color: ${colors.accent} !important;
      }
      [data-testid="progress-bar"] [data-testid="progress-bar-handle"],
      input[type="range"] { accent-color: ${colors.accent} !important; }
      a:hover, a:focus { color: ${colors.accent} !important; }
      .se-dock { background: ${colors.surface} !important; border-color: rgba(255,255,255,0.08) !important; }
    `;
  }

  function applyPreset(presetName, customColors) {
    const colors = presetName === "custom" ? customColors : PRESETS[presetName];
    const el = ensureStyleEl();
    el.textContent = buildCss(colors);
  }

  function applyFont(fontKey) {
    let fontEl = document.getElementById("se-font-style");
    if (!fontEl) {
      fontEl = document.createElement("style");
      fontEl.id = "se-font-style";
      document.head.appendChild(fontEl);
    }
    const stack = FONT_STACKS[fontKey];
    fontEl.textContent = stack ? `body, button, input, ${TEXT_SELECTORS} { font-family: ${stack} !important; }` : "";
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("theme");
    if (!settings?.enabled) return;
    applyPreset(settings.preset, settings.customColors);
    if (settings.font) applyFont(settings.font);

    SpotifyEnhancerStorage.onChange((changes) => {
      const theme = changes.settings?.newValue?.theme;
      if (theme) {
        applyPreset(theme.preset, theme.customColors);
        if (theme.font) applyFont(theme.font);
      }
    });
  }

  return { init, applyPreset, applyFont, PRESETS, FONT_STACKS };
})();

window.SpotifyEnhancerThemes = SpotifyEnhancerThemes;
