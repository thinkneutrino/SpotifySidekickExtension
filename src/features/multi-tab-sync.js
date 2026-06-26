/**
 * multi-tab-sync.js — Feature #22
 * Warns when Spotify Web Player is open in more than one tab at once,
 * a common cause of "why did my music randomly switch/stutter" confusion.
 * Uses chrome.storage as a simple heartbeat channel across tabs (no server).
 */

const SpotifyEnhancerMultiTabSync = (() => {
  const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let heartbeatInterval = null;

  async function announce() {
    if (!SpotifyEnhancerStorage.isContextValid()) {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      return;
    }

    const stored = await SpotifyEnhancerStorage.safeCall(() => chrome.storage.local.get("openTabs"), null);
    if (stored === null) {
      // Context died on this call — stop the heartbeat instead of retrying forever.
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      return;
    }

    const tabs = stored.openTabs || {};
    tabs[TAB_ID] = Date.now();
    // Prune stale entries (tab closed without cleanup, e.g. crash).
    for (const id in tabs) {
      if (Date.now() - tabs[id] > 10000) delete tabs[id];
    }
    await SpotifyEnhancerStorage.safeCall(() => chrome.storage.local.set({ openTabs: tabs }), undefined);

    const otherActiveTabs = Object.keys(tabs).filter((id) => id !== TAB_ID).length;
    if (otherActiveTabs > 0) {
      showWarning(otherActiveTabs);
    } else {
      hideWarning();
    }
  }

  function showWarning(count) {
    let badge = document.getElementById("se-multitab-warning");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "se-multitab-warning";
      badge.className = "se-multitab-warning";
      document.body.appendChild(badge);
    }
    badge.textContent = `Spotify is also open in ${count} other tab${count > 1 ? "s" : ""}`;
  }

  function hideWarning() {
    document.getElementById("se-multitab-warning")?.remove();
  }

  function cleanup() {
    if (!SpotifyEnhancerStorage.isContextValid()) return;
    SpotifyEnhancerStorage.safeCall(async () => {
      const { openTabs } = await chrome.storage.local.get("openTabs");
      if (openTabs) {
        delete openTabs[TAB_ID];
        await chrome.storage.local.set({ openTabs });
      }
    }, undefined);
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("multiTabSync");
    if (!settings?.enabled) return;
    announce();
    heartbeatInterval = setInterval(announce, 4000);
    window.addEventListener("beforeunload", cleanup);
  }

  return { init };
})();

window.SpotifyEnhancerMultiTabSync = SpotifyEnhancerMultiTabSync;
