import { normalize, resolve, sep } from 'node:path'

const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i

/**
 * Sanitizes a filename or relative path component to prevent path traversal,
 * control character injection, and Windows reserved name issues.
 */
export function sanitizePathComponent(name: string): string {
  if (!name || typeof name !== 'string') return 'file'

  // Remove null bytes and control characters
  let clean = name.replace(/[\x00-\x1f\x7f]/g, '').trim()

  // Replace invalid filesystem characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*]/g, '_')

  // Remove leading and trailing dots or spaces
  clean = clean.replace(/^[.\s]+|[.\s]+$/g, '')

  // Prevent Windows reserved device names
  if (WINDOWS_RESERVED_NAMES.test(clean)) {
    clean = `_${clean}`
  }

  return clean || 'file'
}

/**
 * Validates and resolves a torrent file relative path safely inside the target destination directory.
 * Throws an Error if path traversal is attempted.
 */
export function resolveSafeDownloadPath(baseDir: string, relativePath: string): string {
  if (!baseDir || typeof baseDir !== 'string') {
    throw new Error('Invalid base directory provided for download path resolution')
  }

  const normalizedBase = resolve(normalize(baseDir))

  // Split relative path and sanitize each segment
  const segments = relativePath
    .split(/[\\/]+/)
    .filter((s) => s.length > 0 && s !== '.' && s !== '..')
    .map(sanitizePathComponent)

  if (segments.length === 0) {
    throw new Error(`Invalid relative path: "${relativePath}"`)
  }

  const targetPath = resolve(normalizedBase, ...segments)

  // Ensure target path is strictly within baseDir
  if (!targetPath.startsWith(normalizedBase + sep) && targetPath !== normalizedBase) {
    throw new Error(`Path traversal attempt detected: "${relativePath}" resolves outside base directory`)
  }

  return targetPath
}

/**
 * Validates magnet URI structure and extracts basic info hash.
 */
export function validateMagnetUri(uri: string): { isValid: boolean; infoHash?: string; error?: string } {
  if (!uri || typeof uri !== 'string') {
    return { isValid: false, error: 'Magnet URI must be a non-empty string' }
  }

  const trimmed = uri.trim()
  if (!trimmed.startsWith('magnet:?')) {
    return { isValid: false, error: 'URI must start with magnet:?' }
  }

  const xtMatch = /[?&]xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i.exec(trimmed)
  if (!xtMatch) {
    return { isValid: false, error: 'Magnet URI lacks a valid BitTorrent info hash (urn:btih:)' }
  }

  return { isValid: true, infoHash: xtMatch[1].toLowerCase() }
}
