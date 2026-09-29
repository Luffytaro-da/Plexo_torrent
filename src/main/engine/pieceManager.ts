import type { PieceInfo, PieceState, TorrentFileInfo, TorrentFilePriority } from '../../shared/types'
import { bitfieldToHex, hexToBitfield, verifyPieceHash } from './pieceHasher'

export interface PieceManagerOptions {
  totalBytes: number
  pieceLength: number
  numPieces: number
  pieceHashes: string[] // List of 20-byte hex SHA-1 hashes
  files: { index: number; name: string; path: string; length: number; offset: number }[]
  initialBitfieldHex?: string
}

export class PieceManager {
  readonly totalBytes: number
  readonly pieceLength: number
  readonly numPieces: number
  readonly pieceHashes: string[]
  readonly files: { index: number; name: string; path: string; length: number; offset: number }[]

  private readonly states: PieceState[]
  private readonly availability: number[]
  private readonly bytesReceived: number[]
  private readonly retryCounts: number[]
  private readonly corruptionCounts: number[]
  private readonly interfaceAttributions: Map<number, string> = new Map()

  constructor(options: PieceManagerOptions) {
    this.totalBytes = options.totalBytes
    this.pieceLength = options.pieceLength
    this.numPieces = options.numPieces
    this.pieceHashes = options.pieceHashes
    this.files = options.files

    this.states = new Array<PieceState>(this.numPieces).fill('missing')
    this.availability = new Array<number>(this.numPieces).fill(0)
    this.bytesReceived = new Array<number>(this.numPieces).fill(0)
    this.retryCounts = new Array<number>(this.numPieces).fill(0)
    this.corruptionCounts = new Array<number>(this.numPieces).fill(0)

    if (options.initialBitfieldHex) {
      const bitfield = hexToBitfield(options.initialBitfieldHex, this.numPieces)
      for (let i = 0; i < this.numPieces; i++) {
        if (bitfield[i]) {
          this.states[i] = 'verified'
          this.bytesReceived[i] = this.getPieceLength(i)
        }
      }
    }
  }

  getPieceLength(index: number): number {
    if (index < 0 || index >= this.numPieces) return 0
    if (index === this.numPieces - 1) {
      const remainder = this.totalBytes % this.pieceLength
      return remainder === 0 ? this.pieceLength : remainder
    }
    return this.pieceLength
  }

  getPieceState(index: number): PieceState {
    return this.states[index] ?? 'missing'
  }

  getAllStates(): PieceState[] {
    return [...this.states]
  }

  setPieceState(index: number, state: PieceState, interfaceId?: string): void {
    if (index < 0 || index >= this.numPieces) return
    this.states[index] = state
    if (interfaceId) {
      this.interfaceAttributions.set(index, interfaceId)
    }
  }

  markPieceRequested(index: number, interfaceId?: string): void {
    if (index >= 0 && index < this.numPieces && this.states[index] === 'missing') {
      this.states[index] = 'requested'
      if (interfaceId) {
        this.interfaceAttributions.set(index, interfaceId)
      }
    }
  }

  markPieceDownloading(index: number, bytesDownloaded: number, interfaceId?: string): void {
    if (index >= 0 && index < this.numPieces) {
      if (this.states[index] !== 'verified') {
        this.states[index] = 'downloading'
      }
      this.bytesReceived[index] = Math.min(bytesDownloaded, this.getPieceLength(index))
      if (interfaceId) {
        this.interfaceAttributions.set(index, interfaceId)
      }
    }
  }

  getBytesReceived(index: number): number {
    return this.bytesReceived[index] || 0
  }

  verifyPiece(index: number, pieceBuffer: Buffer | Uint8Array, interfaceId?: string): boolean {
    if (index < 0 || index >= this.numPieces) return false

    const expectedHash = this.pieceHashes[index]
    const isValid = expectedHash ? verifyPieceHash(pieceBuffer, expectedHash) : true

    if (isValid) {
      this.states[index] = 'verified'
      this.bytesReceived[index] = this.getPieceLength(index)
      if (interfaceId) {
        this.interfaceAttributions.set(index, interfaceId)
      }
      return true
    } else {
      this.states[index] = 'corrupted'
      this.corruptionCounts[index] = (this.corruptionCounts[index] || 0) + 1
      this.retryCounts[index] = (this.retryCounts[index] || 0) + 1
      this.bytesReceived[index] = 0
      return false
    }
  }

  /**
   * Verifies a piece during startup or force-recheck disk verification.
   * If the piece fails cryptographic hash check or has no data, it is marked as 'missing',
   * NEVER as 'corrupted'. 'corrupted' is strictly for live peer download failures.
   */
  verifyPieceFromDisk(index: number, pieceBuffer: Buffer | Uint8Array): boolean {
    if (index < 0 || index >= this.numPieces) return false

    const expectedHash = this.pieceHashes[index]
    if (!expectedHash) {
      this.states[index] = 'missing'
      this.bytesReceived[index] = 0
      return false
    }

    const isValid = verifyPieceHash(pieceBuffer, expectedHash)
    if (isValid) {
      this.states[index] = 'verified'
      this.bytesReceived[index] = this.getPieceLength(index)
      return true
    } else {
      this.states[index] = 'missing'
      this.bytesReceived[index] = 0
      return false
    }
  }

