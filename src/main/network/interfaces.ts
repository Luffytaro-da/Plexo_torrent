import { execFile } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { promisify } from 'node:util'
import type { NetworkInterfaceInfo, NetworkInterfaceKind } from '../../shared/types'
import { testInterfaces } from '../testKnobs'

const execFileAsync = promisify(execFile)
const DISCOVERY_TIMEOUT_MS = 5000

interface WindowsAdapter {
  Name: string
  InterfaceDescription: string
  Status: string
  LinkSpeed: string
  NdisPhysicalMedium: number
}

async function getMacHardwarePortNames(): Promise<Map<string, string>> {
  const deviceToName = new Map<string, string>()
  if (process.platform !== 'darwin') return deviceToName
  try {
    const { stdout } = await execFileAsync('networksetup', ['-listallhardwareports'], {
      timeout: DISCOVERY_TIMEOUT_MS
    })
    const blocks = stdout.split(/\n\s*\n/)
    for (const block of blocks) {
      const portMatch = /Hardware Port:\s*(.+)/.exec(block)
      const deviceMatch = /Device:\s*(.+)/.exec(block)
      if (portMatch && deviceMatch) {
        deviceToName.set(deviceMatch[1].trim(), portMatch[1].trim())
      }
    }
  } catch {
    // Fallback to raw device names
  }
  return deviceToName
}

function classifyInterface(descriptionOrName: string): NetworkInterfaceKind {
  const name = descriptionOrName.toLowerCase()
  if (/wi-?fi|wireless|wlan|802\.11|airport/.test(name)) return 'wifi'
  if (/rndis|remote ndis|tether|apple mobile device|iphone|ipad|usb/.test(name)) return 'usb'
  if (name.includes('bridge')) return 'bridge'
  if (name.includes('ethernet') || name.includes('lan') || name.includes('gigabit') || name.includes('pcie')) {
    return 'ethernet'
  }
  return 'other'
}

let cachedWindowsAdapters: Map<string, WindowsAdapter> = new Map()
let lastWindowsAdapterFetch = 0

async function getWindowsAdapters(): Promise<Map<string, WindowsAdapter>> {
  if (process.platform !== 'win32') return new Map()
  const now = Date.now()
  if (now - lastWindowsAdapterFetch < 4000 && cachedWindowsAdapters.size > 0) {
    return cachedWindowsAdapters
  }
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetAdapter -ErrorAction Stop | Select-Object Name, InterfaceDescription, Status, LinkSpeed, NdisPhysicalMedium | ConvertTo-Json -Compress'
      ],
      { windowsHide: true, timeout: DISCOVERY_TIMEOUT_MS, encoding: 'utf8' }
    )
    const clean = stdout.trim().replace(/^\uFEFF/, '')
    if (clean) {
      const parsed = JSON.parse(clean)
      const adapters: WindowsAdapter[] = Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
      cachedWindowsAdapters = new Map(
        adapters
          .filter((a) => typeof a.Name === 'string')
          .map((a) => [a.Name, a])
      )
      lastWindowsAdapterFetch = now
    }
  } catch {
    // Return existing cache on error
  }
  return cachedWindowsAdapters
}

export async function getWindowsPhysicalAdapterStats(): Promise<Map<string, { receivedBytes: number; sentBytes: number }>> {
  if (process.platform !== 'win32') return new Map()
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetAdapterStatistics -ErrorAction Stop | Select-Object Name, ReceivedBytes, SentBytes | ConvertTo-Json -Compress'
      ],
      { windowsHide: true, timeout: 3500, encoding: 'utf8' }
    )
    const clean = stdout.trim().replace(/^\uFEFF/, '')
    if (!clean) return new Map()
    const parsed = JSON.parse(clean)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const map = new Map<string, { receivedBytes: number; sentBytes: number }>()
    for (const item of list) {
      if (item && item.Name) {
        map.set(item.Name, {
          receivedBytes: Number(item.ReceivedBytes) || 0,
          sentBytes: Number(item.SentBytes) || 0
        })
      }
    }
    return map
  } catch {
    return new Map()
  }
}

export async function getWindowsRoutesSummary(): Promise<{ destinationPrefix: string; nextHop: string; interfaceAlias: string; metric: number }[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop | Select-Object DestinationPrefix, NextHop, InterfaceAlias, RouteMetric | ConvertTo-Json -Compress"
      ],
      { windowsHide: true, timeout: 3500, encoding: 'utf8' }
    )
    const clean = stdout.trim().replace(/^\uFEFF/, '')
    if (!clean) return []
    const parsed = JSON.parse(clean)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.map((item: any) => ({
      destinationPrefix: String(item.DestinationPrefix || '0.0.0.0/0'),
      nextHop: String(item.NextHop || ''),
      interfaceAlias: String(item.InterfaceAlias || ''),
      metric: Number(item.RouteMetric) || 0
    }))
  } catch {
    return []
  }
}

export async function listActiveInterfaces(): Promise<NetworkInterfaceInfo[]> {
  const overridden = testInterfaces()
  if (overridden) return overridden

  const hardwarePorts = await getMacHardwarePortNames()
  const windowsAdapters = await getWindowsAdapters()
  const all = networkInterfaces()
  const result: NetworkInterfaceInfo[] = []

  for (const [device, addresses] of Object.entries(all)) {
    if (!addresses) continue

    // Find non-internal IPv4 address (ignore 127.0.0.1 and link-local 169.254.x.x)
    const ipv4 = addresses.find(
      (addr) => addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')
    )
    if (!ipv4) continue

    const ipv6List = addresses
      .filter((addr) => addr.family === 'IPv6' && !addr.internal && !addr.address.startsWith('fe80:'))
      .map((addr) => addr.address)

    const hardwareName = hardwarePorts.get(device)
    const adapter = windowsAdapters.get(device)
    let kind = classifyInterface(adapter?.InterfaceDescription ?? hardwareName ?? device)

    // NdisPhysicalMedium: 1 = wireless LAN, 9 = native 802.11, 14 = Ethernet (802.3)
    if (adapter?.NdisPhysicalMedium === 1 || adapter?.NdisPhysicalMedium === 9) {
      kind = 'wifi'
    } else if (kind === 'other' && adapter?.NdisPhysicalMedium === 14) {
      kind = 'ethernet'
    }

    const isOnline = adapter ? adapter.Status === 'Up' : true

    result.push({
      id: device,
      device,
      displayName: hardwareName ?? adapter?.InterfaceDescription ?? device,
      address: ipv4.address,
      ipv6Addresses: ipv6List,
      kind,
      mac: ipv4.mac && ipv4.mac !== '00:00:00:00:00:00' ? ipv4.mac : undefined,
      enabled: true,
      downloadSpeed: 0,
      uploadSpeed: 0,
      bytesDownloaded: 0,
      bytesUploaded: 0,
      activePeers: 0,
      isOnline,
      routingState: isOnline ? 'enabled' : 'offline',
      isPhysicallyConfirmed: false
    })
  }

  return result
}
