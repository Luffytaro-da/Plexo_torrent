import type {
  AddTorrentOptions,
  GlobalSettings,
  InterfacePolicy,
  NetworkInterfaceInfo,
  PieceState,
  TorrentFilePriority,
  TorrentMetadataInspectResult,
  TorrentState
} from './types'

export interface IpcContract {
  listInterfaces: { args: []; result: NetworkInterfaceInfo[] }
  refreshInterfaces: { args: []; result: NetworkInterfaceInfo[] }
  setInterfaceEnabled: { args: [id: string, enabled: boolean]; result: NetworkInterfaceInfo[] }
  setInterfacePreference: {
    args: [id: string, patch: { label?: string; color?: string }]
    result: NetworkInterfaceInfo[]
  }

  inspectTorrentMetadata: {
    args: [source: { type: 'magnet'; uri: string } | { type: 'file'; filePath: string }]
    result: TorrentMetadataInspectResult
  }
  addTorrent: { args: [options: AddTorrentOptions]; result: string }
  startTorrent: { args: [infoHash: string]; result: void }
  pauseTorrent: { args: [infoHash: string]; result: void }
  resumeTorrent: { args: [infoHash: string]; result: void }
  recheckTorrent: { args: [infoHash: string]; result: void }
  removeTorrent: { args: [infoHash: string, deleteFiles: boolean]; result: void }

  setFilePriorities: {
    args: [infoHash: string, priorities: Record<number, TorrentFilePriority>]
    result: void
  }
  setTorrentInterfacePolicy: {
    args: [infoHash: string, policy: InterfacePolicy]
    result: void
  }
  setTorrentLimits: {
    args: [
      infoHash: string,
      limits: { downloadLimit?: number; uploadLimit?: number; seedingRatioLimit?: number }
    ]
    result: void
  }

  getAllTorrents: { args: []; result: TorrentState[] }
  getTorrentPieceStates: { args: [infoHash: string]; result: PieceState[] }
  getSettings: { args: []; result: GlobalSettings }
  updateSettings: { args: [patch: Partial<GlobalSettings>]; result: GlobalSettings }

  chooseDirectory: { args: [defaultPath?: string]; result: string | null }
  chooseTorrentFile: { args: []; result: string | null }
  revealInFolder: { args: [targetPath: string]; result: void }
  getRoutingDiagnostics: { args: []; result: import('./types').RoutingDiagnosticsReport }
}
