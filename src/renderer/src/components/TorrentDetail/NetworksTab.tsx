import { ArrowDown, ArrowUp, Users } from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'
import { useTorrentStore } from '../../store/torrentStore'
import { getInterfaceKindBadge } from '../../utils/colors'
import { formatBytes, formatSpeed } from '../../utils/formatters'

interface NetworksTabProps {
  torrent: TorrentState
}

export const NetworksTab: React.FC<NetworksTabProps> = ({ torrent }) => {
  const { interfaces, setTorrentInterfacePolicy } = useTorrentStore()

  return (
    <div className="flex-1 flex flex-col h-full p-4 overflow-y-auto text-xs space-y-4">
      {/* Current Policy Control */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Assigned Routing Policy</div>
          <div className="text-sm font-bold text-cyan-400 capitalize">{torrent.interfacePolicy.mode} Routing</div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Change Policy:</span>
          <select
            value={torrent.interfacePolicy.mode}
            onChange={(e) =>
              setTorrentInterfacePolicy(torrent.infoHash, {
                ...torrent.interfacePolicy,
                mode: e.target.value as any
              })
            }
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="automatic">Automatic (All Healthy Adapters)</option>
            <option value="preferred">Preferred Adapter</option>
            <option value="single">Single Adapter Only</option>
            <option value="custom">Custom Policy</option>
          </select>
        </div>
      </div>

      {/* Network Adapters Breakdown Table */}
      <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
            <tr>
              <th className="py-2.5 px-3">Network Adapter</th>
              <th className="py-2.5 px-3">Routing Status</th>
              <th className="py-2.5 px-3">Local IPv4</th>
              <th className="py-2.5 px-3">Swarm Peers</th>
              <th className="py-2.5 px-3">Throughput (Down / Up)</th>
              <th className="py-2.5 px-3">Traffic Contribution</th>
              <th className="py-2.5 px-3">Total Transferred</th>
            </tr>
          </thead>
          <tbody>
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
              const routingStatus = tStats?.routingStatus || (iface.isOnline && iface.enabled ? 'idle' : 'offline')

              return (
                <tr
                  key={iface.id}
                  className="border-b border-slate-800/40 hover:bg-slate-900/30 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 font-medium text-slate-200">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          iface.isOnline && iface.enabled ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span>{iface.label || iface.displayName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${badge.class}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-normal">
                          {connCount} sockets ({boundCount} bound, {fallbackCount} fallback)
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    {(() => {
                      let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700'
                      let label: string = routingStatus
                      if (routingStatus === 'confirmed physical traffic') {
                        badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        label = 'Confirmed Physical Traffic'
                      } else if (routingStatus === 'transferring') {
                        badgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      } else if (routingStatus === 'connected') {
                        badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      } else if (routingStatus === 'socket-bound') {
                        badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      } else if (routingStatus === 'fallback') {
                        badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      } else if (routingStatus === 'unsupported') {
                        badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      } else if (routingStatus === 'offline') {
                        badgeClass = 'bg-slate-800 text-slate-500 border-slate-700'
                      }
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${badgeClass}`}
                        >
                          {label}
                        </span>
                      )
                    })()}
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-300">{iface.address}</td>

                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>{peerCount}</span>
                      <span className="text-[10px] text-slate-500">({connectedPeers} conn)</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
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

                  <td className="py-2.5 px-3">
                    <div className="space-y-1 min-w-[90px]">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Share:</span>
                        <span className="text-cyan-400 font-bold">{dContribution}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${dContribution}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-slate-400">
                    ↓ {formatBytes(dBytes)} • ↑ {formatBytes(uBytes)}
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
