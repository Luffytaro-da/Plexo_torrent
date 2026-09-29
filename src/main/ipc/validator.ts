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
    if (!patch || typeof patch !== 'object') {
      throw new Error('Settings patch must be an object')
    }
    return patch as Partial<GlobalSettings>
  }
}
