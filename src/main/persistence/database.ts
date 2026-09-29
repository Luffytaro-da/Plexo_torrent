import { copyFileSync, existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_LISTEN_PORT } from '../../shared/constants'
import type { GlobalSettings } from '../../shared/types'
import {
  CURRENT_SCHEMA_VERSION,
  type PersistedNetworkConfig,
  type PersistedState,
  type PersistedTorrentRecord
} from './schema'

export const SETTINGS_SECTIONS = {
  general: [
    'startWithWindows',
    'startMinimized',
    'minimizeToTray',
    'closeToTray',
    'autoStartRestoredTorrents',
    'autoStartDownloads',
    'confirmTorrentRemoval',
    'confirmDataDeletion',
    'showCompletionNotifications',
    'showErrorNotifications',
    'defaultSavePath'
  ],
  appearance: ['theme', 'uiDensity'],
  downloads: [
    'defaultSavePath',
    'openFolderOnCompletion',
    'autoStartDownloads',
    'maxActiveDownloads',
    'maxActiveSeeds'
  ],
  connection: [
    'maxGlobalConns',
    'maxConnsPerTorrent',
    'globalDownloadLimit',
    'globalUploadLimit',
    'listenPort',
    'enableUpnp',
    'enableDht',
    'enablePex',
    'enableLsd'
  ],
  diagnostics: [
    'enableDiagnosticLogging',
    'enableRoutingDiagnostics',
    'enableVerbosePeerDiagnostics'
  ]
} as const

export function getDefaultSettings(defaultSaveDir: string): GlobalSettings {
  return {
    defaultSavePath: defaultSaveDir,
    maxActiveDownloads: 5,
    maxActiveSeeds: 5,
    maxConnsPerTorrent: 55,
    maxGlobalConns: 200,
    globalDownloadLimit: -1,
    globalUploadLimit: -1,
    defaultInterfacePolicy: { mode: 'automatic' },
    theme: 'dark',
    uiDensity: 'compact',
    startWithWindows: false,
    startMinimized: false,
    minimizeToTray: false,
    closeToTray: false,
    autoStartRestoredTorrents: true,
    autoStartDownloads: true,
    confirmTorrentRemoval: true,
    confirmDataDeletion: true,
    showCompletionNotifications: true,
    showErrorNotifications: true,
    openFolderOnCompletion: false,
    enableDht: true,
    enablePex: true,
    enableLsd: true,
    enableUpnp: true,
    listenPort: DEFAULT_LISTEN_PORT,
    enableDiagnosticLogging: false,
    enableRoutingDiagnostics: false,
    enableVerbosePeerDiagnostics: false
  }
}

export class Database {
  readonly filePath: string
  readonly backupPath: string
  private state: PersistedState
  private saveTimeout: NodeJS.Timeout | null = null
  private isSaving = false
  private pendingSave = false
  private defaultSaveDir: string

