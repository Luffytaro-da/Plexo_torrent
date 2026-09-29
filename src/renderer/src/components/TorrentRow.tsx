import React from 'react'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Folder,
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
    removeTorrent,
    settings
  } = useTorrentStore()

  const statusMeta = STATUS_CONFIG[torrent.status] || STATUS_CONFIG.paused
  const isRunning =
    torrent.status === 'downloading' ||
    torrent.status === 'seeding' ||
    torrent.status === 'checking' ||
    torrent.status === 'restored'

  const handleReveal = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.relayTorrent && torrent.savePath) {
      window.relayTorrent.revealInFolder(torrent.savePath)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    const deleteFiles = e.shiftKey
    if (deleteFiles) {
      const shouldConfirm = settings?.confirmDataDeletion !== false
      if (!shouldConfirm || confirm(`Permanently delete "${torrent.name}" and downloaded files from disk?`)) {
        void removeTorrent(torrent.infoHash, true)
      }
    } else {
      const shouldConfirm = settings?.confirmTorrentRemoval !== false
      if (!shouldConfirm || confirm(`Remove "${torrent.name}" from RelayTorrent?`)) {
        void removeTorrent(torrent.infoHash, false)
      }
    }
  }

  return (
    <tr
      onClick={() => setSelectedInfoHash(torrent.infoHash)}
      className={`group transition-colors cursor-pointer select-none text-xs ${
        isSelected
          ? 'bg-[#182332] text-slate-100 ring-1 ring-inset ring-cyan-500/30'
          : 'hover:bg-[#141a24] text-slate-300'
      }`}
    >
      {/* Name & Metadata */}
      <td className="py-2 px-3 max-w-xs">
        <div className="flex flex-col gap-0.5">
          <div className="font-semibold text-slate-100 truncate flex items-center gap-2" title={torrent.name}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusMeta.dotClass}`} />
            <span className="truncate tracking-tight">{torrent.name}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span className={`px-1.5 py-0.2 rounded font-semibold border ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </span>
            <span className="opacity-40">·</span>
            <span>{formatBytes(torrent.totalBytes)}</span>
            <span className="opacity-40">·</span>
            <span>{torrent.files.length} {torrent.files.length === 1 ? 'file' : 'files'}</span>
            {torrent.numPieces > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-slate-400">
                  {torrent.verifiedPieces}/{torrent.numPieces} pcs
                </span>
              </>
            )}
          </div>
        </div>
      </td>

      {/* Progress */}
      <td className="py-2 px-3 w-48">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-slate-200 font-semibold">{formatPercent(torrent.progress)}</span>
            <span className="text-slate-400">
              {formatBytes(torrent.downloadedBytes)} / {formatBytes(torrent.totalBytes)}
            </span>
          </div>
          <div className="w-full bg-[#1e2634] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                torrent.status === 'completed' || torrent.status === 'seeding'
                  ? 'bg-emerald-400 shadow-xs'
                  : torrent.status === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }}
            />
          </div>
        </div>
      </td>

      {/* Speeds (Down / Up) */}
      <td className="py-2 px-3 whitespace-nowrap w-32">
        <div className="flex flex-col gap-0.5 font-mono text-[11px]">
          <div className="flex items-center gap-1 text-cyan-400">
            <ArrowDown className="w-3 h-3 shrink-0" />
            <span>{formatSpeed(torrent.downloadSpeed)}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400 text-[10px]">
            <ArrowUp className="w-3 h-3 shrink-0" />
            <span>{formatSpeed(torrent.uploadSpeed)}</span>
          </div>
        </div>
      </td>

      {/* ETA & Ratio */}
      <td className="py-2 px-3 whitespace-nowrap text-[11px] text-slate-300 w-24">
        <div className="flex flex-col gap-0.5 font-mono">
          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{formatEta(torrent.eta)}</span>
          </div>
          <div className="text-[10px] text-slate-400">Ratio: {torrent.ratio.toFixed(2)}</div>
        </div>
      </td>

      {/* Swarm (Peers / Seeds) */}
      <td className="py-2 px-3 whitespace-nowrap text-[11px] w-28">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-mono text-[10px]">
            <strong className="text-slate-200 font-semibold">{torrent.peerCount}</strong> peers{' '}
            <span className="text-slate-500">({torrent.seedCount}s)</span>
          </span>
        </div>
      </td>

      {/* Interface Policy */}
      <td className="py-2 px-3 whitespace-nowrap text-[11px] w-28">
        <div className="inline-flex items-center gap-1 bg-[#161c24] border border-[#242f40] px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-medium">
          <Network className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="capitalize">{torrent.interfacePolicy.mode}</span>
        </div>
      </td>

      {/* Compact Actions */}
      <td className="py-2 px-3 text-right whitespace-nowrap w-28">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isRunning ? (
            <button
              onClick={() => pauseTorrent(torrent.infoHash)}
              className="p-1 rounded hover:bg-[#202938] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Pause"
              aria-label="Pause torrent"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => resumeTorrent(torrent.infoHash)}
              className="p-1 rounded hover:bg-[#202938] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Resume"
              aria-label="Resume torrent"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => recheckTorrent(torrent.infoHash)}
            className="p-1 rounded hover:bg-[#202938] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Force Recheck"
            aria-label="Recheck torrent"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleReveal}
            className="p-1 rounded hover:bg-[#202938] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reveal in Folder"
            aria-label="Reveal in Folder"
          >
            <Folder className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRemove}
            className="p-1 rounded hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
            title="Remove Torrent"
            aria-label="Remove torrent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
