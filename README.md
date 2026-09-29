# RelayTorrent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron)](https://www.electronjs.org/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20%7C%20Playwright-brightgreen)](https://playwright.dev/)

A modern, high-performance desktop BitTorrent client for Windows, macOS, and Linux that accelerates swarm transfers by routing peer connections across **multiple network interfaces simultaneously**.

If your machine has:
- **Wi-Fi** (Home broadband router)
- **Ethernet** (Office LAN or secondary connection)
- **USB Tethering** (4G / 5G mobile connection)

RelayTorrent connects to swarm peers over all available adapters at the same time, aggregating your bandwidth into a single unified download pipeline.

---

## ⚠️ Before You Start

### Combining Multiple Network Connections

To successfully combine bandwidth across multiple network adapters:

- **Use distinct internet connections:**
  - Each adapter must be connected to a different gateway and IP subnet (for example, **Wi-Fi** via your home fiber router + **USB Tethering** via your 5G phone).
  - Connecting both Wi-Fi and Ethernet to the **same local router** (sharing one subnet like `192.168.1.0/24`) will not increase speeds: both adapters share the same upstream broadband connection, and your operating system's routing table will direct all packets through whichever interface has the lower metric.

### Windows 10 / 11 Simultaneous Connections Setting

Some Windows installations automatically disable or put Wi-Fi into low-power sleep when an active Ethernet cable is plugged in.

If your Wi-Fi disconnects when Ethernet is connected:
1. Open the **Local Group Policy Editor** (`gpedit.msc`).
2. Navigate to:
   `Computer Configuration` → `Administrative Templates` → `Network` → `Windows Connection Manager`
3. Set **"Minimize the number of simultaneous connections to the Internet or a Windows domain"** to **Disabled**.

---

## Why RelayTorrent?

Standard BitTorrent clients bind their sockets to `0.0.0.0` (all interfaces) and let the operating system make routing decisions. When your computer has multiple active network interfaces, the OS selects a single default route based on interface metrics—leaving your secondary Wi-Fi or tethered connection completely idle.

RelayTorrent solves this by deterministically binding peer wire sockets to specific local network addresses. Peer connections are balanced across all healthy adapters, turning your swarm traffic into a multi-path download engine.

```text
                           ┌── Wi-Fi (192.168.1.50) ─────── Peers [1..20] ──┐
                           │                                                 │
Swarm Peers ─── Multi-Path ├── Ethernet (10.0.0.15) ────── Peers [21..45] ─┼──→ Verified Piece Assembly ──→ Disk
                           │                                                 │
                           └── USB Tether (172.20.10.4) ─── Peers [46..60] ──┘
```

**Multiple Physical Adapters → Dedicated Peer Wire Sockets → Aggregated Swarm Throughput**

---

## Key Features

- ⚡ **Multi-Interface Swarm Routing** — Discovers and monitors physical network adapters in real time. Routes peer sockets across Wi-Fi, Ethernet, and USB tethering adapters with configurable routing policies (Automatic, Preferred Interface, or Custom).
- 🔍 **Hardware NDIS Validation** — Directly queries operating system hardware counters (Windows NDIS statistics) to verify real physical byte contributions, ensuring reported throughput reflects actual wire transfer rather than virtual loopbacks.
- 🛡️ **Cryptographic Piece Verification** — Enforces strict SHA-1 hash checks on every piece before marking it complete. Corrupt or unverified data is quarantined and re-requested automatically without discarding valid progress.
- ⚖️ **Intelligent Swarm Scheduling** — Employs a rarest-first piece picker to balance piece availability across the swarm, supports sequential download for streaming preview, and includes endgame duplicate-request racing.
- 📁 **Per-File Priority Management** — Set individual file priorities within multi-file torrents (High, Normal, Low, or Skip) with real-time state persistence.
- 📊 **Visual Swarm & Piece Canvas** — Interactive piece grid color-coded by state (Verified, Downloading, Requested, Corrupted, Skipped, Missing) alongside detailed peer diagnostics and tracker inspectors.
- ⚙️ **Comprehensive General Settings** — Desktop preferences modal inspired by qBittorrent, providing full control over default save paths, connection limits, listen ports, transfer speed caps, and interface policies.
- 💾 **Atomic State Persistence** — SQLite-backed transactional state store ensuring your transfers, piece states, custom policies, and settings survive unexpected crashes and restarts.
- 🌓 **Cohesive Light & Dark Modes** — Thoughtfully crafted UI with an instant theme toggle. Features a deep Plexo-inspired dark navy aesthetic and a refined, WCAG AAA-compliant desktop light theme.

---

## How It Works

RelayTorrent combines native operating system networking primitives with BitTorrent wire protocols:

