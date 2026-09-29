import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Database, getDefaultSettings } from '../../src/main/persistence/database'
import { IpcValidator } from '../../src/main/ipc/validator'
import type { GlobalSettings } from '../../src/shared/types'

describe('Essential General Settings System', () => {
  let testDir: string
  let db: Database

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'relay-settings-test-'))
    db = new Database(testDir, join(testDir, 'downloads'))
    await db.initialize()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('provides safe default settings for all essential options', () => {
    const defaults = getDefaultSettings(join(testDir, 'downloads'))

    // Appearance
    expect(defaults.theme).toBe('dark')
    expect(defaults.uiDensity).toBe('compact')

    // Startup & behavior
    expect(defaults.startWithWindows).toBe(false)
    expect(defaults.startMinimized).toBe(false)
    expect(defaults.minimizeToTray).toBe(false)
    expect(defaults.closeToTray).toBe(false)
    expect(defaults.autoStartRestoredTorrents).toBe(true)
    expect(defaults.autoStartDownloads).toBe(true)
    expect(defaults.confirmTorrentRemoval).toBe(true)
    expect(defaults.confirmDataDeletion).toBe(true)
    expect(defaults.showCompletionNotifications).toBe(true)
    expect(defaults.showErrorNotifications).toBe(true)

    // Downloads
    expect(defaults.defaultSavePath).toContain('downloads')
    expect(defaults.openFolderOnCompletion).toBe(false)
    expect(defaults.maxActiveDownloads).toBe(5)
    expect(defaults.maxActiveSeeds).toBe(5)

    // Connection
    expect(defaults.maxGlobalConns).toBe(200)
    expect(defaults.maxConnsPerTorrent).toBe(55)
    expect(defaults.globalDownloadLimit).toBe(-1)
    expect(defaults.globalUploadLimit).toBe(-1)
    expect(defaults.enableDht).toBe(true)
    expect(defaults.enablePex).toBe(true)
    expect(defaults.enableLsd).toBe(true)
    expect(defaults.enableUpnp).toBe(true)
    expect(defaults.listenPort).toBe(6881)

    // Diagnostics (disabled by default)
    expect(defaults.enableDiagnosticLogging).toBe(false)
    expect(defaults.enableRoutingDiagnostics).toBe(false)
    expect(defaults.enableVerbosePeerDiagnostics).toBe(false)
  })

  it('persists and reloads general settings atomically', async () => {
    const patch: Partial<GlobalSettings> = {
      theme: 'light',
      uiDensity: 'standard',
      startWithWindows: true,
      startMinimized: true,
      minimizeToTray: true,
      closeToTray: true,
      autoStartRestoredTorrents: false,
      autoStartDownloads: false,
      confirmTorrentRemoval: false,
      confirmDataDeletion: false,
      showCompletionNotifications: false,
      showErrorNotifications: false,
      openFolderOnCompletion: true,
      maxGlobalConns: 350,
      maxConnsPerTorrent: 80,
      globalDownloadLimit: 5242880,
      globalUploadLimit: 1048576,
      enableDht: false,
      enablePex: false,
      enableLsd: false,
      enableUpnp: false,
      listenPort: 8999,
      enableDiagnosticLogging: true,
      enableRoutingDiagnostics: true,
      enableVerbosePeerDiagnostics: true
    }

    db.updateSettings(patch)
    await db.saveImmediate()

    // Reload from disk in a fresh Database instance
    const db2 = new Database(testDir, join(testDir, 'downloads'))
    await db2.initialize()
    const loaded = db2.getSettings()

    expect(loaded.theme).toBe('light')
    expect(loaded.uiDensity).toBe('standard')
    expect(loaded.startWithWindows).toBe(true)
    expect(loaded.startMinimized).toBe(true)
    expect(loaded.minimizeToTray).toBe(true)
    expect(loaded.closeToTray).toBe(true)
    expect(loaded.autoStartRestoredTorrents).toBe(false)
    expect(loaded.autoStartDownloads).toBe(false)
    expect(loaded.confirmTorrentRemoval).toBe(false)
    expect(loaded.confirmDataDeletion).toBe(false)
    expect(loaded.showCompletionNotifications).toBe(false)
    expect(loaded.showErrorNotifications).toBe(false)
    expect(loaded.openFolderOnCompletion).toBe(true)
    expect(loaded.maxGlobalConns).toBe(350)
    expect(loaded.maxConnsPerTorrent).toBe(80)
    expect(loaded.globalDownloadLimit).toBe(5242880)
    expect(loaded.globalUploadLimit).toBe(1048576)
    expect(loaded.enableDht).toBe(false)
    expect(loaded.enablePex).toBe(false)
    expect(loaded.enableLsd).toBe(false)
    expect(loaded.enableUpnp).toBe(false)
    expect(loaded.listenPort).toBe(8999)
    expect(loaded.enableDiagnosticLogging).toBe(true)
    expect(loaded.enableRoutingDiagnostics).toBe(true)
    expect(loaded.enableVerbosePeerDiagnostics).toBe(true)
  })

  it('migrates legacy settings safely without loss', async () => {
    // Simulate legacy saved state from version 1 with only a few keys
    const legacyState = {
      version: 1,
      lastSavedAt: Date.now(),
      settings: {
        defaultSavePath: join(testDir, 'custom-downloads'),
        maxActiveDownloads: 12,
        maxActiveSeeds: 8,
        theme: 'dark'
      },
      torrents: {},
      networkPreferences: {}
    }

    const legacyDb = new Database(testDir, join(testDir, 'downloads'))
    // @ts-expect-error accessing private migrate for testing
    const migrated = legacyDb.migrate(legacyState)

    // Existing customized values must be preserved
    expect(migrated.settings.defaultSavePath).toBe(join(testDir, 'custom-downloads'))
    expect(migrated.settings.maxActiveDownloads).toBe(12)
    expect(migrated.settings.maxActiveSeeds).toBe(8)

    // Newly introduced options must receive safe defaults
    expect(migrated.settings.uiDensity).toBe('compact')
    expect(migrated.settings.autoStartRestoredTorrents).toBe(true)
    expect(migrated.settings.showCompletionNotifications).toBe(true)
    expect(migrated.settings.enableDiagnosticLogging).toBe(false)
  })

  it('resets settings by section correctly', async () => {
    db.updateSettings({
      theme: 'light',
      uiDensity: 'standard',
      maxGlobalConns: 500,
      enableDht: false
    })

    // Reset only appearance section
    const afterAppearanceReset = db.resetSettings('appearance')
    expect(afterAppearanceReset.theme).toBe('dark')
    expect(afterAppearanceReset.uiDensity).toBe('compact')
    // Connection section remains untouched
    expect(afterAppearanceReset.maxGlobalConns).toBe(500)
    expect(afterAppearanceReset.enableDht).toBe(false)

    // Reset all settings
    const afterAllReset = db.resetSettings('all')
    expect(afterAllReset.maxGlobalConns).toBe(200)
    expect(afterAllReset.enableDht).toBe(true)
  })

  describe('IpcValidator.validateSettingsPatch', () => {
    it('validates and accepts valid patches', () => {
      const validPatch = {
        theme: 'light',
        uiDensity: 'compact',
        maxGlobalConns: 400,
        maxConnsPerTorrent: 60,
        globalDownloadLimit: 1048576,
        globalUploadLimit: -1,
        listenPort: 6882,
        enableDht: true,
        startWithWindows: false
      }

      const res = IpcValidator.validateSettingsPatch(validPatch)
      expect(res.theme).toBe('light')
      expect(res.maxGlobalConns).toBe(400)
      expect(res.globalDownloadLimit).toBe(1048576)
      expect(res.globalUploadLimit).toBe(-1)
    })

    it('rejects invalid enum values', () => {
      expect(() => IpcValidator.validateSettingsPatch({ theme: 'neon' })).toThrow(/Invalid theme/)
      expect(() => IpcValidator.validateSettingsPatch({ uiDensity: 'ultra-dense' })).toThrow(
        /Invalid uiDensity/
      )
    })

    it('rejects invalid or excessively large peer limits', () => {
      expect(() => IpcValidator.validateSettingsPatch({ maxGlobalConns: 999999 })).toThrow(
        /maxGlobalConns/
      )
      expect(() => IpcValidator.validateSettingsPatch({ maxGlobalConns: 2 })).toThrow(
        /maxGlobalConns/
      )
      expect(() => IpcValidator.validateSettingsPatch({ maxConnsPerTorrent: 1000 })).toThrow(
        /maxConnsPerTorrent/
      )
    })

    it('rejects invalid speed limits and non-finite numbers', () => {
      expect(() => IpcValidator.validateSettingsPatch({ globalDownloadLimit: -50 })).toThrow(
        /globalDownloadLimit/
      )
      expect(() => IpcValidator.validateSettingsPatch({ globalUploadLimit: NaN })).toThrow(
        /globalUploadLimit/
      )
    })

    it('rejects malformed settings patches and non-objects', () => {
      expect(() => IpcValidator.validateSettingsPatch(null)).toThrow(/Settings patch must be a non-null object/)
      expect(() => IpcValidator.validateSettingsPatch('invalid')).toThrow(/Settings patch must be a non-null object/)
      expect(() => IpcValidator.validateSettingsPatch([1, 2, 3])).toThrow(/Settings patch must be a non-null object/)
    })

    it('rejects invalid default save paths', () => {
      expect(() => IpcValidator.validateSettingsPatch({ defaultSavePath: '' })).toThrow(
        /defaultSavePath must be a non-empty string/
      )
      expect(() => IpcValidator.validateSettingsPatch({ defaultSavePath: '   ' })).toThrow(
        /defaultSavePath must be a non-empty string/
      )
    })
  })

  it('persists settings synchronously via saveSync without timer delay', async () => {
    db.updateSettings({ theme: 'light', listenPort: 7890 })
    // Synchronous save (like during before-quit)
    db.saveSync()

    const db2 = new Database(testDir, join(testDir, 'downloads'))
    await db2.initialize()
    const loaded = db2.getSettings()

    expect(loaded.theme).toBe('light')
    expect(loaded.listenPort).toBe(7890)
  })

  it('survives immediate restart when saveImmediate is awaited', async () => {
    db.updateSettings({
      theme: 'light',
      uiDensity: 'standard',
      autoStartDownloads: false,
      startWithWindows: true
    })
    await db.saveImmediate()

    const db2 = new Database(testDir, join(testDir, 'downloads'))
    await db2.initialize()
    const reloaded = db2.getSettings()

    expect(reloaded.theme).toBe('light')
    expect(reloaded.uiDensity).toBe('standard')
    expect(reloaded.autoStartDownloads).toBe(false)
    expect(reloaded.startWithWindows).toBe(true)
  })
})

