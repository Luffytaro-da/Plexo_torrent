import { existsSync, readFileSync } from 'node:fs'
import { open, readFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import WebTorrent from 'webtorrent'
import { TELEMETRY_BROADCAST_INTERVAL_MS } from '../../shared/constants'
import type {
  ActivityLogEntry,
  AddTorrentOptions,
  GlobalSettings,
  InterfacePolicy,
  NetworkInterfaceInfo,
  PieceState,
  TorrentFilePriority,
  TorrentMetadataInspectResult,
  TorrentPeerInfo,
  TorrentState,
  TorrentStatus,
  TorrentTrackerInfo,
  VerificationJobState,
  VerificationStatus,
  TorrentInterfaceTelemetry,
  InterfaceRoutingDetailedStatus,
  RoutingDiagnosticsReport
} from '../../shared/types'
import {
  listActiveInterfaces,
  getWindowsPhysicalAdapterStats,
  getWindowsRoutesSummary
} from '../network/interfaces'
import { InterfacePolicyEngine } from '../network/interfacePolicy'
import { NetworkTelemetryTracker } from '../network/telemetry'
import {
  installMultiInterfaceSocketInterceptor,
  getRouteRecord,
  getPlatformBindingCapability,
  type OutgoingConnectionRoutingDecision
} from '../network/deviceBinding'
import { PeerDiagnosticsTracker } from '../network/peerDiagnostics'
import type { Database } from '../persistence/database'
import type { ITorrentEngineAdapter, TorrentEngineEvents } from './adapter'
import { PieceManager } from './pieceManager'
import { resolveSafeDownloadPath, validateMagnetUri } from './safety'
import { TorrentPieceScheduler } from './scheduler'

export const DEFAULT_TRACKERS = [
  'http://tracker.opentrackr.org:1337/announce',
  'https://tracker.tamersunion.org:443/announce',
  'http://open.acgnxtracker.com:80/announce',
  'https://tracker.gbitt.info:443/announce',
  'https://tracker.lelux.fi:443/announce',
  'https://tracker.moeking.me:443/announce',
  'http://tracker.files.fm:6969/announce',
  'http://tracker.mywaifu.best:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce'
]

async function parseTorrentAsync(data: any): Promise<any> {
  const mod = await import('parse-torrent')
  const parse = mod.default || mod
  return parse(data)
}

interface ActiveTorrentSession {
  infoHash: string
  name: string
  savePath: string
  magnetUri?: string
  torrentFilePath?: string
  totalBytes: number
  pieceLength: number
  numPieces: number
  pieceHashes: string[]
  files: { index: number; name: string; path: string; length: number; offset: number }[]
  filePriorities: Record<number, TorrentFilePriority>
  pieceManager: PieceManager
  scheduler: TorrentPieceScheduler
  wtTorrent?: WebTorrent.Torrent
  status: TorrentStatus
  interfacePolicy: InterfacePolicy
  downloadLimit?: number
  uploadLimit?: number
  seedingRatioLimit?: number
  downloadedBytes: number
  uploadedBytes: number
  downloadSpeed: number
  uploadSpeed: number
  addedAt: number
  completedAt: number | null
  errorMessage?: string
  activityLogs: ActivityLogEntry[]
  peers: Map<string, TorrentPeerInfo>
  trackers: TorrentTrackerInfo[]
  connectionCounter: number
  verificationJob?: VerificationJobState
  interfaceTelemetry: Map<string, TorrentInterfaceTelemetry>
  isStarting?: boolean
  isVerifyingDisk?: boolean
}

export class TorrentEngine implements ITorrentEngineAdapter {
  private client: WebTorrent.Instance | null = null
  private settings: GlobalSettings
  private database: Database
  private events: TorrentEngineEvents
  private sessions: Map<string, ActiveTorrentSession> = new Map()
  private interfaces: NetworkInterfaceInfo[] = []
  private telemetryTracker = new NetworkTelemetryTracker()
  private updateTimer: NodeJS.Timeout | null = null
  private isDestroyed = false
  private currentDrainingSession: ActiveTorrentSession | null = null
  private peerDiagnosticsTracker = new PeerDiagnosticsTracker(300)
  private activePeerRoutingDecisions = new Map<string, OutgoingConnectionRoutingDecision>()

  constructor(settings: GlobalSettings, database: Database, events: TorrentEngineEvents) {
    this.settings = settings
    this.database = database
    this.events = events
  }

  async initialize(settings: GlobalSettings): Promise<void> {
    this.settings = settings
    await this.refreshInterfaces()

    // Install deterministic multi-network interface socket router with per-peer diagnostics
    installMultiInterfaceSocketInterceptor(
      (host, port) => {
        const key = `${host}:${port}`
        const decision = this.activePeerRoutingDecisions.get(key)
        if (decision) {
          return decision
        }

        const activeSession = this.currentDrainingSession || Array.from(this.sessions.values()).find(
          (s) => s.status === 'downloading' || s.status === 'seeding'
        )
        if (activeSession) {
          activeSession.connectionCounter++
          const onlineIfaces = this.interfaces.filter((i) => i.isOnline && i.enabled)
          const iface = InterfacePolicyEngine.selectInterfaceForConnection(
            activeSession.interfacePolicy,
            onlineIfaces,
            activeSession.connectionCounter
          )
          if (iface) {
            return {
              infoHash: activeSession.infoHash,
              peerId: key,
              targetInterface: { id: iface.id, displayName: iface.displayName, address: iface.address }
            }
          }
        }
        return null
      },
      (event, meta, errorMsg) => {
        const infoHash = meta.infoHash || 'unknown'
        const parts = meta.peerId ? meta.peerId.split(':') : []
        const ip = parts[0] || 'unknown'
        const port = Number(parts[1]) || 0
        if (event === 'attempt') {
          this.peerDiagnosticsTracker.recordConnectionAttempt(infoHash, ip, port, meta.protocol, meta.selectedInterface)
        } else if (event === 'connect') {
          this.peerDiagnosticsTracker.recordConnectionSuccess(
            infoHash,
            ip,
            port,
            meta.actualLocalAddress,
            meta.selectedInterface?.displayName,
            meta.fallbackReason
          )
        } else if (event === 'error') {
          this.peerDiagnosticsTracker.recordConnectionFailure(
            infoHash,
            ip,
            port,
            errorMsg || 'connection failed',
            meta.actualLocalAddress
          )
        } else if (event === 'close') {
          this.peerDiagnosticsTracker.recordClosed(infoHash, ip, port)
        }
      }
    )

    const dhtConfig = settings.enableDht !== false
      ? {
          bootstrap: [
            'router.bittorrent.com:6881',
            'router.utorrent.com:6881',
            'dht.transmissionbt.com:6881',
            'dht.libtorrent.org:25401',
            'dht.aelitis.com:6881'
          ]
        }
      : false

    this.client = new WebTorrent({
      dht: dhtConfig,
      lsd: settings.enableLsd !== false,
      utPex: settings.enablePex !== false,
      natUpnp: settings.enableUpnp !== false,
      natPmp: settings.enableUpnp !== false,
      torrentPort: settings.listenPort || 0,
      utp: false,
      webSeeds: true,
      maxConns: settings.maxGlobalConns || 1000,
      downloadLimit: settings.globalDownloadLimit ?? -1,
      uploadLimit: settings.globalUploadLimit ?? -1
    })

    // Load persisted torrents from database
    const persisted = this.database.getAllTorrents()
    for (const record of persisted) {
      try {
        const source = record.magnetUri
          ? { type: 'magnet' as const, uri: record.magnetUri }
          : record.torrentFilePath
            ? { type: 'file' as const, filePath: record.torrentFilePath }
            : null

        if (source) {
          await this.restorePersistedTorrent(record)
        }
      } catch (err) {
        console.warn(`[Engine] Failed to restore torrent ${record.infoHash}:`, err)
      }
    }

    // Broadcast restored state immediately so UI renders restored items with 0 speeds
    this.broadcastTorrents()

    // Trigger startup state machine for active restored torrents: restored -> checking -> downloading / seeding
    for (const session of this.sessions.values()) {
      if (session.status === 'restored') {
        void this.startTorrent(session.infoHash)
      }
    }

    // Start throttled telemetry & state update loop
    this.startUpdateLoop()
  }

  async destroy(): Promise<void> {
    this.isDestroyed = true
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }

    for (const session of this.sessions.values()) {
      if (session.wtTorrent) {
        try {
          session.wtTorrent.destroy({ destroyStore: false })
        } catch {
          // ignore
        }
      }
    }
    this.sessions.clear()

    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client?.destroy(() => resolve())
      })
      this.client = null
    }
  }

  async refreshInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const raw = await listActiveInterfaces()
    // Enrich with database custom preferences if any
    const prefs = this.database.getAllNetworkConfigs()
    this.interfaces = raw.map((iface) => {
      const p = prefs[iface.id]
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
    return [...this.interfaces]
  }

  getInterfaces(): NetworkInterfaceInfo[] {
    return [...this.interfaces]
  }

  async inspectMetadata(
    source: { type: 'magnet'; uri: string } | { type: 'file'; filePath: string; fileData?: Uint8Array }
  ): Promise<TorrentMetadataInspectResult> {
    let parsed: any

    if (source.type === 'magnet') {
      const val = validateMagnetUri(source.uri)
      if (!val.isValid || !val.infoHash) {
        throw new Error(val.error || 'Invalid magnet URI')
      }
      // If we already have full parsed metadata for this infohash
      const existing = this.sessions.get(val.infoHash)
      if (existing) {
        return {
          infoHash: existing.infoHash,
          name: existing.name,
          totalBytes: existing.totalBytes,
          pieceLength: existing.pieceLength,
          numPieces: existing.numPieces,
          files: existing.files.map((f) => ({
            index: f.index,
            name: f.name,
            path: f.path,
            length: f.length
          })),
          trackers: existing.trackers.map((t) => t.announce)
        }
      }

      parsed = await parseTorrentAsync(source.uri)
    } else {
      const data = source.fileData ? Buffer.from(source.fileData) : await readFile(source.filePath)
      parsed = await parseTorrentAsync(data)
    }

    if (!parsed.infoHash) {
      throw new Error('Failed to parse torrent info hash')
    }

    const name = parsed.name || 'Unknown Torrent'
    const pieceLength = parsed.pieceLength || 262144
    const pieceHashes = parsed.pieces || []
    const totalBytes = parsed.length || 0
    const files = parsed.files?.map((f: any, index: number) => ({
      index,
      name: f.name,
      path: f.path,
      length: f.length
    })) || [{ index: 0, name, path: name, length: totalBytes }]

    const announceList = Array.isArray(parsed.announce) ? parsed.announce : parsed.announce ? [parsed.announce] : []

    return {
      infoHash: parsed.infoHash.toLowerCase(),
      name,
      totalBytes,
      pieceLength,
      numPieces: pieceHashes.length,
      files,
      trackers: announceList
    }
  }

  async addTorrent(options: AddTorrentOptions): Promise<string> {
    const meta = await this.inspectMetadata(options.source)
    const infoHash = meta.infoHash.toLowerCase()

    if (this.sessions.has(infoHash)) {
      throw new Error(`Torrent "${meta.name}" is already in download queue`)
    }

    const savePath = resolveSafeDownloadPath(
      options.savePath || this.settings.defaultSavePath,
      meta.name
    )

    let magnetUri: string | undefined
    let torrentFilePath: string | undefined

    if (options.source.type === 'magnet') {
      magnetUri = options.source.uri
    } else {
      torrentFilePath = options.source.filePath
    }

    let offsetCounter = 0
    const files = meta.files.map((f, i) => {
      const item = {
        index: i,
        name: f.name,
        path: f.path,
        length: f.length,
        offset: offsetCounter
      }
      offsetCounter += f.length
      return item
    })

    // Retrieve piece hashes from metadata
    let rawParsed: any = null
    if (options.source.type === 'file') {
      const data = options.source.fileData ? Buffer.from(options.source.fileData) : await readFile(options.source.filePath)
      rawParsed = await parseTorrentAsync(data)
    }

    const pieceHashes = rawParsed?.pieces || []
    const numPieces = pieceHashes.length || Math.ceil(meta.totalBytes / meta.pieceLength)

    const pieceManager = new PieceManager({
      totalBytes: meta.totalBytes,
      pieceLength: meta.pieceLength,
      numPieces,
      pieceHashes,
      files
    })

    const filePriorities = options.filePriorities || {}
    pieceManager.applyFilePriorities(filePriorities)

    const interfacePolicy = options.interfacePolicy || this.settings.defaultInterfacePolicy

    const session: ActiveTorrentSession = {
      infoHash,
      name: meta.name,
      savePath: dirname(savePath),
      magnetUri,
      torrentFilePath,
      totalBytes: meta.totalBytes,
      pieceLength: meta.pieceLength,
      numPieces,
      pieceHashes,
      files,
      filePriorities,
      pieceManager,
      scheduler: new TorrentPieceScheduler(),
      status: options.startImmediately !== false ? 'downloading' : 'paused',
      interfacePolicy,
      downloadLimit: options.downloadLimit,
      uploadLimit: options.uploadLimit,
      seedingRatioLimit: options.seedingRatioLimit,
      downloadedBytes: 0,
      uploadedBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      addedAt: Date.now(),
      completedAt: null,
      activityLogs: [
        {
          timestamp: Date.now(),
          level: 'info',
          message: `Torrent "${meta.name}" added.`
        }
      ],
      peers: new Map(),
      trackers: meta.trackers.map((announce) => ({
        announce,
        status: 'working',
        peers: 0,
        seeds: 0,
        leechers: 0
      })),
      connectionCounter: 0,
      interfaceTelemetry: new Map()
    }

    this.sessions.set(infoHash, session)
    this.persistSession(session)

    if (options.startImmediately !== false) {
      void this.startTorrent(infoHash)
    }

    this.broadcastTorrents()
    return infoHash
  }

  private async restorePersistedTorrent(record: import('../persistence/schema').PersistedTorrentRecord): Promise<void> {
    const infoHash = record.infoHash.toLowerCase()

    let pieceHashes: string[] = []
    let files = [{ index: 0, name: record.name, path: record.name, length: record.totalBytes, offset: 0 }]

    if (record.torrentFilePath && existsSync(record.torrentFilePath)) {
      try {
        const raw = readFileSync(record.torrentFilePath)
        const parsed = await parseTorrentAsync(raw)
        pieceHashes = parsed.pieces || []
        let offsetCounter = 0
        if (parsed.files) {
          files = parsed.files.map((f: any, i: number) => {
            const item = { index: i, name: f.name, path: f.path, length: f.length, offset: offsetCounter }
            offsetCounter += f.length
            return item
          })
        }
      } catch {
        // use record fallback
      }
    }

    const pieceManager = new PieceManager({
      totalBytes: record.totalBytes,
      pieceLength: record.pieceLength,
      numPieces: record.numPieces,
      pieceHashes,
      files,
      initialBitfieldHex: record.verifiedBitfield
    })

    pieceManager.applyFilePriorities(record.filePriorities || {})

    // Explicit state machine: restored sessions start in 'paused' or 'restored'
    const initialStatus: TorrentStatus = record.status === 'paused' ? 'paused' : 'restored'

    const session: ActiveTorrentSession = {
      infoHash,
      name: record.name,
      savePath: record.savePath,
      magnetUri: record.magnetUri,
      torrentFilePath: record.torrentFilePath,
      totalBytes: record.totalBytes,
      pieceLength: record.pieceLength,
      numPieces: record.numPieces,
      pieceHashes,
      files,
      filePriorities: record.filePriorities || {},
      pieceManager,
      scheduler: new TorrentPieceScheduler(),
      status: initialStatus,
      interfacePolicy: record.interfacePolicy,
      downloadLimit: record.downloadLimit,
      uploadLimit: record.uploadLimit,
      seedingRatioLimit: record.seedingRatioLimit,
      downloadedBytes: record.downloadedBytes,
      uploadedBytes: record.uploadedBytes,
      downloadSpeed: 0,
      uploadSpeed: 0,
      addedAt: record.addedAt,
      completedAt: record.completedAt,
      activityLogs: [
        {
          timestamp: Date.now(),
          level: 'info',
          message: `Restored session from disk (was: ${record.status}, initial: ${initialStatus}).`
        }
      ],
      peers: new Map(),
      trackers: [],
      connectionCounter: 0,
      interfaceTelemetry: new Map()
    }

    this.sessions.set(infoHash, session)
  }

  async startTorrent(infoHash: string): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session || !this.client) return

    // Guard against re-entrant calls
    if (session.isStarting || (session.status === 'checking' && session.isVerifyingDisk)) {
      return
    }
    session.isStarting = true

    try {
      // Step 1: Detect existing files on disk
      const existingFilePaths = new Map<number, string>()
      let anyFileExists = false
      for (const file of session.files) {
        const diskFilePath = resolveSafeDownloadPath(session.savePath, file.path)
        if (existsSync(diskFilePath)) {
          existingFilePaths.set(file.index, diskFilePath)
          anyFileExists = true
        }
      }

      // Step 2: State transition: restored -> checking (if data on disk exists)
      if (anyFileExists && session.pieceHashes.length > 0) {
        session.status = 'checking'
        session.downloadSpeed = 0
        session.uploadSpeed = 0
        this.logActivity(session, 'info', 'Verifying existing data on disk...')
        this.broadcastTorrents()
        await this.verifyDiskData(session, existingFilePaths)
      } else {
        if (!anyFileExists) {
          session.pieceManager.resetAllToMissing()
        }
      }

      // Check if verification was cancelled
      if (session.verificationJob?.status === 'cancelled') {
        session.status = 'paused'
        this.persistSession(session)
        this.broadcastTorrents()
        return
      }

      // Step 3: State transition: checking -> completed / seeding OR downloading
      if (session.pieceManager.isComplete()) {
        session.status = 'seeding'
        if (!session.completedAt) session.completedAt = Date.now()
        this.logActivity(session, 'success', 'All pieces verified. Transitioned to seeding.')
      } else {
        session.status = 'downloading'
        const verifiedCount = session.pieceManager.getVerifiedCount()
        if (verifiedCount > 0) {
          this.logActivity(
            session,
            'info',
            `${verifiedCount} / ${session.numPieces} pieces verified. Connecting to swarm and downloading remaining pieces...`
          )
        } else {
          this.logActivity(session, 'info', 'Connecting to swarm and downloading pieces...')
        }
      }

      this.persistSession(session)
      this.broadcastTorrents()

      // Step 4: Attach to WebTorrent client (STRICTLY after disk check has finished)
      const source = session.torrentFilePath && existsSync(session.torrentFilePath)
        ? session.torrentFilePath
        : session.magnetUri || session.infoHash

      let wtTorrent = this.client.torrents.find((t) => t.infoHash === session.infoHash)
      if (!wtTorrent) {
        const announceList = [...new Set([...session.trackers.map((t) => t.announce), ...DEFAULT_TRACKERS])]
        wtTorrent = this.client.add(source, {
          path: session.savePath,
          announce: announceList,
          maxConns: this.settings.maxConnsPerTorrent || 55,
          bitfield: session.pieceManager.getBitfieldUint8Array(),
          deselect: false
        })
      }

      session.wtTorrent = wtTorrent
      const originalDrain = (wtTorrent as any)._drain?.bind(wtTorrent)
      if (originalDrain && !(wtTorrent as any)._relayDrainHooked) {
        ;(wtTorrent as any)._relayDrainHooked = true
        ;(wtTorrent as any)._drain = () => {
          this.currentDrainingSession = session
          const q = (wtTorrent as any)._queue
          if (Array.isArray(q) && q.length > 0) {
            const nextPeer = q[0]
            if (nextPeer && nextPeer.addr) {
              session.connectionCounter++
              const onlineIfaces = this.interfaces.filter((i) => i.isOnline && i.enabled)
              const target = InterfacePolicyEngine.selectInterfaceForConnection(
                session.interfacePolicy,
                onlineIfaces,
                session.connectionCounter
              )
              if (target) {
                this.activePeerRoutingDecisions.set(nextPeer.addr, {
                  infoHash: session.infoHash,
                  peerId: nextPeer.addr,
                  targetInterface: { id: target.id, displayName: target.displayName, address: target.address }
                })
              }
            }
          }
          try {
            originalDrain()
          } finally {
            this.currentDrainingSession = null
          }
        }
      }
      this.bindWebTorrentEvents(session, wtTorrent)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      session.status = 'error'
      session.errorMessage = errorMsg
      this.logActivity(session, 'error', `Engine error: ${errorMsg}`)
      this.persistSession(session)
      this.broadcastTorrents()
    } finally {
      session.isStarting = false
    }
  }

  cancelVerification(infoHash: string): void {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (session && session.verificationJob && session.verificationJob.status === 'checking') {
      session.verificationJob.status = 'cancelled'
      session.isVerifyingDisk = false
      this.logActivity(session, 'warn', 'Verification cancelled.')
    }
  }

  private async verifyDiskData(session: ActiveTorrentSession, existingFilePaths?: Map<number, string>): Promise<void> {
    if (session.pieceHashes.length === 0) return

    session.isVerifyingDisk = true
    session.verificationJob = {
      status: 'preparing',
      totalPiecesToCheck: session.numPieces,
      piecesChecked: 0,
      verifiedPieces: 0,
      missingPieces: 0,
      corruptedPieces: 0,
      totalBytesToCheck: session.totalBytes,
      bytesChecked: 0,
      currentPieceIndex: 0,
      speed: 0,
      eta: null,
      startTime: Date.now(),
      completionTime: null
    }
    this.broadcastTorrents()

    const filePaths = existingFilePaths || new Map<number, string>()
    if (!existingFilePaths) {
      for (const file of session.files) {
        const diskFilePath = resolveSafeDownloadPath(session.savePath, file.path)
        if (existsSync(diskFilePath)) {
          filePaths.set(file.index, diskFilePath)
        }
      }
    }

    if (filePaths.size === 0) {
      session.pieceManager.resetAllToMissing()
      session.verificationJob.status = 'completed'
      session.verificationJob.completionTime = Date.now()
      session.isVerifyingDisk = false
      this.broadcastTorrents()
      return
    }

    session.verificationJob.status = 'checking'

    const MAX_OPEN_FILES = 50
    const fileHandles = new Map<number, any>()
    const recentlyUsedFileIndices: number[] = []

    const getFileHandle = async (fileIndex: number) => {
      if (fileHandles.has(fileIndex)) {
        const idx = recentlyUsedFileIndices.indexOf(fileIndex)
        if (idx !== -1) recentlyUsedFileIndices.splice(idx, 1)
        recentlyUsedFileIndices.push(fileIndex)
        return fileHandles.get(fileIndex)
      }

      if (fileHandles.size >= MAX_OPEN_FILES) {
        const toClose = recentlyUsedFileIndices.shift()
        if (toClose !== undefined) {
          const fh = fileHandles.get(toClose)
          fileHandles.delete(toClose)
          try { await fh?.close() } catch {}
        }
      }

      const path = filePaths.get(fileIndex)
      if (!path) return null

      try {
        const fh = await open(path, 'r')
        fileHandles.set(fileIndex, fh)
        recentlyUsedFileIndices.push(fileIndex)
        return fh
      } catch {
        return null
      }
    }

    const CONCURRENCY = 4
    let currentPiece = 0
    let lastBroadcastTime = Date.now()
    let lastBytesChecked = 0
    let lastSpeedUpdate = Date.now()

    const checkPiece = async (p: number): Promise<void> => {
      const pieceLength = session.pieceManager.getPieceLength(p)
      const pieceOffset = p * session.pieceLength
      const pieceBuf = Buffer.alloc(pieceLength)
      let bytesRead = 0

      for (const file of session.files) {
        const fileStart = file.offset
        const fileEnd = file.offset + file.length
        const pieceEnd = pieceOffset + pieceLength

        const overlapStart = Math.max(pieceOffset, fileStart)
        const overlapEnd = Math.min(pieceEnd, fileEnd)

        if (overlapEnd > overlapStart) {
          const fh = await getFileHandle(file.index)
          if (!fh) continue

          const fileOffset = overlapStart - fileStart
          const bufferOffset = overlapStart - pieceOffset
          const readLen = overlapEnd - overlapStart
          try {
            const { bytesRead: r } = await fh.read(pieceBuf, bufferOffset, readLen, fileOffset)
            bytesRead += r
          } catch {
            // Read error
          }
        }
      }

      let isVerified = false
      if (bytesRead === pieceLength) {
        isVerified = session.pieceManager.verifyPieceFromDisk(p, pieceBuf)
      } else {
        session.pieceManager.setPieceState(p, 'missing')
      }

      if (session.verificationJob) {
        session.verificationJob.bytesChecked += pieceLength
        session.verificationJob.piecesChecked++
        if (isVerified) {
          session.verificationJob.verifiedPieces++
        } else {
          session.verificationJob.missingPieces++
        }
        session.verificationJob.currentPieceIndex = p
      }
    }

    try {
      const workers = Array.from({ length: CONCURRENCY }).map(async () => {
        while (currentPiece < session.numPieces) {
          if ((session.verificationJob?.status as VerificationStatus) === 'cancelled') break

          const p = currentPiece++
          await checkPiece(p)

          const now = Date.now()
          if (now - lastSpeedUpdate >= 1000) {
            const dt = (now - lastSpeedUpdate) / 1000
            const db = session.verificationJob!.bytesChecked - lastBytesChecked
            session.verificationJob!.speed = Math.max(0, db / dt)
            const remBytes = session.verificationJob!.totalBytesToCheck - session.verificationJob!.bytesChecked
            session.verificationJob!.eta = session.verificationJob!.speed > 0 ? Math.ceil(remBytes / session.verificationJob!.speed) : null
            lastBytesChecked = session.verificationJob!.bytesChecked
            lastSpeedUpdate = now
          }

          if (now - lastBroadcastTime >= 400) {
            this.broadcastTorrents()
            lastBroadcastTime = now
          }
        }
      })

      await Promise.all(workers)

      if ((session.verificationJob?.status as VerificationStatus) !== 'cancelled') {
        session.verificationJob!.status = 'completed'
      }
    } finally {
      for (const fh of fileHandles.values()) {
        try { await fh.close() } catch {}
      }
      fileHandles.clear()
      session.isVerifyingDisk = false
      if (session.verificationJob) {
        session.verificationJob.completionTime = Date.now()
        session.verificationJob.speed = 0
        session.verificationJob.eta = null
      }
      this.broadcastTorrents()
    }
  }

  private bindWebTorrentEvents(session: ActiveTorrentSession, wt: WebTorrent.Torrent): void {
    if (!wt || typeof wt.on !== 'function') return
    if ((wt as any)._relayListenersBound) return
    ;(wt as any)._relayListenersBound = true

    wt.on('metadata', () => {
      session.name = wt.name || session.name
      session.totalBytes = wt.length || session.totalBytes
      session.pieceLength = wt.pieceLength || session.pieceLength
      
      const realHashes: string[] = (wt as any)._hashes || (wt.torrentObject && (wt.torrentObject as any).pieces) || []
      if (realHashes.length > 0) {
        session.pieceHashes = realHashes
      }
      session.numPieces = session.pieceHashes.length || wt.pieces?.length || Math.ceil(session.totalBytes / session.pieceLength)

      let offsetCounter = 0
      session.files = wt.files.map((f, i) => {
        const item = {
          index: i,
          name: f.name,
          path: f.path,
          length: f.length,
          offset: offsetCounter
        }
        offsetCounter += f.length
        return item
      })

      // Preserve any pieces already verified!
      const currentBitfield = session.pieceManager.getBitfieldHex()
      session.pieceManager = new PieceManager({
        totalBytes: session.totalBytes,
        pieceLength: session.pieceLength,
        numPieces: session.numPieces,
        pieceHashes: session.pieceHashes,
        files: session.files,
        initialBitfieldHex: currentBitfield
      })
      session.pieceManager.applyFilePriorities(session.filePriorities)

      this.logActivity(session, 'info', `Metadata acquired for "${session.name}" (${session.files.length} files).`)
      this.persistSession(session)
      this.broadcastTorrents()
    })

    wt.on('warning', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      this.logActivity(session, 'info', `Swarm notice: ${msg}`)
    })

    wt.on('wire', (wire) => {
      // Do not accept or route new peer connections while paused
      if (session.status === 'paused') {
        try {
          wire.destroy()
        } catch {}
        return
      }

      session.connectionCounter++
      // WebTorrent does not expose the peer socket on the wire; recover routing metadata by peer address.
      const socket = (wire as any)._socket || (wire as any).conn || (wire as any)._conn
      const routed = getRouteRecord(wire.remoteAddress, wire.remotePort)
      const relayMeta = (wire as any)._relayMeta || socket?._relayMeta || routed
      const boundIface = relayMeta?.selectedInterface || (wire as any)._relayInterface || socket?._relayInterface
      const selectedInterface = boundIface || InterfacePolicyEngine.selectInterfaceForConnection(
        session.interfacePolicy,
        this.interfaces.filter((i) => i.isOnline && i.enabled),
        session.connectionCounter
      )

      const actualLocal = socket?.localAddress || relayMeta?.actualLocalAddress || routed?.actualLocalAddress
      const matchedIface = actualLocal ? this.interfaces.find((i) => i.address === actualLocal && i.isOnline && i.enabled) : null
      const effectiveIface = matchedIface || null

      const peerId = (wire as unknown as { peerId?: string }).peerId || wire.remoteAddress || `peer-${session.connectionCounter}`
      const peerInfo: TorrentPeerInfo = {
        id: peerId,
        ip: wire.remoteAddress || '127.0.0.1',
        port: wire.remotePort || 6881,
        client: (wire as unknown as { client?: string }).client || 'BitTorrent Client',
        downloadSpeed: typeof wire.downloadSpeed === 'function' ? wire.downloadSpeed() : 0,
        uploadSpeed: typeof wire.uploadSpeed === 'function' ? wire.uploadSpeed() : 0,
        progress: 0,
        protocol: (wire as any).type === 'webrtc' ? 'webrtc' : (wire as any).type === 'utp' ? 'utp' : 'tcp',
        interfaceId: effectiveIface?.id,
        interfaceName: effectiveIface?.displayName,
        selectedLocalAddress: selectedInterface?.address,
        actualLocalAddress: actualLocal,
        connectionStatus: 'connected',
        bytesReceived: 0,
        bytesUploaded: 0,
        fallbackReason: relayMeta?.fallbackReason || (socket as any)?._fallbackReason,
        choked: wire.peerChoking,
        choking: wire.amChoking,
        interested: wire.amInterested,
        interesting: wire.peerInteresting
      }

      session.peers.set(peerId, peerInfo)
      this.peerDiagnosticsTracker.recordHandshake(session.infoHash, peerId, peerInfo.ip, peerInfo.port, true)

      this.logActivity(
        session,
        'info',
        `Connected to peer ${peerInfo.ip}:${peerInfo.port} via ${effectiveIface?.displayName || 'Default Route'} (local: ${actualLocal || 'default'})`
      )

      const ifaceId = effectiveIface?.id || 'default'
      if (!session.interfaceTelemetry.has(ifaceId)) {
        session.interfaceTelemetry.set(ifaceId, {
          interfaceId: ifaceId,
          interfaceName: effectiveIface?.displayName || 'Default Route',
          localAddress: effectiveIface?.address || actualLocal || '',
          activePeerCount: 0,
          connectedPeerCount: 0,
          connectingPeerCount: 0,
          activePeerIds: [],
          connectionCount: 0,
          successfullyBoundConnectionCount: 0,
          fallbackConnectionCount: 0,
          downloadBytes: 0,
          uploadBytes: 0,
          currentDownloadSpeed: 0,
          currentUploadSpeed: 0,
          downloadContributionPercent: 0,
          uploadContributionPercent: 0,
          lastActivityTime: null,
          routingStatus: 'socket-bound',
          bindingCapability: getPlatformBindingCapability().capability,
          bindingCapabilityReason: getPlatformBindingCapability().reason
        })
      }

      const tStat = session.interfaceTelemetry.get(ifaceId)!
      tStat.connectionCount++
      if (actualLocal && selectedInterface && actualLocal === selectedInterface.address) {
        tStat.successfullyBoundConnectionCount++
        tStat.routingStatus = 'socket-bound'
      } else if (relayMeta?.fallbackReason || (selectedInterface && actualLocal && actualLocal !== selectedInterface.address)) {
        tStat.fallbackConnectionCount++
        tStat.routingStatus = 'fallback'
      } else {
        tStat.successfullyBoundConnectionCount++
      }

      wire.on('download', (bytes: number) => {
        // Strictly prevent late download events from mutating paused counters
        if (session.status !== 'downloading' && session.status !== 'seeding') {
          return
        }

        session.downloadedBytes += bytes
        peerInfo.bytesReceived = (peerInfo.bytesReceived || 0) + bytes

        const currentActual = socket?.localAddress || peerInfo.actualLocalAddress
        const matched = currentActual ? this.interfaces.find((i) => i.address === currentActual && i.isOnline && i.enabled) : null
        const attrId = matched?.id || 'default'

        let stat = session.interfaceTelemetry.get(attrId)
        if (!stat) {
          const newStat: TorrentInterfaceTelemetry = {
            interfaceId: attrId,
            interfaceName: matched?.displayName || 'Default Route',
            localAddress: matched?.address || currentActual || '',
            activePeerCount: 0,
            connectedPeerCount: 0,
            connectingPeerCount: 0,
            activePeerIds: [],
            connectionCount: 0,
            successfullyBoundConnectionCount: 0,
            fallbackConnectionCount: 0,
            downloadBytes: 0,
            uploadBytes: 0,
            currentDownloadSpeed: 0,
            currentUploadSpeed: 0,
            downloadContributionPercent: 0,
            uploadContributionPercent: 0,
            lastActivityTime: null,
            routingStatus: matched ? 'socket-bound' : 'fallback',
            bindingCapability: getPlatformBindingCapability().capability,
            bindingCapabilityReason: getPlatformBindingCapability().reason
          }
          session.interfaceTelemetry.set(attrId, newStat)
          stat = newStat
        }

        stat.downloadBytes += bytes
        stat.lastActivityTime = Date.now()
        if (matched) {
          this.telemetryTracker.recordDownload(matched.id, bytes)
        }

        this.peerDiagnosticsTracker.recordBytes(session.infoHash, peerInfo.ip, peerInfo.port, bytes, 0)
      })

      wire.on('upload', (bytes: number) => {
        // Strictly prevent late upload events from mutating paused counters
        if (session.status !== 'downloading' && session.status !== 'seeding') {
          return
        }

        session.uploadedBytes += bytes
        peerInfo.bytesUploaded = (peerInfo.bytesUploaded || 0) + bytes

        const currentActual = socket?.localAddress || peerInfo.actualLocalAddress
        const matched = currentActual ? this.interfaces.find((i) => i.address === currentActual && i.isOnline && i.enabled) : null
        const attrId = matched?.id || 'default'

        let stat = session.interfaceTelemetry.get(attrId)
        if (!stat) {
          const newStat: TorrentInterfaceTelemetry = {
            interfaceId: attrId,
            interfaceName: matched?.displayName || 'Default Route',
            localAddress: matched?.address || currentActual || '',
            activePeerCount: 0,
            connectedPeerCount: 0,
            connectingPeerCount: 0,
            activePeerIds: [],
            connectionCount: 0,
            successfullyBoundConnectionCount: 0,
            fallbackConnectionCount: 0,
            downloadBytes: 0,
            uploadBytes: 0,
            currentDownloadSpeed: 0,
            currentUploadSpeed: 0,
            downloadContributionPercent: 0,
            uploadContributionPercent: 0,
            lastActivityTime: null,
            routingStatus: matched ? 'socket-bound' : 'fallback',
            bindingCapability: getPlatformBindingCapability().capability,
            bindingCapabilityReason: getPlatformBindingCapability().reason
          }
          session.interfaceTelemetry.set(attrId, newStat)
          stat = newStat
        }

        stat.uploadBytes += bytes
        stat.lastActivityTime = Date.now()
        if (matched) {
          this.telemetryTracker.recordUpload(matched.id, bytes)
        }

        this.peerDiagnosticsTracker.recordBytes(session.infoHash, peerInfo.ip, peerInfo.port, 0, bytes)
      })

      // Live block-level chunk arrival
      wire.on('piece', (index: number, _offset: number, buffer: Uint8Array) => {
        if (session.status === 'downloading' || session.status === 'seeding') {
          const currentReceived = (session.pieceManager.getBytesReceived(index) || 0) + buffer.length
          session.pieceManager.markPieceDownloading(index, currentReceived, effectiveIface?.id)
        }
      })

      wire.on('close', () => {
        peerInfo.connectionStatus = 'closed'
        session.peers.delete(peerId)
        session.scheduler.clearPeerRequests(peerId)
        this.peerDiagnosticsTracker.recordClosed(session.infoHash, peerInfo.ip, peerInfo.port)
      })
    })

    wt.on('piece', (pieceIndex) => {
      if (session.status === 'checking' || session.status === 'restored' || session.status === 'paused') return

      session.pieceManager.setPieceState(pieceIndex, 'verified')
      session.scheduler.onPieceCompleted(pieceIndex)

      if (session.pieceManager.isComplete()) {
        session.status = 'seeding'
        if (!session.completedAt) session.completedAt = Date.now()
        this.logActivity(session, 'success', 'All pieces downloaded and verified! Transitioned to seeding.')
      }

      this.persistSession(session)
      this.events.onPieceStatesUpdated(session.infoHash, session.pieceManager.getAllStates())
      this.broadcastTorrents()
    })

    wt.on('done', () => {
      if (session.status === 'checking' || session.status === 'restored' || session.status === 'paused') return

      if (session.pieceManager.isComplete()) {
        session.status = 'seeding'
        if (!session.completedAt) session.completedAt = Date.now()
        this.logActivity(session, 'success', 'Torrent finished downloading! Now seeding.')
        this.persistSession(session)
        this.broadcastTorrents()
      }
    })

    wt.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      session.status = 'error'
      session.errorMessage = message
      this.logActivity(session, 'error', `Torrent error: ${message}`)
      this.persistSession(session)
      this.broadcastTorrents()
      this.events.onError(session.infoHash, message)
    })
  }

  async pauseTorrent(infoHash: string): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    session.status = 'paused'
    session.downloadSpeed = 0
    session.uploadSpeed = 0

    if (session.scheduler) {
      session.scheduler.clear()
    }

    if (session.wtTorrent) {
      const wt = session.wtTorrent as any
      try {
        wt.pause?.()

        // Clear pending peer connection queue in WebTorrent discovery swarm
        if (Array.isArray(wt._queue)) {
          wt._queue.length = 0
        }

        // Deselect pieces to stop outgoing piece requests
        if (wt.pieces && wt.pieces.length > 0) {
          wt.deselect(0, wt.pieces.length - 1, 0)
        }

        // Choke and cancel all requests on all active wires
        if (Array.isArray(wt.wires)) {
          for (const wire of wt.wires) {
            try {
              // 1. Choke wire to stop uploading
              if (typeof wire.choke === 'function') {
                wire.choke()
              }
              // 2. Mark uninterested to stop downloading
              if (wire.amInterested && typeof wire.uninterested === 'function') {
                wire.uninterested()
              }
              // 3. Cancel any in-flight piece requests
              if (Array.isArray(wire.requests)) {
                for (const req of [...wire.requests]) {
                  try {
                    wire.cancel?.(req.piece, req.offset, req.length)
                  } catch {
                    // ignore
                  }
                }
              }
              // 4. Pause wire stream
              if (typeof wire.pause === 'function') {
                wire.pause()
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Mark all connected peers as choked/idle and reset speeds
    for (const peer of session.peers.values()) {
      peer.downloadSpeed = 0
      peer.uploadSpeed = 0
      peer.choking = true
      peer.interested = false
    }

    // Reset interface telemetry speeds
    for (const telemetry of session.interfaceTelemetry.values()) {
      telemetry.currentDownloadSpeed = 0
      telemetry.currentUploadSpeed = 0
    }

    this.logActivity(session, 'info', 'Torrent paused.')
    this.persistSession(session)
    this.broadcastTorrents()
  }

  async resumeTorrent(infoHash: string): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    if (session.wtTorrent) {
      try {
        const wt = session.wtTorrent as any
        wt.resume?.()

        if (wt.pieces && wt.pieces.length > 0) {
          wt.select(0, wt.pieces.length - 1, 0)
        }

        const isComplete = session.pieceManager.isComplete()

        if (Array.isArray(wt.wires)) {
          for (const wire of wt.wires) {
            try {
              if (typeof wire.resume === 'function') {
                wire.resume()
              }
              if (!wire.amInterested && !isComplete && typeof wire.interested === 'function') {
                wire.interested()
              }
              if (typeof wire.unchoke === 'function') {
                wire.unchoke()
              }
            } catch {
              // ignore
            }
          }
        }

        session.status = isComplete ? 'seeding' : 'downloading'
      } catch {
        void this.startTorrent(infoHash)
        return
      }
    } else {
      void this.startTorrent(infoHash)
      return
    }

    this.logActivity(session, 'info', 'Torrent resumed.')
    this.persistSession(session)
    this.broadcastTorrents()
  }

  async recheckTorrent(infoHash: string): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    if (session.isStarting || (session.status === 'checking' && session.isVerifyingDisk)) {
      return
    }

    if (session.wtTorrent) {
      try {
        session.wtTorrent.removeAllListeners()
        session.wtTorrent.destroy({ destroyStore: false })
      } catch {
        // ignore
      }
      session.wtTorrent = undefined
    }

    session.peers.clear()
    session.downloadSpeed = 0
    session.uploadSpeed = 0
    session.status = 'checking'
    this.logActivity(session, 'info', 'Force recheck initiated...')
    this.broadcastTorrents()

    await this.verifyDiskData(session)

    if (session.verificationJob?.status === 'cancelled') {
      session.status = 'paused'
      this.persistSession(session)
      this.broadcastTorrents()
      return
    }

    if (session.pieceManager.isComplete()) {
      session.status = 'seeding'
      if (!session.completedAt) session.completedAt = Date.now()
      this.logActivity(session, 'success', 'All pieces verified. Transitioned to seeding.')
    } else {
      session.status = 'downloading'
      const verifiedCount = session.pieceManager.getVerifiedCount()
      this.logActivity(
        session,
        'info',
        `${verifiedCount} / ${session.numPieces} pieces verified. Transitioned to downloading.`
      )
    }

    this.persistSession(session)
    this.broadcastTorrents()

    const source = session.torrentFilePath && existsSync(session.torrentFilePath)
      ? session.torrentFilePath
      : session.magnetUri || session.infoHash

    let wtTorrent = this.client?.torrents.find((t) => t.infoHash === session.infoHash)
    if (!wtTorrent && this.client) {
      const announceList = [...new Set([...session.trackers.map((t) => t.announce), ...DEFAULT_TRACKERS])]
      wtTorrent = this.client.add(source, {
        path: session.savePath,
        announce: announceList,
        maxConns: this.settings.maxConnsPerTorrent || 55,
        bitfield: session.pieceManager.getBitfieldUint8Array(),
        deselect: false
      })
    }

    if (wtTorrent) {
      session.wtTorrent = wtTorrent
      const originalDrain = (wtTorrent as any)._drain?.bind(wtTorrent)
      if (originalDrain && !(wtTorrent as any)._relayDrainHooked) {
        ;(wtTorrent as any)._relayDrainHooked = true
        ;(wtTorrent as any)._drain = () => {
          this.currentDrainingSession = session
          try {
            originalDrain()
          } finally {
            this.currentDrainingSession = null
          }
        }
      }
      this.bindWebTorrentEvents(session, wtTorrent)
    }
  }

  async removeTorrent(infoHash: string, deleteFiles: boolean): Promise<void> {
    const hash = infoHash.toLowerCase()
    const session = this.sessions.get(hash)
    if (!session) return

    if (session.wtTorrent) {
      try {
        session.wtTorrent.destroy({ destroyStore: deleteFiles })
      } catch {
        // ignore
      }
    }

    if (deleteFiles) {
      try {
        const fullPath = resolveSafeDownloadPath(session.savePath, session.name)
        if (existsSync(fullPath)) {
          await rm(fullPath, { recursive: true, force: true })
        }
      } catch (err) {
        console.warn(`[Engine] Failed to delete download files for ${hash}:`, err)
      }
    }

    this.sessions.delete(hash)
    this.database.deleteTorrent(hash)
    this.broadcastTorrents()
  }

  async setFilePriorities(infoHash: string, priorities: Record<number, TorrentFilePriority>): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    session.filePriorities = { ...session.filePriorities, ...priorities }
    session.pieceManager.applyFilePriorities(session.filePriorities)

    // Update webtorrent file selections
    if (session.wtTorrent && session.wtTorrent.files) {
      for (const [idxStr, prio] of Object.entries(priorities)) {
        const idx = Number(idxStr)
        const file = session.wtTorrent.files[idx]
        if (file) {
          if (prio === 'skip') {
            file.deselect()
          } else {
            file.select()
          }
        }
      }
    }

    this.persistSession(session)
    this.broadcastTorrents()
  }

  async setTorrentInterfacePolicy(infoHash: string, policy: InterfacePolicy): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    session.interfacePolicy = policy
    this.logActivity(session, 'info', `Network policy updated to ${policy.mode}.`)
    this.persistSession(session)
    this.broadcastTorrents()
  }

  async setTorrentLimits(
    infoHash: string,
    limits: { downloadLimit?: number; uploadLimit?: number; seedingRatioLimit?: number }
  ): Promise<void> {
    const session = this.sessions.get(infoHash.toLowerCase())
    if (!session) return

    if (limits.downloadLimit !== undefined) session.downloadLimit = limits.downloadLimit
    if (limits.uploadLimit !== undefined) session.uploadLimit = limits.uploadLimit
    if (limits.seedingRatioLimit !== undefined) session.seedingRatioLimit = limits.seedingRatioLimit

    this.persistSession(session)
    this.broadcastTorrents()
  }

  getAllTorrents(): TorrentState[] {
    return Array.from(this.sessions.values()).map((s) => this.toTorrentState(s))
  }

  getTorrent(infoHash: string): TorrentState | undefined {
    const session = this.sessions.get(infoHash.toLowerCase())
    return session ? this.toTorrentState(session) : undefined
  }

  getTorrentPieceStates(infoHash: string): PieceState[] {
    const session = this.sessions.get(infoHash.toLowerCase())
    return session ? session.pieceManager.getAllStates() : []
  }

  async updateSettings(settings: GlobalSettings): Promise<void> {
    this.settings = settings
    this.database.updateSettings(settings)
    if (this.client) {
      if (settings.globalDownloadLimit !== undefined) {
        this.client.throttleDownload(settings.globalDownloadLimit)
      }
      if (settings.globalUploadLimit !== undefined) {
        this.client.throttleUpload(settings.globalUploadLimit)
      }
      if (settings.maxGlobalConns !== undefined) {
        this.client.maxConns = settings.maxGlobalConns
      }
    }
  }

  private toTorrentState(session: ActiveTorrentSession): TorrentState {
    const wt = session.wtTorrent
    const isPaused = session.status === 'paused'
    const isChecking = session.status === 'checking' || session.status === 'restored'

    // Speeds: strictly 0 when checking, restored, or paused
    const downloadSpeed = (isPaused || isChecking)
      ? 0
      : (wt ? wt.downloadSpeed : session.downloadSpeed)
    const uploadSpeed = (isPaused || isChecking)
      ? 0
      : (wt ? wt.uploadSpeed : session.uploadSpeed)

    // Synchronize active wires into session.peers (only when actively downloading or seeding)
    if (!isChecking && !isPaused && wt && (wt as any).wires) {
      for (const wire of (wt as any).wires) {
        const peerId = (wire as any).peerId || wire.remoteAddress || `peer-${wire.remoteAddress}:${wire.remotePort}`
        const existing = session.peers.get(peerId)
        const dSpeed = typeof wire.downloadSpeed === 'function' ? wire.downloadSpeed() : 0
        const uSpeed = typeof wire.uploadSpeed === 'function' ? wire.uploadSpeed() : 0
        if (existing) {
          existing.downloadSpeed = dSpeed
          existing.uploadSpeed = uSpeed
          existing.choked = wire.peerChoking
          existing.choking = wire.amChoking
          existing.interested = wire.amInterested
          existing.interesting = wire.peerInteresting
        } else {
          session.peers.set(peerId, {
            id: peerId,
            ip: wire.remoteAddress || '127.0.0.1',
            port: wire.remotePort || 6881,
            client: (wire as any).type === 'webrtc' ? 'WebTorrent Peer' : 'BitTorrent Peer',
            downloadSpeed: dSpeed,
            uploadSpeed: uSpeed,
            progress: 0,
            choked: wire.peerChoking,
            choking: wire.amChoking,
            interested: wire.amInterested,
            interesting: wire.peerInteresting
          })
        }
      }
    }

    const verifiedBytes = session.pieceManager.getVerifiedBytes()

    // Consistent single source of truth for progress:
    // If complete or seeding -> 1.0 (100%)
    // Otherwise verifiedBytes / totalBytes
    let progress = 0
    if (session.status === 'seeding' || session.status === 'completed' || session.pieceManager.isComplete()) {
      progress = 1
    } else if (session.totalBytes > 0) {
      progress = Math.min(1, verifiedBytes / session.totalBytes)
    }

    // ETA calculation
    let eta: number | null = null
    if (session.status === 'checking' && session.verificationJob) {
      eta = session.verificationJob.eta
    } else if (session.status === 'downloading' && downloadSpeed > 0) {
      const remainingBytes = Math.max(0, session.totalBytes - verifiedBytes)
      eta = Math.ceil(remainingBytes / downloadSpeed)
    }

    // Downloaded bytes:
    // If checking or restored, downloadedBytes matches verifiedBytes to prevent mismatched telemetry
    const downloadedBytes = (isChecking)
      ? verifiedBytes
      : Math.max(verifiedBytes, session.downloadedBytes)

    const ratio = downloadedBytes > 0 ? session.uploadedBytes / downloadedBytes : 0
    const files = session.pieceManager.calculateFileProgresses(session.filePriorities)
    const peerCount = (isChecking || isPaused) ? 0 : (wt ? Math.max((wt as any).numPeers || 0, session.peers.size) : session.peers.size)
    const pieceCounts = session.pieceManager.getPieceCounts()

    const interfaceTelemetryList: TorrentInterfaceTelemetry[] = []
    const platformCap = getPlatformBindingCapability()
    if (!isChecking && !isPaused) {
      for (const [ifaceId, base] of session.interfaceTelemetry.entries()) {
        const activePeers = Array.from(session.peers.values()).filter(p => (p.interfaceId || 'default') === ifaceId)
        const currentDownloadSpeed = activePeers.reduce((sum, p) => sum + p.downloadSpeed, 0)
        const currentUploadSpeed = activePeers.reduce((sum, p) => sum + p.uploadSpeed, 0)
        const matchingIface = this.interfaces.find((i) => i.id === ifaceId)
        let routingStatus: InterfaceRoutingDetailedStatus = 'idle'
        if (matchingIface && (!matchingIface.isOnline || !matchingIface.enabled)) {
          routingStatus = 'offline'
        } else if (matchingIface?.isPhysicallyConfirmed && currentDownloadSpeed > 0) {
          routingStatus = 'confirmed physical traffic'
        } else if (currentDownloadSpeed > 0) {
          routingStatus = 'transferring'
        } else if (activePeers.length > 0) {
          if (base.successfullyBoundConnectionCount > 0) {
            routingStatus = 'connected'
          } else if (base.fallbackConnectionCount > 0) {
            routingStatus = 'fallback'
          } else {
            routingStatus = 'socket-bound'
          }
        }

        // If interface has 0 confirmed physical traffic, enforce 0% contribution
        const effectiveDlPercent = (currentDownloadSpeed > 0 || (matchingIface?.isPhysicallyConfirmed && base.downloadBytes > 0))
          ? (downloadedBytes > 0 ? Math.min(100, Math.round((base.downloadBytes / downloadedBytes) * 1000) / 10) : 0)
          : 0

        const effectiveUlPercent = (currentUploadSpeed > 0 || (matchingIface?.isPhysicallyConfirmed && base.uploadBytes > 0))
          ? (session.uploadedBytes > 0 ? Math.min(100, Math.round((base.uploadBytes / session.uploadedBytes) * 1000) / 10) : 0)
          : 0

        interfaceTelemetryList.push({
          ...base,
          activePeerCount: activePeers.length,
          connectedPeerCount: activePeers.filter(p => p.connectionStatus === 'connected').length,
          connectingPeerCount: activePeers.filter(p => p.connectionStatus === 'connecting').length,
          activePeerIds: activePeers.map(p => p.id),
          currentDownloadSpeed: (matchingIface?.isPhysicallyConfirmed || !matchingIface) ? currentDownloadSpeed : 0,
          currentUploadSpeed: (matchingIface?.isPhysicallyConfirmed || !matchingIface) ? currentUploadSpeed : 0,
          downloadContributionPercent: effectiveDlPercent,
          uploadContributionPercent: effectiveUlPercent,
          routingStatus,
          bindingCapability: platformCap.capability,
          bindingCapabilityReason: platformCap.reason,
          physicalBytesReceived: matchingIface?.physicalBytesReceived,
          physicalBytesSent: matchingIface?.physicalBytesSent,
          physicalDownloadSpeed: matchingIface?.physicalDownloadSpeed,
          physicalUploadSpeed: matchingIface?.physicalUploadSpeed,
          isPhysicallyConfirmed: matchingIface?.isPhysicallyConfirmed
        })
      }
    }

    return {
      infoHash: session.infoHash,
      name: session.name,
      magnetUri: session.magnetUri,
      torrentFilePath: session.torrentFilePath,
      savePath: session.savePath,
      status: session.status,
      totalBytes: session.totalBytes,
      downloadedBytes,
      uploadedBytes: session.uploadedBytes,
      progress,
      downloadSpeed,
      uploadSpeed,
      eta,
      ratio,
      numPieces: session.numPieces,
      pieceLength: session.pieceLength,
      verifiedPieces: pieceCounts.verified,
      remainingPieces: pieceCounts.missing + pieceCounts.requested + pieceCounts.downloading + pieceCounts.corrupted,
      requestedPieces: pieceCounts.requested,
      downloadingPieces: pieceCounts.downloading,
      missingPieces: pieceCounts.missing,
      corruptedPieces: pieceCounts.corrupted,
      skippedPieces: pieceCounts.skipped,
      verifiedBytes,
      remainingBytes: Math.max(0, session.totalBytes - verifiedBytes),
      files,
      trackers: session.trackers,
      peers: isChecking ? [] : Array.from(session.peers.values()),
      peerCount,
      seedCount: (isChecking || isPaused) ? 0 : (wt ? (wt as any).numPeers || 0 : 0),
      interfacePolicy: session.interfacePolicy,
      downloadLimit: session.downloadLimit,
      uploadLimit: session.uploadLimit,
      seedingRatioLimit: session.seedingRatioLimit,
      addedAt: session.addedAt,
      completedAt: session.completedAt,
      errorMessage: session.errorMessage,
      interfaceTelemetry: interfaceTelemetryList,
      verificationJob: session.verificationJob,
      activityLogs: [...session.activityLogs]
    }
  }

  private persistSession(session: ActiveTorrentSession): void {
    this.database.setTorrent({
      infoHash: session.infoHash,
      name: session.name,
      magnetUri: session.magnetUri,
      torrentFilePath: session.torrentFilePath,
      savePath: session.savePath,
      status: session.status,
      addedAt: session.addedAt,
      completedAt: session.completedAt,
      totalBytes: session.totalBytes,
      pieceLength: session.pieceLength,
      numPieces: session.numPieces,
      verifiedBitfield: session.pieceManager.getBitfieldHex(),
      selectedFileIndices: session.files.filter((f) => session.filePriorities[f.index] !== 'skip').map((f) => f.index),
      filePriorities: session.filePriorities,
      interfacePolicy: session.interfacePolicy,
      downloadLimit: session.downloadLimit,
      uploadLimit: session.uploadLimit,
      seedingRatioLimit: session.seedingRatioLimit,
      uploadedBytes: session.uploadedBytes,
      downloadedBytes: session.downloadedBytes,
      errorMessage: session.errorMessage
    })
  }

  private logActivity(session: ActiveTorrentSession, level: ActivityLogEntry['level'], message: string): void {
    session.activityLogs.unshift({ timestamp: Date.now(), level, message })
    if (session.activityLogs.length > 100) {
      session.activityLogs.pop()
    }
  }

  private broadcastTorrents(): void {
    if (this.isDestroyed) return
    this.events.onTorrentsUpdated(this.getAllTorrents())
  }

  private startUpdateLoop(): void {
    let tickCount = 0
    this.updateTimer = setInterval(async () => {
      if (this.isDestroyed) return
      tickCount++

      // Constantly check network interfaces to detect dynamically added/removed adapters (Wi-Fi, Ethernet, Hotspots)
      if (tickCount % 4 === 0) {
        try {
          await this.refreshInterfaces()
        } catch {
          // ignore
        }
      }

      // Compute telemetry
      let activeCount = 0
      for (const session of this.sessions.values()) {
        if (session.status === 'downloading' || session.status === 'seeding') {
          activeCount++
        }
      }

      // Live Piece State synchronization from WebTorrent while downloading
      for (const session of this.sessions.values()) {
        if (session.status === 'downloading' && session.wtTorrent) {
          const wt = session.wtTorrent as any
          if (Array.isArray(wt.pieces)) {
            let pieceStatesChanged = false
            for (let i = 0; i < wt.pieces.length && i < session.numPieces; i++) {
              const p = wt.pieces[i]
              const currentState = session.pieceManager.getPieceState(i)
              if (currentState === 'verified') continue

              if (wt.bitfield && wt.bitfield.get(i)) {
                session.pieceManager.setPieceState(i, 'verified')
                pieceStatesChanged = true
              } else if (p && p._buffered > 0) {
                session.pieceManager.markPieceDownloading(i, p.length - p.missing)
                pieceStatesChanged = true
              } else if (p && p._reservations > 0) {
                session.pieceManager.markPieceRequested(i)
                pieceStatesChanged = true
              }
            }
            if (pieceStatesChanged) {
              this.events.onPieceStatesUpdated(session.infoHash, session.pieceManager.getAllStates())
            }
          }
        }
      }

      if (process.platform === 'win32') {
        try {
          void getWindowsPhysicalAdapterStats().then((statsMap) => {
            this.telemetryTracker.updatePhysicalStats(statsMap)
          })
        } catch {}
      }

      const telemetry = this.telemetryTracker.getSystemTelemetry(this.interfaces, activeCount)
      this.interfaces = telemetry.interfaces
      this.events.onTelemetryUpdated(telemetry)
      this.events.onTorrentsUpdated(this.getAllTorrents())
    }, TELEMETRY_BROADCAST_INTERVAL_MS)
  }

  async getRoutingDiagnostics(): Promise<RoutingDiagnosticsReport> {
    const physicalList: { name: string; receivedBytes: number; sentBytes: number }[] = []
    let routes: { destinationPrefix: string; nextHop: string; interfaceAlias: string; metric: number }[] = []

    if (process.platform === 'win32') {
      try {
        const statsMap = await getWindowsPhysicalAdapterStats()
        for (const [name, s] of statsMap.entries()) {
          physicalList.push({ name, receivedBytes: s.receivedBytes, sentBytes: s.sentBytes })
        }
        routes = await getWindowsRoutesSummary()
      } catch {}
    }

    return {
      timestamp: Date.now(),
      platform: process.platform,
      bindingCapability: getPlatformBindingCapability().reason,
      interfaces: this.getInterfaces(),
      physicalAdapterStats: physicalList,
      routesSummary: routes,
      activePeersDiagnostics: this.peerDiagnosticsTracker.getAllDiagnostics()
    }
  }
}
