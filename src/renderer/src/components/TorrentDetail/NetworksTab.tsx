import React from 'react'
import { ArrowDown, ArrowUp, Network, Users } from 'lucide-react'
import type { TorrentState, InterfaceRoutingDetailedStatus } from '../../../../shared/types'
import { useTorrentStore } from '../../store/torrentStore'
import { getInterfaceKindBadge } from '../../utils/colors'
import { formatBytes, formatSpeed } from '../../utils/formatters'

interface NetworksTabProps {
  torrent: TorrentState
}

export const NetworksTab: React.FC<NetworksTabProps> = ({ torrent }) => {
  const { interfaces, setTorrentInterfacePolicy } = useTorrentStore()

  const getRoutingBadge = (status: InterfaceRoutingDetailedStatus) => {
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
        return { label: 'Offline', class: 'bg-[#1a212d] text-slate-500 border-[#283548]' }
      default:
        return { label: 'Idle / Standby', class: 'bg-[#161c24] text-slate-400 border-[#222c3c]' }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full p-3.5 overflow-y-auto text-xs space-y-3">
      {/* Current Policy Control Bar */}
      <div className="bg-[#141922] border border-[#212936] rounded-lg p-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono uppercase font-semibold text-slate-400">Policy:</span>
          <span className="text-xs font-bold font-mono text-cyan-300 capitalize">
            {torrent.interfacePolicy.mode} Multi-Interface Routing
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Mode:</span>
          <select
            value={torrent.interfacePolicy.mode}
            onChange={(e) =>
              setTorrentInterfacePolicy(torrent.infoHash, {
                ...torrent.interfacePolicy,
                mode: e.target.value as any
              })
            }
            className="bg-[#0e1217] border border-[#273244] rounded-md px-2 py-0.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
          >
            <option value="automatic">Automatic (All Healthy Adapters)</option>
            <option value="preferred">Preferred Adapter</option>
            <option value="single">Single Adapter Only</option>
            <option value="custom">Custom Policy</option>
          </select>
        </div>
      </div>

      {/* Network Adapters Breakdown Table */}
      <div className="border border-[#212936] rounded-lg overflow-x-auto bg-[#10141a]">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-[#131821] border-b border-[#212936] text-[10px] font-mono uppercase font-semibold text-slate-400">
            <tr>
              <th className="py-2 px-3">Network Adapter</th>
              <th className="py-2 px-3">Routing State</th>
              <th className="py-2 px-3">Local IPv4</th>
              <th className="py-2 px-3">Swarm Peers</th>
              <th className="py-2 px-3">Throughput (Down / Up)</th>
              <th className="py-2 px-3 w-40">Contribution</th>
              <th className="py-2 px-3">Transferred</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a212d] text-xs">
            {interfaces.map((iface) => {
              const badge = getInterfaceKindBadge(iface.kind)
              const tStats = torrent.interfaceTelemetry?.find((t) => t.interfaceId === iface.id)
              const peerCount = tStats?.activePeerCount || 0
              const connectedPeers = tStats?.connectedPeerCount || 0
              const dSpeed = tStats?.currentDownloadSpeed || 0
              const uSpeed = tStats?.currentUploadSpeed || 0
              const dBytes = tStats?.downloadBytes || 0
              const uBytes = tStats?.uploadBytes || 0
              const connCount = tStats?.connectionCount || 0
              const boundCount = tStats?.successfullyBoundConnectionCount || 0
              const fallbackCount = tStats?.fallbackConnectionCount || 0
              const dContribution = tStats?.downloadContributionPercent || 0
              const routingStatus: InterfaceRoutingDetailedStatus =
                tStats?.routingStatus || (iface.isOnline && iface.enabled ? 'idle' : 'offline')
              const rBadge = getRoutingBadge(routingStatus)

              const isTransferring = dSpeed > 0 || uSpeed > 0

              return (
                <tr
                  key={iface.id}
                  className="hover:bg-[#141a24] transition-colors"
                >
                  {/* Adapter Name & Subtext */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2 font-medium text-slate-200">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          iface.isOnline && iface.enabled
                            ? isTransferring
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-emerald-400'
                            : 'bg-slate-600'
                        }`}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[11px] text-slate-100">{iface.label || iface.displayName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${badge.class}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {connCount} sockets ({boundCount} bound, {fallbackCount} fallback)
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Routing Status Badge */}
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border ${rBadge.class}`}
                    >
                      {rBadge.label}
                    </span>
                  </td>

                  {/* Local Address */}
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-300">{iface.address}</td>

                  {/* Swarm Peers */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                      <Users className="w-3 h-3 text-blue-400" />
                      <span>{peerCount}</span>
                      <span className="text-[10px] text-slate-400">({connectedPeers} conn)</span>
                    </div>
                  </td>

                  {/* Speeds */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-cyan-400 flex items-center gap-0.5">
                        <ArrowDown className="w-3 h-3" />
                        {formatSpeed(dSpeed)}
                      </span>
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <ArrowUp className="w-3 h-3" />
                        {formatSpeed(uSpeed)}
                      </span>
                    </div>
                  </td>

                  {/* Contribution Bar */}
                  <td className="py-2 px-3">
                    <div className="space-y-1 min-w-[100px]">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Share</span>
                        <span className="font-semibold text-cyan-400">{dContribution}%</span>
                      </div>
                      <div className="w-full bg-[#1e2634] rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, dContribution))}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Bytes */}
                  <td className="py-2 px-3 font-mono text-[10px] text-slate-300">
                    <div>Rx: {formatBytes(dBytes)}</div>
                    <div className="text-slate-400">Tx: {formatBytes(uBytes)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
