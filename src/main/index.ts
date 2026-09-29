import { app, BrowserWindow, Menu, nativeImage, Notification, shell, Tray } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IpcChannels } from '../shared/ipc-channels'
import type { GlobalSettings, PieceState, SystemTelemetry, TorrentState } from '../shared/types'
import { TorrentEngine } from './engine/torrentEngine'
import { registerIpcHandlers } from './ipc/handlers'
import { Database } from './persistence/database'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let engine: TorrentEngine | null = null
let database: Database | null = null
let tray: Tray | null = null
let isQuitting = false
const notifiedCompletedTorrents = new Set<string>()

function getPreloadPath(): string {
  const cjs = join(__dirname, '../preload/index.cjs')
  if (existsSync(cjs)) return cjs
  const mjs = join(__dirname, '../preload/index.mjs')
  if (existsSync(mjs)) return mjs
  return join(__dirname, '../preload/index.js')
}

function applyLoginItemSettings(settings: GlobalSettings): void {
  if (process.platform === 'win32') {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!settings.startWithWindows,
        openAsHidden: !!settings.startMinimized
      })
    } catch (err) {
      console.warn('[Main] Failed to update login item settings:', err)
    }
  }
}

function setupTray(window: BrowserWindow): void {
  if (tray) return
  try {
    const icon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACZcDCBGBhAGRgwVDEYNgGE0jAegGICpZ2Bg+A8E/6lhPgw0DqhhPgww4f/hYgAG3hXf3o1V8wAAAABJRU5ErkJggg==',
        'base64'
      )
    )
    tray = new Tray(icon)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open RelayTorrent',
        click: () => {
          window.show()
          window.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
    tray.setToolTip('RelayTorrent')
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => {
      window.show()
      window.focus()
    })
  } catch (err) {
    console.warn('[Main] Tray creation error:', err)
  }
}

function createWindow(settings?: GlobalSettings): BrowserWindow {
  const shouldHideInitially =
    process.env.RELAY_HIDE_WINDOW === '1' || (settings?.startMinimized && !process.env.ELECTRON_RENDERER_URL)

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: !shouldHideInitially,
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
    if (!shouldHideInitially) {
      window.show()
    }
  })

  window.on('minimize', () => {
    const s = database?.getSettings()
    if (s?.minimizeToTray) {
      window.hide()
    }
  })

  window.on('close', (event) => {
    const s = database?.getSettings()
    if (s?.closeToTray && !isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  setupTray(window)

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

  const initialSettings = database.getSettings()
  applyLoginItemSettings(initialSettings)

  const events = {
    onTorrentsUpdated: (torrents: TorrentState[]) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IpcChannels.TORRENTS_UPDATED, torrents)
      }

      // Check for completed torrents to notify / open folder
      for (const t of torrents) {
        if (t.status === 'completed' || (t.status === 'seeding' && t.completedAt && t.progress >= 1)) {
          if (!notifiedCompletedTorrents.has(t.infoHash)) {
            notifiedCompletedTorrents.add(t.infoHash)
            const s = database?.getSettings()
            if (s?.showCompletionNotifications && Notification.isSupported()) {
              try {
                new Notification({
                  title: 'Download Finished',
                  body: `${t.name} has finished downloading.`
                }).show()
              } catch {}
            }
            if (s?.openFolderOnCompletion && t.savePath) {
              try {
                void shell.openPath(t.savePath)
              } catch {}
            }
          }
        }
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
      const s = database?.getSettings()
      if (s?.showErrorNotifications && Notification.isSupported()) {
        try {
          new Notification({
            title: 'RelayTorrent Error',
            body: error
          }).show()
        } catch {}
      }
    }
  }

  engine = new TorrentEngine(initialSettings, database, events)
  await engine.initialize(initialSettings)

  mainWindow = createWindow(initialSettings)
  registerIpcHandlers(mainWindow, engine, database, (settings) => {
    applyLoginItemSettings(settings)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(database?.getSettings())
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (tray) {
    try {
      tray.destroy()
    } catch {}
    tray = null
  }
  if (database) {
    database.saveSync()
  }
  if (engine) {
    void engine.destroy()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
