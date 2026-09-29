import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sha1, sha256 } from '../../src/main/engine/pieceHasher'

export interface SyntheticFile {
  name: string
  content: Buffer
  sha256: string
}

export interface SyntheticTorrentFixture {
  name: string
  files: SyntheticFile[]
  totalBytes: number
  pieceLength: number
  numPieces: number
  pieceHashes: string[]
  expectedSha256s: Record<string, string>
}

/**
 * Creates a synthetic multi-file torrent fixture with deterministically generated data.
 */
export async function createSyntheticTorrentFixture(
  targetDir: string,
  pieceLength = 16384
): Promise<SyntheticTorrentFixture> {
  await mkdir(targetDir, { recursive: true })

  const file1Content = Buffer.from('Synthetic file 1 content with test data '.repeat(500)) // ~20KB
  const file2Content = Buffer.from('Synthetic file 2 content with binary data '.repeat(800)) // ~33KB

  const files: SyntheticFile[] = [
    { name: 'document.txt', content: file1Content, sha256: sha256(file1Content) },
    { name: 'archive.bin', content: file2Content, sha256: sha256(file2Content) }
  ]

  const expectedSha256s: Record<string, string> = {
    'document.txt': files[0].sha256,
    'archive.bin': files[1].sha256
  }

  // Write files to target dir
  for (const f of files) {
    await writeFile(join(targetDir, f.name), f.content)
  }

  // Concatenate and compute piece hashes
  const combined = Buffer.concat([file1Content, file2Content])
  const totalBytes = combined.length
  const numPieces = Math.ceil(totalBytes / pieceLength)
  const pieceHashes: string[] = []

  for (let i = 0; i < numPieces; i++) {
    const start = i * pieceLength
    const end = Math.min(start + pieceLength, totalBytes)
    const slice = combined.subarray(start, end)
    pieceHashes.push(sha1(slice).toString('hex'))
  }

  return {
    name: 'SyntheticTorrent',
    files,
    totalBytes,
    pieceLength,
    numPieces,
    pieceHashes,
    expectedSha256s
  }
}
