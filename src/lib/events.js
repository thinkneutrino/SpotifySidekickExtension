/**
 * events.js
 * A single MutationObserver watches the now-playing bar and emits one
 * "trackchange" event that every feature subscribes to, instead of each
 * feature running its own observer (which would be wasteful and risks
 * subtle race conditions between features).
 */

const SpotifyEnhancerEvents = (() => {
  const listeners = { trackchange: [], playstate: [] };
  let lastTrackId = null;
  let lastPlaying = null;

  function on(eventName, cb) {
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(cb);
    return () => {
      listeners[eventName] = listeners[eventName].filter((fn) => fn !== cb);
    };
  }

  function emit(eventName, payload) {
    (listeners[eventName] || []).forEach((cb) => {
      try { cb(payload); } catch (err) { console.error("[Spotify Sidekick] listener error", err); }
    });
  }

  function checkTrack() {
    const info = SpotifyEnhancerDOM.getCurrentTrackInfo();
    if (info && info.id !== lastTrackId) {
      lastTrackId = info.id;
      emit("trackchange", info);
    }
    const playBtn = SpotifyEnhancerDOM.get("playButton");
    if (playBtn) {
      const isPlaying = playBtn.getAttribute("aria-label")?.toLowerCase().includes("pause");
      if (isPlaying !== lastPlaying) {
        lastPlaying = isPlaying;
        emit("playstate", { playing: isPlaying });
      }
    }
  }

  async function init() {
    try {
      const bar = await SpotifyEnhancerDOM.waitFor("nowPlayingBar", { timeout: 20000 });
      checkTrack();
      SpotifyEnhancerDOM.observeMutations(bar, () => checkTrack());
      // Poll as a safety net: some attribute-only changes don't trigger childList mutations.
      setInterval(checkTrack, 1500);
    } catch (err) {
      console.warn("[Spotify Sidekick] now-playing bar not found, retrying", err);
      setTimeout(init, 3000);
    }
  }

  function getLastTrackId() {
    return lastTrackId;
  }

  init();

  return { on, emit, getLastTrackId };
})();

window.SpotifyEnhancerEvents = SpotifyEnhancerEvents;
