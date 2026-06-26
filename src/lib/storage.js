/**
 * storage.js
 * Thin wrapper around chrome.storage.local so every feature reads/writes
 * through one consistent API. Everything lives in the browser; nothing
 * is ever sent to a server.
 *
 * Namespacing convention:
 *   settings.*   -> feature on/off + config (popup & options page)
 *   data.*       -> user-generated content (ratings, tags, queue, etc.)
 */

const SpotifyEnhancerStorage = (() => {
  // "Extension context invalidated" fires when the extension is reloaded
  // (manually via chrome://extensions, or an auto-update) while this
  // content script is still alive in an already-open tab — the script's
  // connection to the now-restarted extension is dead, so every further
  // chrome.* call throws this same error forever until the page reloads.
  // We detect it once and stop trying, rather than let every interval in
  // every feature keep erroring into the console indefinitely.
  let contextInvalidated = false;

  function isContextInvalidatedError(err) {
    return typeof err?.message === "string" && err.message.includes("Extension context invalidated");
  }

  function isContextValid() {
    return !contextInvalidated;
  }

  /** Wraps a chrome.storage call so a context-invalidation error is caught
   *  once, flips the shared flag, and resolves to a safe fallback instead
   *  of rejecting — every caller below goes through this. */
  async function safeCall(fn, fallback) {
    if (contextInvalidated) return fallback;
    try {
      return await fn();
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        contextInvalidated = true;
        console.warn("[Spotify Sidekick] Extension was reloaded — this tab needs a refresh for it to keep working. Storage calls will stop until then.");
        return fallback;
      }
      throw err;
    }
  }

  const DEFAULTS = {
    settings: {
      hotkeys: { enabled: true, bindings: {
        playPause: "Space",
        next: "ArrowRight",
        prev: "ArrowLeft",
        volumeUp: "ArrowUp",
        volumeDown: "ArrowDown",
        toggleFullscreen: "KeyF",
        rateUp: "Digit1",
        addPlayLater: "KeyL"
      }},
      sleepTimer: { enabled: true },
      theme: { enabled: true, preset: "midnight", customColors: null },
      focusMode: { enabled: true, active: false },
      customCss: { enabled: true, css: "" },
      nowPlayingBar: { enabled: true, height: "normal" },
      fullscreenView: { enabled: true },
      ratings: { enabled: true },
      playLater: { enabled: true },
      sessionTimer: { enabled: true },
      autoTheme: { enabled: false, lightStart: "07:00", darkStart: "19:00" },
      idleDetect: { enabled: false, minutes: 20 },
      multiTabSync: { enabled: true },
      contextSearch: { enabled: true, services: ["genius", "youtube"] },
      accessibility: { enabled: false, highContrast: false, largeTargets: false, reducedMotion: false },
      cursorColor: { enabled: false, color: "#5ee3a8" },
      weeklyRecap: { enabled: true }
    },
    data: {
      ratings: {},       // trackId -> { stars: 1-5, note: string, updatedAt }
      playLater: [],       // [{ trackId, name, artist, addedAt }]
      sessionLog: {},      // "YYYY-MM-DD" -> seconds listened
      streakLog: {},        // "YYYY-MM-DD" -> true
      // "YYYY-Www" (ISO week, Monday start) -> { seconds, plays, artists: { name -> count }, tracks: { trackId -> { name, artist, count } } }
      weeklyLog: {}
    }
  };

  function deepMerge(base, override) {
    const out = { ...base };
    for (const key in override) {
      if (override[key] && typeof override[key] === "object" && !Array.isArray(override[key])) {
        out[key] = deepMerge(base[key] || {}, override[key]);
      } else {
        out[key] = override[key];
      }
    }
    return out;
  }

  async function getAll() {
    const stored = await safeCall(() => chrome.storage.local.get(["settings", "data"]), {});
    return {
      settings: deepMerge(DEFAULTS.settings, stored.settings || {}),
      data: deepMerge(DEFAULTS.data, stored.data || {})
    };
  }

  async function getSetting(path) {
    const { settings } = await getAll();
    return path.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), settings);
  }

  async function setSetting(path, value) {
    const { settings } = await getAll();
    const keys = path.split(".");
    let cursor = settings;
    for (let i = 0; i < keys.length - 1; i++) {
      cursor[keys[i]] = cursor[keys[i]] || {};
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
    await safeCall(() => chrome.storage.local.set({ settings }), undefined);
    await safeCall(() => chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED", path, value }), undefined);
    return settings;
  }

  async function getData(key) {
    const { data } = await getAll();
    return data[key];
  }

  async function setData(key, value) {
    const { data } = await getAll();
    data[key] = value;
    await safeCall(() => chrome.storage.local.set({ data }), undefined);
    return data;
  }

  function onChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") callback(changes);
      });
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        contextInvalidated = true;
      } else {
        throw err;
      }
    }
  }

  return { DEFAULTS, getAll, getSetting, setSetting, getData, setData, onChange, isContextValid, safeCall, isContextInvalidatedError };
})();

// Expose for content scripts (classic scripts share global scope in MV3 content script bundles)
window.SpotifyEnhancerStorage = SpotifyEnhancerStorage;
