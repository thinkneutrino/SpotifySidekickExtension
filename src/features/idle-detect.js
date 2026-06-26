/**
 * idle-detect.js — Feature #21
 * Auto-pauses playback if the user has been inactive (no mouse/keyboard/scroll)
 * in this tab for a configured number of minutes — handy for falling asleep
 * to music without an arbitrary fixed sleep timer.
 */

const SpotifyEnhancerIdleDetect = (() => {
  let lastActivity = Date.now();
  let checkInterval = null;
  let thresholdMs = 20 * 60 * 1000;

  function markActive() {
    lastActivity = Date.now();
  }

  function checkIdle() {
    const idleFor = Date.now() - lastActivity;
    if (idleFor >= thresholdMs) {
      const playBtn = SpotifyEnhancerDOM.get("playButton");
      const isPlaying = playBtn?.getAttribute("aria-label")?.toLowerCase().includes("pause");
      if (isPlaying) {
        playBtn.click();
        SpotifyEnhancerDOM.toast("Paused — no activity detected");
      }
      lastActivity = Date.now(); // avoid immediately re-triggering
    }
  }

  function attachListeners() {
    ["mousemove", "keydown", "scroll", "click"].forEach((evt) =>
      document.addEventListener(evt, markActive, { passive: true })
    );
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("idleDetect");
    if (!settings?.enabled) return;
    thresholdMs = (settings.minutes || 20) * 60 * 1000;
    attachListeners();
    checkInterval = setInterval(checkIdle, 30000);
  }

  return { init };
})();

window.SpotifyEnhancerIdleDetect = SpotifyEnhancerIdleDetect;
