import React, { useState, useEffect } from 'react'
import {
  Folder,
  Settings,
  X,
  HardDrive,
  Network,
  Terminal,
  RotateCcw,
  Check,
  Palette,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import type { GlobalSettings } from '../../../shared/types'
import { useTorrentStore } from '../store/torrentStore'

type SettingsTab = 'general' | 'appearance' | 'downloads' | 'connection' | 'diagnostics'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description, disabled }) => (
  <label
    className={`flex items-start justify-between gap-3 py-1.5 cursor-pointer select-none group ${
      disabled ? 'opacity-50 pointer-events-none' : ''
    }`}
  >
    <div className="flex flex-col pr-2">
      <span className="text-xs font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
        {label}
      </span>
      {description && <span className="text-[10px] text-slate-400 leading-tight mt-0.5">{description}</span>}
    </div>
    <div
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden mt-0.5 ${
        checked ? 'bg-cyan-500' : 'bg-slate-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out mt-0.5 ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </div>
  </label>
)

function sanitizeSettings(
  form: Partial<GlobalSettings>,
  currentSettings?: GlobalSettings | null
): Partial<GlobalSettings> {
  const result: Partial<GlobalSettings> = { ...form }

  if (result.defaultSavePath !== undefined) {
    const trimmed = result.defaultSavePath.trim()
    result.defaultSavePath = trimmed || currentSettings?.defaultSavePath || 'C:\\Downloads'
  }

  if (result.maxActiveDownloads !== undefined) {
    const n = Number(result.maxActiveDownloads)
    result.maxActiveDownloads = isNaN(n) ? 5 : Math.max(1, Math.min(100, Math.floor(n)))
  }

  if (result.maxActiveSeeds !== undefined) {
    const n = Number(result.maxActiveSeeds)
    result.maxActiveSeeds = isNaN(n) ? 5 : Math.max(1, Math.min(100, Math.floor(n)))
  }

  if (result.maxGlobalConns !== undefined) {
    const n = Number(result.maxGlobalConns)
    result.maxGlobalConns = isNaN(n) ? 200 : Math.max(10, Math.min(5000, Math.floor(n)))
  }

  if (result.maxConnsPerTorrent !== undefined) {
    const n = Number(result.maxConnsPerTorrent)
    result.maxConnsPerTorrent = isNaN(n) ? 55 : Math.max(1, Math.min(500, Math.floor(n)))
  }

  if (result.listenPort !== undefined) {
    const n = Number(result.listenPort)
    result.listenPort = isNaN(n) ? 6881 : Math.max(0, Math.min(65535, Math.floor(n)))
  }

  if (result.globalDownloadLimit !== undefined) {
    const n = Number(result.globalDownloadLimit)
    result.globalDownloadLimit = isNaN(n) || (n < 0 && n !== -1) ? -1 : Math.floor(n)
  }

  if (result.globalUploadLimit !== undefined) {
    const n = Number(result.globalUploadLimit)
    result.globalUploadLimit = isNaN(n) || (n < 0 && n !== -1) ? -1 : Math.floor(n)
  }

  return result
}

export const SettingsModal: React.FC = () => {
  const { isSettingsModalOpen, setSettingsModalOpen, settings, updateSettings, resetSettings } =
    useTorrentStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [form, setForm] = useState<Partial<GlobalSettings>>(settings || {})
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  // Seed form when modal opens
  useEffect(() => {
    if (isSettingsModalOpen && settings) {
      setForm({ ...settings })
    }
  }, [isSettingsModalOpen])

  // Sync if settings load after modal is already open
  useEffect(() => {
    if (isSettingsModalOpen && settings && Object.keys(form).length === 0) {
      setForm({ ...settings })
    }
  }, [settings, isSettingsModalOpen])

  if (!isSettingsModalOpen) return null

  const handleApply = async () => {
    try {
      setErrorNotice(null)
      const sanitized = sanitizeSettings(form, settings)
      await updateSettings(sanitized)
      setAppliedNotice('Applied')
      setTimeout(() => setAppliedNotice(null), 2500)
    } catch (err: any) {
      console.error('[Settings] Apply error:', err)
      setErrorNotice(err?.message || 'Failed to apply settings')
      setTimeout(() => setErrorNotice(null), 4000)
    }
  }

  const handleSaveAndClose = async () => {
    try {
      setErrorNotice(null)
      const sanitized = sanitizeSettings(form, settings)
      await updateSettings(sanitized)
      setSettingsModalOpen(false)
    } catch (err: any) {
      console.error('[Settings] Save error:', err)
      setErrorNotice(err?.message || 'Failed to save settings')
    }
  }

  const handleCancel = () => {
    if (settings) {
      setForm({ ...settings })
      // Revert any unapplied visual theme preview
      const root = document.documentElement
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
      if (isDark) {
        root.classList.remove('theme-light')
        root.classList.add('dark', 'theme-dark')
      } else {
        root.classList.remove('dark', 'theme-dark')
        root.classList.add('theme-light')
      }
    }
    setSettingsModalOpen(false)
  }

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
    setForm((prev) => ({ ...prev, theme: newTheme }))
    // Immediate visual theme preview
    const root = document.documentElement
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    if (isDark) {
      root.classList.remove('theme-light')
      root.classList.add('dark', 'theme-dark')
    } else {
      root.classList.remove('dark', 'theme-dark')
      root.classList.add('theme-light')
    }
  }

  const handleResetSection = async () => {
    try {
      setErrorNotice(null)
      if (resetSettings) {
        const updated = await resetSettings(activeTab)
        if (updated) {
          setForm({ ...updated })
          setAppliedNotice(`Reset ${activeTab}`)
          setTimeout(() => setAppliedNotice(null), 2500)
        }
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to reset section')
    }
  }

  const handleResetAll = async () => {
    if (window.confirm('Reset all settings to default values?')) {
      try {
        setErrorNotice(null)
        if (resetSettings) {
          const updated = await resetSettings('all')
          if (updated) {
            setForm({ ...updated })
            setAppliedNotice('All Reset')
            setTimeout(() => setAppliedNotice(null), 2500)
          }
        }
      } catch (err: any) {
        setErrorNotice(err?.message || 'Failed to reset settings')
      }
    }
  }

  const handleChooseDirectory = async () => {
    if (!window.relayTorrent) return
    const dir = await window.relayTorrent.chooseDirectory(form.defaultSavePath)
    if (dir) {
      setForm((prev) => ({ ...prev, defaultSavePath: dir }))
    }
  }

  const navItems: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'downloads', label: 'Downloads', icon: HardDrive },
    { id: 'connection', label: 'Connection', icon: Network },
    { id: 'diagnostics', label: 'Diagnostics', icon: Terminal }
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#141922] border border-[#273244] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[560px]">
        {/* Modal Header */}
        <div className="h-10 border-b border-[#1f2735] px-3.5 flex items-center justify-between bg-[#11161d] shrink-0">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-100">
            <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Settings className="w-3 h-3 text-cyan-400" />
            </div>
            <span>Preferences & Settings</span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded hover:bg-[#1a212d] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Content - 2 Column Layout (qBittorrent desktop style) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-40 bg-[#11161d] border-r border-[#1f2735] p-2 space-y-0.5 shrink-0 flex flex-col justify-between">
            <div className="space-y-0.5">
              {navItems.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-[#18212e] text-cyan-300 font-semibold border border-[#2a3a50]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151b24] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="p-2 rounded-lg bg-[#0e1217] border border-[#1f2735] text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-emerald-400">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>Engine Protected</span>
              </div>
              <p className="leading-tight text-slate-500">
                Atomic persistence active. Settings survive restart.
              </p>
            </div>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 p-4 overflow-y-auto text-xs space-y-4 bg-[#0e1217] select-text">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                {/* Default Storage Location (also fulfills test and immediate access) */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-xs text-slate-200">Default Download Directory</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.defaultSavePath || ''}
                      onChange={(e) => setForm({ ...form, defaultSavePath: e.target.value })}
                      className="flex-1 bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                    />
                    <button
                      onClick={handleChooseDirectory}
                      className="bg-[#1a212d] hover:bg-[#222c3c] text-slate-200 font-medium px-3 py-1 rounded border border-[#283548] flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
                    >
                      <Folder className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                {/* System & Startup Behavior */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Startup & Desktop Integration
                  </div>
                  <ToggleSwitch
                    checked={!!form.startWithWindows}
                    onChange={(checked) => setForm({ ...form, startWithWindows: checked })}
                    label="Start RelayTorrent on Windows startup"
                    description="Launch client automatically when logging into Windows"
                  />
                  <ToggleSwitch
                    checked={!!form.startMinimized}
                    onChange={(checked) => setForm({ ...form, startMinimized: checked })}
                    label="Start minimized"
                    description="Start client in background or system tray without opening main window"
                  />
                  <ToggleSwitch
                    checked={!!form.minimizeToTray}
                    onChange={(checked) => setForm({ ...form, minimizeToTray: checked })}
                    label="Minimize to system tray"
                    description="Keep RelayTorrent running in system notification area when minimized"
                  />
                  <ToggleSwitch
                    checked={!!form.closeToTray}
                    onChange={(checked) => setForm({ ...form, closeToTray: checked })}
                    label="Close to system tray"
                    description="Closing window hides to tray instead of quitting application"
                  />
                </div>

                {/* Automation & Confirmations */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Automation & Confirmations
                  </div>
                  <ToggleSwitch
                    checked={form.autoStartRestoredTorrents !== false}
                    onChange={(checked) => setForm({ ...form, autoStartRestoredTorrents: checked })}
                    label="Automatically start restored torrents"
                    description="Resume previously active downloads upon application launch"
                  />
                  <ToggleSwitch
                    checked={form.autoStartDownloads !== false}
                    onChange={(checked) => setForm({ ...form, autoStartDownloads: checked })}
                    label="Automatically start newly added torrents"
                    description="Begin downloading immediately without manual resume"
                  />
                  <ToggleSwitch
                    checked={form.confirmTorrentRemoval !== false}
                    onChange={(checked) => setForm({ ...form, confirmTorrentRemoval: checked })}
                    label="Confirm before removing a torrent"
                    description="Display confirmation dialog when removing transfers from list"
                  />
                  <ToggleSwitch
                    checked={form.confirmDataDeletion !== false}
                    onChange={(checked) => setForm({ ...form, confirmDataDeletion: checked })}
                    label="Confirm before deleting torrent data"
                    description="Prompt confirmation before permanently deleting files from disk"
                  />
                </div>

                {/* Desktop Notifications */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Notifications
                  </div>
                  <ToggleSwitch
                    checked={form.showCompletionNotifications !== false}
                    onChange={(checked) => setForm({ ...form, showCompletionNotifications: checked })}
                    label="Show completion notifications"
                    description="Display Windows desktop toast when a download finishes"
                  />
                  <ToggleSwitch
                    checked={form.showErrorNotifications !== false}
                    onChange={(checked) => setForm({ ...form, showErrorNotifications: checked })}
                    label="Show error notifications"
                    description="Display notification if a transfer or network engine error occurs"
                  />
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-3">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Theme & Visual Styling
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-200 block">Color Theme</label>
                      <span className="text-[10px] text-slate-400">Choose between dark navy, light, or system appearance</span>
                    </div>
                    <select
                      value={form.theme || 'dark'}
                      onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light' | 'system')}
                      className="bg-[#0e1217] border border-[#242f40] rounded px-3 py-1 text-slate-200 text-xs font-medium focus:border-cyan-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="dark">Dark (Navy / Default)</option>
                      <option value="light">Light</option>
                      <option value="system">Follow System</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#1f2735]">
                    <div>
                      <label className="text-xs font-medium text-slate-200 block">Interface Density</label>
                      <span className="text-[10px] text-slate-400">Compact desktop layout or standard spacious layout</span>
                    </div>
                    <select
                      value={form.uiDensity || 'compact'}
                      onChange={(e) => setForm({ ...form, uiDensity: e.target.value as 'standard' | 'compact' })}
                      className="bg-[#0e1217] border border-[#242f40] rounded px-3 py-1 text-slate-200 text-xs font-medium focus:border-cyan-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="compact">Compact (Plexo Density)</option>
                      <option value="standard">Standard</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Live Application Preview</div>
                  <p>
                    Theme and density adjustments apply immediately to document roots and persist across application restarts.
                  </p>
                </div>
              </div>
            )}

            {/* DOWNLOADS TAB */}
            {activeTab === 'downloads' && (
              <div className="space-y-4">
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Destination Folder
                  </div>
                  <label className="block text-[11px] font-medium text-slate-400">
                    Default Download Directory
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.defaultSavePath || ''}
                      onChange={(e) => setForm({ ...form, defaultSavePath: e.target.value })}
                      className="flex-1 bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                    />
                    <button
                      onClick={handleChooseDirectory}
                      className="bg-[#1a212d] hover:bg-[#222c3c] text-slate-200 font-medium px-3 py-1 rounded border border-[#283548] flex items-center gap-1.5 cursor-pointer text-xs shrink-0"
                    >
                      <Folder className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Completion & Queue
                  </div>
                  <ToggleSwitch
                    checked={!!form.openFolderOnCompletion}
                    onChange={(checked) => setForm({ ...form, openFolderOnCompletion: checked })}
                    label="Open destination folder after completion"
                    description="Reveal downloaded files in Windows Explorer when all pieces are verified"
                  />
                  <ToggleSwitch
                    checked={form.autoStartDownloads !== false}
                    onChange={(checked) => setForm({ ...form, autoStartDownloads: checked })}
                    label="Automatically start added torrents"
                    description="Set newly queued torrents into active downloading state"
                  />

                  <div className="grid grid-cols-2 gap-3 pt-2 mt-2 border-t border-[#1f2735]">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Max Active Downloads
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.maxActiveDownloads ?? 5}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, maxActiveDownloads: v === '' ? undefined : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Max Active Seeds
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.maxActiveSeeds ?? 5}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, maxActiveSeeds: v === '' ? undefined : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONNECTION TAB */}
            {activeTab === 'connection' && (
              <div className="space-y-4">
                {/* Listening Port */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Listening Port & NAT
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-200 block">Incoming Peer Port</label>
                      <span className="text-[10px] text-slate-400">Port used for incoming BitTorrent peer connections</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="65535"
                      value={form.listenPort ?? 6881}
                      onChange={(e) => {
                        const v = e.target.value
                        setForm((prev) => ({ ...prev, listenPort: v === '' ? undefined : parseInt(v, 10) }))
                      }}
                      className="w-24 bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden text-right"
                    />
                  </div>
                  <ToggleSwitch
                    checked={form.enableUpnp !== false}
                    onChange={(checked) => setForm({ ...form, enableUpnp: checked })}
                    label="Enable UPnP / NAT-PMP port forwarding"
                    description="Automatically map incoming ports on supported routers"
                  />
                </div>

                {/* Swarm & Limits */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Peer Connection Limits
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Global Max Connections
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="5000"
                        value={form.maxGlobalConns ?? 200}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, maxGlobalConns: v === '' ? undefined : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Max Peers Per Torrent
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={form.maxConnsPerTorrent ?? 55}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, maxConnsPerTorrent: v === '' ? undefined : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Speed Throttles */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Transfer Rate Limits (Bytes/sec, -1 = unlimited)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Global Download Limit
                      </label>
                      <input
                        type="number"
                        value={form.globalDownloadLimit ?? -1}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, globalDownloadLimit: v === '' ? -1 : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-medium block">
                        Global Upload Limit
                      </label>
                      <input
                        type="number"
                        value={form.globalUploadLimit ?? -1}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((prev) => ({ ...prev, globalUploadLimit: v === '' ? -1 : parseInt(v, 10) }))
                        }}
                        className="mt-1 w-full bg-[#0e1217] border border-[#242f40] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Protocols */}
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Swarm Discovery Protocols
                  </div>
                  <ToggleSwitch
                    checked={form.enableDht !== false}
                    onChange={(checked) => setForm({ ...form, enableDht: checked })}
                    label="Enable Distributed Hash Table (DHT)"
                    description="Locate trackerless peers using the global decentralized BitTorrent DHT"
                  />
                  <ToggleSwitch
                    checked={form.enablePex !== false}
                    onChange={(checked) => setForm({ ...form, enablePex: checked })}
                    label="Enable Peer Exchange (PEX)"
                    description="Exchange peer lists directly with connected clients in the swarm"
                  />
                  <ToggleSwitch
                    checked={form.enableLsd !== false}
                    onChange={(checked) => setForm({ ...form, enableLsd: checked })}
                    label="Enable Local Peer Discovery (LSD)"
                    description="Broadcast and peer with fast clients situated on your local subnet"
                  />
                </div>
              </div>
            )}

            {/* DIAGNOSTICS TAB */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-4">
                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-xs text-slate-200 pb-1 border-b border-[#1f2735]">
                    Telemetry & Diagnostic Tracking
                  </div>
                  <ToggleSwitch
                    checked={!!form.enableDiagnosticLogging}
                    onChange={(checked) => setForm({ ...form, enableDiagnosticLogging: checked })}
                    label="Enable diagnostic logging"
                    description="Log engine scheduler events and verification traces for debugging"
                  />
                  <ToggleSwitch
                    checked={!!form.enableRoutingDiagnostics}
                    onChange={(checked) => setForm({ ...form, enableRoutingDiagnostics: checked })}
                    label="Enable routing diagnostics"
                    description="Poll real-time hardware NDIS counters and per-interface routing metrics"
                  />
                  <ToggleSwitch
                    checked={!!form.enableVerbosePeerDiagnostics}
                    onChange={(checked) => setForm({ ...form, enableVerbosePeerDiagnostics: checked })}
                    label="Enable verbose peer diagnostics"
                    description="Track socket local address attribution and handshake results for every peer connection"
                  />
                </div>

                <div className="bg-[#141922] border border-[#212936] rounded-lg p-3 space-y-1 text-slate-400 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Privacy & Performance Note</span>
                  </div>
                  <p>
                    All diagnostic options are disabled by default. Enabling verbose logging increases CPU and memory overhead during high-bandwidth multi-interface transfers.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer (qBittorrent style: Reset, Cancel, Apply, OK) */}
        <div className="h-12 border-t border-[#1f2735] px-4 flex items-center justify-between bg-[#11161d] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSection}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#242f40] hover:bg-[#1a212d] text-slate-300 text-xs font-medium cursor-pointer transition-colors"
              title={`Reset ${activeTab} section to default`}
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset Section</span>
            </button>
            <button
              onClick={handleResetAll}
              className="px-2 py-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 text-xs transition-colors cursor-pointer"
              title="Reset all settings to default"
            >
              Reset All
            </button>
            {errorNotice && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 animate-in fade-in max-w-xs truncate" title={errorNotice}>
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{errorNotice}</span>
              </span>
            )}
            {appliedNotice && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 animate-in fade-in">
                <Check className="w-3 h-3" />
                <span>{appliedNotice}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3.5 py-1 rounded border border-[#242f40] hover:bg-[#1a212d] text-slate-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3.5 py-1 rounded border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
