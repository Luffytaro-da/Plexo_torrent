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
    <div className="flex-1 flex flex-col h-full p-4 overflow-hidden text-xs space-y-3">
      {/* Header / Summary / Legend */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Total Pieces</div>
            <div className="text-sm font-bold text-slate-100 font-mono">
              {numPieces}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({formatBytes(torrent.pieceLength)} each)
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400">Verified</div>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {stateCounts.verified} ({formatPercent(stateCounts.verified / numPieces)})
            </div>
          </div>

          {stateCounts.downloading > 0 && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-cyan-400">Live Active</div>
              <div className="text-sm font-bold text-cyan-400 font-mono animate-pulse">
                {stateCounts.downloading} downloading
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {(Object.entries(PIECE_STATE_CONFIG) as [PieceState, { label: string; bgClass: string }][]).map(
            ([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className={`w-2.5 h-2.5 rounded-xs ${meta.bgClass}`} />
                <span>
                  {meta.label} ({stateCounts[key]})
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Piece Grid Canvas / Container */}
      <div className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 overflow-y-auto relative">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12px,1fr))] gap-1">
          {effectiveStates.map((state, index) => {
            const meta = PIECE_STATE_CONFIG[state] || PIECE_STATE_CONFIG.missing
            const isDownloading = state === 'downloading'
            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredPiece({ index, state })}
                onMouseLeave={() => setHoveredPiece(null)}
                className={`h-3 rounded-xs transition-transform hover:scale-125 hover:z-10 cursor-pointer ${
                  meta.bgClass
                } ${isDownloading ? 'animate-pulse ring-1 ring-cyan-300' : ''}`}
              />
            )
          })}
        </div>

        {/* Tooltip */}
        {hoveredPiece && (
          <div className="fixed bottom-6 right-6 bg-slate-900 border border-slate-700 shadow-xl rounded-lg px-3 py-1.5 text-xs text-slate-200 pointer-events-none z-50">
            <div className="font-semibold text-cyan-400 font-mono">Piece #{hoveredPiece.index}</div>
            <div className="capitalize text-slate-400">
              State: <strong className="text-slate-200">{hoveredPiece.state}</strong>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Size: {formatBytes(torrent.pieceLength)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