  constructor(storageDir: string, defaultSaveDir: string) {
    this.filePath = join(storageDir, 'state.json')
    this.backupPath = join(storageDir, 'state.json.bak')
    this.defaultSaveDir = defaultSaveDir
    this.state = {
      version: CURRENT_SCHEMA_VERSION,
      lastSavedAt: Date.now(),
      settings: getDefaultSettings(this.defaultSaveDir),
      torrents: {},
      networkPreferences: {}
    }
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })

    if (existsSync(this.filePath)) {
      try {
        const raw = await readFile(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw) as PersistedState
        this.state = this.migrate(parsed)
      } catch (err) {
        console.warn(`[DB] Failed to load ${this.filePath}, attempting backup:`, err)
        if (existsSync(this.backupPath)) {
          try {
            const rawBak = await readFile(this.backupPath, 'utf-8')
            this.state = this.migrate(JSON.parse(rawBak))
          } catch {
            console.error('[DB] Failed to load backup as well. Initializing default state.')
          }
        }
      }
    } else {
      await this.saveImmediate()
    }
  }

  private migrate(loaded: Partial<PersistedState>): PersistedState {
    const defaultState: PersistedState = {
      version: CURRENT_SCHEMA_VERSION,
      lastSavedAt: Date.now(),
      settings: getDefaultSettings(this.defaultSaveDir),
      torrents: {},
      networkPreferences: {}
    }

    if (!loaded || typeof loaded !== 'object') {
      return defaultState
    }

    return {
      version: CURRENT_SCHEMA_VERSION,
      lastSavedAt: loaded.lastSavedAt || Date.now(),
      settings: { ...defaultState.settings, ...(loaded.settings || {}) },
      torrents: loaded.torrents || {},
      networkPreferences: loaded.networkPreferences || {}
    }
  }

  getState(): PersistedState {
    return this.state
  }

  getSettings(): GlobalSettings {
    return { ...this.state.settings }
  }

  updateSettings(patch: Partial<GlobalSettings>): GlobalSettings {
    this.state.settings = { ...this.state.settings, ...patch }
    this.scheduleSave()
    return this.getSettings()
  }

  resetSettings(section?: string): GlobalSettings {
    const defaults = getDefaultSettings(this.defaultSaveDir)
    if (!section || section === 'all') {
      this.state.settings = { ...defaults }
    } else {
      const keys = SETTINGS_SECTIONS[section as keyof typeof SETTINGS_SECTIONS]
      if (keys) {
        for (const k of keys) {
          ;(this.state.settings as any)[k] = (defaults as any)[k]
        }
      }
    }
    this.scheduleSave()
    return this.getSettings()
  }

  getTorrent(infoHash: string): PersistedTorrentRecord | undefined {
    return this.state.torrents[infoHash.toLowerCase()]
  }

  getAllTorrents(): PersistedTorrentRecord[] {
    return Object.values(this.state.torrents)
  }

  setTorrent(record: PersistedTorrentRecord): void {
    this.state.torrents[record.infoHash.toLowerCase()] = { ...record }
    this.scheduleSave()
  }

  deleteTorrent(infoHash: string): void {
    delete this.state.torrents[infoHash.toLowerCase()]
    this.scheduleSave()
  }

  getNetworkConfig(id: string): PersistedNetworkConfig | undefined {
    return this.state.networkPreferences[id]
  }

  setNetworkConfig(config: PersistedNetworkConfig): void {
    this.state.networkPreferences[config.id] = { ...config }
    this.scheduleSave()
  }

  getAllNetworkConfigs(): Record<string, PersistedNetworkConfig> {
    return { ...this.state.networkPreferences }
  }

  scheduleSave(): void {
    if (this.saveTimeout) return
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null
      void this.saveImmediate()
    }, 500)
  }

  async saveImmediate(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    if (this.isSaving) {
      this.pendingSave = true
      return
    }
    this.isSaving = true

    this.state.lastSavedAt = Date.now()
    const content = JSON.stringify(this.state, null, 2)
    const tempFile = `${this.filePath}.tmp.${Date.now()}`

    try {
      await writeFile(tempFile, content, 'utf-8')

      // Backup existing file before overwriting
      if (existsSync(this.filePath)) {
        try {
          await copyFile(this.filePath, this.backupPath)
        } catch {
          // ignore backup errors
        }
      }

      await rename(tempFile, this.filePath)
    } catch (err) {
      console.error('[DB] Save error:', err)
      try {
        if (existsSync(tempFile)) await unlink(tempFile)
      } catch {
        // ignore cleanup error
      }
    } finally {
      this.isSaving = false
      if (this.pendingSave) {
        this.pendingSave = false
        void this.saveImmediate()
      }
    }
  }

  saveSync(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    this.state.lastSavedAt = Date.now()
    const content = JSON.stringify(this.state, null, 2)
    const tempFile = `${this.filePath}.tmp.${Date.now()}`
    try {
      writeFileSync(tempFile, content, 'utf-8')
      if (existsSync(this.filePath)) {
        try {
          copyFileSync(this.filePath, this.backupPath)
        } catch {
          // ignore backup errors
        }
      }
      renameSync(tempFile, this.filePath)
    } catch (err) {
      console.error('[DB] Sync save error:', err)
      try {
        if (existsSync(tempFile)) unlinkSync(tempFile)
      } catch {
        // ignore cleanup error
      }
    }
  }
}
