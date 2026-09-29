import { describe, expect, it } from 'vitest'
import { sha1 } from '../../src/main/engine/pieceHasher'
import { PieceManager } from '../../src/main/engine/pieceManager'

describe('Startup State Machine and Verification Integrity', () => {
  const p0 = Buffer.from('Piece 0 content of test torrent')
  const p1 = Buffer.from('Piece 1 content of test torrent')
  const p2 = Buffer.from('Piece 2 content of test torrent')

  const pieceLength = p0.length
  const totalBytes = p0.length + p1.length + p2.length
  const pieceHashes = [
    sha1(p0).toString('hex'),
    sha1(p1).toString('hex'),
    sha1(p2).toString('hex')
  ]

  const files = [
    { index: 0, name: 'f.bin', path: 'f.bin', length: totalBytes, offset: 0 }
  ]

  it('demonstrates exact state machine flow: restored -> checking -> downloading', () => {
    // 1. Restored state
    let status: 'restored' | 'checking' | 'downloading' | 'completed' | 'seeding' = 'restored'
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    expect(status).toBe('restored')
    expect(pm.getVerifiedCount()).toBe(0)

    // 2. Transition to checking
    status = 'checking'
    expect(status).toBe('checking')

    // Simulate disk verification: piece 0 exists, pieces 1 and 2 are zeros on disk
    const diskBuf0 = p0
    const diskBuf1 = Buffer.alloc(pieceLength, 0)
    const diskBuf2 = Buffer.alloc(pieceLength, 0)

    pm.verifyPieceFromDisk(0, diskBuf0)
    pm.verifyPieceFromDisk(1, diskBuf1)
    pm.verifyPieceFromDisk(2, diskBuf2)

    // Crucial: non-matching pieces are 'missing', NOT 'corrupted'
    const counts = pm.getPieceCounts()
    expect(counts.verified).toBe(1)
    expect(counts.missing).toBe(2)
    expect(counts.corrupted).toBe(0)

    // Telemetry during checking:
    // Verified bytes is 1 piece, NOT full file
    expect(pm.getVerifiedBytes()).toBe(pieceLength)
    expect(pm.isComplete()).toBe(false)

    // 3. Post-verification transition: missing pieces exist -> downloading
    status = pm.isComplete() ? 'seeding' : 'downloading'
    expect(status).toBe('downloading')
  })

  it('demonstrates state machine flow: restored -> checking -> completed -> seeding', () => {
    let status: 'restored' | 'checking' | 'downloading' | 'completed' | 'seeding' = 'restored'
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    status = 'checking'

    // All pieces exist and are valid on disk
    pm.verifyPieceFromDisk(0, p0)
    pm.verifyPieceFromDisk(1, p1)
    pm.verifyPieceFromDisk(2, p2)

    expect(pm.getPieceCounts().verified).toBe(3)
    expect(pm.getPieceCounts().corrupted).toBe(0)
    expect(pm.isComplete()).toBe(true)

    // Transition directly to seeding
    status = pm.isComplete() ? 'seeding' : 'downloading'
    expect(status).toBe('seeding')
  })

  it('verifies live peer corruption vs disk checking distinction', () => {
    const pm = new PieceManager({
      totalBytes,
      pieceLength,
      numPieces: 3,
      pieceHashes,
      files
    })

    // Disk check: zero bytes on disk -> marked missing, NOT corrupted
    const diskZero = Buffer.alloc(pieceLength, 0)
    pm.verifyPieceFromDisk(1, diskZero)
    expect(pm.getPieceState(1)).toBe('missing')
    expect(pm.getPieceCounts().corrupted).toBe(0)

    // Live peer download: bad block received from wire -> marked corrupted
    const badWireData = Buffer.from('Corrupted wire payload sent by peer')
    pm.verifyPiece(1, badWireData, 'wlan0')
    expect(pm.getPieceState(1)).toBe('corrupted')
    expect(pm.getPieceCounts().corrupted).toBe(1)
  })
})
