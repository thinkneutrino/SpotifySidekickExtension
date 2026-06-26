/**
 * content.js
 * Orchestrates startup: waits for Spotify's player shell to exist, then
 * initializes every feature module. Each module independently checks its
 * own "enabled" flag, so this file's job is purely sequencing, not logic.
 */

(async function bootstrap() {
  try {
    await SpotifyEnhancerDOM.waitFor("nowPlayingBar", { timeout: 30000 });
  } catch {
    console.warn("[Spotify Sidekick] Player shell never appeared; aborting init.");
    return;
  }

  const featureModules = [
    SpotifyEnhancerHotkeys,
    SpotifyEnhancerSleepTimer,
    SpotifyEnhancerThemes,
    SpotifyEnhancerFocusMode,
    SpotifyEnhancerCustomCss,
    SpotifyEnhancerNowPlayingBar,
    SpotifyEnhancerFullscreenView,
    SpotifyEnhancerRatings,
    SpotifyEnhancerPlayLater,
    SpotifyEnhancerSessionTimer,
    SpotifyEnhancerAutoTheme,
    SpotifyEnhancerIdleDetect,
    SpotifyEnhancerMultiTabSync,
    SpotifyEnhancerContextSearch,
    SpotifyEnhancerAccessibility,
    SpotifyEnhancerCursorColor,
    SpotifyEnhancerWeeklyRecap
  ];

  for (const mod of featureModules) {
    try {
      await mod.init();
    } catch (err) {
      // One feature failing should never take down the rest.
      console.error("[Spotify Sidekick] feature failed to init:", mod, err);
    }
  }

  console.log("[Spotify Sidekick] All features initialized.");
})();
