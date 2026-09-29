import React from 'react'
import {
  Activity,
  FileText,
  Grid,
  Info,
  Network,
  Radio,
  Users
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
  const { torrents, selectedInfoHash, selectedTab, setSelectedTab } = useTorrentStore()

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
    <div className="h-72 border-t border-slate-800/80 bg-slate-950 flex flex-col select-none shrink-0">
      {/* Detail Tabs Bar */}
      <div className="h-9 border-b border-slate-800/80 bg-slate-900/60 flex items-center px-3 gap-1">
        {tabs.map((tab) => {
          const isActive = selectedTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-slate-950/90">
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
