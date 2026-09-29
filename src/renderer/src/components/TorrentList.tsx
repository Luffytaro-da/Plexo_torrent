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
    if (filterStatus === 'downloading' && t.status !== 'downloading' && t.status !== 'checking' && t.status !== 'restored') {
      return false
    }
    if (filterStatus === 'seeding' && t.status !== 'seeding') {
      return false
    }
    if (filterStatus === 'completed' && t.status !== 'completed') {
      return false
    }
    if (filterStatus === 'paused' && t.status !== 'paused' && t.status !== 'error') {
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
    <div className="flex-1 flex flex-col bg-slate-900/30 overflow-hidden">
      {/* Search & Filter Bar */}
      <div className="h-10 border-b border-slate-800/80 px-3 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2 w-72">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transfers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="text-slate-200 font-semibold">{filteredTorrents.length}</span> of{' '}
          <span className="text-slate-200 font-semibold">{torrents.length}</span> transfers
        </div>
      </div>

      {/* Table of Torrents */}
      <div className="flex-1 overflow-y-auto">
        {filteredTorrents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
              <HardDriveDownload className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-1">No torrents to display</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Add a magnet link or open a .torrent file to start high-speed multi-network downloading.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Torrent Now</span>
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-[11px] font-semibold text-slate-400 select-none z-10">
              <tr>
                <th className="py-2 px-3">Name & Size</th>
                <th className="py-2 px-3">Progress</th>
                <th className="py-2 px-3">Speed (Down/Up)</th>
                <th className="py-2 px-3">ETA & Ratio</th>
                <th className="py-2 px-3">Swarm</th>
                <th className="py-2 px-3">Interface Policy</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
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