### 1. Multi-Interface Socket Binding

Standard TCP/UDP sockets leave interface selection to the kernel routing table. RelayTorrent queries all network adapters upon startup and binds outgoing peer sockets to specific local IPv4 addresses:

```typescript
// Sockets are bound to distinct physical adapter addresses
const socket = net.connect({
  host: peer.ip,
  port: peer.port,
  localAddress: selectedInterface.address
})
```

- **Strong Host Model Handling**: On Windows, the TCP/IP stack enforces the Strong Host Model. If a bound interface lacks a direct route to a remote peer, RelayTorrent automatically utilizes fallback routing to maintain swarm connectivity without attributing phantom traffic to the bound adapter.
- **No VPNs or Virtual Adapters**: No packet filtering drivers, TAP devices, or root/kernel extensions are required.

### 2. Piece Integrity & Verification Pipeline

In BitTorrent, files are divided into fixed-size pieces (typically 256 KB to 16 MB), each verified against a SHA-1 hash provided in the `.torrent` metadata:

1. **Sub-Piece Chunking**: Each piece is requested in standard 16 KB blocks across active peer wires.
2. **Buffer Aggregation**: Incoming blocks are assembled in memory until all blocks for a piece are received.
3. **Cryptographic Validation**: The assembled piece is hashed and compared to the official torrent piece hash.
4. **Flushing to Disk**: Only verified pieces are committed to destination files. Corrupt pieces are discarded immediately and marked for re-download.

### 3. Real Hardware Telemetry

RelayTorrent does not rely on simple application-layer socket counters. It periodically samples hardware adapter interface statistics to confirm that traffic is traversing the intended physical wire. The **Multi-Interface Swarm Router** view displays live physical throughput and socket allocation metrics per adapter.

---

## What is a Piece?

A **piece** is the cryptographic verification boundary in the BitTorrent protocol:

- **Piece Length**: Typically 256 KB, 512 KB, 1 MB, 2 MB, or 4 MB, chosen when the torrent is created.
- **Sub-Piece Blocks**: Pieces are transferred across peer wires in smaller 16 KB chunks to allow efficient multiplexing over TCP sockets.
- **Verification**: Once every 16 KB block of a piece arrives, the client computes the SHA-1 hash of the combined buffer. If the hash matches the metadata dictionary, the piece is marked **Verified**.

The **Pieces** tab provides a real-time, interactive visual representation of all pieces in a transfer:
- 🟢 **Verified** — Checked against the cryptographic hash and safely written to disk.
- 🔵 **Downloading** — Blocks actively in flight across one or more network adapters.
- 🟣 **Requested** — Scheduled for download and assigned to connected peers.
- 🔴 **Corrupted** — Failed integrity check; quarantined and queued for re-download.
- ⚪ **Missing / Pending** — Yet to be requested from the swarm.

---

## Getting Started

### Prerequisites

- **Node.js**: `20.x` or `22.x` LTS recommended
- **npm**: `v10+`
- **Supported OS**: Windows 10/11, macOS 12+ (Apple Silicon & Intel), or Linux (Ubuntu 22.04+, Fedora, Debian)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Luffytaro-da/plexo_torrent.git
cd plexo_torrent
npm install
```

### Running in Development

Start the application with hot module replacement (HMR):

```bash
npm run dev
```

---

## Running Tests

RelayTorrent includes a comprehensive test suite covering unit logic, synthetic swarm transfers, and end-to-end Electron interactions:

```bash
# Run all unit tests (piece hashing, socket binding, state machine, settings)
npm test

# Run specific unit test suites
npm run test:unit

# Run synthetic swarm & piece integrity integration tests
npm run test:integration

# Run end-to-end Playwright tests in headless Electron
npm run test:e2e

# Perform static type checking across main, preload, and renderer
npm run typecheck
```

---

## Building Installers

Package RelayTorrent for distribution:

```bash
# Compile and build production bundles
npm run build

# Windows installer (.exe)
npm run build:win

# macOS disk image (.dmg)
npm run build:mac

# Linux AppImage (.AppImage)
npm run build:linux

# Unpacked directory for local testing
npm run build:unpack
```

Packaged installers and binaries will be generated inside the `dist/` directory.

---

## Tech Stack

- **Runtime & Desktop Shell**: [Electron 34](https://www.electronjs.org/)
- **UI Framework**: [React 19](https://react.dev/)
- **Build System**: [electron-vite](https://electron-vite.org/) & [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript 5.7](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand)
- **Torrent Engine**: [WebTorrent](https://webtorrent.io/) & Native Socket Binding Interceptor
- **Persistence**: SQLite with atomic transaction journaling
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/)

---

## License

This project is licensed under the [MIT License](LICENSE).
