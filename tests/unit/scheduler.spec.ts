import { describe, expect, it } from 'vitest'
import { TorrentPieceScheduler } from '../../src/main/engine/scheduler'
import type { PieceInfo } from '../../src/shared/types'

describe('TorrentPieceScheduler', () => {
  const pieces: PieceInfo[] = [
    { index: 0, length: 16384, state: 'missing', availability: 3, bytesReceived: 0, retryCount: 0 },
    { index: 1, length: 16384, state: 'missing', availability: 1, bytesReceived: 0, retryCount: 0 },
    { index: 2, length: 16384, state: 'missing', availability: 2, bytesReceived: 0, retryCount: 0 }
  ]

  it('selects rarest piece first by default', () => {
    const scheduler = new TorrentPieceScheduler({ sequential: false })
    const peerBitfield = [true, true, true]

    // Piece 1 has availability 1 (rarest), so it should be picked first
    const selected = scheduler.selectNextPiece(pieces, peerBitfield, 'peer-1')
    expect(selected).toBe(1)
  })

  it('selects pieces in sequential order when sequential mode is enabled', () => {
    const scheduler = new TorrentPieceScheduler({ sequential: true })
    const peerBitfield = [true, true, true]

    const selected = scheduler.selectNextPiece(pieces, peerBitfield, 'peer-1')
    expect(selected).toBe(0)
  })

  it('activates endgame mode and cancels duplicate requests on completion', () => {
    const scheduler = new TorrentPieceScheduler({ endgameThreshold: 3 })
    expect(scheduler.isEndgame(pieces)).toBe(true)

    scheduler.registerRequest(1, 'peer-1')
    scheduler.registerRequest(1, 'peer-2') // Duplicate request in endgame

    const cancelledPeers = scheduler.onPieceCompleted(1)
    expect(cancelledPeers).toContain('peer-1')
    expect(cancelledPeers).toContain('peer-2')
  })
})
