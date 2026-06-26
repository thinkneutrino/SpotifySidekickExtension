/**
 * popup.js
 * Drives the popup UI: tab switching, settings toggles bound via
 * data-setting paths, and rendering the Play Later / Ratings / Folders
 * lists from chrome.storage.local.
 */

const Storage = window.SpotifyEnhancerStorage;

// --- Tab switching ---
document.querySelectorAll(".app__tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".app__tab").forEach((t) => t.classList.remove("app__tab--active"));
    document.querySelectorAll(".app__panel").forEach((p) => p.classList.remove("app__panel--active"));
    tab.classList.add("app__tab--active");
    document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add("app__panel--active");
  });
});

// --- Generic data-setting checkbox binding ---
async function bindSettingCheckboxes() {
  const checkboxes = document.querySelectorAll("[data-setting]");
  for (const box of checkboxes) {
    const path = box.dataset.setting;
    box.checked = !!(await Storage.getSetting(path));
    box.addEventListener("change", () => Storage.setSetting(path, box.checked));
  }
}

// --- Sleep timer controls ---
document.querySelectorAll("[data-sleep]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendToActiveTabScript((minutes) => window.SpotifyEnhancerSleepTimer?.start(minutes), Number(btn.dataset.sleep));
  });
});
document.getElementById("sleep-cancel").addEventListener("click", () => {
  sendToActiveTabScript(() => window.SpotifyEnhancerSleepTimer?.cancel());
});

async function sendToActiveTabScript(fn, ...args) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: "https://open.spotify.com/*" });
  if (!tab) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args }).catch(() => {});
}

// --- Stats (session timer + streak) ---
async function renderStats() {
  const sessionLog = await Storage.getData("sessionLog");
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySeconds = sessionLog[todayKey] || 0;
  const mins = Math.floor(todaySeconds / 60);
  document.getElementById("stat-today").textContent = mins > 0 ? `${mins}m` : "0m";

  const streakLog = await Storage.getData("streakLog");
  let count = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (streakLog[key]) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  document.getElementById("stat-streak").textContent = String(count);
}

// --- Weekly recap ---

