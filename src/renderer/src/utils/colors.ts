import type { NetworkInterfaceKind, PieceState, TorrentStatus } from '../../../shared/types'

export const STATUS_CONFIG: Record<
  TorrentStatus,
  { label: string; badgeClass: string; textClass: string; dotClass: string }
> = {
  restored: {
    label: 'Restored',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    textClass: 'text-indigo-400',
    dotClass: 'bg-indigo-400'
  },
  downloading: {
    label: 'Downloading',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    textClass: 'text-cyan-400',
    dotClass: 'bg-cyan-400 animate-plexo-pulse'
  },
  seeding: {
    label: 'Seeding',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400'
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    textClass: 'text-teal-400',
    dotClass: 'bg-teal-400'
  },
  checking: {
    label: 'Checking',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400 animate-pulse'
  },
  paused: {
    label: 'Paused',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-600/40',
    textClass: 'text-slate-400',
    dotClass: 'bg-slate-500'
  },
  stalled: {
    label: 'Stalled',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    textClass: 'text-orange-400',
    dotClass: 'bg-orange-400'
  },
  error: {
    label: 'Error',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400'
  }
}

export const PIECE_STATE_CONFIG: Record<PieceState, { label: string; color: string; bgClass: string }> = {
  verified: { label: 'Verified', color: '#10b981', bgClass: 'bg-emerald-500' },
  downloading: { label: 'Downloading', color: '#38bdf8', bgClass: 'bg-cyan-400' },
  requested: { label: 'Requested', color: '#818cf8', bgClass: 'bg-indigo-400' },
  corrupted: { label: 'Corrupted', color: '#f87171', bgClass: 'bg-rose-500' },
  skipped: { label: 'Skipped', color: '#64748b', bgClass: 'bg-slate-600' },
  missing: { label: 'Missing', color: '#1e293b', bgClass: 'bg-slate-800' }
}

export function getInterfaceKindBadge(kind: NetworkInterfaceKind): { label: string; class: string } {
  switch (kind) {
    case 'wifi':
      return { label: 'Wi-Fi', class: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' }
    case 'ethernet':
      return { label: 'Ethernet', class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' }
    case 'usb':
      return { label: 'USB Tether', class: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
    case 'bridge':
      return { label: 'Bridge', class: 'bg-slate-500/15 text-slate-300 border-slate-500/30' }
    default:
      return { label: 'Network', class: 'bg-slate-500/15 text-slate-300 border-slate-500/30' }
  }
}
