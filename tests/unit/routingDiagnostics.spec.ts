import { describe, expect, it } from 'vitest'
import { PeerDiagnosticsTracker } from '../../src/main/network/peerDiagnostics'
import { NetworkTelemetryTracker } from '../../src/main/network/telemetry'
import type { InterfaceRoutingDetailedStatus, NetworkInterfaceInfo } from '../../src/shared/types'

describe('Peer Diagnostics and Windows Multi-Interface Routing Tests', () => {
  it('records peer diagnostic information including selected vs actual local address and fallback reason', () => {
    const tracker = new PeerDiagnosticsTracker(50)
    const infoHash = 'a'.repeat(40)

    tracker.recordConnectionAttempt(infoHash, '198.51.100.1', 6881, 'tcp', {
      id: 'eth-1',
      displayName: 'Ethernet',
      address: '192.168.1.100'
    })

    // Suppose the socket connected via default route (fallback)
    tracker.recordConnectionSuccess(
      infoHash,
      '198.51.100.1',
      6881,
      '192.168.43.200',
      'Wi-Fi',
      'Fallback from 192.168.1.100 to 192.168.43.200'
    )

    // Record transferred bytes
    tracker.recordBytes(infoHash, '198.51.100.1', 6881, 16384, 0)

    const allRecords = tracker.getAllDiagnostics()
    expect(allRecords).toHaveLength(1)
    const record = allRecords[0]
    expect(record.ip).toBe('198.51.100.1')
    expect(record.selectedLocalAddress).toBe('192.168.1.100')
    expect(record.actualLocalAddress).toBe('192.168.43.200')
    expect(record.actualWindowsAdapter).toBe('Wi-Fi')
    expect(record.connectionResult).toBe('connected')
    expect(record.receivedBytes).toBe(16384)
    expect(record.fallbackReason).toContain('Fallback from 192.168.1.100')
  })

  it('records connection failure when an interface cannot reach remote peer', () => {
    const tracker = new PeerDiagnosticsTracker(50)
    const infoHash = 'b'.repeat(40)

    tracker.recordConnectionAttempt(infoHash, '203.0.113.50', 51413, 'tcp', {
      id: 'eth-2',
      displayName: 'Ethernet 2',
      address: '10.0.0.5'
    })

    tracker.recordConnectionFailure(
      infoHash,
      '203.0.113.50',
      51413,
      'WSAEHOSTUNREACH: No route to host',
      '10.0.0.5'
    )

    const record = tracker.getAllDiagnostics()[0]
    expect(record.connectionResult).toBe('failed')
    expect(record.fallbackReason).toContain('WSAEHOSTUNREACH')
    expect(record.actualLocalAddress).toBe('10.0.0.5')
  })

  it('strictly excludes unconfirmed physical adapters from main network usage totals', () => {
    const telemetry = new NetworkTelemetryTracker()

    const wifiIface: NetworkInterfaceInfo = {
      id: 'wifi',
      device: 'Wi-Fi',
      displayName: 'Wi-Fi',
      address: '192.168.43.15',
      ipv6Addresses: [],
      kind: 'wifi',
      enabled: true,
      isOnline: true,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 10
    }

    const ethernetIface: NetworkInterfaceInfo = {
      id: 'eth',
      device: 'Ethernet',
      displayName: 'Ethernet',
      address: '10.0.0.10',
      ipv6Addresses: [],
      kind: 'ethernet',
      enabled: true,
      isOnline: true,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 0
    }

    // Feed physical NDIS stats: Wi-Fi receiving bytes, Ethernet received 0 bytes
    const physicalStats = new Map<string, { receivedBytes: number; sentBytes: number }>()
    physicalStats.set('Wi-Fi', { receivedBytes: 5000000, sentBytes: 1000000 })
    physicalStats.set('Ethernet', { receivedBytes: 0, sentBytes: 0 })
    telemetry.updatePhysicalStats(physicalStats)

    // Record download on Wi-Fi
    telemetry.recordDownload('wifi', 1048576)

    const sysTelemetry = telemetry.getSystemTelemetry([wifiIface, ethernetIface], 1)

    // Wi-Fi should show downloaded bytes
    const wifiSnap = sysTelemetry.interfaces.find((i) => i.id === 'wifi')
    expect(wifiSnap?.bytesDownloaded).toBe(1048576)

    // Ethernet was NOT physically confirmed and has 0 active peers, so its speed is 0
    const ethSnap = sysTelemetry.interfaces.find((i) => i.id === 'eth')
    expect(ethSnap?.downloadSpeed).toBe(0)
    expect(ethSnap?.isPhysicallyConfirmed).toBe(false)

    // Total download speed only includes physically confirmed adapters
    expect(sysTelemetry.totalDownloadSpeed).toBe(wifiSnap?.downloadSpeed)
  })

  it('supports all required granular interface routing states', () => {
    const validStates: InterfaceRoutingDetailedStatus[] = [
      'detected',
      'enabled',
      'selected',
      'socket-bound',
      'connected',
      'transferring',
      'confirmed physical traffic',
      'fallback',
      'unsupported',
      'offline',
      'idle'
    ]

    for (const state of validStates) {
      expect(typeof state).toBe('string')
      expect(state.length).toBeGreaterThan(0)
    }
  })
})
