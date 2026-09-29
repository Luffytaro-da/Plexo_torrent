import { connect, Socket, type SocketConstructorOpts } from 'node:net'
import { networkInterfaces } from 'node:os'

const AF_INET = 2
const SOCK_STREAM = 1
const SOCK_CLOEXEC = 0o2000000
const SOL_SOCKET = 1
const SO_BINDTODEVICE = 25

interface Libc {
  socket: (domain: number, type: number, protocol: number) => number
  setsockopt: (fd: number, level: number, name: number, value: string, length: number) => number
  close: (fd: number) => number
  errno: () => number
}

let libc: Libc | null = null
let support: Promise<boolean> | null = null

function openOnDevice(lib: Libc, device: string): number {
  const fd = lib.socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0)
  if (fd < 0) throw new Error(`socket() failed (errno ${lib.errno()})`)
  if (
    lib.setsockopt(fd, SOL_SOCKET, SO_BINDTODEVICE, device, Buffer.byteLength(device) + 1) !== 0
  ) {
    const errno = lib.errno()
    lib.close(fd)
    throw new Error(`Couldn't bind socket to device ${device} (errno ${errno})`)
  }
  return fd
}

export function deviceBindingSupported(): Promise<boolean> {
  support ??= (async () => {
    if (process.platform !== 'linux') return true
    try {
      const { default: koffi } = await import('koffi')
      const lib = koffi.load('libc.so.6')
      const candidate: Libc = {
        socket: lib.func('int socket(int, int, int)'),
        setsockopt: lib.func('int setsockopt(int, int, int, const char *, uint32_t)'),
        close: lib.func('int close(int)'),
        errno: () => koffi.errno()
      }
      candidate.close(openOnDevice(candidate, 'lo'))
      libc = candidate
      return true
    } catch {
      return false
    }
  })()
  return support
}

function deviceFor(localAddress: string, host: string): string | undefined {
  if (host === 'localhost' || host.startsWith('127.')) return undefined
  for (const [device, addresses] of Object.entries(networkInterfaces())) {
    if (addresses?.some((addr) => addr.address === localAddress)) return device
  }
  return undefined
}

export function connectFrom(localAddress: string, host: string, port: number): Socket {
  const device = libc && deviceFor(localAddress, host)
  if (!libc || !device) {
    return connect({ host, port, localAddress, family: 4 })
  }

  try {
    const fd = openOnDevice(libc, device)
    return new Socket({ fd, manualStart: true } as SocketConstructorOpts).connect({
      host,
      port,
      family: 4
    })
  } catch (error) {
    const socket = new Socket()
    process.nextTick(() => socket.destroy(error as Error))
    return socket
  }
}

export type PlatformBindingCapabilityType = 'fully_supported' | 'partial' | 'best_effort' | 'unsupported'

export interface PlatformBindingCapabilityInfo {
  capability: PlatformBindingCapabilityType
  reason: string
  details: string
}

export function getPlatformBindingCapability(): PlatformBindingCapabilityInfo {
  if (process.platform === 'linux') {
    return {
      capability: 'fully_supported',
      reason: 'Linux native SO_BINDTODEVICE & policy routing supported.',
      details: 'Linux kernel supports per-socket interface binding via SO_BINDTODEVICE and policy routing, enabling deterministic multi-network distribution across physical adapters.'
    }
  }
  if (process.platform === 'win32') {
    return {
      capability: 'best_effort',
      reason: 'Windows Strong Host Model & metric-based routing (Best Effort).',
      details: 'Windows routes outbound packets based on interface metrics and route tables. Sockets explicitly bind to secondary adapter IPs, with automatic fallback to default route if the peer destination is unroutable via that adapter.'
    }
  }
  if (process.platform === 'darwin') {
    return {
      capability: 'best_effort',
      reason: 'macOS service order routing (Best Effort).',
      details: 'macOS prioritizes network interfaces by service order. Local IP binding is honored when routes exist for the adapter.'
    }
  }
  return {
    capability: 'unsupported',
    reason: `Platform "${process.platform}" does not provide granular socket binding.`,
    details: 'Sockets use the system default network stack without per-connection hardware routing.'
  }
}

export interface OutgoingInterfaceSelection {
  id: string
  displayName: string
  address: string
}

export interface SocketRelayMetadata {
  selectedInterface?: OutgoingInterfaceSelection
  selectedLocalAddress?: string
  actualLocalAddress?: string
  protocol: 'tcp' | 'utp' | 'webrtc'
  connectionStatus: 'connecting' | 'connected' | 'failed' | 'closed'
  fallbackReason?: string
  routingStatus: 'bound' | 'fallback'
  bytesReceived: number
  bytesUploaded: number
}

const originalConnect = Socket.prototype.connect
let socketInterceptorInstalled = false

export function installMultiInterfaceSocketInterceptor(
  getInterface: (host: string, port: number) => OutgoingInterfaceSelection | null
): void {
  if (socketInterceptorInstalled) return
  socketInterceptorInstalled = true

  Socket.prototype.connect = function (this: Socket, ...args: any[]): any {
    try {
      let options: any = null
      let cb: any = null

      if (typeof args[0] === 'object' && args[0] !== null) {
        options = { ...args[0] }
        cb = args[1]
      } else if (typeof args[0] === 'number' || typeof args[0] === 'string') {
        const port = Number(args[0])
        const host = typeof args[1] === 'string' ? args[1] : 'localhost'
        cb = typeof args[1] === 'function' ? args[1] : typeof args[2] === 'function' ? args[2] : undefined
        options = { port, host }
      }

      if (options && options.host && typeof options.host === 'string') {
        const host = options.host
        const isLocal = host === 'localhost' || host.startsWith('127.') || host === '::1'
        if (!isLocal && !options.localAddress) {
          const selected = getInterface(host, options.port)
          if (selected && selected.address) {
            options.localAddress = selected.address
            const meta: SocketRelayMetadata = {
              selectedInterface: selected,
              selectedLocalAddress: selected.address,
              actualLocalAddress: undefined,
              protocol: 'tcp',
              connectionStatus: 'connecting',
              routingStatus: 'bound',
              bytesReceived: 0,
              bytesUploaded: 0
            }
            ;(this as any)._relayMeta = meta
            ;(this as any)._relayInterface = selected
            ;(this as any)._selectedLocalAddress = selected.address

            this.once('connect', () => {
              const actual = this.localAddress
              meta.actualLocalAddress = actual
              meta.connectionStatus = 'connected'
              if (actual && actual !== selected.address) {
                meta.routingStatus = 'fallback'
                meta.fallbackReason = 'OS routed connection through default gateway instead of selected adapter'
                ;(this as any)._fallbackReason = meta.fallbackReason
              } else {
                meta.routingStatus = 'bound'
              }
            })

            this.once('error', (err: any) => {
              meta.connectionStatus = 'failed'
              if (err && (err.code === 'ENETUNREACH' || err.code === 'EHOSTUNREACH' || err.code === 'EADDRNOTAVAIL')) {
                meta.fallbackReason = `Network unreachable on selected adapter (${err.code})`
                ;(this as any)._fallbackReason = meta.fallbackReason
              }
            })

            this.once('close', () => {
              meta.connectionStatus = 'closed'
            })
          }
        }
      }

      if (options) {
        return originalConnect.call(this, options, cb)
      }
    } catch {
      // fallback to original connect
    }

    return originalConnect.apply(this, args as any)
  }
}
