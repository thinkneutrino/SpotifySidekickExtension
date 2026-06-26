/**
 * dom-utils.js
 * Spotify's web player is a React SPA with class names that can change between
 * releases. We rely primarily on stable `data-testid` attributes (Spotify uses
 * these for their own internal testing, so they change far less often than
 * class names) with a couple of structural fallbacks. Every lookup is wrapped
 * so a missing element fails quietly instead of throwing across the codebase.
 */

const SpotifyEnhancerDOM = (() => {
  const SELECTORS = {
    nowPlayingBar: '[data-testid="now-playing-bar"]',
    nowPlayingWidget: '[data-testid="now-playing-widget"]',
    trackName: '[data-testid="context-item-info-title"] a, [data-testid="context-item-info-title"]',
    artistName: '[data-testid="context-item-info-artist"]',
    coverArt: '[data-testid="cover-art-image"]',
    playButton: '[data-testid="control-button-playpause"]',
    nextButton: '[data-testid="control-button-skip-forward"]',
    prevButton: '[data-testid="control-button-skip-back"]',
    volumeSlider: '[data-testid="volume-bar"]',
    progressBar: '[data-testid="playback-progress"], [data-testid="progress-bar"]',
    leftSidebar: '[data-testid="Root__nav-bar"]',
    trackRow: '[data-testid="tracklist-row"]',
    trackRowLink: 'a[href^="/track/"]',
    mainView: '[data-testid="root"], #main',
    likeButton: '[data-testid="add-button"], [aria-label*="ave to" i]'
  };

  function $(selector, root = document) {
    try { return root.querySelector(selector); } catch { return null; }
  }
  function $all(selector, root = document) {
    try { return Array.from(root.querySelectorAll(selector)); } catch { return []; }
  }

  function get(name, root) {
    return $(SELECTORS[name] || name, root);
  }
  function getAll(name, root) {
    return $all(SELECTORS[name] || name, root);
  }

  /** Resolves once an element matching `selector` exists, or rejects after timeout. */
  function waitFor(selector, { timeout = 15000, root = document.body } = {}) {
    const sel = SELECTORS[selector] || selector;
    return new Promise((resolve, reject) => {
      const existing = $(sel, root);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = $(sel, root);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(root, { childList: true, subtree: true });

      if (timeout > 0) {
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timed out waiting for "${selector}"`));
        }, timeout);
      }
    });
  }

  /** Calls `callback` every time the matched element's content changes (e.g. track change). */
  function observeMutations(target, callback, options = { childList: true, subtree: true, characterData: true }) {
    if (!target) return () => {};
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    return () => observer.disconnect();
  }

  /** Extracts the currently playing track's id/name/artist from the now-playing bar. */
  function getCurrentTrackInfo() {
    const nameEl = get("trackName");
    const artistEl = get("artistName");
    const cover = get("coverArt");
    if (!nameEl) return null;

    const name = nameEl.textContent || "";
    const artist = artistEl ? artistEl.textContent : "";

    // Prefer a real track id from any /track/ link inside the now-playing widget;
    // titles are sometimes rendered as plain text or linked to an album instead.
    const widget = get("nowPlayingWidget");
    const trackLink = widget?.querySelector('a[href^="/track/"]');
    const idMatch = trackLink?.getAttribute("href")?.match(/\/track\/([a-zA-Z0-9]+)/);

    const isRealId = !!idMatch;
    const id = isRealId ? idMatch[1] : `local:${hashString(`${name}::${artist}`)}`;

    // Always provide a URL that works: a direct track link when we have a
    // real id, otherwise a Spotify search link for the track + artist so
    // "open this track" never points at a dead/fake URL.
    const url = isRealId
      ? `https://open.spotify.com/track/${id}`
      : `https://open.spotify.com/search/${encodeURIComponent(`${name} ${artist}`.trim())}`;

    return { id, name, artist, coverUrl: cover ? cover.getAttribute("src") : null, isRealId, url };
  }

  /** Small, fast, non-cryptographic string hash used as a stable fallback track id. */
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /** Lightweight, dependency-free toast for in-page feedback. */
  function toast(message, { duration = 2200 } = {}) {
    let host = document.getElementById("se-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "se-toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "se-toast";
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("se-toast--visible"));
    setTimeout(() => {
      el.classList.remove("se-toast--visible");
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  /**
   * Custom tooltip system matching Spotify's own tooltip styling (dark
   * rounded pill, appears above the element, small text) instead of the
   * native browser `title` attribute tooltip, which looks like generic
   * OS chrome and doesn't match Spotify's UI at all. Any element with a
   * `data-se-tooltip="..."` attribute gets one of these automatically.
   */
  let tooltipEl = null;
  let tooltipShowTimer = null;

  function ensureTooltipEl() {
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "se-tooltip";
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function positionTooltip(target) {
    const tip = ensureTooltipEl();
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const margin = 8;

    // Center on the target, then clamp so the tooltip never extends past
    // either edge of the viewport regardless of how long the text is or
    // how close to the edge the target sits.
    let left = rect.left + rect.width / 2;
    const halfWidth = tipRect.width / 2;
    left = Math.max(halfWidth + margin, Math.min(left, window.innerWidth - halfWidth - margin));

    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(rect.top - 8, margin)}px`;
  }

  function showTooltip(target) {
    const text = target.getAttribute("data-se-tooltip");
    if (!text) return;
    clearTimeout(tooltipShowTimer);
    tooltipShowTimer = setTimeout(() => {
      const tip = ensureTooltipEl();
      tip.textContent = text;
      positionTooltip(target);
      tip.classList.add("se-tooltip--visible");
    }, 300); // small delay so it doesn't flash on quick mouse passes, matching Spotify's own feel
  }

  function hideTooltip() {
    clearTimeout(tooltipShowTimer);
    tooltipEl?.classList.remove("se-tooltip--visible");
  }

  function initTooltipSystem() {
    document.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[data-se-tooltip]");
      if (target) showTooltip(target);
    });
    document.addEventListener("mouseout", (e) => {
      const target = e.target.closest("[data-se-tooltip]");
      if (target) hideTooltip();
    });
    // Keep the tooltip glued to its element if the page scrolls/resizes while open.
    document.addEventListener("scroll", () => {
      if (tooltipEl?.classList.contains("se-tooltip--visible")) hideTooltip();
    }, true);
  }
  initTooltipSystem();

  /** Sets a Spotify-style custom tooltip on an element (replaces any native title). */
  function setTooltip(el, text) {
    el.removeAttribute("title");
    el.setAttribute("data-se-tooltip", text);
  }

  function createIconButton({ label, svg, onClick, className = "" }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `se-icon-btn ${className}`.trim();
    btn.setAttribute("aria-label", label);
    setTooltip(btn, label);
    btn.innerHTML = svg;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return btn;
  }

  /**
   * Returns a single fixed-position toolbar that sits just above Spotify's
   * now-playing bar. Every feature that needs a persistent visible control
   * (speed, boost, ratings, tags, session timer, etc.) appends to this dock
   * instead of injecting into Spotify's own flex layout, which is fragile —
   * appending into nested flex containers we don't fully control breaks
   * alignment and can visually collide with Spotify's own UI.
   */
  function getDock() {
    let dock = document.getElementById("se-dock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "se-dock";
      dock.className = "se-dock";
      document.body.appendChild(dock);

      // Keep body.se-dock-active in sync with whether the dock actually has
      // visible controls in it, so Spotify's content area only loses space
      // for the dock when something is really using it.
      const syncActiveClass = () => {
        document.body.classList.toggle("se-dock-active", dock.childElementCount > 0);
      };
      new MutationObserver(syncActiveClass).observe(dock, { childList: true });
      syncActiveClass();
    }
    return dock;
  }

  return { SELECTORS, $, $all, get, getAll, waitFor, observeMutations, getCurrentTrackInfo, toast, createIconButton, getDock, setTooltip };
})();

window.SpotifyEnhancerDOM = SpotifyEnhancerDOM;
