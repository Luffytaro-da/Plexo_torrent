import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type { IpcContract } from '../shared/ipc-contract'
import type { PieceState, SystemTelemetry, TorrentState } from '../shared/types'

type ContractApi = {
  [K in keyof IpcContract]: (
    ...args: IpcContract[K]['args']
  ) => Promise<IpcContract[K]['result']>
}

const methodToChannel: Record<keyof IpcContract, string> = {
  listInterfaces: IpcChannels.LIST_INTERFACES,
  refreshInterfaces: IpcChannels.REFRESH_INTERFACES,
  setInterfaceEnabled: IpcChannels.SET_INTERFACE_ENABLED,
  setInterfacePreference: IpcChannels.SET_INTERFACE_PREFERENCE,
  inspectTorrentMetadata: IpcChannels.INSPECT_TORRENT_METADATA,
  addTorrent: IpcChannels.ADD_TORRENT,
  startTorrent: IpcChannels.START_TORRENT,
  pauseTorrent: IpcChannels.PAUSE_TORRENT,
  resumeTorrent: IpcChannels.RESUME_TORRENT,
  recheckTorrent: IpcChannels.RECHECK_TORRENT,
  removeTorrent: IpcChannels.REMOVE_TORRENT,
  setFilePriorities: IpcChannels.SET_FILE_PRIORITIES,
  setTorrentInterfacePolicy: IpcChannels.SET_TORRENT_INTERFACE_POLICY,
  setTorrentLimits: IpcChannels.SET_TORRENT_LIMITS,
  getAllTorrents: IpcChannels.GET_ALL_TORRENTS,
  getTorrentPieceStates: IpcChannels.GET_TORRENT_PIECE_STATES,
  getSettings: IpcChannels.GET_SETTINGS,
  updateSettings: IpcChannels.UPDATE_SETTINGS,
  chooseDirectory: IpcChannels.CHOOSE_DIRECTORY,
  chooseTorrentFile: IpcChannels.CHOOSE_TORRENT_FILE,
  revealInFolder: IpcChannels.REVEAL_IN_FOLDER
}

const contractMethods = {} as ContractApi
for (const [method, channel] of Object.entries(methodToChannel)) {
  contractMethods[method as keyof IpcContract] = (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args) as never
}

export const relayTorrentApi = {
  ...contractMethods,
  onTorrentsUpdated: (callback: (torrents: TorrentState[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, torrents: TorrentState[]) => callback(torrents)
    ipcRenderer.on(IpcChannels.TORRENTS_UPDATED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TORRENTS_UPDATED, handler)
  },
  onTelemetryUpdated: (callback: (telemetry: SystemTelemetry) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, telemetry: SystemTelemetry) => callback(telemetry)
    ipcRenderer.on(IpcChannels.TELEMETRY_UPDATED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.TELEMETRY_UPDATED, handler)
  },
  onPieceStatesUpdated: (callback: (infoHash: string, pieceStates: PieceState[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, infoHash: string, pieceStates: PieceState[]) =>
      callback(infoHash, pieceStates)
    ipcRenderer.on(IpcChannels.PIECE_STATES_UPDATED, handler)
    return () => ipcRenderer.removeListener(IpcChannels.PIECE_STATES_UPDATED, handler)
  },
  onEngineError: (callback: (infoHash: string | null, error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, infoHash: string | null, error: string) =>
      callback(infoHash, error)
    ipcRenderer.on(IpcChannels.ENGINE_ERROR, handler)
    return () => ipcRenderer.removeListener(IpcChannels.ENGINE_ERROR, handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('relayTorrent', relayTorrentApi)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as unknown as { relayTorrent: typeof relayTorrentApi }).relayTorrent = relayTorrentApi
}
