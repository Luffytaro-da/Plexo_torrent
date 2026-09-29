# RelayTorrent Packaging & Distribution Guide

RelayTorrent supports automated multi-platform desktop packaging via `electron-builder` and `electron-vite`.

## Target Platforms & Output Artifacts

| Platform | Target Formats | Installer Output |
| :--- | :--- | :--- |
| **Windows** (10 / 11) | NSIS Installer, Portable ZIP | `dist/RelayTorrent-Setup-1.0.0.exe`, `dist/RelayTorrent-1.0.0-win.zip` |
| **macOS** (Apple Silicon / Intel) | DMG, ZIP | `dist/RelayTorrent-1.0.0.dmg`, `dist/RelayTorrent-1.0.0-mac.zip` |
| **Linux** (x86_64, arm64) | AppImage, DEB | `dist/RelayTorrent-1.0.0.AppImage`, `dist/relaytorrent_1.0.0_amd64.deb` |

## Build Commands

### 1. Compile & Typecheck
```bash
npm run build
```

### 2. Package for Current Host OS (Unpacked Directory)
```bash
npm run build:unpack
```

### 3. Build Windows NSIS Installer
```bash
npm run build:win
```

### 4. Build macOS DMG
```bash
npm run build:mac
```

### 5. Build Linux AppImage & DEB
```bash
npm run build:linux
```

## Security & Sandboxing
- Context isolation is strictly enforced (`contextIsolation: true`).
- Node integration is disabled in renderer (`nodeIntegration: false`).
- All renderer calls cross typed IPC boundaries validated by `IpcValidator`.
