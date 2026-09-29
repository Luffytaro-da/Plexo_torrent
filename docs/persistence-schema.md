# Persistence Schema & Crash Recovery

## Database Architecture
RelayTorrent uses a versioned, atomic structured JSON store located in the user data directory:
- Windows: `%APPDATA%/RelayTorrent/state.json`
- macOS: `~/Library/Application Support/RelayTorrent/state.json`
- Linux: `~/.config/RelayTorrent/state.json`

## Schema Definition (Version 1)

```typescript
export interface PersistedState {
  version: number // Current schema: 1
  lastSavedAt: number
  settings: PersistedSettings
  torrents: Record<string, PersistedTorrentRecord>
  networkPreferences: Record<string, PersistedNetworkConfig>
}

export interface PersistedTorrentRecord {
  infoHash: string
  name: string
  magnetUri?: string
  torrentFilePath?: string
  savePath: string
  status: 'paused' | 'downloading' | 'completed' | 'seeding' | 'checking' | 'error' | 'stalled'
  addedAt: number
  completedAt: number | null
  totalBytes: number
  pieceLength: number
  numPieces: number
  verifiedBitfield: string // Hex-encoded bitfield of verified pieces
  selectedFileIndices: number[]
  filePriorities: Record<number, 'skip' | 'low' | 'normal' | 'high'>
  interfacePolicy: {
    mode: 'automatic' | 'preferred' | 'single' | 'custom'
    targetInterfaceId?: string
    enabledInterfaceIds?: string[]
  }
  downloadLimitBytesPerSec?: number
  uploadLimitBytesPerSec?: number
  maxRatio?: number
  uploadedBytes: number
  downloadedBytes: number
  errorMessage?: string
}
```

## Atomic Write Protocol
1. Serialize data into JSON formatted buffer.
2. Write to temporary file `${filePath}.tmp.${Date.now()}`.
3. Flush and sync file descriptor to physical disk.
4. Atomically rename temporary file over target file (`fs.rename`).

## Recovery Protocol on Startup
1. Load and parse `state.json`. If corrupted, attempt to recover from `.bak` backup.
2. Verify schema version and run any necessary migrations.
3. For each persisted torrent:
   - Instantiate torrent engine session.
   - If previous state was `downloading` or `seeding`:
     - Inspect physical files on disk at `savePath`.
     - Recheck piece hashes against disk files if files were modified or verify saved bitfield.
     - Resume downloading or seeding seamlessly without re-downloading existing verified pieces.
