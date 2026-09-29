import React from 'react'
import { Radio, Server } from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'

interface TrackersTabProps {
  torrent: TorrentState
}

export const TrackersTab: React.FC<TrackersTabProps> = ({ torrent }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs">
      <div className="flex-1 overflow-y-auto">
        {torrent.trackers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
            <Radio className="w-8 h-8 mb-2 opacity-50" />
            <p>No external trackers announced (using DHT/PEX swarm)</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-[11px] font-semibold text-slate-400 z-10">
              <tr>
                <th className="py-2 px-3">Tracker Announce URL</th>
                <th className="py-2 px-3 w-28">Status</th>
                <th className="py-2 px-3 w-24">Peers</th>
                <th className="py-2 px-3 w-24">Seeds</th>
                <th className="py-2 px-3 w-24">Leechers</th>
              </tr>
            </thead>
            <tbody>
              {torrent.trackers.map((tracker, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2 px-3 font-mono text-slate-200 truncate max-w-md" title={tracker.announce}>
                    <div className="flex items-center gap-1.5 truncate">
                      <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{tracker.announce}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {tracker.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300 font-mono">{tracker.peers}</td>
                  <td className="py-2 px-3 text-slate-300 font-mono">{tracker.seeds}</td>
                  <td className="py-2 px-3 text-slate-300 font-mono">{tracker.leechers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
