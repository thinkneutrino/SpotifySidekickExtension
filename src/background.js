/**
 * background.js
 * Minimal MV3 service worker. Currently only used to relay settings-change
 * notifications between the popup/options page and any open Spotify tabs,
 * since storage.onChanged already does most of this for free — this is a
 * thin safety net for messages that need an explicit broadcast.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Spotify Sidekick] Installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SETTINGS_CHANGED") {
    // storage.onChanged listeners in content scripts already pick this up;
    // this branch exists for any future cross-context messaging needs.
    sendResponse?.({ ok: true });
  }
  return true;
});
