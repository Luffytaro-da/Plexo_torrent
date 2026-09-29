import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import type { ITorrentEngineAdapter } from '../engine/adapter'
import type { Database } from '../persistence/database'
import { IpcValidator } from './validator'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  engine: ITorrentEngineAdapter,
  database: Database
): void {
  // Interfaces
  ipcMain.handle(IpcChannels.LIST_INTERFACES, async () => {
    return engine.getInterfaces()
  })

  ipcMain.handle(IpcChannels.REFRESH_INTERFACES, async () => {
    return engine.refreshInterfaces()
  })

  ipcMain.handle(IpcChannels.SET_INTERFACE_ENABLED, async (_event, id: string, enabled: boolean) => {
    const current = database.getNetworkConfig(id) || { id, enabled }
    database.setNetworkConfig({ ...current, enabled })
    return engine.refreshInterfaces()
  })

  ipcMain.handle(
    IpcChannels.SET_INTERFACE_PREFERENCE,
    async (_event, id: string, patch: { label?: string; color?: string }) => {
      const current = database.getNetworkConfig(id) || { id, enabled: true }
      database.setNetworkConfig({ ...current, ...patch })
      return engine.refreshInterfaces()
    }
  )

  // Torrent Actions
  ipcMain.handle(IpcChannels.INSPECT_TORRENT_METADATA, async (_event, source) => {
    return engine.inspectMetadata(source)
  })

  ipcMain.handle(IpcChannels.ADD_TORRENT, async (_event, options) => {
    const validated = IpcValidator.validateAddTorrent(options)
    return engine.addTorrent(validated)
  })

  ipcMain.handle(IpcChannels.START_TORRENT, async (_event, infoHash: string) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.startTorrent(validatedHash)
  })

  ipcMain.handle(IpcChannels.PAUSE_TORRENT, async (_event, infoHash: string) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.pauseTorrent(validatedHash)
  })

  ipcMain.handle(IpcChannels.RESUME_TORRENT, async (_event, infoHash: string) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.resumeTorrent(validatedHash)
  })

  ipcMain.handle(IpcChannels.RECHECK_TORRENT, async (_event, infoHash: string) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.recheckTorrent(validatedHash)
  })

  ipcMain.handle(IpcChannels.REMOVE_TORRENT, async (_event, infoHash: string, deleteFiles: boolean) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.removeTorrent(validatedHash, Boolean(deleteFiles))
  })

  ipcMain.handle(IpcChannels.SET_FILE_PRIORITIES, async (_event, infoHash: string, priorities) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    const validatedPriorities = IpcValidator.validateFilePriorities(priorities)
    return engine.setFilePriorities(validatedHash, validatedPriorities)
  })

  ipcMain.handle(IpcChannels.SET_TORRENT_INTERFACE_POLICY, async (_event, infoHash: string, policy) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    const validatedPolicy = IpcValidator.validateInterfacePolicy(policy)
    return engine.setTorrentInterfacePolicy(validatedHash, validatedPolicy)
  })

  ipcMain.handle(IpcChannels.SET_TORRENT_LIMITS, async (_event, infoHash: string, limits) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.setTorrentLimits(validatedHash, limits || {})
  })

  // Queries & Settings
  ipcMain.handle(IpcChannels.GET_ALL_TORRENTS, async () => {
    return engine.getAllTorrents()
  })

  ipcMain.handle(IpcChannels.GET_TORRENT_PIECE_STATES, async (_event, infoHash: string) => {
    const validatedHash = IpcValidator.validateInfoHash(infoHash)
    return engine.getTorrentPieceStates(validatedHash)
  })

  ipcMain.handle(IpcChannels.GET_SETTINGS, async () => {
    return database.getSettings()
  })

  ipcMain.handle(IpcChannels.UPDATE_SETTINGS, async (_event, patch) => {
    const validatedPatch = IpcValidator.validateSettingsPatch(patch)
    const updated = database.updateSettings(validatedPatch)
    await engine.updateSettings(updated)
    return updated
  })

  // System Dialogs & Shell
  ipcMain.handle(IpcChannels.CHOOSE_DIRECTORY, async (_event, defaultPath?: string) => {
    const res = await dialog.showOpenDialog(mainWindow, {
      defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle(IpcChannels.CHOOSE_TORRENT_FILE, async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'BitTorrent Files', extensions: ['torrent'] }],
      properties: ['openFile']
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle(IpcChannels.REVEAL_IN_FOLDER, async (_event, targetPath: string) => {
    if (targetPath) {
      shell.showItemInFolder(targetPath)
    }
  })

  ipcMain.handle(IpcChannels.GET_ROUTING_DIAGNOSTICS, async () => {
    return engine.getRoutingDiagnostics()
  })
}
