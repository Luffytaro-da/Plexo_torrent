import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto'

// Robust fallback shim for uint8-util in Vite Electron bundle

export function randomBytes(size: number): Uint8Array {
  const buf = nodeRandomBytes(size)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

export async function hash(data: any, format?: any, algo = 'sha1'): Promise<any> {
  const normAlgo = algo.replace('sha-', 'sha')
  let buf: Buffer
  if (data instanceof ArrayBuffer) {
    buf = Buffer.from(data)
  } else if (data && data.buffer) {
    buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  } else {
    buf = Buffer.from(data || '')
  }
  const h = createHash(normAlgo).update(buf)
  if (format) {
    return h.digest(format)
  }
  const res = h.digest()
  return new Uint8Array(res.buffer, res.byteOffset, res.byteLength)
}

export const text2arr = (str: string): Uint8Array => {
  if (!str) return new Uint8Array(0)
  const buf = Buffer.from(str, 'utf8')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

export const arr2text = (data: any): string => {
  if (typeof data === 'string') return data
  if (!data) return ''
  if (data.buffer) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  }
  return Buffer.from(data).toString('utf8')
}

export const arr2base = (data: any): string => {
  if (!data) return ''
  if (typeof data === 'string') return Buffer.from(data).toString('base64')
  if (data.buffer) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64')
  }
  return Buffer.from(data).toString('base64')
}

export const arr2hex = (data: any): string => {
  if (typeof data === 'string') return data
  if (!data) return ''
  if (data.buffer) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex')
  }
  return Buffer.from(data).toString('hex')
}

export const hex2arr = (str: string): Uint8Array => {
  if (!str) return new Uint8Array(0)
  if (typeof str !== 'string') return str
  const buf = Buffer.from(str, 'hex')
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

export const hex2bin = (hex: string): string => Buffer.from(hex || '', 'hex').toString('binary')
export const bin2hex = (bin: string): string => Buffer.from(bin || '', 'binary').toString('hex')

export const concat = (chunks: Uint8Array[], size?: number): Uint8Array => {
  let length = size || 0
  if (!size) {
    for (const chunk of chunks) length += chunk.length
  }
  const b = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    b.set(chunk, offset)
    offset += chunk.length
  }
  return b
}

export const equal = (a: any, b: any): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export default {
  randomBytes,
  hash,
  text2arr,
  arr2text,
  arr2base,
  arr2hex,
  hex2arr,
  hex2bin,
  bin2hex,
  concat,
  equal
}
