import React, { useState } from 'react'
import {
  Folder,
  Settings,
  X,
  Gauge,
  Network,
  HardDrive,
  ShieldCheck,
  Radio,
  Sliders
} from 'lucide-react'
import type { GlobalSettings } from '../../../shared/types'
import { useTorrentStore } from '../store/torrentStore'

type SettingsTab = 'downloads' | 'connection' | 'speed' | 'routing' | 'protocols'

export const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, setSettingsModalOpen, settings, updateSettings } =
    useTorrentStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('downloads')
  const [form, setForm] = useState<Partial<GlobalSettings>>(settings || {})

  // Keep form in sync when settings change
  React.useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings, isSettingsModalOpen])

  if (!isSettingsModalOpen) return null

  const handleSave = async () => {
    await updateSettings(form)
    setSettingsModalOpen(false)
  }

  const handleChooseDirectory = async () => {
    if (!window.relayTorrent) return
    const dir = await window.relayTorrent.chooseDirectory(form.defaultSavePath)
    if (dir) {
      setForm((prev) => ({ ...prev, defaultSavePath: dir }))
    }
  }

  const navItems: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'downloads', label: 'Downloads & Storage', icon: HardDrive },
    { id: 'connection', label: 'Connection & Swarm', icon: Sliders },
    { id: 'speed', label: 'Speed & Bandwidth', icon: Gauge },
    { id: 'routing', label: 'Network Routing', icon: Network },
    { id: 'protocols', label: 'BitTorrent & Privacy', icon: Radio }
  ]

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        {/* Modal Header */}
        <div className="h-12 border-b border-slate-800 px-5 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5 font-bold text-sm text-slate-100">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span>Options & Preferences</span>
          </div>
          <button
            onClick={() => setSettingsModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content - 2 Column Layout (qBittorrent style) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-slate-950/40 border-r border-slate-800 p-2 space-y-1">
            {navItems.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-blue-600/15 text-cyan-400 border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}

            <div className="pt-6 px-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Safe Client</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Sandboxed paths & SHA-1 piece validation active.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 p-5 overflow-y-auto text-xs space-y-5 bg-slate-900">
            {/* DOWNLOADS TAB */}
            {activeTab === 'downloads' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                    Default Destination
                  </h3>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Download Folder
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.defaultSavePath || ''}
                      onChange={(e) => setForm({ ...form, defaultSavePath: e.target.value })}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      onClick={handleChooseDirectory}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3.5 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Folder className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1">
                    Transfer Queue & Behavior
                  </h3>
                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoStartDownloads !== false}
                      onChange={(e) => setForm({ ...form, autoStartDownloads: e.target.checked })}
                      className="accent-cyan-500 rounded"
                    />
                    <span>Start downloads automatically when added</span>
                  </label>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Max Active Downloads
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={form.maxActiveDownloads || 5}
                        onChange={(e) => setForm({ ...form, maxActiveDownloads: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Max Active Seeds
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={form.maxActiveSeeds || 5}
                        onChange={(e) => setForm({ ...form, maxActiveSeeds: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONNECTION TAB */}
            {activeTab === 'connection' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Connection Limits (qBittorrent Style)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Max Connections Per Torrent
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      placeholder="Default: 55"
                      value={form.maxConnsPerTorrent || ''}
                      onChange={(e) =>
                        setForm({ ...form, maxConnsPerTorrent: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Peers connected per swarm (default: 55)</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Global Maximum Connections
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      placeholder="Default: 1000"
                      value={form.maxGlobalConns || ''}
                      onChange={(e) =>
                        setForm({ ...form, maxGlobalConns: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Total swarm connections across all torrents</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1">
                    Listening Port & UPnP
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Port used for incoming connections
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="65535"
                        placeholder="0 = Random/OS Assigned"
                        value={form.listenPort ?? ''}
                        onChange={(e) =>
                          setForm({ ...form, listenPort: e.target.value ? Number(e.target.value) : 0 })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={form.enableUpnp !== false}
                      onChange={(e) => setForm({ ...form, enableUpnp: e.target.checked })}
                      className="accent-cyan-500 rounded"
                    />
                    <span>Use UPnP / NAT-PMP port forwarding from my router</span>
                  </label>
                </div>
              </div>
            )}

            {/* SPEED TAB */}
            {activeTab === 'speed' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Global Rate Limits
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-cyan-400">
                        Max Download Rate (KB/s)
                      </label>
                      <span className="text-[10px] text-slate-500">0 = Unlimited</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 (Unlimited)"
                      value={form.globalDownloadLimit ? form.globalDownloadLimit / 1024 : ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          globalDownloadLimit: e.target.value ? Number(e.target.value) * 1024 : undefined
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-emerald-400">
                        Max Upload Rate (KB/s)
                      </label>
                      <span className="text-[10px] text-slate-500">0 = Unlimited</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 (Unlimited)"
                      value={form.globalUploadLimit ? form.globalUploadLimit / 1024 : ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          globalUploadLimit: e.target.value ? Number(e.target.value) * 1024 : undefined
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-slate-400 text-[11px]">
                  Rate limits apply immediately across all active torrent downloads and uploads without restarting.
                </div>
              </div>
            )}

            {/* ROUTING TAB */}
            {activeTab === 'routing' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Multi-Interface Policy
                </h3>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Default Network Policy for New Torrents
                  </label>
                  <select
                    value={form.defaultInterfacePolicy?.mode || 'automatic'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultInterfacePolicy: { mode: e.target.value as any }
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="automatic">Automatic (Multi-Interface Aggregation across all active NICs)</option>
                    <option value="preferred">Preferred Interface (Priority Route with fallback)</option>
                    <option value="single">Single Interface (Strict Binding)</option>
                  </select>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p>• <strong className="text-slate-300">Automatic:</strong> Aggregates bandwidth across your Wi-Fi and Ethernet adapters simultaneously.</p>
                  <p>• <strong className="text-slate-300">Strict Binding:</strong> Ensures traffic only flows through your designated adapter (e.g. VPN).</p>
                </div>
              </div>
            )}

            {/* PROTOCOLS TAB */}
            {activeTab === 'protocols' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Swarm Discovery & Peer Protocols
                </h3>
                <div className="space-y-3 bg-slate-950/50 p-3.5 border border-slate-800 rounded-xl">
                  <label className="flex items-start gap-2.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enableDht !== false}
                      onChange={(e) => setForm({ ...form, enableDht: e.target.checked })}
                      className="accent-cyan-500 mt-0.5 rounded"
                    />
                    <div>
                      <span className="font-semibold text-xs block">Distributed Hash Table (DHT)</span>
                      <span className="text-[10px] text-slate-500">Find peers without relying strictly on central tracking servers.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-slate-300 cursor-pointer pt-2 border-t border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={form.enablePex !== false}
                      onChange={(e) => setForm({ ...form, enablePex: e.target.checked })}
                      className="accent-cyan-500 mt-0.5 rounded"
                    />
                    <div>
                      <span className="font-semibold text-xs block">Peer Exchange (PEX)</span>
                      <span className="text-[10px] text-slate-500">Discover other active peers directly through connected swarm nodes.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-slate-300 cursor-pointer pt-2 border-t border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={form.enableLsd !== false}
                      onChange={(e) => setForm({ ...form, enableLsd: e.target.checked })}
                      className="accent-cyan-500 mt-0.5 rounded"
                    />
                    <div>
                      <span className="font-semibold text-xs block">Local Service Discovery (LSD)</span>
                      <span className="text-[10px] text-slate-500">Find and peer with fast clients residing on your local network/LAN.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-14 border-t border-slate-800 px-5 flex items-center justify-between bg-slate-950/80">
          <span className="text-[11px] text-slate-500">
            Changes are saved to disk automatically.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsModalOpen(false)}
              className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
