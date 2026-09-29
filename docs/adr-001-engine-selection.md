# ADR 001: Torrent Engine Selection for RelayTorrent

## Status
Accepted

## Context
RelayTorrent is a modern desktop BitTorrent client targeting Windows 10/11, macOS, and Linux. The requirements demand:
- Fast magnet metadata resolution (`ut_metadata` BEP 9)
- Multi-tracker support (HTTP, HTTPS, UDP BEP 15)
- Swarm discovery (DHT BEP 5, Peer Exchange BEP 11, Local Service Discovery)
- TCP and uTP transport
- Exact piece hash verification (SHA-1 piece verification)
- Resumable state persistence
- Dynamic file selection and prioritization
- Upload and download bandwidth shaping
- Flexible multi-interface network binding
- Reliable cross-platform packaging without native C++ compilation breakage across Electron ABI versions.

### Evaluated Options

1. **libtorrent-rasterbar (`node-libtorrent` / native bindings)**:
   - *Pros*: Battle-tested C++ BitTorrent library with rich feature set.
   - *Cons*: Heavy native build dependencies (`boost`, `OpenSSL`, C++20 toolchains). Node-gyp compilation across Windows MSVC, macOS clang, and Linux gcc regularly fails during CI/CD, packaging, and Electron ABI version upgrades.
2. **Rust-based BitTorrent Engine (e.g. `rqbit` / `cratetorrent` via N-API)**:
   - *Pros*: Fast memory safety.
   - *Cons*: Immature N-API bindings, lacks complete JavaScript ecosystem integration for dynamic piece hooks and custom network interface socket binding without low-level Rust patching.
3. **WebTorrent Core + Extended Node BitTorrent Ecosystem (`webtorrent`, `parse-torrent`, `bittorrent-tracker`, `create-torrent`)**:
   - *Pros*: 100% TypeScript/JavaScript execution in Electron's Node main process, zero native C++ ABI compile issues, fully supports UDP/HTTP trackers, DHT, PEX, magnet links, piece verification, block requests, custom chunk storage, and standard Node `net`/`dgram` socket binding across network interfaces.
   - *Cons*: Requires custom piece manager and socket binding orchestration for multi-homed routing policies.

## Decision
We choose the **Node/WebTorrent BitTorrent Core Engine** encapsulated behind a strict `TorrentEngineAdapter` interface. This provides reliable cross-platform packaging, seamless testability with deterministic in-memory swarms, full protocol compliance (BEP 3, 5, 9, 10, 11, 15, 29), and direct access to piece verification and socket routing layers.

## Consequences
- Guaranteed cross-platform stability on Windows, macOS, and Linux.
- Fast, zero-native-compilation test cycles with Vitest and Playwright.
- Engine implementation is completely decoupled from the UI and IPC layers via an adapter pattern.
