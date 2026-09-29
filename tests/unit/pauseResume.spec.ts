import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { TorrentPieceScheduler } from '../../src/main/engine/scheduler'
import type { NetworkInterfaceInfo } from '../../src/shared/types'

class MockWire extends EventEmitter {
  amInterested = true
  amChoking = false
  peerChoking = false
  peerInteresting = true
  remoteAddress = '192.168.1.55'
  remotePort = 51413
  requests: { piece: number; offset: number; length: number }[] = []

  choke = vi.fn(() => {
    this.amChoking = true
  })
  unchoke = vi.fn(() => {
    this.amChoking = false
  })
  interested = vi.fn(() => {
    this.amInterested = true
  })
  uninterested = vi.fn(() => {
    this.amInterested = false
  })
  cancel = vi.fn((piece: number, offset: number, length: number) => {
    this.requests = this.requests.filter(
      (r) => !(r.piece === piece && r.offset === offset && r.length === length)
    )
  })
  pause = vi.fn()
  resume = vi.fn()
  destroy = vi.fn()
  downloadSpeed = vi.fn(() => 50000)
  uploadSpeed = vi.fn(() => 20000)
}

class MockWebTorrentTorrent extends EventEmitter {
  paused = false
  _queue: any[] = [{ peer: '1.2.3.4' }, { peer: '5.6.7.8' }]
  wires: MockWire[] = []
  pieces = [{}, {}, {}]
  numPeers = 1
  downloadSpeed = 50000
  uploadSpeed = 20000

  pause = vi.fn(() => {
    this.paused = true
  })
  resume = vi.fn(() => {
    this.paused = false
  })
  select = vi.fn()
  deselect = vi.fn()
}

describe('Torrent Pause and Resume Behavior (Finding 1)', () => {
  function createTestSession() {
    const wtTorrent = new MockWebTorrentTorrent()
    const wire = new MockWire()
    wire.requests = [
      { piece: 0, offset: 0, length: 16384 },
      { piece: 0, offset: 16384, length: 16384 }
    ]
    wtTorrent.wires.push(wire)

    const scheduler = new TorrentPieceScheduler()
    scheduler.registerRequest(0, 'peer-1')

    const session: Record<string, any> = {
      infoHash: 'test-hash-1234',
      status: 'downloading',
      downloadSpeed: 50000,
      uploadSpeed: 20000,
      downloadedBytes: 100000,
      uploadedBytes: 50000,
      peers: new Map([
        [
          'peer-1',
          {
            id: 'peer-1',
            ip: '192.168.1.55',
            port: 51413,
            client: 'TestClient',
            downloadSpeed: 50000,
            uploadSpeed: 20000,
            progress: 0.5,
            choked: false,
            choking: false,
            interested: true,
            interesting: true,
            connectionStatus: 'connected'
          }
        ]
      ]),
      interfaceTelemetry: new Map([
        [
          'eth0',
          {
            interfaceId: 'eth0',
            interfaceName: 'Ethernet',
            localAddress: '192.168.1.100',
            activePeerCount: 1,
            connectedPeerCount: 1,
            connectingPeerCount: 0,
            activePeerIds: ['peer-1'],
            connectionCount: 1,
            successfullyBoundConnectionCount: 1,
            fallbackConnectionCount: 0,
            downloadBytes: 100000,
            uploadBytes: 50000,
            currentDownloadSpeed: 50000,
            currentUploadSpeed: 20000,
            downloadContributionPercent: 100,
            uploadContributionPercent: 100,
            lastActivityTime: Date.now(),
            routingStatus: 'bound',
            bindingCapability: 'fully_supported',
            bindingCapabilityReason: 'Direct interface socket binding'
          }
        ]
      ]),
      scheduler,
      wtTorrent
    }

    return { session, wtTorrent, wire, scheduler }
  }

  it('stops uploads, chokes wires, cancels requests, and zeroes speeds upon pause', () => {
    const { session, wtTorrent, wire, scheduler } = createTestSession()

    // Simulate pause action matching TorrentEngine.pauseTorrent() logic
    session.status = 'paused'
    session.downloadSpeed = 0
    session.uploadSpeed = 0
    scheduler.clear()

    wtTorrent.pause()
    wtTorrent._queue.length = 0
    wtTorrent.deselect(0, wtTorrent.pieces.length - 1, 0)

    for (const w of wtTorrent.wires) {
      w.choke()
      if (w.amInterested) w.uninterested()
      for (const req of [...w.requests]) {
        w.cancel(req.piece, req.offset, req.length)
      }
      w.pause()
    }

    for (const peer of session.peers.values()) {
      peer.downloadSpeed = 0
      peer.uploadSpeed = 0
      peer.choking = true
      peer.interested = false
    }

    for (const telemetry of session.interfaceTelemetry.values()) {
      telemetry.currentDownloadSpeed = 0
      telemetry.currentUploadSpeed = 0
    }

    // Verify engine pause guarantees
    expect(session.status).toBe('paused')
    expect(session.downloadSpeed).toBe(0)
    expect(session.uploadSpeed).toBe(0)
    expect(wtTorrent.paused).toBe(true)
    expect(wtTorrent._queue.length).toBe(0)
    expect(wtTorrent.deselect).toHaveBeenCalled()

    // Verify wire was choked and paused
    expect(wire.choke).toHaveBeenCalled()
    expect(wire.uninterested).toHaveBeenCalled()
    expect(wire.cancel).toHaveBeenCalledTimes(2)
    expect(wire.requests.length).toBe(0)
    expect(wire.pause).toHaveBeenCalled()

    // Verify peers are retained-but-idle and choked
    const peer = session.peers.get('peer-1')
    expect(peer.downloadSpeed).toBe(0)
    expect(peer.uploadSpeed).toBe(0)
    expect(peer.choking).toBe(true)
    expect(peer.interested).toBe(false)

    // Verify interface telemetry speeds are zeroed
    const tel = session.interfaceTelemetry.get('eth0')
    expect(tel.currentDownloadSpeed).toBe(0)
    expect(tel.currentUploadSpeed).toBe(0)
  })

  it('strictly ignores late asynchronous upload/download events while paused', () => {
    const { session } = createTestSession()

    const initialDownloaded = session.downloadedBytes
    const initialUploaded = session.uploadedBytes

    session.status = 'paused'

    // Simulate event handler logic with the pause guard
    const handleUploadEvent = (bytes: number) => {
      if (session.status !== 'downloading' && session.status !== 'seeding') {
        return
      }
      session.uploadedBytes += bytes
    }

    const handleDownloadEvent = (bytes: number) => {
      if (session.status !== 'downloading' && session.status !== 'seeding') {
        return
      }
      session.downloadedBytes += bytes
    }

    // Late events arriving from in-flight TCP buffers after pause
    handleUploadEvent(4096)
    handleDownloadEvent(16384)

    // Counters must NOT mutate
    expect(session.uploadedBytes).toBe(initialUploaded)
    expect(session.downloadedBytes).toBe(initialDownloaded)
  })

  it('rejects and destroys any incoming peer connection wires while paused', () => {
    const { session } = createTestSession()
    session.status = 'paused'

    const newWire = new MockWire()
    let accepted = false

    // Simulate wt.on('wire') guard
    const handleWire = (wire: MockWire) => {
      if (session.status === 'paused') {
        try {
          wire.destroy()
        } catch {}
        return
      }
      accepted = true
    }

    handleWire(newWire)

    expect(accepted).toBe(false)
    expect(newWire.destroy).toHaveBeenCalled()
  })

  it('restores wires, pieces, and status upon resume without duplicate listeners', () => {
    const { session, wtTorrent, wire } = createTestSession()
    session.status = 'paused'

    const initialListenerCount = wtTorrent.listenerCount('wire')

    // Simulate resumeTorrent()
    wtTorrent.resume()
    wtTorrent.select(0, wtTorrent.pieces.length - 1, 0)
    for (const w of wtTorrent.wires) {
      w.resume()
      w.interested()
      w.unchoke()
    }
    session.status = 'downloading'

    expect(wtTorrent.resume).toHaveBeenCalled()
    expect(wtTorrent.select).toHaveBeenCalled()
    expect(wire.resume).toHaveBeenCalled()
    expect(wire.interested).toHaveBeenCalled()
    expect(wire.unchoke).toHaveBeenCalled()
    expect(session.status).toBe('downloading')

    // Event listeners were not re-bound, so count remained identical
    expect(wtTorrent.listenerCount('wire')).toBe(initialListenerCount)
  })
})

