import net, { connect, isIP, Socket, type SocketConstructorOpts } from 'node:net'
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

export interface OutgoingConnectionRoutingDecision {
  infoHash?: string
  peerId?: string
  targetInterface?: OutgoingInterfaceSelection
  fallbackToDefault?: boolean
}

export interface SocketRelayMetadata {
  infoHash?: string
  peerId?: string
  selectedInterface?: OutgoingInterfaceSelection
  selectedLocalAddress?: string
  actualLocalAddress?: string
  protocol: 'tcp' | 'utp' | 'webrtc'
  connectionStatus: 'connecting' | 'connected' | 'failed' | 'closed'
  fallbackReason?: string
  routingStatus: 'bound' | 'source-address' | 'fallback'
  bindMethod: BindMethod
  bytesReceived: number
  bytesUploaded: number
}

export type BindMethod = 'device' | 'source-address'

export interface RouteRecord {
  selectedInterface: OutgoingInterfaceSelection
  bindMethod: BindMethod
  actualLocalAddress?: string
  fallbackReason?: string
}

type ConnectCb = (...args: unknown[]) => void
export interface ParsedConnectArgs {
  options: Record<string, unknown>
  cb?: ConnectCb
}

/** Parses both Socket#connect forms, including net.connect's normalized [options, callback] array. */
export function parseConnectArgs(args: unknown[]): ParsedConnectArgs | null {
  const first = args[0]
  if (Array.isArray(first)) {
    const [options, cb] = first as [unknown, unknown]
    if (!options || typeof options !== 'object') return null
    return {
      options: { ...(options as object) },
      cb: typeof cb === 'function' ? (cb as ConnectCb) : undefined
    }
  }
  if (first && typeof first === 'object') {
    return {
      options: { ...(first as object) },
      cb: typeof args[1] === 'function' ? (args[1] as ConnectCb) : undefined
    }
  }
  if (typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first))) {
    const cb = [args[1], args[2]].find((arg) => typeof arg === 'function') as ConnectCb | undefined
    return {
      options: { port: Number(first), host: typeof args[1] === 'string' ? args[1] : 'localhost' },
      cb
    }
  }
  return null
}

function routableIPv4(options: Record<string, unknown>): string | null {
  const host = options.host
  if (typeof host !== 'string' || typeof options.port !== 'number') return null
  if (options.localAddress || options.path) return null
  if (isIP(host) !== 4 || host.startsWith('127.') || host.startsWith('0.')) return null
  return host
}

type Router = (host: string, port: number) => OutgoingConnectionRoutingDecision | null
type DiagnosticsCb = (
  event: 'attempt' | 'connect' | 'error' | 'close',
  meta: SocketRelayMetadata,
  errorMsg?: string
) => void

const routeRecords = new Map<string, RouteRecord>()
const MAX_RECORDS = 4096

export function getRouteRecord(host: string | undefined, port: number | undefined): RouteRecord | undefined {
  return host && port ? routeRecords.get(`${host}:${port}`) : undefined
}

function remember(host: string, port: number, record: RouteRecord): void {
  routeRecords.delete(`${host}:${port}`)
  routeRecords.set(`${host}:${port}`, record)
  if (routeRecords.size > MAX_RECORDS) routeRecords.delete(routeRecords.keys().next().value as string)
}

