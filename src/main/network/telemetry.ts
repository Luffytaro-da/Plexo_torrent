import type { NetworkInterfaceInfo, SystemTelemetry } from '../../shared/types'

interface InterfaceStats {
  bytesDownloaded: number
  bytesUploaded: number
  lastBytesDownloaded: number
  lastBytesUploaded: number
  downloadSpeed: number
  uploadSpeed: number
  activePeers: number
  lastSampleTime: number
}

export class NetworkTelemetryTracker {
  private interfaceStats: Map<string, InterfaceStats> = new Map()

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
        lastSampleTime: Date.now()
      }
      this.interfaceStats.set(interfaceId, stats)
    }
    return stats
  }

  updateSpeeds(): void {
    const now = Date.now()
    for (const stats of this.interfaceStats.values()) {
      const deltaSec = Math.max(0.1, (now - stats.lastSampleTime) / 1000)

      const deltaDown = Math.max(0, stats.bytesDownloaded - stats.lastBytesDownloaded)
      const deltaUp = Math.max(0, stats.bytesUploaded - stats.lastBytesUploaded)

      const instantDownSpeed = deltaDown / deltaSec
      const instantUpSpeed = deltaUp / deltaSec

      // Exponential moving average (alpha = 0.5)
      stats.downloadSpeed = Math.round(stats.downloadSpeed * 0.5 + instantDownSpeed * 0.5)
      stats.uploadSpeed = Math.round(stats.uploadSpeed * 0.5 + instantUpSpeed * 0.5)

      stats.lastBytesDownloaded = stats.bytesDownloaded
      stats.lastBytesUploaded = stats.bytesUploaded
      stats.lastSampleTime = now
    }
  }

  enrichInterfaces(interfaces: NetworkInterfaceInfo[]): NetworkInterfaceInfo[] {
    this.updateSpeeds()

    return interfaces.map((iface) => {
      const stats = this.interfaceStats.get(iface.id)
      if (!stats) return iface

      return {
        ...iface,
        downloadSpeed: stats.downloadSpeed,
        uploadSpeed: stats.uploadSpeed,
        bytesDownloaded: stats.bytesDownloaded,
        bytesUploaded: stats.bytesUploaded,
        activePeers: stats.activePeers
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
      totalDownloadSpeed += iface.downloadSpeed
      totalUploadSpeed += iface.uploadSpeed
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
