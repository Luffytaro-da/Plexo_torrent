import type { PeerDiagnosticRecord } from '../../shared/types'

export class PeerDiagnosticsTracker {
  private records: Map<string, PeerDiagnosticRecord> = new Map()
  private maxRecords: number

  constructor(maxRecords: number = 200) {
    this.maxRecords = maxRecords
  }

  private getKey(infoHash: string, ip: string, port: number): string {
    return `${infoHash.toLowerCase()}:${ip}:${port}`
  }

  recordConnectionAttempt(
    infoHash: string,
    ip: string,
    port: number,
    protocol: 'tcp' | 'utp' | 'webrtc',
    selectedInterface?: { id: string; displayName: string; address: string }
  ): PeerDiagnosticRecord {
    const key = this.getKey(infoHash, ip, port)
    const record: PeerDiagnosticRecord = {
      id: key,
      infoHash: infoHash.toLowerCase(),
      ip,
      port,
      protocol,
      selectedInterfaceId: selectedInterface?.id,
      selectedInterfaceName: selectedInterface?.displayName,
      selectedLocalAddress: selectedInterface?.address,
      actualLocalAddress: undefined,
      actualWindowsAdapter: undefined,
      connectionResult: 'pending',
      handshakeResult: 'pending',
      receivedBytes: 0,
      uploadedBytes: 0,
      timestamp: Date.now()
    }
    this.records.set(key, record)
    this.trimRecords()
    return record
  }

  recordConnectionSuccess(
    infoHash: string,
    ip: string,
    port: number,
    actualLocalAddress?: string,
    actualWindowsAdapter?: string,
    fallbackReason?: string
  ): void {
    const key = this.getKey(infoHash, ip, port)
    const existing = this.records.get(key)
    if (existing) {
      existing.connectionResult = 'connected'
      existing.actualLocalAddress = actualLocalAddress || existing.actualLocalAddress
      existing.actualWindowsAdapter = actualWindowsAdapter || existing.actualWindowsAdapter
      if (fallbackReason) {
        existing.fallbackReason = fallbackReason
      }
    }
  }

  recordConnectionFailure(
    infoHash: string,
    ip: string,
    port: number,
    error: string,
    actualLocalAddress?: string
  ): void {
    const key = this.getKey(infoHash, ip, port)
    const existing = this.records.get(key)
    if (existing) {
      existing.connectionResult = 'failed'
      existing.fallbackReason = error
      if (actualLocalAddress) {
        existing.actualLocalAddress = actualLocalAddress
      }
    }
  }

  recordHandshake(
    infoHash: string,
    peerId: string,
    ip: string,
    port: number,
    success: boolean
  ): void {
    const key = this.getKey(infoHash, ip, port)
    const existing = this.records.get(key)
    if (existing) {
      existing.id = peerId || existing.id
      existing.handshakeResult = success ? 'success' : 'failed'
    }
  }

  recordBytes(
    infoHash: string,
    ip: string,
    port: number,
    downloadedDelta: number,
    uploadedDelta: number
  ): void {
    const key = this.getKey(infoHash, ip, port)
    const existing = this.records.get(key)
    if (existing) {
      existing.receivedBytes += downloadedDelta
      existing.uploadedBytes += uploadedDelta
    }
  }

  recordClosed(infoHash: string, ip: string, port: number): void {
    const key = this.getKey(infoHash, ip, port)
    const existing = this.records.get(key)
    if (existing && existing.connectionResult !== 'failed') {
      existing.connectionResult = 'closed'
    }
  }

  getAllDiagnostics(): PeerDiagnosticRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  clear(): void {
    this.records.clear()
  }

  private trimRecords(): void {
    if (this.records.size > this.maxRecords) {
      const excess = this.records.size - this.maxRecords
      const keys = Array.from(this.records.keys()).slice(0, excess)
      for (const k of keys) {
        this.records.delete(k)
      }
    }
  }
}
