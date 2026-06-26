/**
 * hotkeys.js — Feature #1
 * Global keyboard shortcuts for playback control, scoped to avoid firing
 * while the user is typing in Spotify's own search/input fields.
 */

const SpotifyEnhancerHotkeys = (() => {
  let bindings = {};
  let enabled = true;

  function isTypingContext(e) {
    const tag = e.target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
  }

  function eventToKeyCode(e) {
    return e.code;
  }

  function handleKeydown(e) {
    if (!enabled || isTypingContext(e)) return;

    const code = eventToKeyCode(e);
    const action = Object.entries(bindings).find(([, key]) => key === code)?.[0];
    if (!action) return;

    e.preventDefault();

    switch (action) {
      case "playPause":
        SpotifyEnhancerDOM.get("playButton")?.click();
        break;
      case "next":
        SpotifyEnhancerDOM.get("nextButton")?.click();
        break;
      case "prev":
        SpotifyEnhancerDOM.get("prevButton")?.click();
        break;
      case "volumeUp":
      case "volumeDown": {
        const slider = SpotifyEnhancerDOM.get("volumeSlider");
        if (slider) {
          const input = slider.querySelector('input[type="range"]') || slider;
          const step = 5;
          const current = Number(input.value || input.getAttribute("aria-valuenow") || 50);
          const next = action === "volumeUp" ? Math.min(100, current + step) : Math.max(0, current - step);
          input.value = next;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        break;
      }
      case "toggleFullscreen":
        window.SpotifyEnhancerFullscreenView?.toggle();
        break;
      case "rateUp": {
        const track = SpotifyEnhancerDOM.getCurrentTrackInfo();
        if (track) window.SpotifyEnhancerRatings?.quickRate(track, 5);
        break;
      }
      case "addPlayLater": {
        const track = SpotifyEnhancerDOM.getCurrentTrackInfo();
        if (track) window.SpotifyEnhancerPlayLater?.add(track);
        break;
      }
    }
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("hotkeys");
    enabled = settings?.enabled ?? true;
    bindings = settings?.bindings || {};
    document.addEventListener("keydown", handleKeydown, true);

    SpotifyEnhancerStorage.onChange((changes) => {
      if (changes.settings) {
        const updated = changes.settings.newValue?.hotkeys;
        if (updated) {
          enabled = updated.enabled;
          bindings = updated.bindings;
        }
      }
    });
  }

  return { init };
})();

window.SpotifyEnhancerHotkeys = SpotifyEnhancerHotkeys;
