import React from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ActivityLogEntry, TorrentState } from '../../../../shared/types'
import { formatDate } from '../../utils/formatters'

interface ActivityLogTabProps {
  torrent: TorrentState
}

function getLogIcon(level: ActivityLogEntry['level']) {
  switch (level) {
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
    case 'warn':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    case 'info':
    default:
      return <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
  }
}

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ torrent }) => {
  return (
    <div className="flex-1 flex flex-col h-full p-4 overflow-y-auto text-xs">
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 font-mono space-y-2">
        {torrent.activityLogs.length === 0 ? (
          <div className="text-slate-500 italic">No activity recorded yet</div>
        ) : (
          torrent.activityLogs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-2.5 py-1 border-b border-slate-900/60 last:border-0"
            >
              <span className="text-[10px] text-slate-500 shrink-0 select-none">
                {formatDate(log.timestamp)}
              </span>
              {getLogIcon(log.level)}
              <span className="text-slate-300 select-text leading-relaxed">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
