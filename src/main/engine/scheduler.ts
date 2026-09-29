import type { PieceInfo, PieceState } from '../../shared/types'

export interface SchedulerOptions {
  sequential?: boolean
  endgameThreshold?: number // Number of remaining pieces to activate endgame mode (default: 5)
}

export class TorrentPieceScheduler {
  private sequential: boolean
  private endgameThreshold: number
  private activeRequests: Map<number, Set<string>> = new Map() // pieceIndex -> Set<peerId>

  constructor(options: SchedulerOptions = {}) {
    this.sequential = options.sequential ?? false
    this.endgameThreshold = options.endgameThreshold ?? 5
  }

  setSequential(sequential: boolean): void {
    this.sequential = sequential
  }

  isEndgame(pieces: PieceInfo[]): boolean {
    const unverified = pieces.filter((p) => p.state !== 'verified' && p.state !== 'skipped')
    return unverified.length > 0 && unverified.length <= this.endgameThreshold
  }

  /**
   * Selects the next piece index to request from a peer.
   */
  selectNextPiece(
    pieces: PieceInfo[],
    peerBitfield: boolean[],
    peerId: string
  ): number | null {
    const isEndgameActive = this.isEndgame(pieces)

    const candidates: { index: number; availability: number; state: PieceState }[] = []

    for (const piece of pieces) {
      if (piece.state === 'verified' || piece.state === 'skipped') continue
      if (!peerBitfield[piece.index]) continue

      const currentRequesters = this.activeRequests.get(piece.index)

      // If this peer already has an active request for this piece, don't duplicate to the same peer
      if (currentRequesters && currentRequesters.has(peerId)) continue

      if (piece.state === 'missing') {
        candidates.push({
          index: piece.index,
          availability: piece.availability,
          state: piece.state
        })
      } else if (isEndgameActive && (piece.state === 'requested' || piece.state === 'downloading')) {
        // In endgame mode, allow redundant requests across different peers
        candidates.push({
          index: piece.index,
          availability: piece.availability,
          state: piece.state
        })
      }
    }

    if (candidates.length === 0) return null

    if (this.sequential) {
      // Sort by index ascending
      candidates.sort((a, b) => a.index - b.index)
    } else {
      // Rarest-first: sort by availability ascending, then by index
      candidates.sort((a, b) => {
        if (a.availability !== b.availability) {
          return a.availability - b.availability
        }
        return a.index - b.index
      })
    }

    const selected = candidates[0].index
    this.registerRequest(selected, peerId)
    return selected
  }

  registerRequest(pieceIndex: number, peerId: string): void {
    let requesters = this.activeRequests.get(pieceIndex)
    if (!requesters) {
      requesters = new Set()
      this.activeRequests.set(pieceIndex, requesters)
    }
    requesters.add(peerId)
  }

  cancelRequest(pieceIndex: number, peerId: string): void {
    const requesters = this.activeRequests.get(pieceIndex)
    if (requesters) {
      requesters.delete(peerId)
      if (requesters.size === 0) {
        this.activeRequests.delete(pieceIndex)
      }
    }
  }

  /**
   * Called when a piece finishes and verifies to cancel any other duplicate in-flight peer requests.
   */
  onPieceCompleted(pieceIndex: number): string[] {
    const requesters = this.activeRequests.get(pieceIndex)
    const peersToCancel = requesters ? Array.from(requesters) : []
    this.activeRequests.delete(pieceIndex)
    return peersToCancel
  }

  clearPeerRequests(peerId: string): void {
    for (const [pieceIndex, requesters] of this.activeRequests.entries()) {
      requesters.delete(peerId)
      if (requesters.size === 0) {
        this.activeRequests.delete(pieceIndex)
      }
    }
  }

  clear(): void {
    this.activeRequests.clear()
  }
}
