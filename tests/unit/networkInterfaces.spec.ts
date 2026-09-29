import { describe, expect, it } from 'vitest'
import { listActiveInterfaces } from '../../src/main/network/interfaces'
import { setTestInterfaces } from '../../src/main/testKnobs'
import type { NetworkInterfaceInfo } from '../../src/shared/types'

describe('Network Interface Discovery', () => {
  it('respects test interface overrides', async () => {
    const mockInterfaces: NetworkInterfaceInfo[] = [
      {
        id: 'eth0',
        device: 'eth0',
        displayName: 'Gigabit Ethernet',
        address: '192.168.1.100',
        ipv6Addresses: [],
        kind: 'ethernet',
        enabled: true,
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
        displayName: 'Wi-Fi 6',
        address: '192.168.1.101',
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

    setTestInterfaces(mockInterfaces)
    const list = await listActiveInterfaces()
    expect(list.length).toBe(2)
    expect(list[0].id).toBe('eth0')
    expect(list[1].kind).toBe('wifi')

    setTestInterfaces(null)
  })
})
