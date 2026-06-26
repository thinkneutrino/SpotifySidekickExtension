/**
 * options.js
 * Hotkey rebinding (click a key's button, then press the new key) and a
 * larger custom-CSS editor than the popup has room for.
 */

const Storage = window.SpotifyEnhancerStorage;

const ACTION_LABELS = {
  playPause: "Play / Pause",
  next: "Next track",
  prev: "Previous track",
  volumeUp: "Volume up",
  volumeDown: "Volume down",
  toggleFullscreen: "Toggle fullscreen view",
  rateUp: "Rate current track 5★",
  addPlayLater: "Add current track to Play Later"
};

function formatKey(code) {
  return code.replace("Key", "").replace("Digit", "").replace("Arrow", "");
}

async function renderRebindList() {
  const bindings = (await Storage.getSetting("hotkeys.bindings")) || {};
  const container = document.getElementById("rebind-list");
  container.innerHTML = "";

  Object.entries(bindings).forEach(([action, key]) => {
    const row = document.createElement("div");
    row.className = "rebind-row";
    row.innerHTML = `<span>${ACTION_LABELS[action] || action}</span><button class="rebind-btn" data-action="${action}">${formatKey(key)}</button>`;
    const btn = row.querySelector("button");

    btn.addEventListener("click", () => {
      btn.classList.add("rebind-btn--listening");
      btn.textContent = "Press a key…";

      const captureKey = async (e) => {
        e.preventDefault();
        const newCode = e.code;
        const current = (await Storage.getSetting("hotkeys.bindings")) || {};
        current[action] = newCode;
        await Storage.setSetting("hotkeys.bindings", current);
        btn.textContent = formatKey(newCode);
        btn.classList.remove("rebind-btn--listening");
        document.removeEventListener("keydown", captureKey, true);
      };
      document.addEventListener("keydown", captureKey, true);
    });

    container.appendChild(row);
  });
}

async function bindCssEditor() {
  const textarea = document.getElementById("custom-css-full");
  textarea.value = (await Storage.getSetting("customCss.css")) || "";
  document.getElementById("save-css-full-btn").addEventListener("click", async () => {
    await Storage.setSetting("customCss.css", textarea.value);
  });
}

(async function init() {
  await renderRebindList();
  await bindCssEditor();
})();
