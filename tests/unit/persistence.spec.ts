import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Database } from '../../src/main/persistence/database'
import type { PersistedTorrentRecord } from '../../src/main/persistence/schema'

describe('Database and State Persistence', () => {
  let testDir: string
  let db: Database

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'relay-test-db-'))
    db = new Database(testDir, join(testDir, 'downloads'))
    await db.initialize()
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('initializes with default settings and saves state atomically', async () => {
    const settings = db.getSettings()
    expect(settings.defaultSavePath).toContain('downloads')
    expect(settings.maxActiveDownloads).toBe(5)

    db.updateSettings({ maxActiveDownloads: 10 })
    await db.saveImmediate()

    // Reload from disk into a fresh instance
    const db2 = new Database(testDir, join(testDir, 'downloads'))
    await db2.initialize()
    expect(db2.getSettings().maxActiveDownloads).toBe(10)
  })

  it('persists and restores torrent records with verified bitfields', async () => {
    const record: PersistedTorrentRecord = {
      infoHash: 'a1b2c3d4e5f678901234567890abcdef12345678',
      name: 'Sample Linux ISO',
      savePath: join(testDir, 'downloads'),
      status: 'downloading',
      addedAt: Date.now(),
      completedAt: null,
      totalBytes: 1048576,
      pieceLength: 262144,
      numPieces: 4,
      verifiedBitfield: 'f0',
      selectedFileIndices: [0],
      filePriorities: { 0: 'normal' },
      interfacePolicy: { mode: 'automatic' },
      uploadedBytes: 1000,
      downloadedBytes: 524288
    }

    db.setTorrent(record)
    await db.saveImmediate()

    const db2 = new Database(testDir, join(testDir, 'downloads'))
    await db2.initialize()

    const loaded = db2.getTorrent('a1b2c3d4e5f678901234567890abcdef12345678')
    expect(loaded).toBeDefined()
    expect(loaded?.name).toBe('Sample Linux ISO')
    expect(loaded?.verifiedBitfield).toBe('f0')
  })
})
