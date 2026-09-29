# Known Limitations & Unsupported Features

## 1. Multi-Interface Socket Attribution
- **Windows / macOS**:
  - Outgoing TCP peer connections and tracker requests can be bound to specific interface IP addresses (`localAddress`).
  - Incoming peer connections arrive on whatever interface the remote peer connects to via port forwarding or UPnP/NAT-PMP.
- **Linux**:
  - Outgoing TCP socket binding to specific devices requires `SO_BINDTODEVICE` via libc. In environments where unprivileged socket binding is restricted (e.g. strict container policies), RelayTorrent falls back to standard routing table dispatch.

## 2. Content Scope
- RelayTorrent is designed exclusively for user-provided magnet links and legal `.torrent` files. It does not provide built-in torrent search indexing, DHT search scraping, or piracy portals.

## 3. Protocol Limitations
- **IPv6 Multi-Homed Routing**: RelayTorrent fully detects IPv6 addresses; however, per-interface source IP pinning is prioritized on IPv4 where routing tables are strictly deterministic.
- **uTP over UDP multi-homing**: Node `dgram` socket binding is applied per listening interface port.
