import type {
  GlobalSettings,
  InterfacePolicy,
  TorrentFilePriority,
  TorrentStatus
} from '../../shared/types'

export const CURRENT_SCHEMA_VERSION = 1

export interface PersistedNetworkConfig {
  id: string
  enabled: boolean
  label?: string
  color?: string
}

export interface PersistedTorrentRecord {
  infoHash: string
  name: string
  magnetUri?: string
  torrentFilePath?: string
  savePath: string
  status: TorrentStatus
  addedAt: number
  completedAt: number | null
  totalBytes: number
  pieceLength: number
  numPieces: number
  verifiedBitfield: string
  selectedFileIndices: number[]
  filePriorities: Record<number, TorrentFilePriority>
  interfacePolicy: InterfacePolicy
  downloadLimit?: number
  uploadLimit?: number
  seedingRatioLimit?: number
  uploadedBytes: number
  downloadedBytes: number
  errorMessage?: string
}

export interface PersistedState {
  version: number
  lastSavedAt: number
  settings: GlobalSettings
  torrents: Record<string, PersistedTorrentRecord>
  networkPreferences: Record<string, PersistedNetworkConfig>
}
