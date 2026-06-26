/**
 * accessibility.js — Features #24, #25, plus screen-reader support
 * Bundles high-contrast mode, larger click targets, reduced motion,
 * and supplemental aria-labels for elements Spotify under-labels.
 */

const SpotifyEnhancerAccessibility = (() => {
  let styleEl = null;

  const HIGH_CONTRAST_CSS = `
    .se-a11y-high-contrast { filter: contrast(1.35) saturate(1.1) !important; }
    .se-a11y-high-contrast [data-testid="now-playing-bar"] button {
      outline: 1px solid rgba(255,255,255,0.4) !important;
    }
  `;
  const LARGE_TARGETS_CSS = `
    .se-a11y-large-targets [data-testid="now-playing-bar"] button,
    .se-a11y-large-targets [data-testid="control-button-playpause"] {
      min-width: 44px !important;
      min-height: 44px !important;
      padding: 8px !important;
    }
    .se-a11y-large-targets [data-testid="tracklist-row"] {
      min-height: 56px !important;
    }
  `;
  const REDUCED_MOTION_CSS = `
    .se-a11y-reduced-motion * {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  `;

  function ensureStyle() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "se-a11y-style";
      styleEl.textContent = HIGH_CONTRAST_CSS + LARGE_TARGETS_CSS + REDUCED_MOTION_CSS;
      document.head.appendChild(styleEl);
    }
  }

  function apply(settings) {
    ensureStyle();
    document.body.classList.toggle("se-a11y-high-contrast", !!settings.highContrast);
    document.body.classList.toggle("se-a11y-large-targets", !!settings.largeTargets);
    document.body.classList.toggle("se-a11y-reduced-motion", !!settings.reducedMotion);
  }

  function patchMissingLabels() {
    // Spotify occasionally ships icon-only buttons without aria-label in certain views;
    // this is a best-effort patch, not a guarantee, and degrades silently.
    const candidates = SpotifyEnhancerDOM.$all("button:not([aria-label])");
    candidates.forEach((btn) => {
      const svgTitle = btn.querySelector("svg title")?.textContent;
      if (svgTitle) btn.setAttribute("aria-label", svgTitle);
    });
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("accessibility");
    if (!settings?.enabled) return;
    apply(settings);
    patchMissingLabels();
    SpotifyEnhancerDOM.observeMutations(document.body, patchMissingLabels, { childList: true, subtree: true });

    SpotifyEnhancerStorage.onChange((changes) => {
      const updated = changes.settings?.newValue?.accessibility;
      if (updated) apply(updated);
    });
  }

  return { init, apply };
})();

window.SpotifyEnhancerAccessibility = SpotifyEnhancerAccessibility;
