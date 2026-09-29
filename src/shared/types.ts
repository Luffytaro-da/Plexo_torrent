export type InterfaceRoutingDetailedStatus =
  | 'detected'
  | 'enabled'
  | 'selected'
  | 'socket-bound'
  | 'connected'
  | 'transferring'
  | 'confirmed physical traffic'
  | 'fallback'
  | 'unsupported'
  | 'offline'
  | 'idle'

export type NetworkInterfaceKind = 'wifi' | 'ethernet' | 'usb' | 'bridge' | 'other'

export interface NetworkInterfaceInfo {
  id: string
  device: string
  displayName: string
  address: string
  ipv6Addresses: string[]
  kind: NetworkInterfaceKind
  mac?: string
  enabled: boolean
  label?: string
  color?: string
  downloadSpeed: number
  uploadSpeed: number
  bytesDownloaded: number
  bytesUploaded: number
  activePeers: number
  isOnline: boolean
  physicalBytesReceived?: number
  physicalBytesSent?: number
  physicalDownloadSpeed?: number
  physicalUploadSpeed?: number
  isPhysicallyConfirmed?: boolean
  routingState?: InterfaceRoutingDetailedStatus
}

export type InterfacePolicyMode = 'automatic' | 'preferred' | 'single' | 'custom'

export interface InterfacePolicy {
  mode: InterfacePolicyMode
  targetInterfaceId?: string
  enabledInterfaceIds?: string[]
}

export type TorrentStatus =
  | 'restored'
  | 'stalled'
  | 'checking'
  | 'downloading'
  | 'completed'
  | 'seeding'
  | 'paused'
  | 'error'

export type PieceState =
  | 'missing'
  | 'requested'
  | 'downloading'
  | 'verified'
  | 'corrupted'
  | 'skipped'

export type VerificationStatus =
  | 'idle'
  | 'preparing'
  | 'checking'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface VerificationJobState {
  status: VerificationStatus
  totalPiecesToCheck: number
  piecesChecked: number
  verifiedPieces: number
  missingPieces: number
  corruptedPieces: number
  totalBytesToCheck: number
  bytesChecked: number
  currentPieceIndex: number | null
  speed: number
  eta: number | null
  startTime: number | null
  completionTime: number | null
  errorMessage?: string
}

export type TorrentFilePriority = 'skip' | 'low' | 'normal' | 'high'

export interface TorrentFileInfo {
  index: number
  name: string
  path: string
  length: number
  bytesCompleted: number
  progress: number
  priority: TorrentFilePriority
  selected: boolean
}

export interface TorrentTrackerInfo {
  announce: string
  tier?: number
  status: 'contacting' | 'working' | 'updating' | 'error'
  message?: string
  peers: number
  seeds: number
  leechers: number
  lastAnnounce?: number
  nextAnnounce?: number
}

export interface TorrentPeerInfo {
  id: string
  ip: string
  port: number
  client?: string
  downloadSpeed: number
  uploadSpeed: number
  progress: number
  protocol?: 'tcp' | 'utp' | 'webrtc'
  interfaceId?: string
  interfaceName?: string
  selectedLocalAddress?: string
  actualLocalAddress?: string
  connectionStatus?: 'connecting' | 'connected' | 'failed' | 'closed'
  bytesReceived?: number
  bytesUploaded?: number
  fallbackReason?: string
  choked: boolean
  choking: boolean
  interested: boolean
  interesting: boolean
}

export interface PieceInfo {
  index: number
  length: number
  state: PieceState
  availability: number
  bytesReceived: number
  interfaceId?: string
  retryCount: number
}

export interface ActivityLogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface TorrentInterfaceTelemetry {
  interfaceId: string
  interfaceName: string
  localAddress: string
  activePeerCount: number
  connectedPeerCount: number
  connectingPeerCount: number
  activePeerIds: string[]
  connectionCount: number
  successfullyBoundConnectionCount: number
  fallbackConnectionCount: number
  downloadBytes: number
  uploadBytes: number
  currentDownloadSpeed: number
  currentUploadSpeed: number
  downloadContributionPercent: number
  uploadContributionPercent: number
  lastActivityTime: number | null
  routingStatus: InterfaceRoutingDetailedStatus
  bindingCapability: 'fully_supported' | 'partial' | 'best_effort' | 'unsupported'
  bindingCapabilityReason?: string
  physicalBytesReceived?: number
  physicalBytesSent?: number
  physicalDownloadSpeed?: number
  physicalUploadSpeed?: number
  isPhysicallyConfirmed?: boolean
}

