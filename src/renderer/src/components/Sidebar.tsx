import React, { useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Network,
  PauseCircle,
  Power,
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
    interfaces: storeInterfaces,
    toggleInterface
  } = useTorrentStore()

  const [isCollapsed, setIsCollapsed] = useState(false)

  const counts: Record<NavigationFilter, number> = {
    all: torrents.length,
    downloading: torrents.filter(
      (t) => t.status === 'downloading' || t.status === 'checking' || t.status === 'restored'
    ).length,
    seeding: torrents.filter((t) => t.status === 'seeding').length,
    completed: torrents.filter((t) => t.status === 'completed').length,
    paused: torrents.filter((t) => t.status === 'paused' || t.status === 'error').length
  }

  const navItems: { id: NavigationFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Transfers', icon: <Layers className="w-4 h-4 shrink-0" /> },
    { id: 'downloading', label: 'Downloading', icon: <ArrowDownCircle className="w-4 h-4 text-cyan-400 shrink-0" /> },
    { id: 'seeding', label: 'Seeding', icon: <ArrowUpCircle className="w-4 h-4 text-emerald-400 shrink-0" /> },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" /> },
    { id: 'paused', label: 'Paused / Inactive', icon: <PauseCircle className="w-4 h-4 text-slate-400 shrink-0" /> }
  ]

  const interfaces = telemetry?.interfaces && telemetry.interfaces.length > 0 ? telemetry.interfaces : storeInterfaces

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-60'
      } bg-slate-900/60 border-r border-slate-800/80 flex flex-col justify-between p-3 select-none transition-all duration-300 relative shrink-0`}
    >
      {/* Top Section */}
      <div className="space-y-6">
        {/* Toggle Collapse Button Header */}
        <div className="flex items-center justify-between px-1">
          {!isCollapsed && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Transfers
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer ml-auto"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Transfer Filter Nav Buttons */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = viewMode === 'torrents' && filterStatus === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setViewMode('torrents')
                  setFilterStatus(item.id)
                }}
                title={isCollapsed ? `${item.label} (${counts[item.id]})` : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
                } py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                      isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {counts[item.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Networking View Button */}
        <div>
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-2">
              Routing
            </div>
          )}
          <button
            onClick={() => setViewMode('networks')}
            title={isCollapsed ? 'Multi-Interface Router' : undefined}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-between px-2.5'
            } py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'networks'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              <Network className="w-4 h-4 text-blue-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Multi-Interface Router</span>}
            </div>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 shrink-0">
                {interfaces.filter((i) => i.isOnline && i.enabled).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Bottom Adapter Panel */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 space-y-2 mt-4 shadow-lg">
        <div
          onClick={() => setViewMode('networks')}
          className="flex items-center justify-between text-[11px] font-semibold text-slate-300 cursor-pointer hover:text-cyan-300 transition-colors"
          title="Open network manager"
        >
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            {!isCollapsed && <span>Swarm Adapters</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[10px] text-slate-500 font-mono">
              {interfaces.filter((i) => i.isOnline && i.enabled).length}/{interfaces.length}
            </span>
          )}
        </div>

        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
          {interfaces.length === 0 ? (
            <div className="text-[10px] text-slate-500 italic text-center py-1">
              {!isCollapsed ? 'No adapters found' : '...'}
            </div>
          ) : (
            interfaces.map((iface) => {
              const isBusy = iface.downloadSpeed > 0 || iface.uploadSpeed > 0
              return (
                <div
                  key={iface.id}
                  className={`flex items-center justify-between text-[11px] rounded-lg border transition-all ${
                    isCollapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'
                  } ${
                    iface.isOnline && iface.enabled
                      ? 'bg-slate-900/80 border-slate-800/80'
                      : 'bg-slate-950/40 border-slate-900 opacity-50'
                  }`}
                  title={`${iface.displayName} (${iface.address}): ${
                    iface.isOnline && iface.enabled ? 'Active' : 'Disabled'
                  } - ${formatSpeed(iface.downloadSpeed)}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {/* Live Activity Pulse Indicator */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          iface.isOnline && iface.enabled
                            ? isBusy
                              ? 'bg-cyan-400'
                              : 'bg-emerald-400'
                            : 'bg-slate-600'
                        }`}
                      />
                      {iface.isOnline && iface.enabled && isBusy && (
                        <div className="absolute w-3 h-3 rounded-full bg-cyan-400/40 animate-ping" />
                      )}
                    </div>

                    {!isCollapsed && (
                      <span className="truncate text-slate-300 font-medium text-[11px]">
                        {iface.label || iface.displayName}
                      </span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {iface.downloadSpeed > 0 ? formatSpeed(iface.downloadSpeed) : 'idle'}
                      </span>
                      {/* One-click quick toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          void toggleInterface(iface.id, !iface.enabled)
                        }}
                        className={`p-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                          iface.enabled ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                        title={iface.enabled ? 'Click to disable adapter' : 'Click to enable adapter'}
                      >
                        <Power className="w-3 h-3" />
                      </button>
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
