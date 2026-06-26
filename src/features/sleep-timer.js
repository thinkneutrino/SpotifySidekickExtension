/**
 * sleep-timer.js — Feature #2
 * Pauses playback after a chosen duration, with a small floating badge
 * showing time remaining and a one-click cancel.
 */

const SpotifyEnhancerSleepTimer = (() => {
  let timeoutId = null;
  let intervalId = null;
  let endTime = null;
  let badge = null;

  function removeBadge() {
    badge?.remove();
    badge = null;
  }

  function renderBadge() {
    removeBadge();
    badge = document.createElement("div");
    badge.className = "se-sleep-badge";
    badge.innerHTML = `<span class="se-sleep-badge__time"></span><button class="se-sleep-badge__cancel" aria-label="Cancel sleep timer" data-se-tooltip="Cancel sleep timer">×</button>`;
    document.body.appendChild(badge);
    badge.querySelector(".se-sleep-badge__cancel").addEventListener("click", cancel);
    updateBadge();
  }

  function updateBadge() {
    if (!badge || !endTime) return;
    const remainingMs = endTime - Date.now();
    if (remainingMs <= 0) return;
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    badge.querySelector(".se-sleep-badge__time").textContent = `${mins}:${String(secs).padStart(2, "0")} until pause`;
  }

  function start(minutes) {
    cancel();
    endTime = Date.now() + minutes * 60000;
    renderBadge();
    intervalId = setInterval(updateBadge, 1000);
    timeoutId = setTimeout(() => {
      const playBtn = SpotifyEnhancerDOM.get("playButton");
      if (playBtn && playBtn.getAttribute("aria-label")?.toLowerCase().includes("pause")) {
        playBtn.click();
      }
      SpotifyEnhancerDOM.toast("Sleep timer: playback paused");
      cancel();
    }, minutes * 60000);
  }

  function cancel() {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
    endTime = null;
    removeBadge();
  }

  function isActive() {
    return !!endTime;
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("sleepTimer");
    if (!settings?.enabled) return;
  }

  return { init, start, cancel, isActive };
})();

window.SpotifyEnhancerSleepTimer = SpotifyEnhancerSleepTimer;
