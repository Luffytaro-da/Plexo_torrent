import React from 'react'
import { File, FileCode, FileText, Film, Music, Shield } from 'lucide-react'
import type { TorrentFilePriority, TorrentState } from '../../../../shared/types'
import { useTorrentStore } from '../../store/torrentStore'
import { formatBytes, formatPercent } from '../../utils/formatters'

interface FilesTabProps {
  torrent: TorrentState
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) {
    return <Film className="w-3.5 h-3.5 text-cyan-400" />
  }
  if (['mp3', 'flac', 'wav', 'aac', 'ogg'].includes(ext || '')) {
    return <Music className="w-3.5 h-3.5 text-pink-400" />
  }
  if (['iso', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Shield className="w-3.5 h-3.5 text-amber-400" />
  }
  if (['js', 'ts', 'py', 'rs', 'go', 'c', 'cpp', 'html', 'json'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-emerald-400" />
  }
  if (['txt', 'pdf', 'doc', 'docx', 'md'].includes(ext || '')) {
    return <FileText className="w-3.5 h-3.5 text-blue-400" />
  }
  return <File className="w-3.5 h-3.5 text-slate-400" />
}

export const FilesTab: React.FC<FilesTabProps> = ({ torrent }) => {
  const { setFilePriorities } = useTorrentStore()

  const handlePriorityChange = (index: number, priority: TorrentFilePriority) => {
    setFilePriorities(torrent.infoHash, { [index]: priority })
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-[11px] font-semibold text-slate-400 z-10">
            <tr>
              <th className="py-2 px-3">File Name</th>
              <th className="py-2 px-3 w-28">Size</th>
              <th className="py-2 px-3 w-48">Progress</th>
              <th className="py-2 px-3 w-32">Priority</th>
            </tr>
          </thead>
          <tbody>
            {torrent.files.map((file) => (
              <tr
                key={file.index}
                className="border-b border-slate-800/40 hover:bg-slate-800/40 transition-colors"
              >
                {/* File name & Icon */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 max-w-md truncate" title={file.path}>
                    {getFileIcon(file.name)}
                    <span className="font-medium text-slate-200 truncate">{file.name}</span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                  {formatBytes(file.length)}
                </td>

                {/* Progress bar */}
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{formatBytes(file.bytesCompleted)}</span>
                      <span>{formatPercent(file.progress)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, file.progress * 100))}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Priority Selector */}
                <td className="py-2 px-3">
                  <select
                    value={file.priority}
                    onChange={(e) =>
                      handlePriorityChange(file.index, e.target.value as TorrentFilePriority)
                    }
                    className="bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="skip">Do Not Download</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
