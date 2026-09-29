import { describe, expect, it } from 'vitest'
import { InterfacePolicyEngine } from '../../src/main/network/interfacePolicy'
import type { InterfacePolicy, NetworkInterfaceInfo } from '../../src/shared/types'

describe('InterfacePolicyEngine', () => {
  const ifaces: NetworkInterfaceInfo[] = [
    {
      id: 'eth0',
      device: 'eth0',
      displayName: 'Ethernet',
      address: '192.168.1.10',
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
      displayName: 'Wi-Fi',
      address: '192.168.1.20',
      ipv6Addresses: [],
      kind: 'wifi',
      enabled: true,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 0,
      isOnline: true
    },
    {
      id: 'usb0',
      device: 'usb0',
      displayName: 'USB Tether',
      address: '192.168.42.2',
      ipv6Addresses: [],
      kind: 'usb',
      enabled: false, // Disabled
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 0,
      isOnline: true
    }
  ]

  it('filters interfaces according to policy modes', () => {
    // Automatic: returns all enabled interfaces
    const auto = InterfacePolicyEngine.getEligibleInterfaces({ mode: 'automatic' }, ifaces)
    expect(auto.map((i) => i.id)).toEqual(['eth0', 'wlan0'])

    // Single: returns only target interface
    const single = InterfacePolicyEngine.getEligibleInterfaces(
      { mode: 'single', targetInterfaceId: 'wlan0' },
      ifaces
    )
    expect(single.map((i) => i.id)).toEqual(['wlan0'])

    // Custom: returns enabled custom list
    const custom = InterfacePolicyEngine.getEligibleInterfaces(
      { mode: 'custom', enabledInterfaceIds: ['eth0'] },
      ifaces
    )
    expect(custom.map((i) => i.id)).toEqual(['eth0'])
  })

  it('balances connections across eligible interfaces', () => {
    const policy: InterfacePolicy = { mode: 'automatic' }
    const iface0 = InterfacePolicyEngine.selectInterfaceForConnection(policy, ifaces, 0)
    const iface1 = InterfacePolicyEngine.selectInterfaceForConnection(policy, ifaces, 1)

    expect(iface0?.id).toBe('eth0')
    expect(iface1?.id).toBe('wlan0')
  })
})
