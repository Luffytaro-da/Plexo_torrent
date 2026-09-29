import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IpcChannels } from '../shared/ipc-channels'
import type { PieceState, SystemTelemetry, TorrentState } from '../shared/types'
import { TorrentEngine } from './engine/torrentEngine'
import { registerIpcHandlers } from './ipc/handlers'
import { Database } from './persistence/database'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let engine: TorrentEngine | null = null
let database: Database | null = null

function getPreloadPath(): string {
  const cjs = join(__dirname, '../preload/index.cjs')
  if (existsSync(cjs)) return cjs
  const mjs = join(__dirname, '../preload/index.mjs')
  if (existsSync(mjs)) return mjs
  return join(__dirname, '../preload/index.js')
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: process.env.RELAY_HIDE_WINDOW !== '1',
    autoHideMenuBar: true,
    title: 'RelayTorrent',
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  window.on('ready-to-show', () => {
    if (process.env.RELAY_HIDE_WINDOW !== '1') {
      window.show()
    }
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load remote URL in dev or local HTML in prod
  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(async () => {
  const userDataDir = process.env.RELAY_USER_DATA || app.getPath('userData')
  const defaultDownloadDir = app.getPath('downloads')

  database = new Database(userDataDir, defaultDownloadDir)
  await database.initialize()

  const events = {
    onTorrentsUpdated: (torrents: TorrentState[]) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.TORRENTS_UPDATED, torrents)
      }
    },
    onTelemetryUpdated: (telemetry: SystemTelemetry) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.TELEMETRY_UPDATED, telemetry)
      }
    },
    onPieceStatesUpdated: (infoHash: string, pieceStates: PieceState[]) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.PIECE_STATES_UPDATED, infoHash, pieceStates)
      }
    },
    onError: (infoHash: string | null, error: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.ENGINE_ERROR, infoHash, error)
      }
    }
  }

  engine = new TorrentEngine(database.getSettings(), database, events)
  await engine.initialize(database.getSettings())

  mainWindow = createWindow()
  registerIpcHandlers(mainWindow, engine, database)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('before-quit', async () => {
  if (engine) {
    await engine.destroy()
  }
  if (database) {
    await database.saveImmediate()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
