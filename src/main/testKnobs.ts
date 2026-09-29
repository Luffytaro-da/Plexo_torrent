import type { NetworkInterfaceInfo } from '../shared/types'

/**
 * Test knobs allowing E2E and integration tests to inject mock network environments,
 * timings, and simulated interface configurations.
 */

let overriddenInterfaces: NetworkInterfaceInfo[] | null = null

export function setTestInterfaces(interfaces: NetworkInterfaceInfo[] | null): void {
  overriddenInterfaces = interfaces
}

export function testInterfaces(): NetworkInterfaceInfo[] | null {
  if (overriddenInterfaces) return overriddenInterfaces

  const env = process.env.RELAY_TEST_INTERFACES
  if (!env) return null

  // Format: "eth0=192.168.1.5,wlan0=192.168.1.6"
  const entries = env.split(',').filter(Boolean)
  return entries.map((entry) => {
    const [device, address] = entry.split('=')
    return {
      id: device,
      device,
      displayName: device.toUpperCase(),
      address: address || '127.0.0.1',
      ipv6Addresses: [],
      kind: device.toLowerCase().includes('wlan') || device.toLowerCase().includes('wifi') ? 'wifi' : 'ethernet',
      enabled: true,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 0,
      isOnline: true
    }
  })
}
