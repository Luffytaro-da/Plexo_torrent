import React from 'react'
import {
  Folder,
  HardDrive,
  Share2,
  ShieldCheck,
  Zap
} from 'lucide-react'
import type { TorrentState } from '../../../../shared/types'
import { formatBytes, formatDate, formatEta, formatPercent, formatSpeed } from '../../utils/formatters'

interface OverviewTabProps {
  torrent: TorrentState
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ torrent }) => {
  const handleReveal = () => {
    if (window.relayTorrent && torrent.savePath) {
      window.relayTorrent.revealInFolder(torrent.savePath)
    }
  }

  return (
    <div className="p-4 space-y-4 text-xs select-text overflow-y-auto max-h-full">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Total Size</span>
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-slate-100">{formatBytes(torrent.totalBytes)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {torrent.files.length} file{torrent.files.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Completed</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-slate-100">
            {formatBytes(torrent.downloadedBytes)} ({formatPercent(torrent.progress)})
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {torrent.verifiedPieces} / {torrent.numPieces} verified pieces
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Down Speed</span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold font-mono text-cyan-400">
            {formatSpeed(torrent.downloadSpeed)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">ETA: {formatEta(torrent.eta)}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Upload / Ratio</span>
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400">
            {formatSpeed(torrent.uploadSpeed)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ratio: {torrent.ratio.toFixed(2)}</div>
        </div>
      </div>

      {/* Details List */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5 space-y-2.5">
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Info Hash:</span>
          <span className="col-span-10 font-mono text-slate-300 select-all bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            {torrent.infoHash}
          </span>
        </div>

        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Save Location:</span>
          <div className="col-span-10 flex items-center justify-between bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            <span className="truncate font-mono text-slate-300" title={torrent.savePath}>
              {torrent.savePath}
            </span>
            <button
              onClick={handleReveal}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 shrink-0 ml-2 font-medium cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Reveal in Explorer</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Pieces:</span>
          <div className="col-span-10 text-slate-300">
            <div>
              <strong>{torrent.numPieces}</strong> pieces × {formatBytes(torrent.pieceLength)}
            </div>
            <div className="text-[11px] mt-1 flex gap-3 flex-wrap">
              <span className="text-emerald-400">✔ {torrent.verifiedPieces ?? 0} Verified</span>
              <span className="text-blue-400">⬇ {torrent.downloadingPieces ?? 0} Downloading</span>
              <span className="text-purple-400">⏳ {torrent.requestedPieces ?? 0} Requested</span>
              <span className="text-slate-400">? {torrent.missingPieces ?? 0} Missing</span>
              <span className="text-rose-400">✖ {torrent.corruptedPieces ?? 0} Corrupted</span>
              <span className="text-amber-600/80">⚠ {torrent.skippedPieces ?? 0} Skipped</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {torrent.remainingPieces ?? 0} remaining ({formatBytes(torrent.remainingBytes || 0)})
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Network Policy:</span>
          <span className="col-span-10 text-slate-300 capitalize">
            <strong>{torrent.interfacePolicy.mode}</strong>
            {torrent.interfacePolicy.targetInterfaceId && ` (Target: ${torrent.interfacePolicy.targetInterfaceId})`}
          </span>
        </div>

        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Added On:</span>
          <span className="col-span-10 text-slate-300">
            {formatDate(torrent.addedAt)}
            {torrent.completedAt && ` • Completed: ${formatDate(torrent.completedAt)}`}
          </span>
        </div>

        {torrent.errorMessage && (
          <div className="grid grid-cols-12 items-center gap-2 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-rose-400">
            <span className="col-span-2 font-semibold">Error:</span>
            <span className="col-span-10 font-mono text-[11px]">{torrent.errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
