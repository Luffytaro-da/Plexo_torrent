import React from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Globe, Network, Users } from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'
import { formatSpeed } from '../../utils/formatters'

interface PeersTabProps {
  torrent: TorrentState
}

export const PeersTab: React.FC<PeersTabProps> = ({ torrent }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs bg-[#0e1217]">
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {torrent.peers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 font-mono">
            <Users className="w-7 h-7 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs">No active peers connected currently</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead className="sticky top-0 bg-[#121720]/95 backdrop-blur-xs border-b border-[#212936] text-[10px] font-mono uppercase font-semibold text-slate-400 z-10">
              <tr>
                <th className="py-2 px-3">Peer (IP : Port)</th>
                <th className="py-2 px-3 w-20">Protocol</th>
                <th className="py-2 px-3">Local Address</th>
                <th className="py-2 px-3">Client</th>
                <th className="py-2 px-3 w-28">Down Speed</th>
                <th className="py-2 px-3 w-28">Up Speed</th>
                <th className="py-2 px-3">Interface Used</th>
                <th className="py-2 px-3 w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a212d] font-mono text-[11px]">
              {torrent.peers.map((peer) => {
                const proto = (peer.protocol || 'tcp').toUpperCase()
                const isFallback = Boolean(peer.fallbackReason)

                return (
                  <tr
                    key={peer.id}
                    className="hover:bg-[#141a24] transition-colors"
                  >
                    <td className="py-2 px-3 text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-cyan-300 font-semibold">
                          {peer.ip}:{peer.port}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#141922] text-slate-300 border border-[#273244]">
                        {proto}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-300">
                      <div className="flex items-center gap-1">
                        <span>{peer.actualLocalAddress || 'auto'}</span>
                        {isFallback && (
                          <span
                            className="text-amber-400 cursor-help"
                            title={peer.fallbackReason || 'Routed via fallback gateway'}
                          >
                            <AlertCircle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3 text-slate-300 font-sans text-xs">{peer.client || 'Unknown'}</td>

                    <td className="py-2 px-3 text-cyan-400">
                      {peer.downloadSpeed > 0 ? (
                        <div className="flex items-center gap-1">
                          <ArrowDown className="w-3 h-3 shrink-0" />
                          <span>{formatSpeed(peer.downloadSpeed)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">0 B/s</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-emerald-400">
                      {peer.uploadSpeed > 0 ? (
                        <div className="flex items-center gap-1">
                          <ArrowUp className="w-3 h-3 shrink-0" />
                          <span>{formatSpeed(peer.uploadSpeed)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">0 B/s</span>
                      )}
                    </td>

                    <td className="py-2 px-3 font-sans">
                      <span className="inline-flex items-center gap-1 bg-[#141922] border border-[#253043] px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                        <Network className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>{peer.interfaceName || 'Default Route'}</span>
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-400 text-[10px]">
                      {peer.choked ? 'Choked' : 'Unchoked'} · {peer.interested ? 'Interested' : 'Idle'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
