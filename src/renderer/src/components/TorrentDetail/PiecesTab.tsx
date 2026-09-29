import React, { useEffect, useState, useMemo } from 'react'
import type { PieceState, TorrentState } from '../../../../shared/types'
import { useTorrentStore } from '../../store/torrentStore'
import { PIECE_STATE_CONFIG } from '../../utils/colors'
import { formatBytes, formatPercent } from '../../utils/formatters'

interface PiecesTabProps {
  torrent: TorrentState
}

export const PiecesTab: React.FC<PiecesTabProps> = ({ torrent }) => {
  const { pieceStatesMap, setPieceStates } = useTorrentStore()
  const [hoveredPiece, setHoveredPiece] = useState<{ index: number; state: PieceState } | null>(null)

  const states = pieceStatesMap[torrent.infoHash.toLowerCase()] || []
  const numPieces = torrent.numPieces || states.length || 1

  // Fetch piece states on mount / hash change
  useEffect(() => {
    if (window.relayTorrent && torrent.infoHash) {
      void window.relayTorrent.getTorrentPieceStates(torrent.infoHash).then((pcs) => {
        if (pcs && pcs.length > 0) {
          setPieceStates(torrent.infoHash, pcs)
        }
      })
    }
  }, [torrent.infoHash, setPieceStates])

  // Fallback states array if not yet fetched
  const effectiveStates: PieceState[] = useMemo(() => {
    if (states.length === numPieces) return states
    return Array.from({ length: numPieces }, (_, i) =>
      i < torrent.verifiedPieces ? 'verified' : 'missing'
    )
  }, [states, numPieces, torrent.verifiedPieces])

  // Real-time piece state counts from effective states
  const stateCounts = useMemo(() => {
    const counts: Record<PieceState, number> = {
      verified: 0,
      downloading: 0,
      requested: 0,
      corrupted: 0,
      skipped: 0,
      missing: 0
    }
    for (const st of effectiveStates) {
      if (counts[st] !== undefined) {
        counts[st]++
      } else {
        counts.missing++
      }
    }
    return counts
  }, [effectiveStates])

  return (
    <div className="flex-1 flex flex-col h-full p-3.5 overflow-hidden text-xs space-y-2.5">
      {/* Header / Summary / Legend (Plexo style) */}
      <div className="flex items-center justify-between bg-[#141922] border border-[#212936] rounded-lg p-2.5 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Total Pieces</div>
            <div className="text-xs font-bold text-slate-100 font-mono">
              {numPieces}{' '}
              <span className="text-[10px] font-normal text-slate-400">
                ({formatBytes(torrent.pieceLength)} each)
              </span>
            </div>
          </div>

          <span className="text-slate-500 font-mono text-xs">·</span>

          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Verified</div>
            <div className="text-xs font-bold text-emerald-400 font-mono">
              {stateCounts.verified} ({formatPercent(stateCounts.verified / numPieces)})
            </div>
          </div>

          {stateCounts.downloading > 0 && (
            <>
              <span className="text-slate-500 font-mono text-xs">·</span>
              <div>
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400">Live Active</div>
                <div className="text-xs font-bold text-cyan-400 font-mono animate-pulse">
                  {stateCounts.downloading} active
                </div>
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {(Object.entries(PIECE_STATE_CONFIG) as [PieceState, { label: string; bgClass: string }][]).map(
            ([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                <span className={`w-2 h-2 rounded-xs ${meta.bgClass}`} />
                <span>
                  {meta.label} <strong className="text-slate-200">({stateCounts[key]})</strong>
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Piece Grid Canvas / Container */}
      <div className="flex-1 bg-[#10141a] border border-[#1f2735] rounded-lg p-2.5 overflow-y-auto relative">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10px,1fr))] gap-1">
          {effectiveStates.map((state, index) => {
            const meta = PIECE_STATE_CONFIG[state] || PIECE_STATE_CONFIG.missing
            const isDownloading = state === 'downloading'
            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredPiece({ index, state })}
                onMouseLeave={() => setHoveredPiece(null)}
                className={`h-2.5 rounded-xs transition-transform hover:scale-125 hover:z-10 cursor-pointer ${
                  meta.bgClass
                } ${isDownloading ? 'animate-pulse ring-1 ring-cyan-300' : ''}`}
              />
            )
          })}
        </div>

        {/* Hover Inspector Tooltip */}
        {hoveredPiece && (
          <div className="fixed bottom-4 right-4 bg-[#161c24] border border-[#273244] shadow-2xl rounded-md px-2.5 py-1.5 text-xs text-slate-200 pointer-events-none z-50 font-mono">
            <div className="font-semibold text-cyan-400">Piece #{hoveredPiece.index}</div>
            <div className="text-[11px] text-slate-300 capitalize">
              State: <strong className="text-white">{hoveredPiece.state}</strong>
            </div>
            <div className="text-[10px] text-slate-400">Size: {formatBytes(torrent.pieceLength)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
