/**
 * ratings.js — Feature #14
 * A 5-star + note rating system, stored entirely in chrome.storage.local
 * keyed by track id. Renders a small star row injected next to the
 * now-playing track info.
 */

const SpotifyEnhancerRatings = (() => {
  let widget = null;
  let currentTrackId = null;

  async function getRating(trackId) {
    const ratings = await SpotifyEnhancerStorage.getData("ratings");
    return ratings[trackId] || null;
  }

  async function setRating(trackId, stars, note = "") {
    const ratings = await SpotifyEnhancerStorage.getData("ratings");
    ratings[trackId] = { stars, note, updatedAt: Date.now() };
    await SpotifyEnhancerStorage.setData("ratings", ratings);
    return ratings[trackId];
  }

  async function quickRate(track, stars) {
    await setRating(track.id, stars);
    SpotifyEnhancerDOM.toast(`Rated "${track.name}" ${stars}★`);
    if (currentTrackId === track.id) renderStars(stars);
  }

  function renderStars(activeStars) {
    if (!widget) return;
    widget.querySelectorAll(".se-rating__star").forEach((star, i) => {
      star.classList.toggle("se-rating__star--filled", i < activeStars);
    });
  }

  function createWidget() {
    widget = document.createElement("div");
    widget.className = "se-rating";
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement("button");
      star.className = "se-rating__star";
      star.setAttribute("aria-label", `Rate ${i} star${i > 1 ? "s" : ""}`);
      SpotifyEnhancerDOM.setTooltip(star, `Rate ${i} star${i > 1 ? "s" : ""}`);
      star.textContent = "★";
      star.addEventListener("click", async () => {
        const existing = await getRating(currentTrackId);
        // Clicking the currently-set top star clears the rating; otherwise sets it.
        const newStars = existing?.stars === i ? 0 : i;
        await setRating(currentTrackId, newStars, existing?.note || "");
        renderStars(newStars);
      });
      widget.appendChild(star);
    }
    SpotifyEnhancerDOM.getDock().appendChild(widget);
  }

  async function syncToTrack(track) {
    currentTrackId = track?.id || null;
    if (!currentTrackId) return;
    const rating = await getRating(currentTrackId);
    renderStars(rating?.stars || 0);
  }

  async function getAllRated() {
    const ratings = await SpotifyEnhancerStorage.getData("ratings");
    return Object.entries(ratings)
      .filter(([, r]) => r.stars > 0)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("ratings");
    if (!settings?.enabled) return;
    createWidget();
    SpotifyEnhancerEvents.on("trackchange", syncToTrack);
    syncToTrack(SpotifyEnhancerDOM.getCurrentTrackInfo());
  }

  return { init, getRating, setRating, quickRate, getAllRated };
})();

window.SpotifyEnhancerRatings = SpotifyEnhancerRatings;
