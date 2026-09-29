# Multi-Interface Networking Architecture & Routing Model

## Overview
RelayTorrent detects active, non-loopback network adapters on Windows, macOS, and Linux, enabling users to harness multiple physical connections (such as simultaneous Wi-Fi, Ethernet, and USB tethering).

## Interface Discovery Mechanics

### 1. Windows (PowerShell `Get-NetAdapter`)
Queries Windows Management Instrumentation (WMI) via PowerShell for adapter names, physical media types (`NdisPhysicalMedium`), link speeds, and hardware descriptions:
- `NdisPhysicalMedium = 1 | 9` -> `wifi`
- `NdisPhysicalMedium = 14` -> `ethernet`
- Descriptions matching RNDIS / Apple USB -> `usb`

### 2. macOS (`networksetup -listallhardwareports`)
Maps BSD device names (`en0`, `en1`) to human-readable hardware ports (Wi-Fi, iPhone USB, Thunderbolt Ethernet).

### 3. Linux (`/sys/class/net` & `ip route`)
Inspects interface operational state, sysfs wireless markers, and local addresses.

## Socket Binding & OS Routing Behavior

- **Windows & macOS (Strong/Weak Host Model)**:
  Specifying `localAddress` on outgoing TCP connections (`net.Socket`) binds the socket's source IP. The OS kernel routes packets through the interface that owns that source IP address.
- **Linux (`SO_BINDTODEVICE`)**:
  On Linux, by default the kernel routes packets via the main routing table regardless of source IP. Sockets bound via `SO_BINDTODEVICE` (using libc FDs via `koffi`) guarantee packets exit the intended physical device.

## Interface Policies

1. **Automatic**: All active, healthy, and user-enabled interfaces are utilized in round-robin / load-balanced peer swarm allocation.
2. **Preferred**: Selected interfaces are prioritized for tracker announces and initial peer handshakes.
3. **Single Interface**: All engine traffic (peer connections, DHT, tracker announces) is strictly pinned to one chosen interface.
4. **Custom**: User explicitly toggles individual interfaces on or off and assigns custom labels and colors.

## Dynamic Interface Transitions
When an interface is disconnected or disappears:
- Active peer connections on that interface fail gracefully with network reset errors.
- The interface is marked `offline` in the UI.
- The torrent engine redistributes pending piece requests and peer handshakes to remaining online interfaces.
- When the interface reconnects, it is automatically re-evaluated and restored to the routing pool.
