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
    return <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
  }
  if (['mp3', 'flac', 'wav', 'aac', 'ogg'].includes(ext || '')) {
    return <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
  }
  if (['iso', 'zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
  }
  if (['js', 'ts', 'py', 'rs', 'go', 'c', 'cpp', 'html', 'json'].includes(ext || '')) {
    return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  }
  if (['txt', 'pdf', 'doc', 'docx', 'md'].includes(ext || '')) {
    return <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
  }
  return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
}

export const FilesTab: React.FC<FilesTabProps> = ({ torrent }) => {
  const { setFilePriorities } = useTorrentStore()

  const handlePriorityChange = (index: number, priority: TorrentFilePriority) => {
    setFilePriorities(torrent.infoHash, { [index]: priority })
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs bg-[#0e1217]">
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[560px]">
          <thead className="sticky top-0 bg-[#121720]/95 backdrop-blur-xs border-b border-[#212936] text-[10px] font-mono uppercase font-semibold text-slate-400 z-10">
            <tr>
              <th className="py-2 px-3">File Name</th>
              <th className="py-2 px-3 w-28">Size</th>
              <th className="py-2 px-3 w-44">Progress</th>
              <th className="py-2 px-3 w-32">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a212d]">
            {torrent.files.map((file) => (
              <tr
                key={file.index}
                className="hover:bg-[#141a24] transition-colors"
              >
                {/* File name & Icon */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 max-w-md truncate" title={file.path}>
                    {getFileIcon(file.name)}
                    <span className="font-medium text-slate-200 truncate">{file.name}</span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-2 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                  {formatBytes(file.length)}
                </td>

                {/* Progress bar */}
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{formatBytes(file.bytesCompleted)}</span>
                      <span className="text-slate-200 font-semibold">{formatPercent(file.progress)}</span>
                    </div>
                    <div className="w-full bg-[#1e2634] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full transition-all duration-200"
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
                    className="bg-[#141922] border border-[#273244] rounded px-2 py-0.5 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
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
