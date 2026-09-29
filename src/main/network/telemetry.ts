import type { InterfaceRoutingDetailedStatus, NetworkInterfaceInfo, SystemTelemetry } from '../../shared/types'

interface InterfaceStats {
  bytesDownloaded: number
  bytesUploaded: number
  lastBytesDownloaded: number
  lastBytesUploaded: number
  downloadSpeed: number
  uploadSpeed: number
  activePeers: number
  lastSampleTime: number

  // Physical NDIS hardware statistics from OS
  lastPhysicalReceived: number
  lastPhysicalSent: number
  physicalDownloadSpeed: number
  physicalUploadSpeed: number
  isPhysicallyConfirmed: boolean
}

export class NetworkTelemetryTracker {
  private interfaceStats: Map<string, InterfaceStats> = new Map()
  private latestPhysicalStats: Map<string, { receivedBytes: number; sentBytes: number }> = new Map()

  recordDownload(interfaceId: string, bytes: number): void {
    const stats = this.getOrCreateStats(interfaceId)
    stats.bytesDownloaded += bytes
  }

  recordUpload(interfaceId: string, bytes: number): void {
    const stats = this.getOrCreateStats(interfaceId)
    stats.bytesUploaded += bytes
  }

  setActivePeers(interfaceId: string, count: number): void {
    const stats = this.getOrCreateStats(interfaceId)
    stats.activePeers = count
  }

  updatePhysicalStats(statsMap: Map<string, { receivedBytes: number; sentBytes: number }>): void {
    this.latestPhysicalStats = statsMap
  }

  private getOrCreateStats(interfaceId: string): InterfaceStats {
    let stats = this.interfaceStats.get(interfaceId)
    if (!stats) {
      stats = {
        bytesDownloaded: 0,
        bytesUploaded: 0,
        lastBytesDownloaded: 0,
        lastBytesUploaded: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        activePeers: 0,
        lastSampleTime: Date.now(),
        lastPhysicalReceived: 0,
        lastPhysicalSent: 0,
        physicalDownloadSpeed: 0,
        physicalUploadSpeed: 0,
        isPhysicallyConfirmed: false
      }
      this.interfaceStats.set(interfaceId, stats)
    }
    return stats
  }

  updateSpeeds(): void {
    const now = Date.now()
    for (const [id, stats] of this.interfaceStats.entries()) {
      const deltaSec = Math.max(0.1, (now - stats.lastSampleTime) / 1000)

      const deltaDown = Math.max(0, stats.bytesDownloaded - stats.lastBytesDownloaded)
      const deltaUp = Math.max(0, stats.bytesUploaded - stats.lastBytesUploaded)

      const instantDownSpeed = deltaDown / deltaSec
      const instantUpSpeed = deltaUp / deltaSec

      // Exponential moving average (alpha = 0.5)
      stats.downloadSpeed = Math.round(stats.downloadSpeed * 0.5 + instantDownSpeed * 0.5)
      stats.uploadSpeed = Math.round(stats.uploadSpeed * 0.5 + instantUpSpeed * 0.5)

      // Physical OS adapter calculations
      const physical = this.latestPhysicalStats.get(id)
      if (physical) {
        if (stats.lastPhysicalReceived > 0) {
          const physDeltaDown = Math.max(0, physical.receivedBytes - stats.lastPhysicalReceived)
          const physDeltaUp = Math.max(0, physical.sentBytes - stats.lastPhysicalSent)
          const physDownSpeed = Math.round(physDeltaDown / deltaSec)
          const physUpSpeed = Math.round(physDeltaUp / deltaSec)

          stats.physicalDownloadSpeed = Math.round(stats.physicalDownloadSpeed * 0.5 + physDownSpeed * 0.5)
          stats.physicalUploadSpeed = Math.round(stats.physicalUploadSpeed * 0.5 + physUpSpeed * 0.5)

          // Physical traffic is confirmed only when the OS adapter registers actual byte deltas
          stats.isPhysicallyConfirmed = physDownSpeed > 100 || (stats.bytesDownloaded > 0 && physDeltaDown > 0)
        } else {
          stats.isPhysicallyConfirmed = stats.bytesDownloaded > 0
        }
        stats.lastPhysicalReceived = physical.receivedBytes
        stats.lastPhysicalSent = physical.sentBytes
      } else {
        // Fallback for mock environments / non-Windows
        stats.isPhysicallyConfirmed = stats.bytesDownloaded > 0 && stats.downloadSpeed > 0
      }

      stats.lastBytesDownloaded = stats.bytesDownloaded
      stats.lastBytesUploaded = stats.bytesUploaded
      stats.lastSampleTime = now
    }
  }

