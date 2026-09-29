# Threat and Safety Model

## 1. Path Traversal & Unsafe Filenames
- **Threat**: Malicious torrent metadata containing paths with `../`, `..\\`, absolute root paths (`/etc/passwd`, `C:\Windows\System32`), or null bytes.
- **Defense**:
  - Filename and path normalization using strict sanitization.
  - Verification that every resolved file path resides strictly within the user-approved destination directory (`path.resolve` check against `savePath`).
  - Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) are sanitized.

## 2. Malformed Metadata & Bencode Exploits
- **Threat**: Deeply nested bencode structures causing stack overflow, corrupted info dictionaries, or invalid integer formats.
- **Defense**:
  - Safe bencode decoding with depth limits and bounded input byte sizes.
  - Validation of piece hash lengths (must be exact multiple of 20 bytes).
  - Validation of file sizes (non-negative, total matching sum of files).

## 3. Untrusted Swarm Peers & Corrupted Data
- **Threat**: Malicious peers sending garbage data or attempting Sybil attacks.
- **Defense**:
  - 100% SHA-1 verification on every piece before marking complete or saving to disk.
  - Corrupted pieces trigger immediate discard, peer score penalty, and re-request from alternative swarm peers.
  - Bounded request queues preventing buffer bloat or memory exhaustion from slow/stalled peers.

## 4. Electron Security Boundary
- **Threat**: Renderer compromise leading to arbitrary local filesystem or network access.
- **Defense**:
  - `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
  - Typed IPC with strict schema validation at the main process boundary.
  - Renderer never has direct disk access or raw socket access.

## 5. Disk Space & Permission Hazards
- **Threat**: Disk filling up mid-download causing corruption or system lockup.
- **Defense**:
  - Pre-allocation checks against available disk space before starting downloads.
  - Graceful error handling for `ENOSPC`, `EACCES`, and `EROFS` errors, pausing the torrent safely and alerting the user.
