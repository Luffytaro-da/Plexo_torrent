import React, { useState } from 'react'
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Network,
  PauseCircle,
  Radio
} from 'lucide-react'
import { useTorrentStore, type NavigationFilter } from '../store/torrentStore'
import { formatSpeed } from '../utils/formatters'

export const Sidebar: React.FC = () => {
  const {
    torrents,
    filterStatus,
    setFilterStatus,
    viewMode,
    setViewMode,
    telemetry,
    interfaces: storeInterfaces
  } = useTorrentStore()

  const [isCollapsed, setIsCollapsed] = useState(false)

  const counts: Record<NavigationFilter, number> = {
    all: torrents.length,
    downloading: torrents.filter((t) => t.status === 'downloading' || t.status === 'restored').length,
    checking: torrents.filter((t) => t.status === 'checking').length,
    seeding: torrents.filter((t) => t.status === 'seeding').length,
    completed: torrents.filter((t) => t.status === 'completed').length,
    paused: torrents.filter((t) => t.status === 'paused' || t.status === 'stalled').length,
    error: torrents.filter((t) => t.status === 'error').length
  }

  const navItems: { id: NavigationFilter; label: string; icon: React.ReactNode; colorClass: string }[] = [
    { id: 'all', label: 'All Transfers', icon: <Layers className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-slate-300' },
    { id: 'downloading', label: 'Downloading', icon: <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-cyan-400' },
    { id: 'checking', label: 'Checking', icon: <Clock className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-amber-400' },
    { id: 'seeding', label: 'Seeding', icon: <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-emerald-400' },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-teal-400' },
    { id: 'paused', label: 'Paused / Inactive', icon: <PauseCircle className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-slate-400' },
    { id: 'error', label: 'Errors', icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />, colorClass: 'text-rose-400' }
  ]

  const interfaces = telemetry?.interfaces && telemetry.interfaces.length > 0 ? telemetry.interfaces : storeInterfaces
  const onlineCount = interfaces.filter((i) => i.isOnline).length

  return (
    <aside
      className={`${
        isCollapsed ? 'w-14' : 'w-56'
      } bg-[#0e1217] border-r border-[#1f2735] flex flex-col justify-between p-2 select-none transition-all duration-200 relative shrink-0 z-20`}
    >
      {/* Top Section */}
      <div className="space-y-4">
        {/* Toggle Collapse Button Header */}
        <div className="flex items-center justify-between px-1.5 pt-1">
          {!isCollapsed && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Filters
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-[#1a212d] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer ml-auto"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Transfer Filter Nav Buttons */}
        <nav className="space-y-0.5" aria-label="Transfer Filters">
          {navItems.map((item) => {
            const isActive = viewMode === 'torrents' && filterStatus === item.id
            const count = counts[item.id]
            // Skip error item if 0 to keep sidebar dense and clean, unless active
            if (item.id === 'error' && count === 0 && !isActive) return null
            // Skip checking item if 0, unless active
            if (item.id === 'checking' && count === 0 && !isActive) return null

            return (
              <button
                key={item.id}
                onClick={() => {
                  setViewMode('torrents')
                  setFilterStatus(item.id)
                }}
                title={isCollapsed ? `${item.label} (${count})` : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-2'
                } py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer group ${
                  isActive
                    ? 'bg-[#18212e] text-cyan-300 font-semibold border border-[#2a3a50]'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-[#151b24] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={item.colorClass}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0 transition-colors ${
                      isActive ? 'bg-cyan-950/80 text-cyan-300 font-semibold border border-cyan-800/40' : 'bg-[#161c24] text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Router View Nav Link */}
        <div className="pt-2 border-t border-[#1a212d]">
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 mb-1 font-mono">
              Swarm Router
            </div>
          )}
          <button
            onClick={() => setViewMode('networks')}
            title={isCollapsed ? `Multi-Interface Router (${onlineCount} active)` : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-between px-2'
            } py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'networks'
                ? 'bg-[#18212e] text-blue-300 font-semibold border border-blue-500/40'
                : 'text-slate-300 hover:text-slate-100 hover:bg-[#151b24] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Network className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Multi-Interface Router</span>}
            </div>
            {!isCollapsed && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#161c24] text-slate-400 shrink-0 border border-[#222c3c]">
                {onlineCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Bottom Adapter Strip (Plexo Inspired) */}
      <div className="bg-[#12161e] border border-[#1f2735] rounded-lg p-2 space-y-1.5 mt-2 shadow-sm">
        <div
          onClick={() => setViewMode('networks')}
          className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-cyan-300 transition-colors font-mono"
          title="Open network manager"
        >
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
            {!isCollapsed && <span>Adapters</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[9px] text-slate-500 font-mono">
              {onlineCount}/{interfaces.length}
            </span>
          )}
        </div>

        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {interfaces.length === 0 ? (
            <div className="text-[10px] text-slate-500 italic text-center py-1">
              {!isCollapsed ? 'No adapters found' : '...'}
            </div>
          ) : (
            interfaces.map((iface) => {
              const isTransferring = iface.downloadSpeed > 0 || iface.uploadSpeed > 0
              const statusDot = iface.isOnline
                ? isTransferring
                  ? 'bg-cyan-400 animate-pulse'
                  : 'bg-emerald-400'
                : 'bg-slate-600'

              return (
                <div
                  key={iface.id}
                  className={`flex items-center justify-between text-xs rounded-md border transition-all ${
                    isCollapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'
                  } ${
                    iface.isOnline
                      ? 'bg-[#161c24] border-[#242f40]'
                      : 'bg-[#10141a] border-[#1a212d] opacity-50'
                  }`}
                  title={`${iface.displayName} (${iface.address}): ${
                    iface.isOnline ? (isTransferring ? 'Transferring' : 'Online / Idle') : 'Offline'
                  } - ${formatSpeed(iface.downloadSpeed)}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                    {!isCollapsed && (
                      <div className="flex flex-col truncate leading-tight">
                        <span className="truncate text-slate-200 font-medium text-[11px]">
                          {iface.label || iface.displayName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {iface.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {iface.downloadSpeed > 0 ? (
                        <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                          {formatSpeed(iface.downloadSpeed)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {iface.isOnline ? 'idle' : 'offline'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </aside>
  )
}
