import type {
  AddTorrentOptions,
  GlobalSettings,
  InterfacePolicy,
  PieceState,
  SystemTelemetry,
  TorrentFilePriority,
  TorrentMetadataInspectResult,
  TorrentState
} from '../../shared/types'

export interface TorrentEngineEvents {
  onTorrentsUpdated: (torrents: TorrentState[]) => void
  onTelemetryUpdated: (telemetry: SystemTelemetry) => void
  onPieceStatesUpdated: (infoHash: string, pieceStates: PieceState[]) => void
  onError: (infoHash: string | null, error: string) => void
}

export interface ITorrentEngineAdapter {
  initialize(settings: GlobalSettings): Promise<void>
  destroy(): Promise<void>

  inspectMetadata(
    source: { type: 'magnet'; uri: string } | { type: 'file'; filePath: string; fileData?: Uint8Array }
  ): Promise<TorrentMetadataInspectResult>

  addTorrent(options: AddTorrentOptions): Promise<string>
  startTorrent(infoHash: string): Promise<void>
  pauseTorrent(infoHash: string): Promise<void>
  resumeTorrent(infoHash: string): Promise<void>
  recheckTorrent(infoHash: string): Promise<void>
  removeTorrent(infoHash: string, deleteFiles: boolean): Promise<void>

  setFilePriorities(infoHash: string, priorities: Record<number, TorrentFilePriority>): Promise<void>
  setTorrentInterfacePolicy(infoHash: string, policy: InterfacePolicy): Promise<void>
  setTorrentLimits(
    infoHash: string,
    limits: { downloadLimit?: number; uploadLimit?: number; seedingRatioLimit?: number }
  ): Promise<void>

  getAllTorrents(): TorrentState[]
  getTorrent(infoHash: string): TorrentState | undefined
  getTorrentPieceStates(infoHash: string): PieceState[]

  updateSettings(settings: GlobalSettings): Promise<void>
  refreshInterfaces(): Promise<import('../../shared/types').NetworkInterfaceInfo[]>
  getInterfaces(): import('../../shared/types').NetworkInterfaceInfo[]
  getRoutingDiagnostics(): Promise<import('../../shared/types').RoutingDiagnosticsReport>
}
