import React from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Globe, Network, Users } from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'
import { formatSpeed } from '../../utils/formatters'

interface PeersTabProps {
  torrent: TorrentState
}

export const PeersTab: React.FC<PeersTabProps> = ({ torrent }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs">
      <div className="flex-1 overflow-y-auto">
        {torrent.peers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
            <Users className="w-8 h-8 mb-2 opacity-50" />
            <p>No active peers connected currently</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-[11px] font-semibold text-slate-400 z-10">
              <tr>
                <th className="py-2.5 px-3">Peer (IP : Port)</th>
                <th className="py-2.5 px-3">Protocol</th>
                <th className="py-2.5 px-3">Local Address</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Down Speed</th>
                <th className="py-2.5 px-3">Up Speed</th>
                <th className="py-2.5 px-3">Interface Used</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {torrent.peers.map((peer) => {
                const proto = (peer.protocol || 'tcp').toUpperCase()
                const isFallback = Boolean(peer.fallbackReason)

                return (
                  <tr
                    key={peer.id}
                    className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {peer.ip}:{peer.port}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        {proto}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-300">
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

                    <td className="py-2.5 px-3 text-slate-300">{peer.client || 'Unknown'}</td>

                    <td className="py-2.5 px-3 font-mono text-cyan-400">
                      {peer.downloadSpeed > 0 ? (
                        <div className="flex items-center gap-1">
                          <ArrowDown className="w-3 h-3" />
                          <span>{formatSpeed(peer.downloadSpeed)}</span>
                        </div>
                      ) : (
                        '0 B/s'
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-emerald-400">
                      {peer.uploadSpeed > 0 ? (
                        <div className="flex items-center gap-1">
                          <ArrowUp className="w-3 h-3" />
                          <span>{formatSpeed(peer.uploadSpeed)}</span>
                        </div>
                      ) : (
                        '0 B/s'
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300 font-medium">
                        <Network className="w-3 h-3 text-blue-400" />
                        <span>{peer.interfaceName || 'Default Route'}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                      {peer.choked ? 'Choked' : 'Unchoked'} •{' '}
                      {peer.interested ? 'Interested' : 'Idle'}
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
