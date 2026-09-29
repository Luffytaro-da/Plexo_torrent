export const IpcChannels = {
  // Queries & Commands
  LIST_INTERFACES: 'relaytorrent:list-interfaces',
  REFRESH_INTERFACES: 'relaytorrent:refresh-interfaces',
  SET_INTERFACE_ENABLED: 'relaytorrent:set-interface-enabled',
  SET_INTERFACE_PREFERENCE: 'relaytorrent:set-interface-preference',

  INSPECT_TORRENT_METADATA: 'relaytorrent:inspect-torrent-metadata',
  ADD_TORRENT: 'relaytorrent:add-torrent',
  START_TORRENT: 'relaytorrent:start-torrent',
  PAUSE_TORRENT: 'relaytorrent:pause-torrent',
  RESUME_TORRENT: 'relaytorrent:resume-torrent',
  RECHECK_TORRENT: 'relaytorrent:recheck-torrent',
  REMOVE_TORRENT: 'relaytorrent:remove-torrent',

  SET_FILE_PRIORITIES: 'relaytorrent:set-file-priorities',
  SET_TORRENT_INTERFACE_POLICY: 'relaytorrent:set-torrent-interface-policy',
  SET_TORRENT_LIMITS: 'relaytorrent:set-torrent-limits',

  GET_ALL_TORRENTS: 'relaytorrent:get-all-torrents',
  GET_TORRENT_PIECE_STATES: 'relaytorrent:get-torrent-piece-states',
  GET_SETTINGS: 'relaytorrent:get-settings',
  UPDATE_SETTINGS: 'relaytorrent:update-settings',

  CHOOSE_DIRECTORY: 'relaytorrent:choose-directory',
  CHOOSE_TORRENT_FILE: 'relaytorrent:choose-torrent-file',
  REVEAL_IN_FOLDER: 'relaytorrent:reveal-in-folder',

  // Push Events (Main -> Renderer)
  TORRENTS_UPDATED: 'relaytorrent:torrents-updated',
  TELEMETRY_UPDATED: 'relaytorrent:telemetry-updated',
  INTERFACES_UPDATED: 'relaytorrent:interfaces-updated',
  PIECE_STATES_UPDATED: 'relaytorrent:piece-states-updated',
  ENGINE_ERROR: 'relaytorrent:engine-error'
} as const
