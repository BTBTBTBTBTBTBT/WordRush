import type { DisplayStatus } from '@/lib/admin/studio';

/** Calendar chip / card status colors (kept under app/ so Tailwind sees the class names). */
export const STATUS_LOOK: Record<DisplayStatus, { label: string; chip: string; dot: string }> = {
  draft: { label: 'Draft', chip: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' },
  'needs-bmt': { label: 'Needs BMT', chip: 'bg-purple-50 text-purple-700 ring-purple-200', dot: 'bg-purple-500' },
  'needs-jp': { label: 'Needs JP', chip: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  approved: { label: 'Approved', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  posted: { label: 'Posted', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  failed: { label: 'Failed', chip: 'bg-rose-50 text-rose-600 ring-rose-300', dot: 'bg-rose-500' },
  paused: { label: 'Paused', chip: 'bg-slate-100 text-slate-500 ring-slate-300', dot: 'bg-slate-400' },
};
