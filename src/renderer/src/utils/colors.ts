import type { NetworkInterfaceKind, PieceState, TorrentStatus } from '../../../shared/types'

export const STATUS_CONFIG: Record<
  TorrentStatus,
  { label: string; badgeClass: string; textClass: string; dotClass: string }
> = {
  restored: {
    label: 'Restored',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    textClass: 'text-indigo-400',
    dotClass: 'bg-indigo-400'
  },
  downloading: {
    label: 'Downloading',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    textClass: 'text-cyan-400',
    dotClass: 'bg-cyan-400 animate-pulse'
  },
  seeding: {
    label: 'Seeding',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400'
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    textClass: 'text-teal-400',
    dotClass: 'bg-teal-400'
  },
  checking: {
    label: 'Checking',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400 animate-spin'
  },
  paused: {
    label: 'Paused',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    textClass: 'text-slate-400',
    dotClass: 'bg-slate-400'
  },
  stalled: {
    label: 'Stalled',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    textClass: 'text-orange-400',
    dotClass: 'bg-orange-400'
  },
  error: {
    label: 'Error',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400'
  }
}

export const PIECE_STATE_CONFIG: Record<PieceState, { label: string; color: string; bgClass: string }> = {
  verified: { label: 'Verified', color: '#10b981', bgClass: 'bg-emerald-500' },
  downloading: { label: 'Downloading', color: '#06b6d4', bgClass: 'bg-cyan-500' },
  requested: { label: 'Requested', color: '#3b82f6', bgClass: 'bg-blue-500' },
  corrupted: { label: 'Corrupted', color: '#ef4444', bgClass: 'bg-rose-500' },
  skipped: { label: 'Skipped', color: '#64748b', bgClass: 'bg-slate-600' },
  missing: { label: 'Missing', color: '#1e293b', bgClass: 'bg-slate-800' }
}

export function getInterfaceKindBadge(kind: NetworkInterfaceKind): { label: string; class: string } {
  switch (kind) {
    case 'wifi':
      return { label: 'Wi-Fi', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    case 'ethernet':
      return { label: 'Ethernet', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    case 'usb':
      return { label: 'USB Tether', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
    case 'bridge':
      return { label: 'Bridge', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    default:
      return { label: 'Network', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
  }
}
