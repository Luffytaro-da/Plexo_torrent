import React, { useEffect, useState, useRef, useCallback } from 'react'
import { AddTorrentModal } from './components/AddTorrentModal'
import { Header } from './components/Header'
import { NetworksView } from './components/NetworksView'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { TorrentDetailPanel } from './components/TorrentDetail/TorrentDetailPanel'
import { TorrentList } from './components/TorrentList'
import { useTorrentStore } from './store/torrentStore'

export const App: React.FC = () => {
  const {
    fetchInitialData,
    setTorrents,
    setTelemetry,
    setPieceStates,
    viewMode,
    selectedInfoHash,
    settings
  } = useTorrentStore()

  // Apply theme and UI density immediately to root document
  useEffect(() => {
    const root = document.documentElement
    const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('relaytorrent_theme') : null
    const theme = settings?.theme || savedTheme || 'dark'
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.classList.remove('theme-light')
      root.classList.add('dark', 'theme-dark')
    } else {
      root.classList.remove('dark', 'theme-dark')
      root.classList.add('theme-light')
    }

    if (settings?.theme) {
      try {
        localStorage.setItem('relaytorrent_theme', settings.theme)
      } catch {}
    }

    const density = settings?.uiDensity || 'compact'
    root.setAttribute('data-density', density)
  }, [settings?.theme, settings?.uiDensity])

  // React to system color scheme changes if follow-system is active
  useEffect(() => {
    if (settings?.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement
      if (e.matches) {
        root.classList.remove('theme-light')
        root.classList.add('dark', 'theme-dark')
      } else {
        root.classList.remove('dark', 'theme-dark')
        root.classList.add('theme-light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.theme])

  // Dynamic resizable splitter state (percent of content height for TorrentList)
  const [splitPercent, setSplitPercent] = useState<number>(50)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchInitialData()

    if (window.relayTorrent) {
      const unsubTorrents = window.relayTorrent.onTorrentsUpdated((torrents) => {
        setTorrents(torrents)
      })

      const unsubTelemetry = window.relayTorrent.onTelemetryUpdated((telemetry) => {
        setTelemetry(telemetry)
      })

      const unsubPieces = window.relayTorrent.onPieceStatesUpdated((infoHash, pieces) => {
        setPieceStates(infoHash, pieces)
      })

      const unsubError = window.relayTorrent.onEngineError((infoHash, error) => {
        console.warn(`[Engine Error] [${infoHash}]:`, error)
      })

      return () => {
        unsubTorrents()
        unsubTelemetry()
        unsubPieces()
        unsubError()
      }
    }

    return undefined
  }, [fetchInitialData, setTorrents, setTelemetry, setPieceStates])

  // Mouse drag handler for splitter
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const newPercent = (relativeY / rect.height) * 100
      // Clamp between 20% and 80%
      const clamped = Math.max(20, Math.min(80, newPercent))
      setSplitPercent(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div className="flex-1 flex flex-col h-screen w-screen overflow-hidden bg-[#0e1217] text-slate-100 font-sans">
      {/* Header */}
      <Header />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Dynamic Content Area */}
        <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden bg-[#0e1217] relative">
          {viewMode === 'networks' ? (
            <NetworksView />
          ) : (
            <>
              {/* Torrent List Pane */}
              <div
                style={{
                  height: selectedInfoHash ? `${splitPercent}%` : '100%',
                  transition: isDragging ? 'none' : 'height 0.15s ease-out'
                }}
                className="overflow-hidden flex flex-col"
              >
                <TorrentList />
              </div>

              {/* Dynamic Resizable Splitter (Plexo style) */}
              {selectedInfoHash && (
                <div
                  onMouseDown={handleMouseDown}
                  onDoubleClick={() => setSplitPercent(50)}
                  title="Drag to resize pane (double click to reset)"
                  className="h-1.5 bg-[#12161e] hover:bg-cyan-500/20 border-y border-[#1f2735] hover:border-cyan-500/40 cursor-row-resize flex items-center justify-center transition-colors group shrink-0 select-none z-10"
                >
                  <div className="w-10 h-0.5 rounded-full bg-[#2a3648] group-hover:bg-cyan-400 transition-colors" />
                </div>
              )}

              {/* Detail Panel Pane */}
              {selectedInfoHash && (
                <div
                  style={{
                    height: `${100 - splitPercent}%`,
                    transition: isDragging ? 'none' : 'height 0.15s ease-out'
                  }}
                  className="overflow-hidden flex flex-col bg-[#0e1217]"
                >
                  <TorrentDetailPanel />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddTorrentModal />
      <SettingsModal />
    </div>
  )
}
