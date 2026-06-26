/**
 * play-later.js — Feature #15
 * A personal "play later" list, separate from Spotify's own session queue
 * (which clears/reorders constantly). Capped at 10 tracks — this is meant
 * as a short-term holding list, not a full playlist replacement; if you
 * need to keep more than 10, make a real Spotify playlist for it. Each
 * entry stores a direct Spotify URL (or a search-link fallback when no
 * real track id is available) so it can be opened with one click from
 * the popup.
 */

const SpotifyEnhancerPlayLater = (() => {
  const MAX_ITEMS = 10;
  let button = null;

  async function add(track) {
    const list = await SpotifyEnhancerStorage.getData("playLater");
    if (list.some((t) => t.trackId === track.id)) {
      SpotifyEnhancerDOM.toast("Already in your Play Later list");
      return list;
    }
    if (list.length >= MAX_ITEMS) {
      SpotifyEnhancerDOM.toast(`Play Later is full (${MAX_ITEMS} max) — remove a track first`);
      return list;
    }
    list.unshift({
      trackId: track.id,
      name: track.name,
      artist: track.artist,
      coverUrl: track.coverUrl,
      url: track.url,
      isRealId: !!track.isRealId,
      addedAt: Date.now()
    });
    await SpotifyEnhancerStorage.setData("playLater", list);
    SpotifyEnhancerDOM.toast(`Added "${track.name}" to Play Later (${list.length}/${MAX_ITEMS})`);
    return list;
  }

  async function remove(trackId) {
    const list = await SpotifyEnhancerStorage.getData("playLater");
    const updated = list.filter((t) => t.trackId !== trackId);
    await SpotifyEnhancerStorage.setData("playLater", updated);
    return updated;
  }

  async function getAll() {
    return SpotifyEnhancerStorage.getData("playLater");
  }

  function createButton() {
    button = SpotifyEnhancerDOM.createIconButton({
      label: "Add to Play Later",
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      className: "se-play-later-btn",
      onClick: () => {
        const track = SpotifyEnhancerDOM.getCurrentTrackInfo();
        if (track) add(track);
      }
    });
    SpotifyEnhancerDOM.getDock().appendChild(button);
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("playLater");
    if (!settings?.enabled) return;
    createButton();
  }

  return { init, add, remove, getAll, MAX_ITEMS };
})();

window.SpotifyEnhancerPlayLater = SpotifyEnhancerPlayLater;

