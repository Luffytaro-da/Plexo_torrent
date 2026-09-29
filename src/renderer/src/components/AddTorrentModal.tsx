import React, { useState } from 'react'
import {
  FileUp,
  Folder,
  HardDrive,
  Link,
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react'
import type {
  InterfacePolicy,
  TorrentFilePriority,
  TorrentMetadataInspectResult
} from '../../../shared/types'
import { useTorrentStore } from '../store/torrentStore'
import { formatBytes } from '../utils/formatters'

export const AddTorrentModal: React.FC = () => {
  const { isAddModalOpen, setAddModalOpen, settings, interfaces } = useTorrentStore()

  const [tab, setTab] = useState<'magnet' | 'file'>('magnet')
  const [magnetInput, setMagnetInput] = useState('')
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [savePath, setSavePath] = useState(settings?.defaultSavePath || '')
  const [inspectResult, setInspectResult] = useState<TorrentMetadataInspectResult | null>(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startImmediately, setStartImmediately] = useState(true)
  const [policyMode, setPolicyMode] = useState<InterfacePolicy['mode']>('automatic')
  const [targetInterfaceId, setTargetInterfaceId] = useState<string>('')
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set())

  if (!isAddModalOpen) return null

  const handleChooseFile = async () => {
    if (!window.relayTorrent) return
    setError(null)
    const filePath = await window.relayTorrent.chooseTorrentFile()
    if (filePath) {
      setSelectedFilePath(filePath)
      await inspectSource({ type: 'file', filePath })
    }
  }

  const handleChooseDirectory = async () => {
    if (!window.relayTorrent) return
    const dir = await window.relayTorrent.chooseDirectory(savePath)
    if (dir) {
      setSavePath(dir)
    }
  }

  const inspectSource = async (
    source: { type: 'magnet'; uri: string } | { type: 'file'; filePath: string }
  ) => {
    if (!window.relayTorrent) return
    setIsInspecting(true)
    setError(null)
    try {
      const res = await window.relayTorrent.inspectTorrentMetadata(source)
      setInspectResult(res)
      setSelectedFileIndices(new Set(res.files.map((f) => f.index)))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setInspectResult(null)
    } finally {
      setIsInspecting(false)
    }
  }

  const handleMagnetChange = async (val: string) => {
    setMagnetInput(val)
    if (val.trim().startsWith('magnet:?')) {
      await inspectSource({ type: 'magnet', uri: val.trim() })
    }
  }

  const handleAdd = async () => {
    if (!window.relayTorrent) return
    setError(null)

    const source =
      tab === 'magnet'
        ? { type: 'magnet' as const, uri: magnetInput.trim() }
        : { type: 'file' as const, filePath: selectedFilePath! }

    if (tab === 'magnet' && !magnetInput.trim()) {
      setError('Please provide a valid magnet link.')
      return
    }

    if (tab === 'file' && !selectedFilePath) {
      setError('Please choose a .torrent file.')
      return
    }

    const filePriorities: Record<number, TorrentFilePriority> = {}
    if (inspectResult) {
      for (const file of inspectResult.files) {
        filePriorities[file.index] = selectedFileIndices.has(file.index) ? 'normal' : 'skip'
      }
    }

    const policy: InterfacePolicy = {
      mode: policyMode,
      targetInterfaceId: targetInterfaceId || undefined
    }

    try {
      await window.relayTorrent.addTorrent({
        source,
        savePath: savePath || settings?.defaultSavePath || '',
        filePriorities,
        interfacePolicy: policy,
        startImmediately
      })

      // Reset and close
      setAddModalOpen(false)
      setMagnetInput('')
      setSelectedFilePath(null)
      setInspectResult(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }

  const toggleFile = (index: number) => {
    const next = new Set(selectedFileIndices)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    setSelectedFileIndices(next)
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span>Add New Torrent</span>
          </div>
          <button
            onClick={() => setAddModalOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs: Magnet vs File */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/30 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setTab('magnet')}
            className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-colors ${
              tab === 'magnet'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Magnet Link</span>
          </button>
          <button
            onClick={() => setTab('file')}
            className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-colors ${
              tab === 'file'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>.torrent File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Input field */}
          {tab === 'magnet' ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Magnet URI
              </label>
              <textarea
                rows={2}
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetInput}
                onChange={(e) => handleMagnetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Torrent File
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  placeholder="Select a .torrent file..."
                  value={selectedFilePath || ''}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-xs"
                />
                <button
                  onClick={handleChooseFile}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
                >
                  Browse...
                </button>
              </div>
            </div>
          )}

          {/* Loading inspection indicator */}
          {isInspecting && (
            <div className="flex items-center gap-2 text-cyan-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching metadata and analyzing swarm...</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metadata Preview & File List */}
          {inspectResult && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div>
                  <h4 className="font-bold text-slate-100 truncate max-w-md">{inspectResult.name}</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatBytes(inspectResult.totalBytes)} • {inspectResult.numPieces} pieces (
                    {formatBytes(inspectResult.pieceLength)} each)
                  </div>
                </div>
              </div>

              {/* Files checklist */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                  <span>Download Content ({inspectResult.files.length} files)</span>
                  <button
                    onClick={() => {
                      if (selectedFileIndices.size === inspectResult.files.length) {
                        setSelectedFileIndices(new Set())
                      } else {
                        setSelectedFileIndices(new Set(inspectResult.files.map((f) => f.index)))
                      }
                    }}
                    className="text-cyan-400 hover:underline cursor-pointer"
                  >
                    {selectedFileIndices.size === inspectResult.files.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                <div className="max-h-32 overflow-y-auto border border-slate-800 rounded-lg p-2 space-y-1 bg-slate-950">
                  {inspectResult.files.map((file) => (
                    <label
                      key={file.index}
                      className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={selectedFileIndices.has(file.index)}
                          onChange={() => toggleFile(file.index)}
                          className="accent-cyan-500"
                        />
                        <span className="text-slate-300 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono text-[10px] shrink-0">
                        {formatBytes(file.length)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Destination Path */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Destination Folder
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-mono"
              />
              <button
                onClick={handleChooseDirectory}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Choose...</span>
              </button>
            </div>
          </div>

          {/* Network Interface Policy Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Network Routing Policy
              </label>
              <select
                value={policyMode}
                onChange={(e) => setPolicyMode(e.target.value as InterfacePolicy['mode'])}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="automatic">Automatic (All Adapters)</option>
                <option value="preferred">Preferred Adapter</option>
                <option value="single">Single Adapter Only</option>
              </select>
            </div>

            {policyMode !== 'automatic' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Target Adapter
                </label>
                <select
                  value={targetInterfaceId}
                  onChange={(e) => setTargetInterfaceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="">Select an adapter...</option>
                  {interfaces.map((iface) => (
                    <option key={iface.id} value={iface.id}>
                      {iface.label || iface.displayName} ({iface.address})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Start Immediately */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={startImmediately}
              onChange={(e) => setStartImmediately(e.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-slate-300 font-medium">Start download immediately</span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="h-14 border-t border-slate-800 px-4 flex items-center justify-end gap-2 bg-slate-950/60">
          <button
            onClick={() => setAddModalOpen(false)}
            className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            Add Torrent
          </button>
        </div>
      </div>
    </div>
  )
}
