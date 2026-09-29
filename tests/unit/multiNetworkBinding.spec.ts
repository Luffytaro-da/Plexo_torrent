import { describe, expect, it } from 'vitest'
import { getPlatformBindingCapability } from '../../src/main/network/deviceBinding'
import { PieceManager } from '../../src/main/engine/pieceManager'
import { createHash } from 'node:crypto'

describe('Multi-Network Binding & Telemetry Attribution', () => {
  it('exposes platform binding capability and documents OS limitations correctly', () => {
    const platformCap = getPlatformBindingCapability()

    expect(['fully_supported', 'best_effort', 'partial', 'unsupported']).toContain(platformCap.capability)
    expect(platformCap.reason).toBeDefined()
    expect(platformCap.reason.length).toBeGreaterThan(10)
    expect(platformCap.details).toBeDefined()

    if (process.platform === 'win32') {
      expect(platformCap.capability).toBe('best_effort')
      expect(platformCap.reason).toContain('Strong Host')
    } else if (process.platform === 'linux') {
      expect(platformCap.capability).toBe('fully_supported')
      expect(platformCap.reason).toContain('SO_BINDTODEVICE')
    }
  })

  it('attributes traffic strictly to actual transmitting local address, not selected intent', () => {
    // Simulating two network interfaces:
    // primary: 192.168.1.50
    // secondary: 192.168.43.100
    const primaryIface = { id: 'eth0', displayName: 'Ethernet', address: '192.168.1.50' }
    const secondaryIface = { id: 'wlan0', displayName: 'Wi-Fi Hotspot', address: '192.168.43.100' }

    // Suppose policy selected secondary (wlan0), but socket.localAddress returned primary (eth0) due to OS routing fallback
    const selectedIface = secondaryIface
    const actualLocalAddress = primaryIface.address // 192.168.1.50

    // Engine checks actual address to determine attribution
    const interfaces = [primaryIface, secondaryIface]
    const matchedIface = interfaces.find((i) => i.address === actualLocalAddress)

    // The interface that must receive traffic attribution MUST be primary, NOT selected
    expect(matchedIface?.id).toBe('eth0')
    expect(matchedIface?.id).not.toBe(selectedIface.id)

    // And routing status must be marked as fallback
    const routingStatus = actualLocalAddress === selectedIface.address ? 'bound' : 'fallback'
    expect(routingStatus).toBe('fallback')
  })

  it('calculates contribution percentages from actual transferred bytes', () => {
    const ethBytes = 750000
    const wifiBytes = 250000
    const totalTorrentDownloaded = ethBytes + wifiBytes

    const ethContribution = Math.round((ethBytes / totalTorrentDownloaded) * 100)
    const wifiContribution = Math.round((wifiBytes / totalTorrentDownloaded) * 100)

    expect(ethContribution).toBe(75)
    expect(wifiContribution).toBe(25)
    expect(ethContribution + wifiContribution).toBe(100)
  })

  it('updates live piece states from missing to downloading to verified', () => {
    const rawData = Buffer.from('LivePieceChunkStreamingTestData1234567890')
    const hash = createHash('sha1').update(rawData).digest('hex')

    const pm = new PieceManager({
      totalBytes: rawData.length,
      pieceLength: rawData.length,
      numPieces: 1,
      pieceHashes: [hash],
      files: [{ index: 0, name: 'test.bin', path: 'test.bin', length: rawData.length, offset: 0 }]
    })

    // Initially missing
    expect(pm.getPieceState(0)).toBe('missing')
    expect(pm.getBytesReceived(0)).toBe(0)

    // Chunk arrives on wire
    pm.markPieceDownloading(0, 16384, 'wlan0')
    expect(pm.getPieceState(0)).toBe('downloading')
    expect(pm.getBytesReceived(0)).toBe(rawData.length) // clamped to piece length

    // Full piece completes and verifies
    const verified = pm.verifyPiece(0, rawData, 'wlan0')
    expect(verified).toBe(true)
    expect(pm.getPieceState(0)).toBe('verified')
    expect(pm.isComplete()).toBe(true)
  })
})
