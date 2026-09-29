import React, { useState, useRef, useEffect } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Gauge,
  Network,
  Plus,
  Radio,
  Settings,
  X,
  Zap
} from 'lucide-react'
import { useTorrentStore } from '../store/torrentStore'
import { formatBytes, formatSpeed } from '../utils/formatters'

const SPEED_PRESETS = [
  { label: 'Unlimited', bytes: -1 },
  { label: '500 KB/s', bytes: 500 * 1024 },
  { label: '1 MB/s', bytes: 1024 * 1024 },
  { label: '2.5 MB/s', bytes: 2.5 * 1024 * 1024 },
  { label: '5 MB/s', bytes: 5 * 1024 * 1024 },
  { label: '10 MB/s', bytes: 10 * 1024 * 1024 },
  { label: '25 MB/s', bytes: 25 * 1024 * 1024 },
  { label: '50 MB/s', bytes: 50 * 1024 * 1024 }
]

export const Header: React.FC = () => {
  const {
    telemetry,
    interfaces: storeInterfaces,
    settings,
    updateSettings,
    setAddModalOpen,
    setSettingsModalOpen,
    viewMode,
    setViewMode
  } = useTorrentStore()

  const [speedPopover, setSpeedPopover] = useState<'download' | 'upload' | null>(null)
  const [customValue, setCustomValue] = useState<string>('')
  const [customUnit, setCustomUnit] = useState<'KB' | 'MB'>('MB')
  const popoverRef = useRef<HTMLDivElement>(null)

  const downSpeed = telemetry?.totalDownloadSpeed || 0
  const upSpeed = telemetry?.totalUploadSpeed || 0
  const interfaces = telemetry?.interfaces && telemetry.interfaces.length > 0 ? telemetry.interfaces : storeInterfaces
  const onlineIfaces = interfaces.filter((i) => i.isOnline && i.enabled).length
  const confirmedPhysicalCount = interfaces.filter(
    (i) => i.isPhysicallyConfirmed && (i.downloadSpeed > 0 || (i.physicalBytesReceived && i.physicalBytesReceived > 0))
  ).length

  const currentDownloadLimit = settings?.globalDownloadLimit ?? -1
  const currentUploadLimit = settings?.globalUploadLimit ?? -1

  // Handle clicking outside to dismiss popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSpeedPopover(null)
      }
    }
    if (speedPopover) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [speedPopover])

  const handleApplyPreset = (bytes: number) => {
    if (speedPopover === 'download') {
      void updateSettings({ globalDownloadLimit: bytes })
    } else if (speedPopover === 'upload') {
      void updateSettings({ globalUploadLimit: bytes })
    }
    setSpeedPopover(null)
  }

  const handleApplyCustom = () => {
    const num = parseFloat(customValue)
    if (isNaN(num) || num < 0) return
    const multiplier = customUnit === 'MB' ? 1024 * 1024 : 1024
    const bytes = Math.round(num * multiplier)

    if (speedPopover === 'download') {
      void updateSettings({ globalDownloadLimit: bytes })
    } else if (speedPopover === 'upload') {
      void updateSettings({ globalUploadLimit: bytes })
    }
    setSpeedPopover(null)
    setCustomValue('')
  }

  const activeLimit = speedPopover === 'download' ? currentDownloadLimit : currentUploadLimit

  return (
    <header className="h-11 border-b border-[#1f2735] bg-[#0e1217] flex items-center justify-between px-3.5 drag-region select-none z-30 relative shrink-0">
      {/* Brand / Logo (Plexo style) */}
      <div className="flex items-center gap-2.5 no-drag">
        <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-sm">
          <Zap className="w-3.5 h-3.5 text-white fill-white" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold tracking-tight text-slate-100">
            RelayTorrent
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Multi-Interface Client
          </span>
        </div>
      </div>

      {/* Center Band: Speeds & Quick Limit Popovers (Plexo style pill) */}
      <div className="flex items-center gap-4 no-drag relative">
        <div className="flex items-center gap-2.5 bg-[#141922] border border-[#222c3c] px-3 py-1 rounded-full text-xs shadow-xs">
          {/* Download Speed Pill */}
          <button
            onClick={() => setSpeedPopover(speedPopover === 'download' ? null : 'download')}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
              speedPopover === 'download'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                : 'hover:bg-[#1a212d] text-slate-200'
            }`}
            title="Click to configure download throttle"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${downSpeed > 0 ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
            <ArrowDown className="w-3 h-3 text-cyan-400" />
            <span className="font-mono text-[11px] font-semibold tracking-tight text-slate-100">{formatSpeed(downSpeed)}</span>
            {currentDownloadLimit > 0 && (
              <span className="text-[9px] bg-cyan-950/80 text-cyan-300 px-1 rounded font-mono border border-cyan-800/40">
                max {formatBytes(currentDownloadLimit)}/s
              </span>
            )}
          </button>

          <span className="text-slate-500 text-[10px] select-none">·</span>

          {/* Upload Speed Pill */}
          <button
            onClick={() => setSpeedPopover(speedPopover === 'upload' ? null : 'upload')}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${
              speedPopover === 'upload'
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'hover:bg-[#1a212d] text-slate-200'
            }`}
            title="Click to configure upload throttle"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${upSpeed > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <ArrowUp className="w-3 h-3 text-emerald-400" />
            <span className="font-mono text-[11px] font-semibold tracking-tight text-slate-100">{formatSpeed(upSpeed)}</span>
            {currentUploadLimit > 0 && (
              <span className="text-[9px] bg-emerald-950/80 text-emerald-300 px-1 rounded font-mono border border-emerald-800/40">
                max {formatBytes(currentUploadLimit)}/s
              </span>
            )}
          </button>

          <span className="text-slate-500 text-[10px] select-none">·</span>

          {/* Interfaces Quick Status */}
          <div
            onClick={() => setViewMode(viewMode === 'networks' ? 'torrents' : 'networks')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition-colors px-1 text-[11px]"
            title="Open multi-interface manager"
          >
            <Radio className="w-3 h-3 text-blue-400" />
            <span className="text-slate-400">
              <strong className="text-slate-200 font-semibold">{onlineIfaces}</strong> {onlineIfaces === 1 ? 'Adapter' : 'Adapters'}
              {confirmedPhysicalCount > 1 ? (
                <span className="ml-1 text-[9px] text-emerald-400 font-semibold font-mono">({confirmedPhysicalCount} Confirmed)</span>
              ) : onlineIfaces > 1 ? (
                <span className="ml-1 text-[9px] text-amber-400 font-semibold font-mono">(1 Active)</span>
              ) : null}
            </span>
          </div>
        </div>

        {/* Speed Limit Popover Dropdown */}
        {speedPopover && (
          <div
            ref={popoverRef}
            className="absolute top-10 left-2 w-72 bg-[#161c24] border border-[#273244] rounded-xl shadow-2xl p-3 text-xs z-50 animate-in fade-in duration-100 backdrop-blur-md"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222c3c]">
              <div className="flex items-center gap-1.5">
                <Gauge className={`w-3.5 h-3.5 ${speedPopover === 'download' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                <span className="font-semibold text-slate-200">
                  Global {speedPopover === 'download' ? 'Download' : 'Upload'} Limit
                </span>
              </div>
              <button
                onClick={() => setSpeedPopover(null)}
                className="p-1 rounded hover:bg-[#222c3c] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-1">
                {SPEED_PRESETS.map((preset) => {
                  const isSelected = activeLimit === preset.bytes
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleApplyPreset(preset.bytes)}
                      className={`flex items-center justify-between px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? speedPopover === 'download'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                          : 'bg-[#12161e] border-[#222c3c] text-slate-300 hover:bg-[#1f2735]'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  )
                })}
              </div>

              {/* Custom Input */}
              <div className="pt-2 border-t border-[#222c3c]">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Custom Throttle
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 8"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyCustom()
                    }}
                    className="flex-1 bg-[#10141a] border border-[#253043] rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div className="flex border border-[#253043] rounded-md overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setCustomUnit('KB')}
                      className={`px-1.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                        customUnit === 'KB' ? 'bg-cyan-600 text-white' : 'bg-[#10141a] text-slate-400 hover:bg-[#1a212d]'
                      }`}
                    >
                      KB/s
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomUnit('MB')}
                      className={`px-1.5 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                        customUnit === 'MB' ? 'bg-cyan-600 text-white' : 'bg-[#10141a] text-slate-400 hover:bg-[#1a212d]'
                      }`}
                    >
                      MB/s
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer shrink-0 shadow-xs"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-1.5 no-drag">
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-xs transition-colors cursor-pointer active:scale-95"
          title="Add Magnet URI or .torrent file"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Torrent</span>
        </button>

        <button
          onClick={() => setViewMode(viewMode === 'networks' ? 'torrents' : 'networks')}
          className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
            viewMode === 'networks'
              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              : 'bg-[#141922] border-[#222c3c] text-slate-400 hover:text-slate-200 hover:bg-[#1f2735]'
          }`}
          title="Multi-Interface Router"
        >
          <Network className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setSettingsModalOpen(true)}
          className="p-1.5 rounded-md border border-[#222c3c] bg-[#141922] hover:bg-[#1f2735] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Preferences"
          aria-label="Preferences"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
