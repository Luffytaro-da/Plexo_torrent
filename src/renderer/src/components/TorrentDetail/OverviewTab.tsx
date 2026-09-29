import React, { useState } from 'react'
import {
  Check,
  Copy,
  Folder,
  HardDrive,
  Network,
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
  const [copiedHash, setCopiedHash] = useState(false)

  const handleReveal = () => {
    if (window.relayTorrent && torrent.savePath) {
      window.relayTorrent.revealInFolder(torrent.savePath)
    }
  }

  const handleCopyHash = () => {
    void navigator.clipboard.writeText(torrent.infoHash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const verifiedBytes = (torrent.verifiedPieces ?? 0) * (torrent.pieceLength || 0)
  const remainingBytes = torrent.remainingBytes ?? Math.max(0, torrent.totalBytes - torrent.downloadedBytes)
  const isChecking = torrent.status === 'checking'

  return (
    <div className="p-3.5 space-y-3.5 text-xs select-text overflow-y-auto max-h-full">
      {/* Metric Cards Grid (Plexo style instrument cards) */}
      <div className="grid grid-cols-4 gap-2.5">
        {/* Total Size Card */}
        <div className="bg-[#141922] border border-[#212936] rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">Total Size</span>
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100">{formatBytes(torrent.totalBytes)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {torrent.files.length} {torrent.files.length !== 1 ? 'files' : 'file'} · {torrent.numPieces} pcs
          </div>
        </div>

        {/* Verified / Completed Card */}
        <div className="bg-[#141922] border border-[#212936] rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">
              {isChecking ? 'Checking' : 'Progress'}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100 flex items-baseline gap-1.5">
            <span>{formatBytes(torrent.downloadedBytes)}</span>
            <span className="text-[11px] font-semibold text-cyan-400">({formatPercent(torrent.progress)})</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            Verified: <strong className="text-emerald-400">{torrent.verifiedPieces}</strong> / {torrent.numPieces} pcs
          </div>
        </div>

        {/* Download Speed Card */}
        <div className="bg-[#141922] border border-[#212936] rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">Down Speed</span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold font-mono text-cyan-400">
            {formatSpeed(torrent.downloadSpeed)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            ETA: <span className="text-slate-300">{formatEta(torrent.eta)}</span>
          </div>
        </div>

        {/* Upload Speed / Ratio Card */}
        <div className="bg-[#141922] border border-[#212936] rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">Up / Ratio</span>
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400">
            {formatSpeed(torrent.uploadSpeed)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            Ratio: <strong className="text-slate-200">{torrent.ratio.toFixed(2)}</strong> · Up: {formatBytes(torrent.uploadedBytes)}
          </div>
        </div>
      </div>

      {/* Verification & Transfer State Breakdown Strip */}
      <div className="bg-[#12161e] border border-[#1f2735] rounded-lg p-2.5 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400">Cryptographically Verified:</span>{' '}
            <strong className="text-emerald-400">{formatBytes(verifiedBytes)}</strong>
          </div>
          <span className="text-slate-500">·</span>
          <div>
            <span className="text-slate-400">Received Total:</span>{' '}
            <strong className="text-slate-200">{formatBytes(torrent.downloadedBytes)}</strong>
          </div>
          <span className="text-slate-500">·</span>
          <div>
            <span className="text-slate-400">Remaining to Verify:</span>{' '}
            <strong className="text-cyan-400">{formatBytes(remainingBytes)}</strong>
          </div>
        </div>
        <div className="text-slate-400">
          Piece Size: <strong className="text-slate-200">{formatBytes(torrent.pieceLength)}</strong>
        </div>
      </div>

      {/* Details List */}
      <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
        {/* Info Hash */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Info Hash:</span>
          <div className="col-span-10 flex items-center justify-between bg-[#0e1217] px-2 py-1 rounded border border-[#212936]">
            <span className="font-mono text-slate-300 text-[11px] select-all truncate">{torrent.infoHash}</span>
            <button
              onClick={handleCopyHash}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 ml-2 cursor-pointer font-mono shrink-0"
              title="Copy Info Hash"
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Save Location */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Destination:</span>
          <div className="col-span-10 flex items-center justify-between bg-[#0e1217] px-2 py-1 rounded border border-[#212936]">
            <span className="truncate font-mono text-slate-300 text-[11px]" title={torrent.savePath}>
              {torrent.savePath}
            </span>
            <button
              onClick={handleReveal}
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 shrink-0 ml-2 font-medium cursor-pointer"
            >
              <Folder className="w-3 h-3" />
              <span>Reveal</span>
            </button>
          </div>
        </div>

        {/* Piece Status Breakdown */}
        <div className="grid grid-cols-12 items-start gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Piece Health:</span>
          <div className="col-span-10 text-slate-300 font-mono text-[11px]">
            <div className="flex gap-3 flex-wrap">
              <span className="text-emerald-400">✔ {torrent.verifiedPieces ?? 0} Verified</span>
              <span className="text-cyan-400">⬇ {torrent.downloadingPieces ?? 0} Downloading</span>
              <span className="text-indigo-400">⏳ {torrent.requestedPieces ?? 0} Requested</span>
              <span className="text-slate-400">? {torrent.missingPieces ?? 0} Missing</span>
              {(torrent.corruptedPieces ?? 0) > 0 && (
                <span className="text-rose-400">✖ {torrent.corruptedPieces} Corrupted</span>
              )}
              {(torrent.skippedPieces ?? 0) > 0 && (
                <span className="text-amber-500">⚠ {torrent.skippedPieces} Skipped</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {torrent.remainingPieces ?? Math.max(0, torrent.numPieces - (torrent.verifiedPieces || 0))} pieces remaining
            </div>
          </div>
        </div>

        {/* Network Policy */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Routing Policy:</span>
          <div className="col-span-10 text-slate-300 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-[#12161e] border border-[#253043] px-2 py-0.5 rounded text-[11px] font-mono capitalize">
              <Network className="w-3 h-3 text-cyan-400" />
              {torrent.interfacePolicy.mode}
            </span>
            {torrent.interfacePolicy.targetInterfaceId && (
              <span className="text-[10px] text-slate-400 font-mono">
                Target: {torrent.interfacePolicy.targetInterfaceId}
              </span>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-12 items-center gap-2">
          <span className="col-span-2 text-slate-400 font-medium">Timestamp:</span>
          <span className="col-span-10 text-slate-400 font-mono text-[11px]">
            Added {formatDate(torrent.addedAt)}
            {torrent.completedAt && ` · Completed ${formatDate(torrent.completedAt)}`}
          </span>
        </div>

        {/* Error message if present */}
        {torrent.errorMessage && (
          <div className="bg-rose-950/30 border border-rose-800/40 p-2 rounded text-rose-300 font-mono text-[11px]">
            <strong>Error:</strong> {torrent.errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}
