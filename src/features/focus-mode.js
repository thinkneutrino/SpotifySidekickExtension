/**
 * focus-mode.js — Feature #8
 * One-toggle "distraction-free" mode. Spotify's web player doesn't expose
 * a CSS-only way to hide its own side panels — "Now Playing view" and
 * "Your Library" are real interactive widgets toggled by clicking
 * Spotify's own buttons, not just hideable containers. So focus mode
 * works by clicking those buttons itself, the same way a person would.
 *
 * Both buttons' exact labels are confirmed in both states:
 *   Now Playing view: "Hide Now Playing view" (open) / "Show Now Playing view" (closed)
 *   Your Library:     "Collapse Your Library" (open) / "Open Your Library" (closed)
 *
 * Rather than remember "did focus mode close this" across enable/disable,
 * which breaks if Spotify swaps the button element or the person manually
 * toggles a panel while focus mode is on, we just read each button's
 * current exact label fresh every time and decide from that — this makes
 * toggling focus mode on/off idempotent and self-correcting: clicking the
 * dock button again always flips between "everything closed" and
 * "whatever was open before," with no stored flags to drift out of sync.
 */

const SpotifyEnhancerFocusMode = (() => {
  let active = false;

  function findButtonByExactLabel(label) {
    const buttons = SpotifyEnhancerDOM.$all("button[aria-label]");
    return buttons.find((btn) => btn.getAttribute("aria-label") === label) || null;
  }

  function closeNowPlayingViewIfOpen() {
    const btn = findButtonByExactLabel("Hide Now Playing view");
    if (btn) btn.click();
  }
  function openNowPlayingViewIfClosed() {
    const btn = findButtonByExactLabel("Show Now Playing view");
    if (btn) btn.click();
  }
  function collapseLibraryIfOpen() {
    const btn = findButtonByExactLabel("Collapse Your Library");
    if (btn) btn.click();
  }
  function openLibraryIfCollapsed() {
    const btn = findButtonByExactLabel("Open Your Library");
    if (btn) btn.click();
  }

  function enterFocus() {
    closeNowPlayingViewIfOpen();
    collapseLibraryIfOpen();
  }

  function exitFocus() {
    openNowPlayingViewIfClosed();
    openLibraryIfCollapsed();
  }

  function setActive(value) {
    active = value;
    document.body.classList.toggle("se-focus-active", active);
    if (active) enterFocus();
    else exitFocus();
    SpotifyEnhancerStorage.setSetting("focusMode.active", active);
    SpotifyEnhancerDOM.toast(active ? "Focus mode on" : "Focus mode off");
  }

  function toggle() {
    setActive(!active);
  }

  function createToggleButton() {
    const btn = SpotifyEnhancerDOM.createIconButton({
      label: "Focus mode",
      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
      className: "se-focus-toggle",
      onClick: toggle
    });
    SpotifyEnhancerDOM.getDock().appendChild(btn);
  }

  async function init() {
    const settings = await SpotifyEnhancerStorage.getSetting("focusMode");
    if (!settings?.enabled) return;
    createToggleButton();
    // Intentionally start with active = false on every page load rather
    // than restoring a previously-saved true: Spotify's own panel states
    // aren't something we control or can verify on load, so starting from
    // "focus mode off" and letting a click flip to the real current state
    // is more predictable than assuming stale state from a past session.
  }

  return { init, toggle, setActive };
})();

window.SpotifyEnhancerFocusMode = SpotifyEnhancerFocusMode;
