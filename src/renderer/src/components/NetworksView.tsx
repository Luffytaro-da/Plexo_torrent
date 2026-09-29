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
  const { interfaces, refreshInterfaces, setViewMode, telemetry, torrents } = useTorrentStore()
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

  const onlineCount = interfaces.filter((i) => i.isOnline).length
  const confirmedPhysicalCount = interfaces.filter(
    (i) => i.isPhysicallyConfirmed && (i.downloadSpeed > 0 || (i.physicalBytesReceived && i.physicalBytesReceived > 0))
  ).length

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
      return { label: 'Confirmed Traffic', class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
    }
    switch (status) {
      case 'confirmed physical traffic':
        return { label: 'Confirmed Traffic', class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
      case 'transferring':
        return { label: 'Transferring', class: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' }
      case 'connected':
        return { label: 'Connected', class: 'bg-blue-500/15 text-blue-300 border-blue-500/30' }
      case 'socket-bound':
        return { label: 'Socket Bound', class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' }
      case 'fallback':
        return { label: 'Fallback Route', class: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
      case 'unsupported':
        return { label: 'Unsupported', class: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
      case 'offline':
        return { label: 'Offline / Disconnected', class: 'bg-[#1a212d] text-slate-500 border-[#283548]' }
      default:
        return { label: 'Idle / Standby', class: 'bg-[#161c24] text-slate-400 border-[#222c3c]' }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0e1217] overflow-y-auto p-4 space-y-4 select-text">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#1f2735] pb-3 shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setViewMode('torrents')}
            className="p-1 rounded-md bg-[#141922] border border-[#212936] hover:bg-[#1f2735] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Back to Transfers"
            aria-label="Back to Transfers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Multi-Interface Swarm Router</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {onlineCount} Online ({confirmedPhysicalCount > 1 ? `${confirmedPhysicalCount} Confirmed` : '1 Active'})
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Deterministic socket routing across network adapters. Verified via hardware NDIS statistics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
              showDiagnostics
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                : 'bg-[#141922] hover:bg-[#1f2735] text-slate-300 border-[#212936]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showDiagnostics ? 'Hide Diagnostics' : 'Peer Routing Diagnostics'}</span>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-[#141922] hover:bg-[#1f2735] border border-[#212936] text-slate-300 hover:text-white px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Rescan</span>
          </button>
        </div>
      </div>

      {/* Platform Binding Capability Banner (Plexo style) */}
      <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 flex items-start gap-3">
        {sampleBindingCap === 'fully_supported' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : sampleBindingCap === 'best_effort' ? (
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              Platform Binding Architecture:
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                sampleBindingCap === 'fully_supported'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : sampleBindingCap === 'best_effort'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              {sampleBindingCap.replace('_', ' ')}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">{sampleBindingReason}</p>
          <p className="text-[10px] text-slate-500">
            Note: On Windows, the TCP/IP stack enforces the Strong Host Model. Sockets bind to each local address; if an adapter lacks an internet route to a peer, the connection safely falls back to the default gateway without attributing fake traffic.
          </p>
        </div>

        {/* Global Confirmed vs Fallback stats */}
        <div className="flex items-center gap-3 bg-[#0e1217] border border-[#212936] px-2.5 py-1.5 rounded-lg text-xs shrink-0 font-mono">
          <div>
            <div className="text-[9px] uppercase font-semibold text-slate-400">Confirmed</div>
            <div className="text-emerald-400 font-bold">{totalBoundConns} conns</div>
          </div>
          <div className="w-px h-5 bg-[#212936]" />
          <div>
            <div className="text-[9px] uppercase font-semibold text-slate-400">Fallback</div>
            <div className="text-amber-400 font-bold">{totalFallbackConns} conns</div>
          </div>
        </div>
      </div>

      {/* Aggregate Network Bandwidth Overview (Plexo Hero Stat Cards) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Combined Download Speed
            </span>
            <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
              {formatSpeed(telemetry?.totalDownloadSpeed || 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Total Confirmed Upload Speed
            </span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {formatSpeed(telemetry?.totalUploadSpeed || 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ArrowUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Total Swarm Transferred
            </span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-0.5">
              {formatBytes((telemetry?.totalBytesDownloaded || 0) + (telemetry?.totalBytesUploaded || 0))}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Live Peer Routing Diagnostics Panel */}
      {showDiagnostics && (
        <div className="bg-[#12161e] border border-[#212936] rounded-lg p-3.5 space-y-3 animate-in fade-in duration-100 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1f2735] pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-100">
                Live Peer Routing Diagnostics
              </h3>
              <span className="text-[9px] bg-[#1a212d] text-slate-400 px-1.5 py-0.2 rounded font-mono border border-[#253043]">
                {diagnostics?.activePeersDiagnostics?.length || 0} Peer Sockets Recorded
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={copyDiagnostics}
                className="flex items-center gap-1 bg-[#161c24] hover:bg-[#1f2735] border border-[#253043] text-slate-300 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer font-mono"
              >
                {copiedDiag ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedDiag ? 'Copied' : 'Copy JSON'}</span>
              </button>

              <button
                onClick={fetchDiagnostics}
                disabled={isLoadingDiag}
                className="p-1 rounded bg-[#161c24] hover:bg-[#1f2735] border border-[#253043] text-slate-300 transition-colors cursor-pointer"
                title="Refresh diagnostics"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingDiag ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Peer Diagnostic Records Table */}
          <div className="border border-[#212936] rounded-lg overflow-hidden bg-[#0e1217] max-h-56 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#141922] text-[9px] text-slate-400 uppercase font-mono tracking-wider font-semibold sticky top-0 border-b border-[#212936]">
                <tr>
                  <th className="py-1.5 px-2.5">Peer Endpoint</th>
                  <th className="py-1.5 px-2.5">Protocol</th>
                  <th className="py-1.5 px-2.5">Selected Iface</th>
                  <th className="py-1.5 px-2.5">Actual Local IP</th>
                  <th className="py-1.5 px-2.5">Windows Adapter</th>
                  <th className="py-1.5 px-2.5">Result</th>
                  <th className="py-1.5 px-2.5">Bytes (Down/Up)</th>
                  <th className="py-1.5 px-2.5">Routing / Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a212d] font-mono text-[10px]">
                {!diagnostics?.activePeersDiagnostics || diagnostics.activePeersDiagnostics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-3 text-center text-slate-500 font-sans text-xs">
                      No peer connection attempts recorded yet.
                    </td>
                  </tr>
                ) : (
                  diagnostics.activePeersDiagnostics.slice(0, 50).map((p, idx) => (
                    <tr key={`${p.infoHash}-${p.ip}-${p.port}-${idx}`} className="hover:bg-[#141a24]">
                      <td className="py-1 px-2.5 text-cyan-300 font-semibold">{p.ip}:{p.port}</td>
                      <td className="py-1 px-2.5 uppercase text-slate-400">{p.protocol}</td>
                      <td className="py-1 px-2.5 text-slate-300">{p.selectedInterfaceName || 'default'} ({p.selectedLocalAddress || 'auto'})</td>
                      <td className="py-1 px-2.5 text-emerald-400">{p.actualLocalAddress || 'pending'}</td>
                      <td className="py-1 px-2.5 text-slate-400">{p.actualWindowsAdapter || '-'}</td>
                      <td className="py-1 px-2.5">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-bold ${
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
                      <td className="py-1 px-2.5 text-slate-400">
                        {formatBytes(p.receivedBytes)} / {formatBytes(p.uploadedBytes)}
                      </td>
                      <td className="py-1 px-2.5 text-[9px]">
                        {p.fallbackReason ? (
                          <span className="text-amber-400" title={p.fallbackReason}>
                            ⚠️ {p.fallbackReason.slice(0, 30)}...
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
            <div className="space-y-1 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>Windows Routing Table Summary</span>
              </div>
              <div className="border border-[#212936] rounded-lg overflow-hidden bg-[#0e1217] max-h-32 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[9px] font-mono">
                  <thead className="bg-[#141922] text-slate-400 uppercase sticky top-0 border-b border-[#212936]">
                    <tr>
                      <th className="py-1 px-2">Destination Prefix</th>
                      <th className="py-1 px-2">Next Hop / Gateway</th>
                      <th className="py-1 px-2">Interface Alias</th>
                      <th className="py-1 px-2">Metric</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a212d] text-slate-300">
                    {diagnostics.routesSummary.slice(0, 15).map((r, i) => (
                      <tr key={i} className="hover:bg-[#141a24]">
                        <td className="py-0.5 px-2">{r.destinationPrefix}</td>
                        <td className="py-0.5 px-2 text-amber-400">{r.nextHop}</td>
                        <td className="py-0.5 px-2 text-cyan-400">{r.interfaceAlias}</td>
                        <td className="py-0.5 px-2">{r.metric}</td>
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
      <div className="space-y-2.5">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Detected Hardware Adapters & Physical NDIS Contribution
        </h3>

        <div className="grid grid-cols-2 gap-3">
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
                className={`border rounded-lg p-3 transition-colors ${
                  iface.isOnline
                    ? 'bg-[#141922] border-[#212936] shadow-xs'
                    : 'bg-[#10141a] border-[#1a212d] opacity-60'
                }`}
              >
                {/* Top Title & Read-only Status */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        iface.isOnline
                          ? iface.isPhysicallyConfirmed && iface.downloadSpeed > 0
                            ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                            : 'bg-cyan-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-100 flex items-center gap-1.5">
                        <span>{iface.label || iface.displayName}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Device: {iface.device} {iface.mac && `(${iface.mac})`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border ${rBadge.class}`}>
                      {rBadge.label}
                    </span>

                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                        iface.isOnline
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-[#1a212d] text-slate-400 border-[#273244]'
                      }`}
                      title="Read-only adapter status"
                    >
                      {iface.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* IP Address & Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-[#0e1217] rounded-md p-2 border border-[#1f2735] mb-2 text-xs">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 font-medium">Local IPv4:</span>
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">{iface.address}</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 font-medium">Swarm Peers:</span>
                    <div className="font-mono text-cyan-400 font-semibold text-[11px]">{iface.activePeers}</div>
                  </div>
                </div>

                {/* Physical Hardware NDIS Counters */}
                {iface.physicalBytesReceived !== undefined && (
                  <div className="bg-[#0e1217] rounded-md px-2 py-1 border border-[#1f2735] mb-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Hardware NDIS:</span>
                    <span className="text-slate-200">
                      Rx: {formatBytes(iface.physicalBytesReceived)} · Tx: {formatBytes(iface.physicalBytesSent || 0)}
                    </span>
                  </div>
                )}

                {/* Real-Time Contribution Bar */}
                <div className="mb-2 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Confirmed Physical Contribution</span>
                    <span className="text-cyan-400 font-semibold">{downloadPercent}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#1e2634] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                      style={{ width: `${downloadPercent}%` }}
                    />
                  </div>
                </div>

                {/* Speeds & Data Totals */}
                <div className="flex items-center justify-between text-xs font-mono pt-1.5 border-t border-[#1f2735]">
                  <div className="flex items-center gap-1.5 text-cyan-400 text-[11px]">
                    <ArrowDown className="w-3 h-3" />
                    <span>{formatSpeed(iface.downloadSpeed)}</span>
                    <span className="text-[9px] text-slate-400">
                      ({formatBytes(iface.bytesDownloaded)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                    <ArrowUp className="w-3 h-3" />
                    <span>{formatSpeed(iface.uploadSpeed)}</span>
                    <span className="text-[9px] text-slate-400">
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
