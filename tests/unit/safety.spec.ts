import { describe, expect, it } from 'vitest'
import { resolveSafeDownloadPath, sanitizePathComponent, validateMagnetUri } from '../../src/main/engine/safety'

describe('Safety and Path Validation', () => {
  it('sanitizes unsafe path components', () => {
    expect(sanitizePathComponent('hello/world')).toBe('hello_world')
    expect(sanitizePathComponent('..test')).toBe('test')
    expect(sanitizePathComponent('CON.txt')).toBe('_CON.txt')
    expect(sanitizePathComponent('NUL')).toBe('_NUL')
    expect(sanitizePathComponent('file\0name')).toBe('filename')
  })

  it('prevents path traversal attempts outside destination directory', () => {
    const base = 'C:\\Users\\test\\Downloads'

    const safe = resolveSafeDownloadPath(base, 'legal_movie.mp4')
    expect(safe).toContain('Downloads')
    expect(safe).toContain('legal_movie.mp4')

    // Relative path trying to go up
    const upward = resolveSafeDownloadPath(base, '../../Windows/System32/calc.exe')
    expect(upward.startsWith(base)).toBe(true)
    expect(upward).not.toContain('..')

    // Nested folders
    const nested = resolveSafeDownloadPath(base, 'folder/subfolder/file.bin')
    expect(nested).toContain('subfolder')
  })

  it('validates magnet URIs', () => {
    const valid = validateMagnetUri(
      'magnet:?xt=urn:btih:d2474e86c95b19b8bcf9657b0e93a56ae79f2107&dn=Ubuntu'
    )
    expect(valid.isValid).toBe(true)
    expect(valid.infoHash).toBe('d2474e86c95b19b8bcf9657b0e93a56ae79f2107')

    const invalid = validateMagnetUri('http://example.com/file.torrent')
    expect(invalid.isValid).toBe(false)
    expect(invalid.error).toBeDefined()

    const missingHash = validateMagnetUri('magnet:?dn=Ubuntu')
    expect(missingHash.isValid).toBe(false)
  })
})