function track(
  socket: Socket,
  host: string,
  port: number,
  decision: OutgoingConnectionRoutingDecision,
  selected: OutgoingInterfaceSelection,
  method: BindMethod,
  onEvent?: DiagnosticsCb
): void {
  const record: RouteRecord = { selectedInterface: selected, bindMethod: method }
  remember(host, port, record)
  const meta: SocketRelayMetadata = {
    infoHash: decision.infoHash,
    peerId: `${host}:${port}`,
    selectedInterface: selected,
    selectedLocalAddress: selected.address,
    protocol: 'tcp',
    connectionStatus: 'connecting',
    routingStatus: method === 'device' ? 'bound' : 'source-address',
    bindMethod: method,
    bytesReceived: 0,
    bytesUploaded: 0
  }
  const tagged = socket as Socket & Record<string, unknown>
  tagged._relayMeta = meta
  tagged._relayInterface = selected
  onEvent?.('attempt', meta)

  socket.once('connect', () => {
    meta.actualLocalAddress = record.actualLocalAddress = socket.localAddress ?? undefined
    meta.connectionStatus = 'connected'
    if (socket.localAddress && socket.localAddress !== selected.address) {
      meta.routingStatus = 'fallback'
      meta.fallbackReason = record.fallbackReason =
        `Connected from ${socket.localAddress}, not the selected ${selected.address}`
    }
    onEvent?.('connect', meta)
  })
  socket.once('error', (error: NodeJS.ErrnoException) => {
    meta.connectionStatus = 'failed'
    meta.fallbackReason = record.fallbackReason =
      error.code === 'ENETUNREACH' || error.code === 'EHOSTUNREACH' || error.code === 'EADDRNOTAVAIL'
        ? `Selected adapter unreachable for destination (${error.code})`
        : `Connection error: ${error.message}`
    onEvent?.('error', meta, meta.fallbackReason)
  })
  socket.once('close', () => {
    meta.connectionStatus = 'closed'
    onEvent?.('close', meta)
  })
}

const originalSocketConnect = Socket.prototype.connect
const originalNetConnect = net.connect
const originalCreateConnection = net.createConnection
let installed = false

export function installMultiInterfaceSocketInterceptor(getRouting: Router, onDiagnosticsEvent?: DiagnosticsCb): void {
  if (installed) return
  installed = true

  Socket.prototype.connect = function (this: Socket, ...args: unknown[]): Socket {
    try {
      const tagged = this as Socket & { _relayRouted?: boolean }
      const parsed = tagged._relayRouted ? null : parseConnectArgs(args)
      const host = parsed && routableIPv4(parsed.options)
      if (parsed && host) {
        const port = parsed.options.port as number
        const decision = getRouting(host, port)
        const selected = decision?.targetInterface
        if (decision && selected?.address && !decision.fallbackToDefault) {
          tagged._relayRouted = true
          parsed.options.localAddress = selected.address
          parsed.options.family = 4
          track(this, host, port, decision, selected, 'source-address', onDiagnosticsEvent)
          return originalSocketConnect.call(this, parsed.options as never, parsed.cb as never)
        }
      }
    } catch (error) {
      console.warn('[Router] connect interception failed, using default route:', error)
    }
    return originalSocketConnect.apply(this, args as never)
  } as typeof Socket.prototype.connect

  const wrapped = function (...args: unknown[]): Socket {
    try {
      if (libc) {
        const parsed = parseConnectArgs(args)
        const host = parsed && routableIPv4(parsed.options)
        if (parsed && host) {
          const port = parsed.options.port as number
          const decision = getRouting(host, port)
          const selected = decision?.targetInterface
          const device = selected && deviceFor(selected.address, host)
          if (decision && selected?.address && device && !decision.fallbackToDefault) {
            const fd = openOnDevice(libc, device)
            const socket = new Socket({ fd, manualStart: true } as SocketConstructorOpts)
            ;(socket as Socket & { _relayRouted?: boolean })._relayRouted = true
            track(socket, host, port, decision, selected, 'device', onDiagnosticsEvent)
            if (parsed.cb) socket.once('connect', parsed.cb)
            return originalSocketConnect.call(socket, { host, port, family: 4, localAddress: selected.address } as never)
          }
        }
      }
    } catch (error) {
      console.warn('[Router] device binding failed, falling back to source address:', error)
    }
    return (originalNetConnect as (...args: unknown[]) => Socket)(...args)
  }
  net.connect = wrapped as typeof net.connect
  net.createConnection = wrapped as typeof net.createConnection
}

export function uninstallMultiInterfaceSocketInterceptor(): void {
  if (!installed) return
  Socket.prototype.connect = originalSocketConnect
  net.connect = originalNetConnect
  net.createConnection = originalCreateConnection
  routeRecords.clear()
  installed = false
}
