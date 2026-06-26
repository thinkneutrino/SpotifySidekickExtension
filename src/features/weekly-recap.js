/**
 * weekly-recap.js — Feature #27
 * Logs listening activity into Monday-start ISO week buckets (artist play
 * counts, track play counts, total seconds listened) so the popup's Recap
 * tab can show "who you listened to most" once a week has fully ended.
 *
 * This module only collects data — it has no UI of its own. The popup
 * reads SpotifyEnhancerStorage.getData("weeklyLog") directly and decides
 * what to render (a finished week's recap, or a locked countdown if the
 * current week hasn't ended yet).
 */

const SpotifyEnhancerWeeklyRecap = (() => {
  let isPlaying = false;
  let currentTrack = null;
  let tickInterval = null;

  /** ISO week key, Monday-start, e.g. "2026-W25". Matches the standard
   *  ISO-8601 week-numbering rules (week 1 is the week containing the
   *  year's first Thursday) so week boundaries are unambiguous and the
   *  same definition the popup uses to find "last week" stays in sync. */
  function isoWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // Sunday (0) -> 7, so Monday=1..Sunday=7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to this week's Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  function emptyWeek() {
    return { seconds: 0, plays: 0, artists: {}, tracks: {} };
  }

  /** Serializes every read-modify-write against weeklyLog through one
   *  queue. logTrackPlay (on track change) and logSecondTick (on a 1s
   *  interval) both read the *entire* weeklyLog object, mutate it, and
   *  write it back — if those two ever overlapped (the interval firing
   *  while a track-change write was still in flight, which storage being
   *  async makes possible), the second write would silently clobber the
   *  first one's update and lose a play-count increment. Routing every
   *  mutation through this queue means each one fully completes before
   *  the next is even allowed to read, so nothing can be lost to a race. */
  let writeQueue = Promise.resolve();
  function queueWeeklyLogMutation(mutate) {
    writeQueue = writeQueue.then(async () => {
      const log = await SpotifyEnhancerStorage.getData("weeklyLog");
      const key = isoWeekKey(new Date());
      const week = log[key] || emptyWeek();
      mutate(week);
      log[key] = week;
      await SpotifyEnhancerStorage.setData("weeklyLog", log);
    }).catch((err) => {
      console.error("[Spotify Sidekick] weekly recap logging failed:", err);
    });
    return writeQueue;
  }

  async function logTrackPlay(track) {
    if (!track?.name) return;
    await queueWeeklyLogMutation((week) => {
      week.plays += 1;
      if (track.artist) {
        week.artists[track.artist] = (week.artists[track.artist] || 0) + 1;
      }
      const trackKey = track.id || `${track.name}::${track.artist || ""}`;
      if (!week.tracks[trackKey]) {
        week.tracks[trackKey] = { name: track.name, artist: track.artist || "", count: 0 };
      }
      week.tracks[trackKey].count += 1;
    });
  }

  async function logSecondTick() {
    await queueWeeklyLogMutation((week) => {
      week.seconds += 1;
    });
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("weeklyRecap");
    if (!settings?.enabled) return;

    SpotifyEnhancerEvents.on("trackchange", (track) => {
      currentTrack = track;
      // A track change while already playing counts as a new play; if
      // playback is paused, logSecondTick's interval simply won't tick,
      // and the play itself is still recorded here so skipped-through
      // tracks still count toward "most played" even if barely listened to.
      logTrackPlay(track);
    });
    SpotifyEnhancerEvents.on("playstate", ({ playing }) => { isPlaying = playing; });

    tickInterval = setInterval(() => {
      if (isPlaying && currentTrack) logSecondTick();
    }, 1000);
  }

  return { init, isoWeekKey };
})();

window.SpotifyEnhancerWeeklyRecap = SpotifyEnhancerWeeklyRecap;