  /**
   * Resets all piece states to 'missing' when no files exist on disk or when starting fresh.
   */
  resetAllToMissing(): void {
    for (let i = 0; i < this.numPieces; i++) {
      this.states[i] = 'missing'
      this.bytesReceived[i] = 0
      this.corruptionCounts[i] = 0
    }
  }

  /**
   * Generates a byte array bitfield suitable for WebTorrent initialization.
   */
  getBitfieldUint8Array(): Uint8Array {
    const numBytes = Math.ceil(this.numPieces / 8)
    const buf = new Uint8Array(numBytes)
    for (let i = 0; i < this.numPieces; i++) {
      if (this.states[i] === 'verified') {
        const byteIndex = Math.floor(i / 8)
        const bitIndex = 7 - (i % 8)
        buf[byteIndex] |= 1 << bitIndex
      }
    }
    return buf
  }

  resetCorruptedPiece(index: number): void {
    if (index >= 0 && index < this.numPieces && this.states[index] === 'corrupted') {
      this.states[index] = 'missing'
    }
  }

  updatePeerAvailability(peerBitfield: boolean[]): void {
    for (let i = 0; i < Math.min(this.numPieces, peerBitfield.length); i++) {
      if (peerBitfield[i]) {
        this.availability[i] = (this.availability[i] || 0) + 1
      }
    }
  }

  decrementPeerAvailability(peerBitfield: boolean[]): void {
    for (let i = 0; i < Math.min(this.numPieces, peerBitfield.length); i++) {
      if (peerBitfield[i]) {
        this.availability[i] = Math.max(0, (this.availability[i] || 0) - 1)
      }
    }
  }

  applyFilePriorities(priorities: Record<number, TorrentFilePriority>): void {
    // Map files to piece ranges
    const piecePriorities = new Array<TorrentFilePriority>(this.numPieces).fill('normal')

    for (const file of this.files) {
      const priority = priorities[file.index] ?? 'normal'
      const startPiece = Math.floor(file.offset / this.pieceLength)
      const endPiece = Math.floor((file.offset + file.length - 1) / this.pieceLength)

      for (let p = startPiece; p <= endPiece; p++) {
        if (p < this.numPieces) {
          if (priority === 'skip' && piecePriorities[p] === 'normal') {
            piecePriorities[p] = 'skip'
          } else if (priority === 'high') {
            piecePriorities[p] = 'high'
          } else if (priority === 'low' && piecePriorities[p] === 'normal') {
            piecePriorities[p] = 'low'
          }
        }
      }
    }

    // Apply skip to non-verified pieces
    for (let i = 0; i < this.numPieces; i++) {
      if (piecePriorities[i] === 'skip' && this.states[i] !== 'verified') {
        this.states[i] = 'skipped'
      } else if (this.states[i] === 'skipped' && piecePriorities[i] !== 'skip') {
        this.states[i] = 'missing'
      }
    }
  }

  getPieceCounts() {
    const counts = {
      verified: 0,
      missing: 0,
      requested: 0,
      downloading: 0,
      corrupted: 0,
      skipped: 0
    }
    for (let i = 0; i < this.numPieces; i++) {
      counts[this.states[i]]++
    }
    return counts
  }

  getVerifiedCount(): number {
    return this.getPieceCounts().verified
  }

  getVerifiedBytes(): number {
    let bytes = 0
    for (let i = 0; i < this.numPieces; i++) {
      if (this.states[i] === 'verified') {
        bytes += this.getPieceLength(i)
      }
    }
    return bytes
  }

  isComplete(): boolean {
    for (let i = 0; i < this.numPieces; i++) {
      if (this.states[i] !== 'verified' && this.states[i] !== 'skipped') {
        return false
      }
    }
    return true
  }

  getBitfieldHex(): string {
    const bitfield = this.states.map((s) => s === 'verified')
    return bitfieldToHex(bitfield)
  }

  getPieceInfos(): PieceInfo[] {
    return this.states.map((state, index) => ({
      index,
      length: this.getPieceLength(index),
      state,
      availability: this.availability[index] || 0,
      bytesReceived: this.bytesReceived[index] || 0,
      interfaceId: this.interfaceAttributions.get(index),
      retryCount: this.retryCounts[index] || 0
    }))
  }

  calculateFileProgresses(priorities: Record<number, TorrentFilePriority>): TorrentFileInfo[] {
    return this.files.map((file) => {
      const startPiece = Math.floor(file.offset / this.pieceLength)
      const endPiece = Math.floor((file.offset + file.length - 1) / this.pieceLength)
      let completedBytes = 0

      for (let p = startPiece; p <= endPiece; p++) {
        if (p < this.numPieces && this.states[p] === 'verified') {
          const pieceStart = p * this.pieceLength
          const pieceEnd = pieceStart + this.getPieceLength(p)
          const overlapStart = Math.max(file.offset, pieceStart)
          const overlapEnd = Math.min(file.offset + file.length, pieceEnd)
          if (overlapEnd > overlapStart) {
            completedBytes += overlapEnd - overlapStart
          }
        }
      }

      const priority = priorities[file.index] ?? 'normal'
      const progress = file.length > 0 ? Math.min(1, completedBytes / file.length) : 1

      return {
        index: file.index,
        name: file.name,
        path: file.path,
        length: file.length,
        bytesCompleted: completedBytes,
        progress,
        priority,
        selected: priority !== 'skip'
      }
    })
  }
}
