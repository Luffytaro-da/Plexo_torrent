import React, { useState, useEffect } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  Info,
  Power,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Zap
} from 'lucide-react'
import { useTorrentStore } from '../store/torrentStore'
import { getInterfaceKindBadge } from '../utils/colors'
import { formatBytes, formatSpeed } from '../utils/formatters'
import type { RoutingDiagnosticsReport, InterfaceRoutingDetailedStatus } from '../../../shared/types'

export const NetworksView: React.FC = () => {
  const { interfaces, toggleInterface, refreshInterfaces, setViewMode, telemetry, torrents } = useTorrentStore()
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false)
  const [diagnostics, setDiagnostics] = useState<RoutingDiagnosticsReport | null>(null)
  const [isLoadingDiag, setIsLoadingDiag] = useState<boolean>(false)
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false)

  const handleRefresh = async () => {
    await refreshInterfaces()
    if (showDiagnostics) {
      await fetchDiagnostics()
    }
  }

  const fetchDiagnostics = async () => {
    if (!window.relayTorrent?.getRoutingDiagnostics) return
    setIsLoadingDiag(true)
    try {
      const data = await window.relayTorrent.getRoutingDiagnostics()
      setDiagnostics(data)
    } catch (err) {
      console.error('Failed to fetch routing diagnostics:', err)
    } finally {
      setIsLoadingDiag(false)
    }
  }

  useEffect(() => {
    if (showDiagnostics) {
      void fetchDiagnostics()
      const timer = setInterval(() => {
        void fetchDiagnostics()
      }, 2500)
      return () => clearInterval(timer)
    }
    return undefined
  }, [showDiagnostics])

  const copyDiagnostics = () => {
    if (!diagnostics) return
    void navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
    setCopiedDiag(true)
    setTimeout(() => setCopiedDiag(false), 2000)
  }

  const onlineCount = interfaces.filter((i) => i.isOnline && i.enabled).length
  const confirmedPhysicalCount = interfaces.filter((i) => i.isPhysicallyConfirmed && (i.downloadSpeed > 0 || (i.physicalBytesReceived && i.physicalBytesReceived > 0))).length

  // Aggregate telemetry from active torrents
  let totalBoundConns = 0
  let totalFallbackConns = 0
  let sampleBindingCap: string = 'best_effort'
  let sampleBindingReason: string = 'Platform routing with fallback'

  for (const t of torrents) {
    if (t.interfaceTelemetry) {
      for (const stat of t.interfaceTelemetry) {
        totalBoundConns += stat.successfullyBoundConnectionCount || 0
        totalFallbackConns += stat.fallbackConnectionCount || 0
        if (stat.bindingCapability) sampleBindingCap = stat.bindingCapability
        if (stat.bindingCapabilityReason) sampleBindingReason = stat.bindingCapabilityReason
      }
    }
  }

  const getRoutingBadge = (status?: InterfaceRoutingDetailedStatus, isPhysicallyConfirmed?: boolean, speed?: number) => {
    if (isPhysicallyConfirmed && speed && speed > 0) {
      return { label: 'Confirmed Physical Traffic', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
    }
    switch (status) {
      case 'confirmed physical traffic':
        return { label: 'Confirmed Physical Traffic', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
      case 'transferring':
        return { label: 'Transferring', class: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' }
      case 'connected':
        return { label: 'Connected', class: 'bg-blue-500/10 text-blue-400 border-blue-500/30' }
      case 'socket-bound':
        return { label: 'Socket Bound', class: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' }
      case 'fallback':
        return { label: 'Fallback Route', class: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
      case 'unsupported':
        return { label: 'Unsupported', class: 'bg-rose-500/10 text-rose-400 border-rose-500/30' }
      case 'offline':
        return { label: 'Offline / Disconnected', class: 'bg-slate-800 text-slate-500 border-slate-700' }
      default:
        return { label: 'Idle / Standby', class: 'bg-slate-800 text-slate-400 border-slate-700' }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('torrents')}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Back to Transfers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Multi-Interface Swarm Router</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {onlineCount} Online ({confirmedPhysicalCount > 1 ? `${confirmedPhysicalCount} Confirmed Active` : '1 Confirmed Active'})
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Parallel socket routing across network adapters. Traffic is strictly verified in real-time against hardware NDIS statistics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
              showDiagnostics
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showDiagnostics ? 'Hide Diagnostics' : 'Peer Routing Diagnostics'}</span>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Rescan Adapters</span>
          </button>
        </div>
      </div>

      {/* Platform Binding Capability Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-start gap-3.5">
        {sampleBindingCap === 'fully_supported' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : sampleBindingCap === 'best_effort' ? (
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">
              Platform Binding Architecture:
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                sampleBindingCap === 'fully_supported'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : sampleBindingCap === 'best_effort'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {sampleBindingCap.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">{sampleBindingReason}</p>
          <p className="text-[11px] text-slate-500">
            Note: On Windows, the TCP/IP stack enforces the Strong Host Model. Sockets are assigned to each network adapter; if an adapter lacks an internet route to a peer, the connection safely falls back to the default gateway without attributing fake traffic.
          </p>
        </div>

        {/* Global Confirmed vs Fallback stats */}
        <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800/80 px-3 py-2 rounded-xl text-xs shrink-0 font-mono">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Confirmed Sockets</div>
            <div className="text-emerald-400 font-bold">{totalBoundConns} conns</div>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Fallback Route</div>
            <div className="text-amber-400 font-bold">{totalFallbackConns} conns</div>
          </div>
        </div>
      </div>

      {/* Aggregate Network Bandwidth Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Confirmed Download Speed
            </span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {formatSpeed(telemetry?.totalDownloadSpeed || 0)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ArrowDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Confirmed Upload Speed
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatSpeed(telemetry?.totalUploadSpeed || 0)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ArrowUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Swarm Data
            </span>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">
              {formatBytes((telemetry?.totalBytesDownloaded || 0) + (telemetry?.totalBytesUploaded || 0))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Live Peer Routing Diagnostics Panel */}
      {showDiagnostics && (
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Live Peer Routing Diagnostics
              </h3>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                {diagnostics?.activePeersDiagnostics?.length || 0} Peer Sockets Recorded
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyDiagnostics}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer font-mono"
              >
                {copiedDiag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDiag ? 'Copied' : 'Copy JSON'}</span>
              </button>

              <button
                onClick={fetchDiagnostics}
                disabled={isLoadingDiag}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Refresh diagnostics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiag ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Peer Diagnostic Records Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/80 text-[10px] text-slate-400 uppercase tracking-wider font-semibold sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Peer Endpoint</th>
                  <th className="py-2 px-3">Protocol</th>
                  <th className="py-2 px-3">Selected Iface</th>
                  <th className="py-2 px-3">Actual Local IP</th>
                  <th className="py-2 px-3">Windows Adapter</th>
                  <th className="py-2 px-3">Result</th>
                  <th className="py-2 px-3">Bytes (Down/Up)</th>
                  <th className="py-2 px-3">Routing State / Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {!diagnostics?.activePeersDiagnostics || diagnostics.activePeersDiagnostics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-500 font-sans text-xs">
                      No peer connection attempts recorded yet. Start a torrent to observe live peer socket bindings.
                    </td>
                  </tr>
                ) : (
                  diagnostics.activePeersDiagnostics.slice(0, 50).map((p, idx) => (
                    <tr key={`${p.infoHash}-${p.ip}-${p.port}-${idx}`} className="hover:bg-slate-900/40">
                      <td className="py-1.5 px-3 text-cyan-300 font-semibold">{p.ip}:{p.port}</td>
                      <td className="py-1.5 px-3 uppercase text-slate-400">{p.protocol}</td>
                      <td className="py-1.5 px-3 text-slate-300">{p.selectedInterfaceName || 'default'} ({p.selectedLocalAddress || 'auto'})</td>
                      <td className="py-1.5 px-3 text-emerald-400">{p.actualLocalAddress || 'pending'}</td>
                      <td className="py-1.5 px-3 text-slate-400">{p.actualWindowsAdapter || '-'}</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            p.connectionResult === 'connected'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : p.connectionResult === 'failed'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {p.connectionResult}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-400">
                        {formatBytes(p.receivedBytes)} / {formatBytes(p.uploadedBytes)}
                      </td>
                      <td className="py-1.5 px-3 text-[10px]">
                        {p.fallbackReason ? (
                          <span className="text-amber-400" title={p.fallbackReason}>
                            ⚠️ {p.fallbackReason.slice(0, 35)}...
                          </span>
                        ) : p.handshakeResult === 'success' ? (
                          <span className="text-emerald-400 font-bold">✓ Bound Handshake</span>
                        ) : (
                          <span className="text-slate-500">Connecting</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Windows Routing Table Summary */}
          {diagnostics?.routesSummary && diagnostics.routesSummary.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Windows Routing Table Summary</span>
              </div>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 max-h-36 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[10px] font-mono">
                  <thead className="bg-slate-900/60 text-slate-500 uppercase sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-1 px-2.5">Destination Prefix</th>
                      <th className="py-1 px-2.5">Next Hop / Gateway</th>
                      <th className="py-1 px-2.5">Interface Alias</th>
                      <th className="py-1 px-2.5">Metric</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {diagnostics.routesSummary.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="py-1 px-2.5">{r.destinationPrefix}</td>
                        <td className="py-1 px-2.5 text-amber-400">{r.nextHop}</td>
                        <td className="py-1 px-2.5 text-cyan-400">{r.interfaceAlias}</td>
                        <td className="py-1 px-2.5">{r.metric}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Interface Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Detected Hardware Adapters & Physical NDIS Contribution
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {interfaces.map((iface) => {
            const badge = getInterfaceKindBadge(iface.kind)
            const rBadge = getRoutingBadge(iface.routingState, iface.isPhysicallyConfirmed, iface.downloadSpeed)
            
            // Only attribute download percentage if physically confirmed and downloading
            const downloadPercent = (iface.isPhysicallyConfirmed && telemetry?.totalBytesDownloaded && telemetry.totalBytesDownloaded > 0)
              ? Math.min(100, Math.round((iface.bytesDownloaded / telemetry.totalBytesDownloaded) * 1000) / 10)
              : 0

            return (
              <div
                key={iface.id}
                className={`border rounded-2xl p-4 transition-all ${
                  iface.enabled && iface.isOnline
                    ? 'bg-slate-900/80 border-slate-800 shadow-lg'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                {/* Top Title & Enable Toggle */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        iface.enabled && iface.isOnline
                          ? iface.isPhysicallyConfirmed && iface.downloadSpeed > 0
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 ring-2 ring-emerald-400/20'
                            : 'bg-cyan-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span>{iface.label || iface.displayName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Device: {iface.device} {iface.mac && `(${iface.mac})`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${rBadge.class}`}>
                      {rBadge.label}
                    </span>

                    <button
                      onClick={() => toggleInterface(iface.id, !iface.enabled)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        iface.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{iface.enabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>
                </div>

                {/* IP Address & Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/70 rounded-xl p-3 border border-slate-800/60 mb-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium">Local IPv4:</span>
                    <div className="font-mono text-slate-200 font-semibold">{iface.address}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium">Active Swarm Peers:</span>
                    <div className="font-mono text-cyan-400 font-semibold">{iface.activePeers}</div>
                  </div>
                </div>

                {/* Physical Hardware NDIS Counters */}
                {iface.physicalBytesReceived !== undefined && (
                  <div className="bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/50 mb-3 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Physical NDIS Bytes:</span>
                    <span className="text-slate-200">
                      Rx: {formatBytes(iface.physicalBytesReceived)} | Tx: {formatBytes(iface.physicalBytesSent || 0)}
                    </span>
                  </div>
                )}

                {/* Real-Time Contribution Bar */}
                <div className="mb-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-medium text-slate-400">
                    <span>Confirmed Physical Contribution</span>
                    <span className="font-mono text-cyan-400 font-semibold">{downloadPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${downloadPercent}%` }}
                    />
                  </div>
                </div>

                {/* Speeds & Data Totals */}
                <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>{formatSpeed(iface.downloadSpeed)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({formatBytes(iface.bytesDownloaded)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>{formatSpeed(iface.uploadSpeed)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({formatBytes(iface.bytesUploaded)})
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
