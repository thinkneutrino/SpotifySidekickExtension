/**
 * fullscreen-view.js — Feature #12
 * A full-viewport "now playing" overlay with large album art, for when
 * music is the only thing that should be on screen.
 */

const SpotifyEnhancerFullscreenView = (() => {
  let overlay = null;

  function render(track) {
    if (!overlay) return;
    overlay.querySelector(".se-fs__art").style.backgroundImage = track?.coverUrl ? `url(${track.coverUrl})` : "none";
    overlay.querySelector(".se-fs__title").textContent = track?.name || "Nothing playing";
    overlay.querySelector(".se-fs__artist").textContent = track?.artist || "";
  }

  function syncPlayIcon() {
    const playBtn = SpotifyEnhancerDOM.get("playButton");
    const isPlaying = playBtn?.getAttribute("aria-label")?.toLowerCase().includes("pause");
    const btn = overlay?.querySelector(".se-fs__playpause");
    if (btn) btn.textContent = isPlaying ? "⏸" : "▶";
  }

  function create() {
    overlay = document.createElement("div");
    overlay.className = "se-fs";
    overlay.innerHTML = `
      <button class="se-fs__exit" aria-label="Exit fullscreen view" data-se-tooltip="Exit (Esc)">×</button>
      <div class="se-fs__art"></div>
      <div class="se-fs__title"></div>
      <div class="se-fs__artist"></div>
      <div class="se-fs__controls">
        <button class="se-fs__prev" aria-label="Previous" data-se-tooltip="Previous">⏮</button>
        <button class="se-fs__playpause" aria-label="Play/Pause" data-se-tooltip="Play/Pause">▶</button>
        <button class="se-fs__next" aria-label="Next" data-se-tooltip="Next">⏭</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".se-fs__exit").addEventListener("click", hide);
    overlay.querySelector(".se-fs__prev").addEventListener("click", () => SpotifyEnhancerDOM.get("prevButton")?.click());
    overlay.querySelector(".se-fs__next").addEventListener("click", () => SpotifyEnhancerDOM.get("nextButton")?.click());
    overlay.querySelector(".se-fs__playpause").addEventListener("click", () => {
      SpotifyEnhancerDOM.get("playButton")?.click();
      setTimeout(syncPlayIcon, 150);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("se-fs--visible")) hide();
    });

    SpotifyEnhancerEvents.on("trackchange", render);
    SpotifyEnhancerEvents.on("playstate", syncPlayIcon);
  }

  function show() {
    if (!overlay) create();
    render(SpotifyEnhancerDOM.getCurrentTrackInfo());
    syncPlayIcon();
    overlay.classList.add("se-fs--visible");
  }

  function hide() {
    overlay?.classList.remove("se-fs--visible");
  }

  function toggle() {
    if (overlay?.classList.contains("se-fs--visible")) hide();
    else show();
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("fullscreenView");
    if (!settings?.enabled) return;
  }

  return { init, show, hide, toggle };
})();

window.SpotifyEnhancerFullscreenView = SpotifyEnhancerFullscreenView;
