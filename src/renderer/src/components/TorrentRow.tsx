import React from 'react'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Network,
  Pause,
  Play,
  RotateCw,
  Trash2,
  Users
} from 'lucide-react'
import type { TorrentState } from '../../../shared/types'
import { useTorrentStore } from '../store/torrentStore'
import { STATUS_CONFIG } from '../utils/colors'
import { formatBytes, formatEta, formatPercent, formatSpeed } from '../utils/formatters'

interface TorrentRowProps {
  torrent: TorrentState
  isSelected: boolean
}

export const TorrentRow: React.FC<TorrentRowProps> = ({ torrent, isSelected }) => {
  const {
    setSelectedInfoHash,
    pauseTorrent,
    resumeTorrent,
    recheckTorrent,
    removeTorrent
  } = useTorrentStore()

  const statusMeta = STATUS_CONFIG[torrent.status] || STATUS_CONFIG.paused
  const isRunning = torrent.status === 'downloading' || torrent.status === 'seeding' || torrent.status === 'checking' || torrent.status === 'restored'

  return (
    <tr
      onClick={() => setSelectedInfoHash(torrent.infoHash)}
      className={`group border-b border-slate-800/60 transition-colors cursor-pointer select-none text-xs ${
        isSelected
          ? 'bg-blue-600/15 border-blue-500/30 text-white'
          : 'hover:bg-slate-850/60 text-slate-300'
      }`}
    >
      {/* Name & Status */}
      <td className="py-2.5 px-3 max-w-xs">
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-slate-100 truncate flex items-center gap-2" title={torrent.name}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusMeta.dotClass}`} />
            <span className="truncate">{torrent.name}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
            <span>{formatBytes(torrent.totalBytes)}</span>
            <span>•</span>
            <span className="text-slate-400">{torrent.files.length} files</span>
          </div>
        </div>
      </td>

      {/* Progress */}
      <td className="py-2.5 px-3 w-48">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px] font-medium">
            <span className="text-slate-300">{formatPercent(torrent.progress)}</span>
            <span className="text-slate-400">
              {formatBytes(torrent.downloadedBytes)} / {formatBytes(torrent.totalBytes)}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                torrent.status === 'completed' || torrent.status === 'seeding'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-sm shadow-cyan-400/50'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }}
            />
          </div>
        </div>
      </td>

      {/* Speeds (Down / Up) */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 font-mono text-cyan-400">
            <ArrowDown className="w-3 h-3" />
            <span>{formatSpeed(torrent.downloadSpeed)}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-emerald-400 text-[11px]">
            <ArrowUp className="w-3 h-3" />
            <span>{formatSpeed(torrent.uploadSpeed)}</span>
          </div>
        </div>
      </td>

      {/* ETA & Ratio */}
      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-300">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{formatEta(torrent.eta)}</span>
          </div>
          <div className="text-[10px] text-slate-400">Ratio: {torrent.ratio.toFixed(2)}</div>
        </div>
      </td>

      {/* Swarm (Peers / Seeds) */}
      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {torrent.peerCount} <span className="text-slate-500">peers</span> ({torrent.seedCount}{' '}
            <span className="text-slate-500">seeds</span>)
          </span>
        </div>
      </td>

      {/* Interface Policy */}
      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
        <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded text-slate-300 font-medium">
          <Network className="w-3 h-3 text-cyan-400" />
          <span className="capitalize">{torrent.interfacePolicy.mode}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-2.5 px-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isRunning ? (
            <button
              onClick={() => pauseTorrent(torrent.infoHash)}
              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => resumeTorrent(torrent.infoHash)}
              className="p-1 rounded hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition-colors"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => recheckTorrent(torrent.infoHash)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
            title="Force Recheck"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (confirm(`Remove torrent "${torrent.name}"?`)) {
                removeTorrent(torrent.infoHash, false)
              }
            }}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
