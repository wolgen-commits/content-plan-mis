import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const JAKARTA_TZ = 'Asia/Jakarta';

function toJakartaDate(date: string | Date): Date {
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: JAKARTA_TZ }));
}

export function formatDate(date: string | Date | null, fmt = 'dd MMM yyyy') {
  if (!date) return '-';
  return format(toJakartaDate(date), fmt, { locale: id });
}

export function nowInJakarta(): Date {
  return toJakartaDate(new Date());
}

export const STATUS_LABELS: Record<string, string> = {
  draft:            'Draft',
  pending_approval: 'Menunggu Approval',
  approved:         'Disetujui',
  pending_publish:  'Menunggu Publish',
  rejected:         'Ditolak',
  published:        'Published',
};

export const STATUS_COLORS: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-600',
  pending_approval: 'bg-warning-light text-warning',
  approved:         'bg-info-light text-info',
  pending_publish:  'bg-brand-light text-brand',
  rejected:         'bg-danger-light text-danger',
  published:        'bg-teal-100 text-teal-700',
};

export const CHANNEL_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-100 text-pink-700',
  TikTok: 'bg-gray-900 text-white',
  YouTube: 'bg-red-100 text-red-700',
  LinkedIn: 'bg-blue-100 text-blue-700',
  Twitter: 'bg-sky-100 text-sky-700',
  Facebook: 'bg-indigo-100 text-indigo-700',
};

export const KANBAN_COLUMNS = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'design_in_progress', label: 'Design in Progress' },
  { id: 'video_in_progress', label: 'Video in Progress' },
  { id: 'review', label: 'Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
] as const;

export const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'short', 'video', 'thread'] as const;
export const CHANNELS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Website'] as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  post:     'Post',
  reel:     'Reel',
  story:    'Story',
  carousel: 'Carousel',
  short:    'Short',
  video:    'Long Video',
  thread:   'Artikel',
};

// Tipe konten → channel yang tersedia
export const CONTENT_TYPE_CHANNEL_MAP: Record<string, string[]> = {
  post:     ['Facebook', 'Website'],
  reel:     ['Instagram', 'TikTok', 'Facebook'],
  story:    ['Instagram', 'TikTok', 'Facebook'],
  carousel: ['Instagram', 'Facebook'],
  short:    ['YouTube'],
  video:    ['YouTube'],
  thread:   ['Website'],
};
export const WORK_ORDERS = [
  { value: 'designer_first', label: 'Designer Dulu' },
  { value: 'videographer_first', label: 'Videographer Dulu' },
  { value: 'parallel', label: 'Paralel' },
] as const;
