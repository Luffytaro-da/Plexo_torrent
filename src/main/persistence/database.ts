import { existsSync } from 'node:fs'
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

export function getDefaultSettings(defaultSaveDir: string): GlobalSettings {
  return {
    defaultSavePath: defaultSaveDir,
    maxActiveDownloads: 5,
    maxActiveSeeds: 5,
    maxConnsPerTorrent: 55,
    maxGlobalConns: 200,
    defaultInterfacePolicy: { mode: 'automatic' },
    theme: 'dark',
    enableDht: true,
    enablePex: true,
    enableLsd: true,
    enableUpnp: true,
    autoStartDownloads: true,
    listenPort: DEFAULT_LISTEN_PORT
  }
}

export class Database {
  readonly filePath: string
  readonly backupPath: string
  private state: PersistedState
  private saveTimeout: NodeJS.Timeout | null = null
  private isSaving = false
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
    if (this.isSaving) return
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
    }
  }
}
