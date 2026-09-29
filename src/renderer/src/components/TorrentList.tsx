import React from 'react'
import {
  HardDriveDownload,
  Plus,
  Search
} from 'lucide-react'
import { useTorrentStore } from '../store/torrentStore'
import { TorrentRow } from './TorrentRow'

export const TorrentList: React.FC = () => {
  const {
    torrents,
    selectedInfoHash,
    filterStatus,
    searchQuery,
    setSearchQuery,
    setAddModalOpen
  } = useTorrentStore()

  // Filter torrents
  const filteredTorrents = torrents.filter((t) => {
    // Status filter
    if (filterStatus === 'downloading' && t.status !== 'downloading' && t.status !== 'restored') {
      return false
    }
    if (filterStatus === 'checking' && t.status !== 'checking') {
      return false
    }
    if (filterStatus === 'seeding' && t.status !== 'seeding') {
      return false
    }
    if (filterStatus === 'completed' && t.status !== 'completed') {
      return false
    }
    if (filterStatus === 'paused' && t.status !== 'paused' && t.status !== 'stalled') {
      return false
    }
    if (filterStatus === 'error' && t.status !== 'error') {
      return false
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.infoHash.toLowerCase().includes(q)
    }

    return true
  })

  return (
    <div className="flex-1 flex flex-col bg-[#0e1217] overflow-hidden">
      {/* Search & Filter Bar (Plexo style) */}
      <div className="h-9 border-b border-[#1f2735] px-3 flex items-center justify-between bg-[#11161d] shrink-0">
        <div className="flex items-center gap-2 w-64">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transfers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161c24] border border-[#253043] rounded-md pl-7 pr-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Showing <strong className="text-slate-200 font-semibold">{filteredTorrents.length}</strong> of{' '}
          <strong className="text-slate-200 font-semibold">{torrents.length}</strong>
        </div>
      </div>

      {/* Table of Torrents */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {filteredTorrents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-[#161c24] border border-[#253043] flex items-center justify-center text-slate-500 mb-2.5 shadow-inner">
              <HardDriveDownload className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-semibold text-slate-300 mb-1">No transfers to display</h3>
            <p className="text-[11px] text-slate-500 max-w-sm mb-3">
              Add a magnet link or open a .torrent file to begin multi-interface swarm downloading.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Torrent</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead className="sticky top-0 bg-[#121720]/95 backdrop-blur-xs border-b border-[#222c3c] text-[10px] uppercase font-mono font-semibold text-slate-400 select-none z-10">
              <tr>
                <th className="py-2 px-3">Name & Metadata</th>
                <th className="py-2 px-3 w-48">Progress</th>
                <th className="py-2 px-3 w-32">Speed (Down / Up)</th>
                <th className="py-2 px-3 w-24">ETA / Ratio</th>
                <th className="py-2 px-3 w-28">Swarm</th>
                <th className="py-2 px-3 w-28">Routing Policy</th>
                <th className="py-2 px-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b222d]">
              {filteredTorrents.map((torrent) => (
                <TorrentRow
                  key={torrent.infoHash}
                  torrent={torrent}
                  isSelected={torrent.infoHash === selectedInfoHash}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
