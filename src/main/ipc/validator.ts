import type {
  AddTorrentOptions,
  GlobalSettings,
  InterfacePolicy,
  TorrentFilePriority
} from '../../shared/types'
import { validateMagnetUri } from '../engine/safety'

export class IpcValidator {
  static validateAddTorrent(options: unknown): AddTorrentOptions {
    if (!options || typeof options !== 'object') {
      throw new Error('AddTorrent options must be an object')
    }

    const opts = options as Record<string, unknown>
    if (!opts.source || typeof opts.source !== 'object') {
      throw new Error('Torrent source is required')
    }

    const source = opts.source as Record<string, unknown>
    if (source.type === 'magnet') {
      if (typeof source.uri !== 'string') {
        throw new Error('Magnet URI must be a string')
      }
      const val = validateMagnetUri(source.uri)
      if (!val.isValid) {
        throw new Error(val.error || 'Invalid magnet URI')
      }
    } else if (source.type === 'file') {
      if (typeof source.filePath !== 'string' || !source.filePath.trim()) {
        throw new Error('Torrent filePath must be a non-empty string')
      }
    } else {
      throw new Error('Invalid torrent source type')
    }

    if (typeof opts.savePath !== 'string' || !opts.savePath.trim()) {
      throw new Error('Save path must be a non-empty string')
    }

    return options as AddTorrentOptions
  }

  static validateInfoHash(infoHash: unknown): string {
    if (typeof infoHash !== 'string' || !/^[a-fA-F0-9]{40}$/i.test(infoHash.trim())) {
      throw new Error(`Invalid 40-character hex infoHash: "${infoHash}"`)
    }
    return infoHash.trim().toLowerCase()
  }

  static validateFilePriorities(priorities: unknown): Record<number, TorrentFilePriority> {
    if (!priorities || typeof priorities !== 'object') {
      throw new Error('File priorities must be an object')
    }

    const validPriorities = new Set(['skip', 'low', 'normal', 'high'])
    for (const [key, val] of Object.entries(priorities)) {
      if (isNaN(Number(key))) {
        throw new Error(`Invalid file index: ${key}`)
      }
      if (typeof val !== 'string' || !validPriorities.has(val)) {
        throw new Error(`Invalid priority value "${val}" for file index ${key}`)
      }
    }

    return priorities as Record<number, TorrentFilePriority>
  }

  static validateInterfacePolicy(policy: unknown): InterfacePolicy {
    if (!policy || typeof policy !== 'object') {
      throw new Error('Interface policy must be an object')
    }

    const p = policy as Record<string, unknown>
    const validModes = new Set(['automatic', 'preferred', 'single', 'custom'])
    if (typeof p.mode !== 'string' || !validModes.has(p.mode)) {
      throw new Error(`Invalid interface policy mode: ${p.mode}`)
    }

    return policy as InterfacePolicy
  }

  static validateSettingsPatch(patch: unknown): Partial<GlobalSettings> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('Settings patch must be a non-null object')
    }

    const p = patch as Record<string, unknown>
    const validated: Partial<GlobalSettings> = {}

    // Appearance
    if (p.theme !== undefined) {
      if (p.theme !== 'dark' && p.theme !== 'light' && p.theme !== 'system') {
        throw new Error(`Invalid theme: "${p.theme}". Expected dark, light, or system`)
      }
      validated.theme = p.theme
    }

    if (p.uiDensity !== undefined) {
      if (p.uiDensity !== 'standard' && p.uiDensity !== 'compact') {
        throw new Error(`Invalid uiDensity: "${p.uiDensity}". Expected standard or compact`)
      }
      validated.uiDensity = p.uiDensity
    }

    // Startup & behavior booleans
    const booleanKeys: (keyof GlobalSettings)[] = [
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
      'openFolderOnCompletion',
      'enableDht',
      'enablePex',
      'enableLsd',
      'enableUpnp',
      'enableDiagnosticLogging',
      'enableRoutingDiagnostics',
      'enableVerbosePeerDiagnostics'
    ]

    for (const key of booleanKeys) {
      if (p[key] !== undefined) {
        if (typeof p[key] !== 'boolean') {
          throw new Error(`Invalid boolean value for setting "${key}"`)
        }
        ;(validated as any)[key] = p[key]
      }
    }

    // Default Save Path
    if (p.defaultSavePath !== undefined) {
      if (typeof p.defaultSavePath !== 'string' || !p.defaultSavePath.trim()) {
        throw new Error('defaultSavePath must be a non-empty string')
      }
      validated.defaultSavePath = p.defaultSavePath.trim()
    }

    // Numeric limits
    if (p.maxActiveDownloads !== undefined) {
      const val = Number(p.maxActiveDownloads)
      if (!Number.isFinite(val) || val < 1 || val > 100) {
        throw new Error('maxActiveDownloads must be an integer between 1 and 100')
      }
      validated.maxActiveDownloads = Math.floor(val)
    }

    if (p.maxActiveSeeds !== undefined) {
      const val = Number(p.maxActiveSeeds)
      if (!Number.isFinite(val) || val < 1 || val > 100) {
        throw new Error('maxActiveSeeds must be an integer between 1 and 100')
      }
      validated.maxActiveSeeds = Math.floor(val)
    }

    if (p.maxGlobalConns !== undefined) {
      const val = Number(p.maxGlobalConns)
      if (!Number.isFinite(val) || val < 10 || val > 5000) {
        throw new Error('maxGlobalConns must be an integer between 10 and 5000')
      }
      validated.maxGlobalConns = Math.floor(val)
    }

    if (p.maxConnsPerTorrent !== undefined) {
      const val = Number(p.maxConnsPerTorrent)
      if (!Number.isFinite(val) || val < 1 || val > 500) {
        throw new Error('maxConnsPerTorrent must be an integer between 1 and 500')
      }
      validated.maxConnsPerTorrent = Math.floor(val)
    }

    if (p.globalDownloadLimit !== undefined) {
      const val = Number(p.globalDownloadLimit)
      if (!Number.isFinite(val) || (val < 0 && val !== -1)) {
        throw new Error('globalDownloadLimit must be -1 (unlimited) or a non-negative number')
      }
      validated.globalDownloadLimit = val < 0 ? -1 : Math.floor(val)
    }

    if (p.globalUploadLimit !== undefined) {
      const val = Number(p.globalUploadLimit)
      if (!Number.isFinite(val) || (val < 0 && val !== -1)) {
        throw new Error('globalUploadLimit must be -1 (unlimited) or a non-negative number')
      }
      validated.globalUploadLimit = val < 0 ? -1 : Math.floor(val)
    }

    if (p.listenPort !== undefined) {
      const val = Number(p.listenPort)
      if (!Number.isFinite(val) || val < 0 || val > 65535) {
        throw new Error('listenPort must be a valid port number (0-65535)')
      }
      validated.listenPort = Math.floor(val)
    }

    if (p.defaultInterfacePolicy !== undefined) {
      validated.defaultInterfacePolicy = this.validateInterfacePolicy(p.defaultInterfacePolicy)
    }

    return validated
  }
}