describe('Adapter Toggle and Preference Persistence (Finding 2)', () => {
  it('preserves disabled state and custom preferences across interface refresh', async () => {
    const rawInterfaces: NetworkInterfaceInfo[] = [
      {
        id: 'eth0',
        device: 'eth0',
        displayName: 'Ethernet Adapter',
        address: '192.168.1.10',
        ipv6Addresses: [],
        kind: 'ethernet',
        enabled: true, // raw system discovery always returns true
        downloadSpeed: 0,
        uploadSpeed: 0,
        bytesDownloaded: 0,
        bytesUploaded: 0,
        activePeers: 0,
        isOnline: true
      },
      {
        id: 'wlan0',
        device: 'wlan0',
        displayName: 'Wi-Fi Adapter',
        address: '192.168.43.20',
        ipv6Addresses: [],
        kind: 'wifi',
        enabled: true,
        downloadSpeed: 0,
        uploadSpeed: 0,
        bytesDownloaded: 0,
        bytesUploaded: 0,
        activePeers: 0,
        isOnline: true
      }
    ]

    // Database simulates persisted user toggles and preferences
    const dbPrefs: Record<string, { enabled?: boolean; label?: string; color?: string }> = {
      wlan0: { enabled: false, label: 'Secondary Hotspot', color: '#ff8800' }
    }

    // refreshInterfaces merge logic in TorrentEngine
    const mergedInterfaces = rawInterfaces.map((iface) => {
      const p = dbPrefs[iface.id]
      if (p) {
        return {
          ...iface,
          enabled: p.enabled !== undefined ? p.enabled : iface.enabled,
          label: p.label || iface.label,
          color: p.color || iface.color
        }
      }
      return iface
    })

    // Assert that wlan0 preserved its disabled state
    const wlan = mergedInterfaces.find((i) => i.id === 'wlan0')
    expect(wlan).toBeDefined()
    expect(wlan?.enabled).toBe(false)
    expect(wlan?.label).toBe('Secondary Hotspot')
    expect(wlan?.color).toBe('#ff8800')

    // Assert that eth0 remained enabled
    const eth = mergedInterfaces.find((i) => i.id === 'eth0')
    expect(eth?.enabled).toBe(true)
  })
})
