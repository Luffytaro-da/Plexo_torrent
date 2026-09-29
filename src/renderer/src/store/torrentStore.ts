import { create } from 'zustand'
import type {
  GlobalSettings,
  InterfacePolicy,
  NetworkInterfaceInfo,
  PieceState,
  SystemTelemetry,
  TorrentFilePriority,
  TorrentState
} from '../../../shared/types'

export type NavigationFilter = 'all' | 'downloading' | 'seeding' | 'completed' | 'paused'
export type DetailTab = 'overview' | 'files' | 'pieces' | 'peers' | 'trackers' | 'networks' | 'activity'
export type ViewMode = 'torrents' | 'networks'

interface TorrentStoreState {
  torrents: TorrentState[]
  selectedInfoHash: string | null
  selectedTab: DetailTab
  viewMode: ViewMode
  filterStatus: NavigationFilter
  searchQuery: string
  telemetry: SystemTelemetry | null
  interfaces: NetworkInterfaceInfo[]
  settings: GlobalSettings | null
  isAddModalOpen: boolean
  isSettingsModalOpen: boolean
  pieceStatesMap: Record<string, PieceState[]>

  // Setters
  setTorrents: (torrents: TorrentState[]) => void
  setSelectedInfoHash: (hash: string | null) => void
  setSelectedTab: (tab: DetailTab) => void
  setViewMode: (mode: ViewMode) => void
  setFilterStatus: (filter: NavigationFilter) => void
  setSearchQuery: (query: string) => void
  setTelemetry: (telemetry: SystemTelemetry) => void
  setInterfaces: (interfaces: NetworkInterfaceInfo[]) => void
  setSettings: (settings: GlobalSettings) => void
  setAddModalOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  setPieceStates: (infoHash: string, pieces: PieceState[]) => void

  // Actions
  fetchInitialData: () => Promise<void>
  pauseTorrent: (infoHash: string) => Promise<void>
  resumeTorrent: (infoHash: string) => Promise<void>
  recheckTorrent: (infoHash: string) => Promise<void>
  removeTorrent: (infoHash: string, deleteFiles: boolean) => Promise<void>
  toggleInterface: (id: string, enabled: boolean) => Promise<void>
  refreshInterfaces: () => Promise<void>
  setFilePriorities: (infoHash: string, priorities: Record<number, TorrentFilePriority>) => Promise<void>
  setTorrentInterfacePolicy: (infoHash: string, policy: InterfacePolicy) => Promise<void>
  updateSettings: (patch: Partial<GlobalSettings>) => Promise<void>
}

export const useTorrentStore = create<TorrentStoreState>((set, get) => ({
  torrents: [],
  selectedInfoHash: null,
  selectedTab: 'overview',
  viewMode: 'torrents',
  filterStatus: 'all',
  searchQuery: '',
  telemetry: null,
  interfaces: [],
  settings: null,
  isAddModalOpen: false,
  isSettingsModalOpen: false,
  pieceStatesMap: {},

  setTorrents: (torrents) => {
    set({ torrents })
    // If selected torrent is gone, reset or keep selection
    const { selectedInfoHash } = get()
    if (selectedInfoHash && !torrents.some((t) => t.infoHash === selectedInfoHash)) {
      set({ selectedInfoHash: torrents.length > 0 ? torrents[0].infoHash : null })
    } else if (!selectedInfoHash && torrents.length > 0) {
      set({ selectedInfoHash: torrents[0].infoHash })
    }
  },

  setSelectedInfoHash: (hash) => {
    set({ selectedInfoHash: hash })
    if (hash && window.relayTorrent) {
      void window.relayTorrent.getTorrentPieceStates(hash).then((pieces) => {
        get().setPieceStates(hash, pieces)
      })
    }
  },

  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setViewMode: (viewMode) => set({ viewMode }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setTelemetry: (telemetry) =>
    set((state) => ({
      telemetry,
      interfaces: telemetry.interfaces && telemetry.interfaces.length > 0 ? telemetry.interfaces : state.interfaces
    })),
  setInterfaces: (interfaces) => set({ interfaces }),
  setSettings: (settings) => set({ settings }),
  setAddModalOpen: (isAddModalOpen) => set({ isAddModalOpen }),
  setSettingsModalOpen: (isSettingsModalOpen) => set({ isSettingsModalOpen }),
  setPieceStates: (infoHash, pieces) =>
    set((state) => ({
      pieceStatesMap: { ...state.pieceStatesMap, [infoHash.toLowerCase()]: pieces }
    })),

  fetchInitialData: async () => {
    if (!window.relayTorrent) return
    try {
      const [torrents, ifaces, settings] = await Promise.all([
        window.relayTorrent.getAllTorrents(),
        window.relayTorrent.listInterfaces(),
        window.relayTorrent.getSettings()
      ])
      set({
        torrents,
        interfaces: ifaces,
        settings,
        selectedInfoHash: torrents.length > 0 ? torrents[0].infoHash : null
      })
    } catch (err) {
      console.error('[Store] Failed to fetch initial data:', err)
    }
  },

  pauseTorrent: async (infoHash) => {
    if (window.relayTorrent) {
      await window.relayTorrent.pauseTorrent(infoHash)
    }
  },

  resumeTorrent: async (infoHash) => {
    if (window.relayTorrent) {
      await window.relayTorrent.resumeTorrent(infoHash)
    }
  },

  recheckTorrent: async (infoHash) => {
    if (window.relayTorrent) {
      await window.relayTorrent.recheckTorrent(infoHash)
    }
  },

  removeTorrent: async (infoHash, deleteFiles) => {
    if (window.relayTorrent) {
      await window.relayTorrent.removeTorrent(infoHash, deleteFiles)
    }
  },

  toggleInterface: async (id, enabled) => {
    if (window.relayTorrent) {
      const updated = await window.relayTorrent.setInterfaceEnabled(id, enabled)
      set((state) => ({
        interfaces: updated,
        telemetry: state.telemetry ? { ...state.telemetry, interfaces: updated } : null
      }))
    }
  },

  refreshInterfaces: async () => {
    if (window.relayTorrent) {
      const updated = await window.relayTorrent.refreshInterfaces()
      set((state) => ({
        interfaces: updated,
        telemetry: state.telemetry ? { ...state.telemetry, interfaces: updated } : null
      }))
    }
  },

  setFilePriorities: async (infoHash, priorities) => {
    if (window.relayTorrent) {
      await window.relayTorrent.setFilePriorities(infoHash, priorities)
    }
  },

  setTorrentInterfacePolicy: async (infoHash, policy) => {
    if (window.relayTorrent) {
      await window.relayTorrent.setTorrentInterfacePolicy(infoHash, policy)
    }
  },

  updateSettings: async (patch) => {
    if (window.relayTorrent) {
      const updated = await window.relayTorrent.updateSettings(patch)
      set({ settings: updated })
    }
  }
}))