  enrichInterfaces(interfaces: NetworkInterfaceInfo[]): NetworkInterfaceInfo[] {
    this.updateSpeeds()

    return interfaces.map((iface) => {
      const stats = this.interfaceStats.get(iface.id)
      const physical = this.latestPhysicalStats.get(iface.device || iface.id)

      const physicalBytesReceived = physical?.receivedBytes ?? stats?.lastPhysicalReceived ?? 0
      const physicalBytesSent = physical?.sentBytes ?? stats?.lastPhysicalSent ?? 0
      const physicalDownloadSpeed = stats?.physicalDownloadSpeed ?? 0
      const physicalUploadSpeed = stats?.physicalUploadSpeed ?? 0
      const isPhysicallyConfirmed = Boolean(stats?.isPhysicallyConfirmed && iface.isOnline && iface.enabled)

      // Determine precise granular routing state
      let routingState: InterfaceRoutingDetailedStatus = 'idle'
      if (!iface.isOnline) {
        routingState = 'offline'
      } else if (!iface.enabled) {
        routingState = 'detected'
      } else if (isPhysicallyConfirmed && (stats?.downloadSpeed || 0) > 0) {
        routingState = 'confirmed physical traffic'
      } else if ((stats?.downloadSpeed || 0) > 0) {
        routingState = 'transferring'
      } else if ((stats?.activePeers || 0) > 0) {
        routingState = 'connected'
      } else {
        routingState = 'socket-bound'
      }

      // If interface is NOT physically confirmed and has 0 active peers, enforce 0 download speed
      const effectiveDownloadSpeed = isPhysicallyConfirmed || !physical
        ? (stats?.downloadSpeed || 0)
        : 0
      const effectiveUploadSpeed = isPhysicallyConfirmed || !physical
        ? (stats?.uploadSpeed || 0)
        : 0

      return {
        ...iface,
        downloadSpeed: effectiveDownloadSpeed,
        uploadSpeed: effectiveUploadSpeed,
        bytesDownloaded: stats?.bytesDownloaded || 0,
        bytesUploaded: stats?.bytesUploaded || 0,
        activePeers: stats?.activePeers || 0,
        physicalBytesReceived,
        physicalBytesSent,
        physicalDownloadSpeed,
        physicalUploadSpeed,
        isPhysicallyConfirmed,
        routingState
      }
    })
  }

  getSystemTelemetry(
    interfaces: NetworkInterfaceInfo[],
    activeTorrentsCount: number
  ): SystemTelemetry {
    const enriched = this.enrichInterfaces(interfaces)
    let totalDownloadSpeed = 0
    let totalUploadSpeed = 0
    let totalBytesDownloaded = 0
    let totalBytesUploaded = 0

    for (const iface of enriched) {
      // Only confirmed physical traffic or online adapters contribute to totals
      if (iface.isOnline && iface.enabled) {
        totalDownloadSpeed += iface.downloadSpeed
        totalUploadSpeed += iface.uploadSpeed
      }
      totalBytesDownloaded += iface.bytesDownloaded
      totalBytesUploaded += iface.bytesUploaded
    }

    return {
      totalDownloadSpeed,
      totalUploadSpeed,
      totalBytesDownloaded,
      totalBytesUploaded,
      activeTorrentsCount,
      interfaces: enriched
    }
  }
}
