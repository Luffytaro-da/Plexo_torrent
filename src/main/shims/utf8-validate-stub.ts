// Pure JS fallback stub for utf-8-validate in Vite Electron bundle
import { isUtf8 } from 'node:buffer'

export function isValidUTF8(buf: Uint8Array | Buffer): boolean {
  if (typeof isUtf8 === 'function') {
    return isUtf8(buf as Buffer)
  }
  return true
}

export default isValidUTF8
