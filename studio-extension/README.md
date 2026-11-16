# Salik Studio — side-panel extension

Salik Studio inside Chrome's side panel, so you can time filters on the platform itself
(Disney+, Netflix, OSN+, Shahid, Prime Video, …) instead of a Stremio stream.
The film keeps playing in its own tab; the panel drives that tab.

## Install (developer mode)
1. `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick the `studio-extension` folder.
3. Open the film's tab, click the Salik Studio icon → the panel opens beside it.

## Use
- Start the film in the tab, then in the panel: **🔗 Use the video in this tab**.
- The player buttons (±1 s, ±0.1 s, ⏯, arrows), ▶ on a row, "actual = now" and the sync tools now use the tab's time.
- **Apply filters while playing** previews the rows on the platform video: skip, mute, full blur, partial blur.
- **🎯** opens the blur picker on the tab: drag a box over the video → it goes on the row you last played (and the clipboard).
  Esc closes it; Space plays/pauses.
- **↩ Back to the Stremio player** returns to the built-in player.

Time and seek go through each platform's own player API (Netflix player API, Disney's `disney-web-player`),
with the plain `<video>` as the fallback for other sites.

## Limits
- Audio alignment (Whisper + wav2vec2) does not run here — extension pages can't load transformers.js from a CDN.
  Use the standalone `Salik_studio.html` for that step.
- Only the sites listed in `manifest.json` can be connected.

## Updating Studio
`src/Salik_studio.html` is the standalone Studio. After replacing it with a newer one:

```
node studio-extension/build.mjs
```

This writes `studio.html` + `studio.js` (inline scripts become files, the xlsx CDN becomes `vendor/xlsx.full.min.js`,
SheetJS 0.18.5, Apache-2.0). Autosave goes to `chrome.storage.local` through `storage-shim.js`.
