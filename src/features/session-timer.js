/**
 * session-timer.js — Feature #17
 * Tracks active listening time per day (only counts time while actually
 * playing, via the playstate event) and maintains a day-streak log.
 * This data also feeds the future stats dashboard.
 */

const SpotifyEnhancerSessionTimer = (() => {
  let badge = null;
  let isPlaying = false;
  let tickInterval = null;
  let todaySeconds = 0;

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  async function loadToday() {
    const log = await SpotifyEnhancerStorage.getData("sessionLog");
    todaySeconds = log[todayKey()] || 0;
  }

  async function persistTick() {
    const log = await SpotifyEnhancerStorage.getData("sessionLog");
    const key = todayKey();
    log[key] = (log[key] || 0) + 1;
    todaySeconds = log[key];
    await SpotifyEnhancerStorage.setData("sessionLog", log);

    const streaks = await SpotifyEnhancerStorage.getData("streakLog");
    if (!streaks[key]) {
      streaks[key] = true;
      await SpotifyEnhancerStorage.setData("streakLog", streaks);
    }
    updateBadge();
  }

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function updateBadge() {
    if (badge) badge.querySelector(".se-session__value").textContent = formatTime(todaySeconds);
  }

  function createBadge() {
    badge = document.createElement("div");
    badge.className = "se-session";
    SpotifyEnhancerDOM.setTooltip(badge, "Time listened today");
    badge.innerHTML = `<span class="se-session__icon">⏱</span><span class="se-session__value">0m</span> <span class="se-session__label">today</span>`;
    SpotifyEnhancerDOM.getDock().appendChild(badge);
  }

  function startTicking() {
    if (tickInterval) return;
    tickInterval = setInterval(() => { if (isPlaying) persistTick(); }, 1000);
  }

  async function getStreakLength() {
    const streaks = await SpotifyEnhancerStorage.getData("streakLog");
    let count = 0;
    let cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (streaks[key]) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("sessionTimer");
    if (!settings?.enabled) return;
    await loadToday();
    createBadge();
    updateBadge();
    startTicking();
    SpotifyEnhancerEvents.on("playstate", ({ playing }) => { isPlaying = playing; });
  }

  return { init, getStreakLength, getTodaySeconds: () => todaySeconds };
})();

window.SpotifyEnhancerSessionTimer = SpotifyEnhancerSessionTimer;