/** Matches weekly-recap.js's isoWeekKey exactly (Monday-start ISO week) so
 *  the popup and the content script agree on what bucket a date falls in. */
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Returns the Monday 00:00 (local time) that starts the ISO week containing `date`. */
function mondayOf(date) {
  const d = new Date(date);
  const dayNum = d.getDay() || 7; // Sunday(0) -> 7
  d.setDate(d.getDate() - (dayNum - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatRecapTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

let recapCountdownInterval = null;

async function renderRecap() {
  const lockedEl = document.getElementById("recap-locked");
  const contentEl = document.getElementById("recap-content");

  let log;
  try {
    log = await Storage.getData("weeklyLog");
  } catch (err) {
    // If storage itself is unavailable for some reason, fail toward the
    // locked state rather than leaving both panels hidden and the tab
    // blank with no explanation.
    console.error("[Spotify Sidekick popup] couldn't read weeklyLog:", err);
    contentEl.hidden = true;
    lockedEl.hidden = false;
    document.getElementById("recap-countdown").textContent = "—";
    return;
  }

  const now = new Date();
  const thisMonday = mondayOf(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekKey = isoWeekKey(lastMonday);
  const lastWeekData = log[lastWeekKey];

  if (lastWeekData && lastWeekData.plays > 0) {
    // A completed week with real data exists — show it, no countdown needed.
    if (recapCountdownInterval) { clearInterval(recapCountdownInterval); recapCountdownInterval = null; }
    lockedEl.hidden = true;
    contentEl.hidden = false;

    document.getElementById("recap-range").textContent = formatDateRange(lastMonday);
    document.getElementById("recap-total-time").textContent = formatRecapTime(lastWeekData.seconds || 0);
    document.getElementById("recap-total-plays").textContent = String(lastWeekData.plays || 0);

    const topArtists = Object.entries(lastWeekData.artists || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const artistList = document.getElementById("recap-artist-list");
    artistList.innerHTML = topArtists.length
      ? topArtists.map(([name, count]) => `
        <li class="recap-rank-row">
          <span class="recap-rank-row__name">${escapeHtml(name)}</span>
          <span class="recap-rank-row__count">${count} play${count > 1 ? "s" : ""}</span>
        </li>`).join("")
      : `<li class="empty-state">No artist data for this week.</li>`;

    const topTracks = Object.values(lastWeekData.tracks || {})
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const trackList = document.getElementById("recap-track-list");
    trackList.innerHTML = topTracks.length
      ? topTracks.map((t) => `
        <li class="recap-rank-row">
          <span class="recap-rank-row__name">${escapeHtml(t.name)}<span class="recap-rank-row__artist">${escapeHtml(t.artist)}</span></span>
          <span class="recap-rank-row__count">${t.count}×</span>
        </li>`).join("")
      : `<li class="empty-state">No track data for this week.</li>`;
  } else {
    // No completed week yet — show the locked state with a live countdown
    // to the moment the current week ends (next Monday 00:00 local time).
    contentEl.hidden = true;
    lockedEl.hidden = false;

    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    function tick() {
      const remaining = nextMonday - new Date();
      document.getElementById("recap-countdown").textContent = formatCountdown(remaining);
    }
    tick();
    if (recapCountdownInterval) clearInterval(recapCountdownInterval);
    recapCountdownInterval = setInterval(tick, 60000);
  }
}

async function renderPlayLater() {
  const list = await Storage.getData("playLater");
  const ul = document.getElementById("play-later-list");
  document.getElementById("play-later-count").textContent = `${list.length}/${PLAY_LATER_MAX}`;

  if (!list.length) {
    ul.innerHTML = `<li class="empty-state">Nothing queued yet (up to 10). Use the + button in Spotify's now-playing bar.</li>`;
    return;
  }
  ul.innerHTML = "";
  list.forEach((track) => {
    const li = document.createElement("li");
    li.className = "track-row track-row--clickable";
    const linkTitle = track.isRealId ? "Open this track on Spotify" : "Search for this track on Spotify (exact link wasn't available when saved)";
    li.title = linkTitle;
    li.innerHTML = `
      <div class="track-row__art" style="background-image:url('${track.coverUrl || ""}')"></div>
      <div class="track-row__info">
        <div class="track-row__name">${escapeHtml(track.name)}</div>
        <div class="track-row__artist">${escapeHtml(track.artist)}</div>
      </div>
      <button class="track-row__remove" aria-label="Remove" title="Remove from Play Later">×</button>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.closest(".track-row__remove")) return;
      if (track.url) window.open(track.url, "_blank", "noopener");
    });
    li.querySelector(".track-row__remove").addEventListener("click", async (e) => {
      e.stopPropagation();
      const updated = await Storage.getData("playLater");
      await Storage.setData("playLater", updated.filter((t) => t.trackId !== track.trackId));
      renderPlayLater();
    });
    ul.appendChild(li);
  });
}

// --- Ratings list ---
async function renderRatings() {
  const ratings = await Storage.getData("ratings");
  const entries = Object.entries(ratings).filter(([, r]) => r.stars > 0).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  const ul = document.getElementById("ratings-list");
  document.getElementById("ratings-count").textContent = String(entries.length);

  if (!entries.length) {
    ul.innerHTML = `<li class="empty-state">Rate tracks with the stars next to the now-playing bar.</li>`;
    return;
  }
  ul.innerHTML = "";
  entries.slice(0, 25).forEach(([trackId, rating]) => {
    const li = document.createElement("li");
    li.className = "track-row";
    li.innerHTML = `
      <div class="track-row__info">
        <div class="track-row__name">${trackId}</div>
      </div>
      <div class="track-row__stars">${"★".repeat(rating.stars)}${"☆".repeat(5 - rating.stars)}</div>
    `;
    ul.appendChild(li);
  });
}

// --- Idle minutes slider ---
async function bindIdleSlider() {
  const slider = document.getElementById("idle-minutes");
  const label = document.getElementById("idle-minutes-value");
  const current = await Storage.getSetting("idleDetect.minutes");
  slider.value = current || 20;
  label.textContent = `${slider.value} minutes`;
  slider.addEventListener("input", () => {
    label.textContent = `${slider.value} minutes`;
  });
  slider.addEventListener("change", () => {
    Storage.setSetting("idleDetect.minutes", Number(slider.value));
  });
}

// --- Theme grid ---
const CUSTOM_COLOR_KEYS = ["bg", "surface", "text", "subtext", "accent"];

async function getCustomColorsFromInputs() {
  const colors = {};
  for (const key of CUSTOM_COLOR_KEYS) {
    colors[key] = document.getElementById(`custom-hex-${key}`).value;
  }
  return colors;
}

function isValidHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

async function applyCustomTheme() {
  const colors = await getCustomColorsFromInputs();
  const invalid = Object.values(colors).some((v) => !isValidHex(v));
  if (invalid) {
    alert("Each color needs to be a valid 6-digit hex code, like #5ee3a8.");
    return;
  }
  await Storage.setSetting("theme.preset", "custom");
  await Storage.setSetting("theme.customColors", colors);
  document.querySelectorAll(".theme-swatch").forEach((s) => s.classList.remove("theme-swatch--active"));
  document.querySelector('[data-theme="custom"]').classList.add("theme-swatch--active");
  sendToActiveTabScript((preset, customColors) => window.SpotifyEnhancerThemes?.applyPreset(preset, customColors), "custom", colors);
}

async function bindThemeGrid() {
  const current = await Storage.getSetting("theme.preset");
  const savedCustomColors = await Storage.getSetting("theme.customColors");
  const panel = document.getElementById("custom-theme-panel");

  document.querySelectorAll(".theme-swatch").forEach((swatch) => {
    swatch.classList.toggle("theme-swatch--active", swatch.dataset.theme === current);
  });
  panel.hidden = current !== "custom";

  if (savedCustomColors) {
    CUSTOM_COLOR_KEYS.forEach((key) => {
      const value = savedCustomColors[key];
      if (!value) return;
      document.getElementById(`custom-color-${key}`).value = value;
      document.getElementById(`custom-hex-${key}`).value = value;
    });
  }

  document.querySelectorAll(".theme-swatch").forEach((swatch) => {
    swatch.addEventListener("click", async () => {
      const theme = swatch.dataset.theme;
      panel.hidden = theme !== "custom";

      if (theme === "custom") {
        // Don't apply yet — let the person pick colors and hit "Apply".
        document.querySelectorAll(".theme-swatch").forEach((s) => s.classList.remove("theme-swatch--active"));
        swatch.classList.add("theme-swatch--active");
        return;
      }

      await Storage.setSetting("theme.preset", theme);
      document.querySelectorAll(".theme-swatch").forEach((s) => s.classList.remove("theme-swatch--active"));
      swatch.classList.add("theme-swatch--active");
      sendToActiveTabScript((preset) => window.SpotifyEnhancerThemes?.applyPreset(preset), theme);
    });
  });

  // Keep the color-picker swatch and the hex text field in sync with each other.
  CUSTOM_COLOR_KEYS.forEach((key) => {
    const colorInput = document.getElementById(`custom-color-${key}`);
    const hexInput = document.getElementById(`custom-hex-${key}`);
    colorInput.addEventListener("input", () => { hexInput.value = colorInput.value; });
    hexInput.addEventListener("input", () => {
      if (isValidHex(hexInput.value)) colorInput.value = hexInput.value;
    });
  });

  document.getElementById("apply-custom-theme-btn").addEventListener("click", applyCustomTheme);
}

// --- Font select ---
async function bindFontSelect() {
  const select = document.getElementById("font-select");
  select.value = (await Storage.getSetting("theme.font")) || "default";
  select.addEventListener("change", async () => {
    await Storage.setSetting("theme.font", select.value);
    sendToActiveTabScript((font) => window.SpotifyEnhancerThemes?.applyFont(font), select.value);
  });
}


// --- Auto theme toggle ---
document.getElementById("auto-theme-toggle").addEventListener("change", (e) => {
  Storage.setSetting("autoTheme.enabled", e.target.checked);
});
(async () => {
  document.getElementById("auto-theme-toggle").checked = !!(await Storage.getSetting("autoTheme.enabled"));
})();

// --- Cursor color ---
async function bindCursorColor() {
  const toggle = document.getElementById("cursor-color-toggle");
  const row = document.getElementById("cursor-color-row");
  const picker = document.getElementById("cursor-color-picker");

  const settings = await Storage.getSetting("cursorColor");
  toggle.checked = !!settings?.enabled;
  picker.value = settings?.color || "#5ee3a8";
  row.hidden = !toggle.checked;

  async function applyLive() {
    const enabled = toggle.checked;
    const color = picker.value;
    await Storage.setSetting("cursorColor.enabled", enabled);
    await Storage.setSetting("cursorColor.color", color);
    sendToActiveTabScript((isEnabled, hex) => {
      if (isEnabled) window.SpotifyEnhancerCursorColor?.apply(hex);
      else window.SpotifyEnhancerCursorColor?.remove();
    }, enabled, color);
  }

  toggle.addEventListener("change", () => {
    row.hidden = !toggle.checked;
    applyLive();
  });
  picker.addEventListener("input", () => {
    if (toggle.checked) applyLive();
  });
}

// --- Custom CSS ---
async function bindCustomCss() {
  const textarea = document.getElementById("custom-css");
  textarea.value = (await Storage.getSetting("customCss.css")) || "";
  document.getElementById("save-css-btn").addEventListener("click", async () => {
    await Storage.setSetting("customCss.css", textarea.value);
    sendToActiveTabScript((css) => window.SpotifyEnhancerCustomCss?.apply(css), textarea.value);
  });
}

// --- Hotkey list (read-only display for now; rebinding lives in a future options page) ---
async function renderHotkeyList() {
  const bindings = (await Storage.getSetting("hotkeys.bindings")) || {};
  const labels = {
    playPause: "Play / Pause", next: "Next track", prev: "Previous track",
    volumeUp: "Volume up", volumeDown: "Volume down",
    toggleFullscreen: "Toggle fullscreen", rateUp: "Rate current track 5★", addPlayLater: "Add to Play Later"
  };
  const container = document.getElementById("hotkey-list");
  container.innerHTML = "";
  Object.entries(bindings).forEach(([action, key]) => {
    const row = document.createElement("div");
    row.className = "hotkey-row";
    row.innerHTML = `<span>${labels[action] || action}</span><kbd>${formatKey(key)}</kbd>`;
    container.appendChild(row);
  });
}
function formatKey(code) {
  return code.replace("Key", "").replace("Digit", "").replace("Arrow", "");
}

// --- Context search services ---
async function bindServiceToggles() {
  const services = (await Storage.getSetting("contextSearch.services")) || [];
  document.querySelectorAll("[data-service]").forEach((box) => {
    box.checked = services.includes(box.dataset.service);
    box.addEventListener("change", async () => {
      const current = (await Storage.getSetting("contextSearch.services")) || [];
      const updated = box.checked
        ? [...new Set([...current, box.dataset.service])]
        : current.filter((s) => s !== box.dataset.service);
      await Storage.setSetting("contextSearch.services", updated);
    });
  });
}

// --- Data export / reset ---
document.getElementById("export-data-btn").addEventListener("click", async () => {
  const all = await Storage.getAll();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: "spotify-enhancer-data.json" }).catch(() => {
    // Fallback if downloads permission isn't available: open in a new tab.
    window.open(url, "_blank");
  });
});

document.getElementById("reset-data-btn").addEventListener("click", async () => {
  if (!confirm("This clears all ratings, Play Later items, and stats. Settings stay as-is. Continue?")) return;
  await chrome.storage.local.set({ data: Storage.DEFAULTS.data });
  renderPlayLater();
  renderRatings();
  renderStats();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// --- Init ---
(async function initPopup() {
  // Each step is isolated so a single failure (a storage error, a missing
  // element, anything unexpected) can't silently prevent every section
  // that would otherwise run after it from ever rendering — previously
  // this was one unguarded await chain, so one throw early on meant the
  // rest of the popup just stayed blank with no visible explanation.
  const steps = [
    ["settings checkboxes", bindSettingCheckboxes],
    ["idle slider", bindIdleSlider],
    ["theme grid", bindThemeGrid],
    ["font select", bindFontSelect],
    ["cursor color", bindCursorColor],
    ["custom CSS", bindCustomCss],
    ["hotkey list", renderHotkeyList],
    ["service toggles", bindServiceToggles],
    ["stats", renderStats],
    ["play later", renderPlayLater],
    ["ratings", renderRatings],
    ["weekly recap", renderRecap]
  ];
  for (const [label, fn] of steps) {
    try {
      await fn();
    } catch (err) {
      console.error(`[Spotify Sidekick popup] "${label}" failed to initialize:`, err);
    }
  }
})();
