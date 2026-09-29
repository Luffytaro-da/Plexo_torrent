import React from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Info,
  Power,
  RefreshCw,
  ShieldAlert,
  Zap
} from 'lucide-react'
import { useTorrentStore } from '../store/torrentStore'
import { getInterfaceKindBadge } from '../utils/colors'
import { formatBytes, formatSpeed } from '../utils/formatters'

export const NetworksView: React.FC = () => {
  const { interfaces, toggleInterface, setViewMode, telemetry, torrents } = useTorrentStore()

  const handleRefresh = async () => {
    if (window.relayTorrent) {
      await window.relayTorrent.refreshInterfaces()
    }
  }

  const onlineCount = interfaces.filter((i) => i.isOnline && i.enabled).length

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
                {onlineCount} Active Interfaces
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Combine physical network connections (Wi-Fi, Ethernet, Hotspots) for parallel BitTorrent swarm downloading.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rescan Adapters</span>
        </button>
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
              Platform Binding Capability:
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
            Note: Traffic is credited strictly according to actual transmitting socket addresses. If secondary interface routes are unreachable from an adapter, connections safely fall back to the default gateway rather than failing.
          </p>
        </div>

        {/* Global Bound vs Fallback stats */}
        <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800/80 px-3 py-2 rounded-xl text-xs shrink-0 font-mono">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Directly Bound</div>
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
              Combined Download Speed
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
              Combined Upload Speed
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

      {/* Network Interface Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Detected Hardware Adapters & Live Contribution
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {interfaces.map((iface) => {
            const badge = getInterfaceKindBadge(iface.kind)
            const downloadPercent = telemetry?.totalBytesDownloaded
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
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 ring-2 ring-emerald-400/20'
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

                {/* Real-Time Contribution Bar */}
                <div className="mb-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-medium text-slate-400">
                    <span>Swarm Download Contribution</span>
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
