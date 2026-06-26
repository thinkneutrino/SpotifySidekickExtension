/**
 * auto-theme.js — Feature #19
 * Automatically switches between a light-leaning and dark-leaning preset
 * based on time of day. Spotify's web player is dark-only by default, so
 * "light" here means a softer, dimmed-down variant rather than a true
 * white theme, since fighting every component's hardcoded dark assumption
 * automatically betting on every component's hardcoded dark styling.
 */

const SpotifyEnhancerAutoTheme = (() => {
  let checkInterval = null;

  function parseTime(str) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
  }

  function nowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  async function evaluate() {
    const settings = await SpotifyEnhancerStorage.getSetting("autoTheme");
    if (!settings?.enabled) return;

    const light = parseTime(settings.lightStart || "07:00");
    const dark = parseTime(settings.darkStart || "19:00");
    const now = nowMinutes();
    const isLightPeriod = light < dark ? (now >= light && now < dark) : !(now >= dark && now < light);

    const desiredPreset = isLightPeriod ? "mono" : "midnight";
    const currentPreset = await SpotifyEnhancerStorage.getSetting("theme.preset");
    if (currentPreset !== desiredPreset) {
      await SpotifyEnhancerStorage.setSetting("theme.preset", desiredPreset);
      window.SpotifyEnhancerThemes?.applyPreset(desiredPreset);
    }
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("autoTheme");
    if (!settings?.enabled) return;
    evaluate();
    checkInterval = setInterval(evaluate, 5 * 60 * 1000);
  }

  return { init, evaluate };
})();

window.SpotifyEnhancerAutoTheme = SpotifyEnhancerAutoTheme;
