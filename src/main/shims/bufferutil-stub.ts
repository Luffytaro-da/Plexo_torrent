// Pure JS fallback stub for bufferutil in Vite Electron bundle

export function mask(
  source: Uint8Array | Buffer,
  mask: Uint8Array | Buffer,
  output: Uint8Array | Buffer,
  offset: number,
  length: number
): void {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3]
  }
}

export function unmask(buffer: Uint8Array | Buffer, mask: Uint8Array | Buffer): void {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3]
  }
}

export default {
  mask,
  unmask
}
