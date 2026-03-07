# CS2 Clutch Mode — Assets

## Required Icons

Place the following files here for full branding:

| File | Size | Used For |
|------|------|----------|
| `icon.png` | 256x256+ | Electron app icon, tray fallback, electron-builder |
| `icon.ico` | Multi-size | Windows taskbar/installer (optional — electron-builder can convert PNG) |

## Branding Assets

- **Full logo** (CS2 Clutch Mode with crosshair background) — use for splash/about screens
- **Crosshair icon** (orange crosshair on dark bg) — used for tray and app icon

## Notes

- The tray icon is generated programmatically in `src/electron/icon.js` at runtime
- For packaging, electron-builder uses `icon.png` from this directory
- If `icon.png` is missing, electron-builder will use its default icon
- To convert PNG to ICO: use an online converter or `png2ico` tool
