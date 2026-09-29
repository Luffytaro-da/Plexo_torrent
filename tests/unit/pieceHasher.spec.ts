import { describe, expect, it } from 'vitest'
import { bitfieldToHex, hexToBitfield, sha1, sha256, verifyPieceHash } from '../../src/main/engine/pieceHasher'

describe('Piece Hasher and Bitfields', () => {
  it('computes sha1 and sha256 hashes accurately', () => {
    const data = Buffer.from('RelayTorrent high performance BitTorrent client')
    const hash1 = sha1(data)
    expect(hash1.length).toBe(20)

    const hash256 = sha256(data)
    expect(hash256.length).toBe(64)
  })

  it('verifies piece hashes correctly', () => {
    const piece = Buffer.from('Piece block payload for unit test')
    const expectedHash = sha1(piece).toString('hex')

    expect(verifyPieceHash(piece, expectedHash)).toBe(true)
    expect(verifyPieceHash(Buffer.from('corrupted payload'), expectedHash)).toBe(false)
  })

  it('converts bitfield to hex and back without loss', () => {
    const bitfield = [true, false, true, true, false, false, true, false, true, true]
    const hex = bitfieldToHex(bitfield)
    expect(typeof hex).toBe('string')

    const reconstructed = hexToBitfield(hex, bitfield.length)
    expect(reconstructed).toEqual(bitfield)
  })
})
