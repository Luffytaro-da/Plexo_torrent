# RelayTorrent

RelayTorrent is a modern, high-performance desktop BitTorrent client built with Electron, React, TypeScript, and Vite. Its signature capability is intelligent multi-interface networking, allowing users to combine multiple network adapters (such as Wi-Fi, Ethernet, and USB tethering) to maximize torrent swarm performance.

## Key Features

- **Multi-Interface Routing**: Auto-detects all active network interfaces across Windows, macOS, and Linux. Choose between Automatic load balancing, Preferred adapter, Single adapter, or Custom policies.
- **Piece-Level Integrity Verification**: 100% SHA-1 piece hash verification before marking pieces complete. Automatic corruption detection, isolation, and re-requesting.
- **Crash Recovery & Resumable State**: Versioned atomic database persistence with backup recovery. Resumes seeding and downloading without re-downloading existing verified data.
- **Advanced Swarm Scheduling**: Rarest-first piece picker, sequential download mode, file priority management (High, Normal, Low, Skip), and endgame duplicate-request cancellation.
- **Telemetry & Visual Piece Map**: Real-time per-adapter download/upload throughput, piece grid visualizer, detailed peer and tracker inspector, and bounded activity logging.
- **Legal & Safe**: Designed exclusively for user-provided magnet links and legal `.torrent` files with strict path traversal protections.

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
npm install
```

### Running in Development
```bash
npm run dev
```

### Running Tests
```bash
# Unit tests
npm run test:unit

# Synthetic integration tests
npm run test:integration

# End-to-end Playwright tests
npm run test:e2e
```

### Building Installers
```bash
# Typecheck & build
npm run build

# Windows Installer (.exe)
npm run build:win

# macOS DMG (.dmg)
npm run build:mac

# Linux AppImage (.AppImage)
npm run build:linux
```
