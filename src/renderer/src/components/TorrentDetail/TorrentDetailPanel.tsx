import React from 'react'
import {
  Activity,
  FileText,
  Grid,
  Info,
  Network,
  Radio,
  Users,
  X
} from 'lucide-react'
import { useTorrentStore, type DetailTab } from '../../store/torrentStore'
import { ActivityLogTab } from './ActivityLogTab'
import { FilesTab } from './FilesTab'
import { NetworksTab } from './NetworksTab'
import { OverviewTab } from './OverviewTab'
import { PeersTab } from './PeersTab'
import { PiecesTab } from './PiecesTab'
import { TrackersTab } from './TrackersTab'

export const TorrentDetailPanel: React.FC = () => {
  const { torrents, selectedInfoHash, setSelectedInfoHash, selectedTab, setSelectedTab } = useTorrentStore()

  const torrent = torrents.find((t) => t.infoHash === selectedInfoHash)
  if (!torrent) return null

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-3.5 h-3.5" /> },
    { id: 'files', label: 'Files', icon: <FileText className="w-3.5 h-3.5" />, count: torrent.files.length },
    { id: 'pieces', label: 'Pieces', icon: <Grid className="w-3.5 h-3.5" />, count: torrent.numPieces },
    { id: 'peers', label: 'Peers', icon: <Users className="w-3.5 h-3.5" />, count: torrent.peerCount },
    { id: 'trackers', label: 'Trackers', icon: <Radio className="w-3.5 h-3.5" />, count: torrent.trackers.length },
    { id: 'networks', label: 'Networks', icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Activity Log', icon: <Activity className="w-3.5 h-3.5" />, count: torrent.activityLogs.length }
  ]

  return (
    <div className="h-full border-t border-[#1f2735] bg-[#0e1217] flex flex-col select-none shrink-0 overflow-hidden">
      {/* Plexo Compact Segmented Detail Tab Bar */}
      <div className="h-8 border-b border-[#1f2735] bg-[#11161d] flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = selectedTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#18212e] text-cyan-300 font-semibold border border-[#2a3a50]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151b24] border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${isActive ? 'bg-cyan-950/80 text-cyan-300' : 'bg-[#161c24] text-slate-500'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Close Button to collapse detail pane */}
        <button
          onClick={() => setSelectedInfoHash(null)}
          className="p-1 rounded hover:bg-[#1a212d] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0 ml-2"
          title="Close details panel"
          aria-label="Close details"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-[#0e1217]">
        {selectedTab === 'overview' && <OverviewTab torrent={torrent} />}
        {selectedTab === 'files' && <FilesTab torrent={torrent} />}
        {selectedTab === 'pieces' && <PiecesTab torrent={torrent} />}
        {selectedTab === 'peers' && <PeersTab torrent={torrent} />}
        {selectedTab === 'trackers' && <TrackersTab torrent={torrent} />}
        {selectedTab === 'networks' && <NetworksTab torrent={torrent} />}
        {selectedTab === 'activity' && <ActivityLogTab torrent={torrent} />}
      </div>
    </div>
  )
}
