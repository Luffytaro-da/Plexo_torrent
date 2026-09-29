import { createHash } from 'node:crypto'

/**
 * Computes SHA-1 hash of a buffer. Returns a 20-byte Buffer or hex string.
 */
export function sha1(data: Buffer | Uint8Array): Buffer {
  return createHash('sha1').update(data).digest()
}

/**
 * Computes SHA-256 hash of a buffer. Returns a 64-char hex string.
 */
export function sha256(data: Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Verifies if a piece buffer matches the expected 20-byte SHA-1 hash.
 */
export function verifyPieceHash(
  pieceBuffer: Buffer | Uint8Array,
  expectedHash: Buffer | Uint8Array | string
): boolean {
  const actualHash = sha1(pieceBuffer)

  if (typeof expectedHash === 'string') {
    return actualHash.toString('hex').toLowerCase() === expectedHash.toLowerCase()
  }

  return actualHash.equals(Buffer.from(expectedHash))
}

/**
 * Converts a bitfield array of booleans to a hex string for compact persistence.
 */
export function bitfieldToHex(bitfield: boolean[]): string {
  const numBytes = Math.ceil(bitfield.length / 8)
  const buf = Buffer.alloc(numBytes)

  for (let i = 0; i < bitfield.length; i++) {
    if (bitfield[i]) {
      const byteIndex = Math.floor(i / 8)
      const bitIndex = 7 - (i % 8)
      buf[byteIndex] |= 1 << bitIndex
    }
  }

  return buf.toString('hex')
}

/**
 * Parses a hex string back into a boolean array bitfield of specified length.
 */
export function hexToBitfield(hex: string, length: number): boolean[] {
  const buf = Buffer.from(hex, 'hex')
  const bitfield = new Array<boolean>(length).fill(false)

  for (let i = 0; i < length; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = 7 - (i % 8)
    if (byteIndex < buf.length) {
      bitfield[i] = (buf[byteIndex] & (1 << bitIndex)) !== 0
    }
  }

  return bitfield
}
