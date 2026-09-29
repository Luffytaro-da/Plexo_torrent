import { describe, expect, it } from 'vitest'
import { sha1 } from '../../src/main/engine/pieceHasher'
import { PieceManager } from '../../src/main/engine/pieceManager'

describe('PieceManager', () => {
  const piece0Data = Buffer.from('Piece 0 content of test torrent')
  const piece1Data = Buffer.from('Piece 1 content of test torrent')
  const piece2Data = Buffer.from('Piece 2 content of test torrent')

  const pieceLength = piece0Data.length
  const totalBytes = piece0Data.length + piece1Data.length + piece2Data.length

  const pieceHashes = [
    sha1(piece0Data).toString('hex'),
    sha1(piece1Data).toString('hex'),
    sha1(piece2Data).toString('hex')
  ]

  const files = [
    { index: 0, name: 'file1.txt', path: 'file1.txt', length: piece0Data.length, offset: 0 },
    {
      index: 1,
      name: 'file2.txt',
      path: 'file2.txt',
      length: piece1Data.length + piece2Data.length,
      offset: piece0Data.length
    }
  ]

  it('initializes with missing pieces and transitions through states', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    expect(pm.getPieceState(0)).toBe('missing')
    expect(pm.getVerifiedCount()).toBe(0)
    expect(pm.isComplete()).toBe(false)

    pm.markPieceRequested(0, 'wlan0')
    expect(pm.getPieceState(0)).toBe('requested')

    pm.markPieceDownloading(0, 10, 'wlan0')
    expect(pm.getPieceState(0)).toBe('downloading')

    // Valid verification
    const verified = pm.verifyPiece(0, piece0Data, 'wlan0')
    expect(verified).toBe(true)
    expect(pm.getPieceState(0)).toBe('verified')
    expect(pm.getVerifiedCount()).toBe(1)
  })

  it('detects corrupted pieces and increments corruption counts', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    const corruptData = Buffer.from('Corrupted payload data')
    const verified = pm.verifyPiece(1, corruptData, 'eth0')

    expect(verified).toBe(false)
    expect(pm.getPieceState(1)).toBe('corrupted')

    pm.resetCorruptedPiece(1)
    expect(pm.getPieceState(1)).toBe('missing')
  })

  it('applies file priorities correctly and skips non-selected pieces', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    // Skip file 0 (which occupies piece 0)
    pm.applyFilePriorities({ 0: 'skip', 1: 'normal' })
    expect(pm.getPieceState(0)).toBe('skipped')
    expect(pm.getPieceState(1)).toBe('missing')
    expect(pm.getPieceState(2)).toBe('missing')
  })

  it('calculates per-file progress accurately across piece boundaries', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    pm.verifyPiece(0, piece0Data)
    const progresses = pm.calculateFileProgresses({ 0: 'normal', 1: 'normal' })

    expect(progresses[0].progress).toBe(1)
    expect(progresses[0].bytesCompleted).toBe(piece0Data.length)
    expect(progresses[1].progress).toBe(0)

    pm.verifyPiece(1, piece1Data)
    const progress2 = pm.calculateFileProgresses({ 0: 'normal', 1: 'normal' })
    expect(progress2[1].progress).toBe(0.5)
  })

  it('marks failed disk checks as missing and NEVER as corrupted', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    const zeroBlock = Buffer.alloc(pieceLength, 0)
    const verified = pm.verifyPieceFromDisk(0, zeroBlock)

    expect(verified).toBe(false)
    expect(pm.getPieceState(0)).toBe('missing')
    expect(pm.getPieceCounts().corrupted).toBe(0)
    expect(pm.getPieceCounts().missing).toBe(3)

    // Valid data from disk marks verified
    const validVerified = pm.verifyPieceFromDisk(0, piece0Data)
    expect(validVerified).toBe(true)
    expect(pm.getPieceState(0)).toBe('verified')
    expect(pm.getPieceCounts().verified).toBe(1)
  })

  it('generates accurate Uint8Array bitfield for WebTorrent initialization', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    pm.verifyPieceFromDisk(0, piece0Data)
    pm.verifyPieceFromDisk(2, piece2Data)

    const bitfield = pm.getBitfieldUint8Array()
    expect(bitfield.length).toBe(1) // 3 pieces fits in 1 byte
    // Bit 0 and Bit 2 set: 0b10100000 = 0xa0 = 160
    expect(bitfield[0]).toBe(0b10100000)
  })
})