export interface TorrentState {
  infoHash: string
  name: string
  magnetUri?: string
  torrentFilePath?: string
  savePath: string
  status: TorrentStatus
  totalBytes: number
  downloadedBytes: number
  uploadedBytes: number
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  eta: number | null
  ratio: number
  numPieces: number
  pieceLength: number
  verifiedPieces: number
  remainingPieces: number
  requestedPieces: number
  downloadingPieces: number
  missingPieces: number
  corruptedPieces: number
  skippedPieces: number
  verifiedBytes: number
  remainingBytes: number
  files: TorrentFileInfo[]
  trackers: TorrentTrackerInfo[]
  peers: TorrentPeerInfo[]
  peerCount: number
  seedCount: number
  interfacePolicy: InterfacePolicy
  downloadLimit?: number
  uploadLimit?: number
  seedingRatioLimit?: number
  addedAt: number
  completedAt: number | null
  errorMessage?: string
  pieceStates?: PieceState[]
  interfaceTelemetry?: TorrentInterfaceTelemetry[]
  verificationJob?: VerificationJobState
  activityLogs: ActivityLogEntry[]
}

export interface AddTorrentOptions {
  source:
    | { type: 'magnet'; uri: string }
    | { type: 'file'; filePath: string; fileData?: Uint8Array }
  savePath: string
  fileIndices?: number[]
  filePriorities?: Record<number, TorrentFilePriority>
  interfacePolicy?: InterfacePolicy
  startImmediately?: boolean
  downloadLimit?: number
  uploadLimit?: number
  seedingRatioLimit?: number
}

export interface TorrentMetadataInspectResult {
  infoHash: string
  name: string
  totalBytes: number
  pieceLength: number
  numPieces: number
  files: { index: number; name: string; path: string; length: number }[]
  trackers: string[]
}

export interface GlobalSettings {
  defaultSavePath: string
  maxActiveDownloads: number
  maxActiveSeeds: number
  maxConnsPerTorrent?: number
  maxGlobalConns?: number
  globalDownloadLimit?: number
  globalUploadLimit?: number
  defaultInterfacePolicy: InterfacePolicy
  theme: 'dark' | 'light' | 'system'
  enableDht: boolean
  enablePex: boolean
  enableLsd: boolean
  enableUpnp?: boolean
  autoStartDownloads?: boolean
  listenPort: number
}

export interface SystemTelemetry {
  totalDownloadSpeed: number
  totalUploadSpeed: number
  totalBytesDownloaded: number
  totalBytesUploaded: number
  activeTorrentsCount: number
  interfaces: NetworkInterfaceInfo[]
}

export interface PeerDiagnosticRecord {
  id: string
  infoHash: string
  ip: string
  port: number
  protocol: 'tcp' | 'utp' | 'webrtc'
  selectedInterfaceId?: string
  selectedInterfaceName?: string
  selectedLocalAddress?: string
  actualLocalAddress?: string
  actualWindowsAdapter?: string
  connectionResult: 'pending' | 'connected' | 'failed' | 'closed'
  handshakeResult: 'pending' | 'success' | 'failed'
  receivedBytes: number
  uploadedBytes: number
  fallbackReason?: string
  timestamp: number
}

export interface RoutingDiagnosticsReport {
  timestamp: number
  platform: string
  bindingCapability: string
  interfaces: NetworkInterfaceInfo[]
  physicalAdapterStats: { name: string; receivedBytes: number; sentBytes: number }[]
  routesSummary: { destinationPrefix: string; nextHop: string; interfaceAlias: string; metric: number }[]
  activePeersDiagnostics: PeerDiagnosticRecord[]
}
