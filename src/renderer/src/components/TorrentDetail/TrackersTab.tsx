import React from 'react'
import { Radio, Server } from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'

interface TrackersTabProps {
  torrent: TorrentState
}

export const TrackersTab: React.FC<TrackersTabProps> = ({ torrent }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs bg-[#0e1217]">
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {torrent.trackers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 font-mono">
            <Radio className="w-7 h-7 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs">No external trackers announced (using DHT/PEX swarm)</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="sticky top-0 bg-[#121720]/95 backdrop-blur-xs border-b border-[#212936] text-[10px] font-mono uppercase font-semibold text-slate-400 z-10">
              <tr>
                <th className="py-2 px-3">Tracker Announce URL</th>
                <th className="py-2 px-3 w-28">Status</th>
                <th className="py-2 px-3 w-20">Peers</th>
                <th className="py-2 px-3 w-20">Seeds</th>
                <th className="py-2 px-3 w-20">Leechers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a212d]">
              {torrent.trackers.map((tracker, index) => (
                <tr
                  key={index}
                  className="hover:bg-[#141a24] transition-colors"
                >
                  <td className="py-2 px-3 font-mono text-slate-200 truncate max-w-md text-[11px]" title={tracker.announce}>
                    <div className="flex items-center gap-1.5 truncate">
                      <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{tracker.announce}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 capitalize">
                      {tracker.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">{tracker.peers}</td>
                  <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">{tracker.seeds}</td>
                  <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">{tracker.leechers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
