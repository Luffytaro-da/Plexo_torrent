import type { relayTorrentApi } from './index'

declare global {
  interface Window {
    relayTorrent: typeof relayTorrentApi
  }
}
