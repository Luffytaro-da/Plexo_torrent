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
  const confirmedPhysicalCount = interfaces.filter((i) => i.isPhysicallyConfirmed && (i.downloadSpeed > 0 || (i.physicalBytesReceived && i.physicalBytesReceived > 0))).length

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
    <header className="h-14 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 drag-region select-none z-20 relative">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3 no-drag">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            RelayTorrent
          </span>
          <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">
            Multi-Interface Swarm
          </span>
        </div>
      </div>

      {/* Global Speeds & Quick Limit Popovers */}
      <div className="flex items-center gap-6 no-drag relative">
        <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800/80 px-3.5 py-1.5 rounded-full text-xs shadow-inner">
          {/* Download Speed Pill */}
          <button
            onClick={() => setSpeedPopover(speedPopover === 'download' ? null : 'download')}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              speedPopover === 'download'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'hover:bg-slate-800/80 text-slate-200'
            }`}
            title="Click to set download speed limit"
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold font-mono">{formatSpeed(downSpeed)}</span>
            {currentDownloadLimit > 0 && (
              <span className="text-[10px] bg-cyan-950/90 text-cyan-400 px-1.5 py-0.2 rounded font-mono border border-cyan-800/40">
                [max {formatBytes(currentDownloadLimit)}/s]
              </span>
            )}
          </button>

          <div className="w-px h-3 bg-slate-800" />

          {/* Upload Speed Pill */}
          <button
            onClick={() => setSpeedPopover(speedPopover === 'upload' ? null : 'upload')}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
              speedPopover === 'upload'
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'hover:bg-slate-800/80 text-slate-200'
            }`}
            title="Click to set upload speed limit"
          >
            <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold font-mono">{formatSpeed(upSpeed)}</span>
            {currentUploadLimit > 0 && (
              <span className="text-[10px] bg-emerald-950/90 text-emerald-400 px-1.5 py-0.2 rounded font-mono border border-emerald-800/40">
                [max {formatBytes(currentUploadLimit)}/s]
              </span>
            )}
          </button>

          <div className="w-px h-3 bg-slate-800" />

          {/* Interfaces */}
          <div
            onClick={() => setViewMode(viewMode === 'networks' ? 'torrents' : 'networks')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-cyan-400 transition-colors px-1"
            title="Active network interfaces"
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 font-medium">
              <strong className="text-slate-200">{onlineIfaces}</strong> Adapters
              {confirmedPhysicalCount > 1 ? (
                <span className="ml-1 text-[10px] text-emerald-400 font-semibold">({confirmedPhysicalCount} Confirmed)</span>
              ) : onlineIfaces > 1 ? (
                <span className="ml-1 text-[10px] text-amber-400 font-semibold">(1 Confirmed)</span>
              ) : null}
            </span>
          </div>
        </div>

        {/* Speed Limit Popover Dropdown */}
        {speedPopover && (
          <div
            ref={popoverRef}
            className="absolute top-12 left-0 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className={`w-4 h-4 ${speedPopover === 'download' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                <span className="font-bold text-slate-100">
                  Global {speedPopover === 'download' ? 'Download' : 'Upload'} Limit
                </span>
              </div>
              <button
                onClick={() => setSpeedPopover(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {SPEED_PRESETS.map((preset) => {
                  const isSelected = activeLimit === preset.bytes
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleApplyPreset(preset.bytes)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? speedPopover === 'download'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  )
                })}
              </div>

              {/* Custom Input */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
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
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div className="flex border border-slate-700 rounded-lg overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setCustomUnit('KB')}
                      className={`px-2 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                        customUnit === 'KB' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      KB/s
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomUnit('MB')}
                      className={`px-2 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                        customUnit === 'MB' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      MB/s
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Torrent</span>
        </button>

        <button
          onClick={() => setViewMode(viewMode === 'networks' ? 'torrents' : 'networks')}
          className={`p-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
            viewMode === 'networks'
              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Network Adapters"
        >
          <Network className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSettingsModalOpen(true)}
          className="p-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Preferences"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
