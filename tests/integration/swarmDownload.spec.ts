import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sha256 } from '../../src/main/engine/pieceHasher'
import { PieceManager } from '../../src/main/engine/pieceManager'
import { createSyntheticTorrentFixture, type SyntheticTorrentFixture } from './testHarness'

describe('Synthetic Torrent Swarm and Piece Integrity Integration', () => {
  let tempDir: string
  let fixture: SyntheticTorrentFixture

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'relay-int-test-'))
    fixture = await createSyntheticTorrentFixture(join(tempDir, 'source'), 16384)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('verifies all pieces of synthetic multi-file torrent and validates SHA-256 byte-for-byte', async () => {
    let offset = 0
    const fileEntries = fixture.files.map((f, index) => {
      const entry = {
        index,
        name: f.name,
        path: f.name,
        length: f.content.length,
        offset
      }
      offset += f.content.length
      return entry
    })

    const pm = new PieceManager({
      totalBytes: fixture.totalBytes,
      pieceLength: fixture.pieceLength,
      numPieces: fixture.numPieces,
      pieceHashes: fixture.pieceHashes,
      files: fileEntries
    })

    const combined = Buffer.concat(fixture.files.map((f) => f.content))

    // Step 1: Deliberately inject a corrupted piece at index 1
    const corruptPiece = Buffer.from('Deliberate corrupted data payload')
    const verifyFailed = pm.verifyPiece(1, corruptPiece, 'eth0')
    expect(verifyFailed).toBe(false)
    expect(pm.getPieceState(1)).toBe('corrupted')

    // Step 2: Re-request and verify valid piece at index 1
    pm.resetCorruptedPiece(1)
    const validPiece1 = combined.subarray(
      fixture.pieceLength,
      Math.min(fixture.pieceLength * 2, fixture.totalBytes)
    )
    const verifyRecovered = pm.verifyPiece(1, validPiece1, 'wlan0')
    expect(verifyRecovered).toBe(true)
    expect(pm.getPieceState(1)).toBe('verified')

    // Step 3: Verify remaining pieces
    for (let i = 0; i < fixture.numPieces; i++) {
      if (i === 1) continue
      const slice = combined.subarray(
        i * fixture.pieceLength,
        Math.min((i + 1) * fixture.pieceLength, fixture.totalBytes)
      )
      const res = pm.verifyPiece(i, slice, 'eth0')
      expect(res).toBe(true)
    }

    expect(pm.isComplete()).toBe(true)
    expect(pm.getVerifiedCount()).toBe(fixture.numPieces)

    // Step 4: Final byte-for-byte SHA-256 validation against source files
    for (const file of fixture.files) {
      const diskContent = await readFile(join(tempDir, 'source', file.name))
      expect(sha256(diskContent)).toBe(fixture.expectedSha256s[file.name])
    }
  })
})
