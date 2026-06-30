'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { ContentPlanFormModal } from '@/components/ui/ContentPlanFormModal';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths,
} from 'date-fns';
import { CHANNELS, STATUS_LABELS, CONTENT_TYPE_LABELS } from '@/lib/utils';
import { ContentPlan, ContentPlanTask, ContentStatus } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';

type PageTab = 'plans' | 'calendar' | 'tasks';
const ALL_STATUSES = Object.keys(STATUS_LABELS) as ContentStatus[];

/* ── Helpers ── */
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeMeta(ct: string | string[]) {
  const types = Array.isArray(ct) ? ct : [ct];
  const isVideo = types.some(t => ['video', 'short', 'reel'].includes(t));
  const label = types.map(t => CONTENT_TYPE_LABELS[t] ?? t).join(', ') || '—';
  if (isVideo) {
    return {
      label,
      color: 'bg-red-50 text-red-600 border border-red-200',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
      ),
    };
  }
  return {
    label,
    color: 'bg-purple-50 text-purple-600 border border-purple-200',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  };
}

/* ── Status colors ── */
const STATUS_BTN: Record<string, string> = {
  draft:            'bg-gray-500 hover:bg-gray-600',
  pending_approval: 'bg-amber-500 hover:bg-amber-600',
  approved:         'bg-emerald-500 hover:bg-emerald-600',
  pending_publish:  'bg-brand hover:bg-brand-dark',
  rejected:         'bg-red-500 hover:bg-red-600',
  published:        'bg-teal-500 hover:bg-teal-600',
};

const STATUS_CAL: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved:         'bg-emerald-100 text-emerald-700',
  pending_publish:  'bg-pink-100 text-pink-700',
  rejected:         'bg-red-100 text-red-600',
  published:        'bg-teal-100 text-teal-700',
};

const STATUS_DOT: Record<string, string> = {
  draft:            '#A1A1AA',
  pending_approval: '#F59E0B',
  approved:         '#16A34A',
  pending_publish:  '#BB2649',
  rejected:         '#DC2626',
  published:        '#0D9488',
};

/* ── Task status colors (for task calendar) ── */
const TASK_STATUS_COLOR = {
  pending:   { bg: 'bg-gray-100',    text: 'text-gray-600',   dot: 'bg-gray-400',    label: 'Belum Dikerjakan' },
  submitted: { bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-400',   label: 'Diajukan' },
  done:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500', label: 'Selesai' },
} as const;

/* ── SVG icons ── */
const IcoEye      = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoEdit     = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoSend     = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoCheck    = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX        = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoUpload   = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const IcoTrash    = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IcoGlobe    = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;

/* ── ActionDropdown ── */
interface MenuItem { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean; }

function ActionDropdown({ plan, items }: { plan: ContentPlan; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnColor = STATUS_BTN[plan.status] ?? 'bg-gray-500 hover:bg-gray-600';

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div>
      <button ref={btnRef} type="button" onClick={toggle}
        className={`w-7 h-7 rounded-md flex items-center justify-center text-white transition-colors ${btnColor}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 bg-white rounded-card border border-gray-200 shadow-xl py-1 overflow-hidden">
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerBefore && <div className="border-t border-gray-100 my-1" />}
              <button type="button" onClick={() => { setOpen(false); item.onClick(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors text-left ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <span className={`flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── TH ── */
function TH({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <th className={`px-3 py-[9px] text-left text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400 border-b border-gray-200 whitespace-nowrap ${wide ? 'min-w-[180px]' : ''}`}>
      {children}
    </th>
  );
}

/* ── CalendarView ── */
const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const CHANNEL_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  Instagram: { bg: 'bg-pink-100',   text: 'text-pink-700',   dot: 'bg-pink-400' },
  TikTok:    { bg: 'bg-gray-900',   text: 'text-white',      dot: 'bg-gray-400' },
  YouTube:   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400'  },
  Facebook:  { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  Website:   { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400' },
};

interface CalPopover {
  dateKey: string;
  channel: string;
  plans: ContentPlan[];
  rect: DOMRect;
}

function CalendarView({ plans }: { plans: ContentPlan[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popover, setPopover] = useState<CalPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  // plansByDate: date key → list of plans
  const plansByDate = useMemo(() => {
    const map = new Map<string, ContentPlan[]>();
    for (const plan of plans) {
      if (!plan.scheduled_date) continue;
      const key = format(new Date(plan.scheduled_date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(plan);
    }
    return map;
  }, [plans]);

  // channelsByDate: date key → { channel → plans[] }
  const channelsByDate = useMemo(() => {
    const map = new Map<string, Map<string, ContentPlan[]>>();
    plansByDate.forEach((dayPlans, dateKey) => {
      const channelMap = new Map<string, ContentPlan[]>();
      dayPlans.forEach(plan => {
        const channels = Array.isArray(plan.channel) ? plan.channel : (plan.channel ? [plan.channel] : []);
        channels.forEach(ch => {
          if (!channelMap.has(ch)) channelMap.set(ch, []);
          channelMap.get(ch)!.push(plan);
        });
      });
      map.set(dateKey, channelMap);
    });
    return map;
  }, [plansByDate]);

  const monthLabel = `${MONTH_ID[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const activeChannels = useMemo(() => {
    const set = new Set<string>();
    channelsByDate.forEach((_, dateKey) => {
      if (isSameMonth(new Date(dateKey), currentMonth)) {
        channelsByDate.get(dateKey)?.forEach((_, ch) => set.add(ch));
      }
    });
    return Array.from(set).sort();
  }, [channelsByDate, currentMonth]);

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setPopover(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  function openPopover(e: React.MouseEvent<HTMLButtonElement>, dateKey: string, channel: string, chPlans: ContentPlan[]) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover(prev =>
      prev?.dateKey === dateKey && prev?.channel === channel ? null : { dateKey, channel, plans: chPlans, rect }
    );
  }

  // Compute popover position: prefer below, flip up if near bottom
  const popoverStyle = useMemo((): React.CSSProperties => {
    if (!popover) return {};
    const { rect } = popover;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 220 ? rect.bottom + 6 : rect.top - 6;
    const translateY = spaceBelow > 220 ? '0' : '-100%';
    let left = rect.left;
    if (left + 240 > window.innerWidth) left = window.innerWidth - 248;
    return { position: 'fixed', top, left, transform: `translateY(${translateY})`, zIndex: 9999 };
  }, [popover]);

  return (
    <div className="bg-white rounded-card border border-gray-200 overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-[15px] font-bold text-gray-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setPopover(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => { setCurrentMonth(new Date()); setPopover(null); }}
            className="px-3 h-8 text-[12px] font-medium rounded-md hover:bg-gray-100 text-gray-600 transition-colors">
            Hari ini
          </button>
          <button onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setPopover(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayPlans = plansByDate.get(key) ?? [];
          const channelMap = channelsByDate.get(key);
          const isToday = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, currentMonth);
          const totalPlans = dayPlans.length;

          return (
            <div key={idx}
              className={`min-h-[120px] p-2 border-b border-gray-100 ${!inMonth ? 'bg-gray-50/60' : ''}`}>

              {/* Day number + total */}
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium ${
                  isToday ? 'bg-brand text-white font-bold' : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>
                {totalPlans > 0 && (
                  <span className="text-[9px] font-bold text-gray-400 leading-none">{totalPlans} plan</span>
                )}
              </div>

              {/* Channel pills — clickable */}
              {channelMap && channelMap.size > 0 && (
                <div className="flex flex-col gap-0.5">
                  {Array.from(channelMap.entries()).map(([ch, chPlans]) => {
                    const c = CHANNEL_COLOR[ch] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
                    const isActive = popover?.dateKey === key && popover?.channel === ch;
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={e => openPopover(e, key, ch, chPlans)}
                        className={`flex items-center justify-between px-1.5 py-[3px] rounded text-[10px] font-semibold w-full text-left transition-opacity hover:opacity-80 ${c.bg} ${c.text} ${isActive ? 'ring-2 ring-offset-1 ring-brand/40' : ''}`}
                      >
                        <span className="truncate">{ch}</span>
                        <span className={`ml-1 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${c.dot} text-white`}>
                          {chPlans.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeChannels.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Channel:</span>
          {activeChannels.map(ch => {
            const c = CHANNEL_COLOR[ch] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
            return (
              <div key={ch} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${c.dot}`} />
                <span className="text-[10px] text-gray-600">{ch}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Channel popover */}
      {popover && typeof document !== 'undefined' && createPortal(
        <div ref={popoverRef} style={popoverStyle}
          className="w-60 bg-white rounded-card border border-gray-200 shadow-xl overflow-hidden">
          {/* Popover header */}
          <div className={`flex items-center justify-between px-3 py-2 ${CHANNEL_COLOR[popover.channel]?.bg ?? 'bg-gray-100'}`}>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${CHANNEL_COLOR[popover.channel]?.dot ?? 'bg-gray-400'}`} />
              <span className={`text-[11px] font-bold ${CHANNEL_COLOR[popover.channel]?.text ?? 'text-gray-700'}`}>
                {popover.channel}
              </span>
            </div>
            <span className={`text-[10px] font-semibold ${CHANNEL_COLOR[popover.channel]?.text ?? 'text-gray-500'}`}>
              {new Date(popover.dateKey + 'T00:00:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {/* Plan list */}
          <div className="py-1 max-h-56 overflow-y-auto">
            {popover.plans.map(plan => (
              <Link key={plan.id} href={`/content-plans/${plan.id}`}
                onClick={() => setPopover(null)}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors group">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CAL[plan.status] ? '' : 'bg-gray-300'}`}
                  style={{ background: STATUS_DOT[plan.status] ?? '#A1A1AA' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 truncate group-hover:text-brand">
                    {plan.title}
                  </p>
                  <p className="text-[10px] text-gray-400">{STATUS_LABELS[plan.status as ContentStatus] ?? plan.status}</p>
                </div>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-brand flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Task Calendar View ── */
type TaskWithPlan = ContentPlanTask & { planTitle: string; planId: string };

function TaskCalendarView({ plans }: { plans: ContentPlan[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [popover, setPopover] = useState<{ dateKey: string; tasks: TaskWithPlan[]; rect: DOMRect } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const allTasks = useMemo<TaskWithPlan[]>(() => {
    const result: TaskWithPlan[] = [];
    for (const plan of plans) {
      for (const task of (plan.tasks ?? []) as ContentPlanTask[]) {
        if (task.deadline) result.push({ ...task, planTitle: plan.title, planId: plan.id });
      }
    }
    return result;
  }, [plans]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithPlan[]>();
    for (const task of allTasks) {
      const key = task.deadline.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [allTasks]);

  const monthLabel = `${MONTH_ID[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  useEffect(() => {
    if (!popover) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setPopover(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  const popoverStyle = useMemo((): React.CSSProperties => {
    if (!popover) return {};
    const { rect } = popover;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 240 ? rect.bottom + 6 : rect.top - 6;
    const translateY = spaceBelow > 240 ? '0' : '-100%';
    let left = rect.left;
    if (left + 268 > window.innerWidth) left = window.innerWidth - 276;
    return { position: 'fixed', top, left, transform: `translateY(${translateY})`, zIndex: 9999 };
  }, [popover]);

  return (
    <div className="bg-white rounded-card border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-[15px] font-bold text-gray-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setPopover(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => { setCurrentMonth(new Date()); setPopover(null); }}
            className="px-3 h-8 text-[12px] font-medium rounded-md hover:bg-gray-100 text-gray-600 transition-colors">
            Hari ini
          </button>
          <button onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setPopover(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, currentMonth);
          const shown = dayTasks.slice(0, 3);
          const extra = dayTasks.length - 3;

          return (
            <div key={idx} className={`min-h-[120px] p-2 border-b border-gray-100 ${!inMonth ? 'bg-gray-50/60' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium ${
                  isToday ? 'bg-brand text-white font-bold' : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>
                {dayTasks.length > 0 && (
                  <span className="text-[9px] font-bold text-gray-400 leading-none">{dayTasks.length} task</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {shown.map(task => {
                  const c = TASK_STATUS_COLOR[task.status as keyof typeof TASK_STATUS_COLOR] ?? TASK_STATUS_COLOR.pending;
                  return (
                    <Link key={task.id} href={`/content-plans/${task.planId}`}
                      className={`flex items-center gap-1 px-1.5 py-[3px] rounded text-[10px] font-medium w-full truncate hover:opacity-80 transition-opacity ${c.bg} ${c.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                      <span className="truncate">{task.name}</span>
                    </Link>
                  );
                })}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPopover(prev => prev?.dateKey === key ? null : { dateKey: key, tasks: dayTasks, rect });
                    }}
                    className="text-[10px] text-gray-400 hover:text-brand text-left px-1.5 py-[2px] transition-colors">
                    +{extra} lainnya
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status Task:</span>
        {(Object.entries(TASK_STATUS_COLOR) as [string, typeof TASK_STATUS_COLOR[keyof typeof TASK_STATUS_COLOR]][]).map(([, c]) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${c.dot}`} />
            <span className="text-[10px] text-gray-600">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Popover */}
      {popover && typeof document !== 'undefined' && createPortal(
        <div ref={popoverRef} style={popoverStyle}
          className="w-64 bg-white rounded-card border border-gray-200 shadow-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <p className="text-[12px] font-semibold text-gray-800">
              {new Date(popover.dateKey + 'T00:00:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{popover.tasks.length} task deadline</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {popover.tasks.map(task => {
              const c = TASK_STATUS_COLOR[task.status as keyof typeof TASK_STATUS_COLOR] ?? TASK_STATUS_COLOR.pending;
              return (
                <Link key={task.id} href={`/content-plans/${task.planId}`}
                  onClick={() => setPopover(null)}
                  className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors group">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 truncate group-hover:text-brand">{task.name}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{task.planTitle}</p>
                    {(task as TaskWithPlan & { pic?: string }).pic && (
                      <p className="text-[10px] text-gray-400">PIC: {(task as TaskWithPlan & { pic?: string }).pic}</p>
                    )}
                  </div>
                  <span className={`mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${c.bg} ${c.text}`}>{c.label}</span>
                </Link>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── WIB formatter ── */
function fmtWIB(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const s = new Date(d).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
    return s.replace(/\./g, ':') + ' WIB';
  } catch { return d; }
}

/* ── Task status badge (dynamic) ── */
interface TaskBadge { label: string; bg: string; text: string; dot: string }
function getTaskBadge(status: string, submitCount: number, revisionCount: number): TaskBadge {
  if (status === 'done') {
    return { label: 'Disetujui', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  }
  if (status === 'submitted') {
    const n = submitCount > 0 ? submitCount : 1;
    return { label: `Diajukan #${n}`, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  }
  if (status === 'pending' && revisionCount > 0) {
    return { label: `Perlu Revisi #${revisionCount}`, bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' };
  }
  return { label: 'Belum Dikerjakan', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' };
}

interface TaskRow {
  id: string;
  name: string;
  deadline: string | null;
  pic: string | null;
  pic_user_id: string | null;
  status: string;
  submit_count: number;
  revision_count: number;
  file_url: string | null;
  file_name: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  created_at: string | null;
  approved_at: string | null;
  content_plan: { id: string; title: string; status: string; created_by: string } | null;
}

/* ── Task history modal ── */
interface TaskLog {
  id: string;
  event_type: 'created' | 'submitted' | 'revision_requested' | 'approved';
  event_number: number | null;
  notes: string | null;
  actor_name: string | null;
  created_at: string;
}

const LOG_META: Record<string, { label: (n?: number | null) => string; color: string; icon: React.ReactNode }> = {
  created: {
    label: () => 'Task Dibuat',
    color: 'bg-blue-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  },
  submitted: {
    label: (n) => `Submit #${n ?? 1}`,
    color: 'bg-amber-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  },
  revision_requested: {
    label: (n) => `Revisi #${n ?? 1}`,
    color: 'bg-orange-400',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  approved: {
    label: () => 'Disetujui',
    color: 'bg-emerald-500',
    icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  },
};

function TaskHistoryModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { data: logs = [], isLoading } = useQuery<TaskLog[]>({
    queryKey: ['task-logs', task.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plan_task_logs')
        .select('id, event_type, event_number, notes, actor_name, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      return (data ?? []) as TaskLog[];
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Log Histori Task</h3>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[220px]">
              {task.name} · {task.content_plan?.title}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 text-lg leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-[12px] text-gray-400">Memuat histori...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-gray-400 italic">
              Belum ada log histori untuk task ini.
            </div>
          ) : (
            <div className="relative">
              {/* vertical connector */}
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" />
              <div className="space-y-4">
                {logs.map((log, i) => {
                  const meta = LOG_META[log.event_type];
                  if (!meta) return null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 relative">
                      <div className={`w-[30px] h-[30px] rounded-full ${meta.color} flex items-center justify-center flex-shrink-0 text-white z-10 shadow-sm`}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-bold text-gray-800">
                            {meta.label(log.event_number)}
                          </p>
                          {log.actor_name && (
                            <span className="text-[10px] text-gray-400">oleh {log.actor_name}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                          {fmtWIB(log.created_at)}
                        </p>
                        {log.notes && (
                          <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
                            <p className="text-[11px] text-gray-600 italic leading-relaxed">
                              &ldquo;{log.notes}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                      {i < logs.length - 1 && <div className="sr-only" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current file */}
          {task.file_url && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">File Hasil Kerja Saat Ini</p>
              <a href={task.file_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-btn border border-brand/30 bg-brand/5 text-brand text-[12px] hover:bg-brand/10 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {task.file_name ?? 'Lihat File'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Task action dropdown ── */
interface TaskActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
  disabled?: boolean;
}

function TaskActionDropdown({ items }: { items: TaskActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div>
      <button ref={btnRef} type="button" onClick={toggle}
        className="w-7 h-7 rounded-md flex items-center justify-center bg-gray-100 hover:bg-brand hover:text-white text-gray-500 transition-colors">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-48 bg-white rounded-card border border-gray-200 shadow-xl py-1 overflow-hidden">
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerBefore && <div className="border-t border-gray-100 my-1" />}
              <button type="button" disabled={item.disabled}
                onClick={() => { if (!item.disabled) { setOpen(false); item.onClick(); } }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors text-left disabled:opacity-40 ${
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <span className={`flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Submit Modal ── */
function TaskSubmitModal({ task, onClose, onSuccess }: { task: TaskRow; onClose: () => void; onSuccess: () => void }) {
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('notes', notes);
      if (file) fd.append('file', file);
      const res = await fetch(`/api/tasks/${task.id}/submit`, { method: 'POST', body: fd });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast.success('Task berhasil di-submit!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal submit task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Submit Task</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{task.name} · {task.content_plan?.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 text-lg">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Catatan Hasil Kerja</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Jelaskan hasil kerja yang telah diselesaikan..."
              className="w-full border border-gray-200 rounded-btn px-3 py-2 text-[13px] focus:outline-none focus:border-brand resize-none"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Upload File <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-btn p-4 text-center hover:border-brand transition-colors">
              <input type="file" id="task-file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <label htmlFor="task-file" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-brand">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="text-[12px] font-medium">{file.name}</span>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <svg className="mx-auto mb-1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    <p className="text-[12px]">Klik untuk pilih file</p>
                  </div>
                )}
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Batal</Button>
            <Button type="submit" loading={loading} className="flex-1">Submit Task</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Team progress filter type ── */
type TeamFilter = 'all' | 'pending' | 'done' | 'late';

/* ── isLate helper: deadline passed AND not done ── */
function isTaskLate(task: TaskRow) {
  if (!task.deadline) return false;
  if (task.status === 'done') return false;
  const todayJkt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  todayJkt.setHours(0, 0, 0, 0);
  return new Date(new Date(task.deadline).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })) < todayJkt;
}

/* ── TasksView ── */
function TasksView() {
  const user = useAuthStore(s => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitTarget, setSubmitTarget] = useState<TaskRow | null>(null);
  const [reviseTarget, setReviseTarget] = useState<TaskRow | null>(null);
  const [reviseNotes, setReviseNotes] = useState('');
  const [historyTarget, setHistoryTarget] = useState<TaskRow | null>(null);
  const [activeSection, setActiveSection] = useState<'mine' | 'approval' | 'team'>('mine');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const canApprove = user?.role === 'content_planner' || user?.role === 'admin';
  const isManager  = user?.role === 'manager_marketing' || user?.role === 'admin';

  const { data: myTasks = [], isLoading: loadingMine } = useQuery({
    queryKey: ['tasks-mine', user?.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plan_tasks')
        .select('id, name, deadline, pic, pic_user_id, status, submit_count, revision_count, file_url, file_name, submission_notes, submitted_at, created_at, approved_at, content_plan:content_plans!content_plan_id(id, title, status, created_by)')
        .eq('pic_user_id', user!.id)
        .order('deadline', { ascending: true });
      return (data ?? []) as unknown as TaskRow[];
    },
    enabled: !!user,
  });

  const { data: approvalTasks = [], isLoading: loadingApproval } = useQuery({
    queryKey: ['tasks-approval', user?.id],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data: myPlans } = await supabase
        .from('content_plans')
        .select('id')
        .eq('created_by', user!.id);
      const planIds = (myPlans ?? []).map((p: { id: string }) => p.id);
      if (!planIds.length) return [];
      const { data } = await supabase
        .from('content_plan_tasks')
        .select('id, name, deadline, pic, pic_user_id, status, submit_count, revision_count, file_url, file_name, submission_notes, submitted_at, created_at, approved_at, content_plan:content_plans!content_plan_id(id, title, status, created_by)')
        .eq('status', 'submitted')
        .in('content_plan_id', planIds)
        .order('submitted_at', { ascending: false });
      return (data ?? []) as unknown as TaskRow[];
    },
    enabled: !!user && canApprove,
  });

  const { data: teamTasks = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['tasks-team'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plan_tasks')
        .select('id, name, deadline, pic, pic_user_id, status, submit_count, revision_count, file_url, file_name, submission_notes, submitted_at, created_at, approved_at, content_plan:content_plans!content_plan_id(id, title, status, created_by)')
        .order('deadline', { ascending: true });
      return (data ?? []) as unknown as TaskRow[];
    },
    enabled: !!user && isManager,
  });

  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast.success('Task disetujui!');
      queryClient.invalidateQueries({ queryKey: ['tasks-mine'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-approval'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_notes: notes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast.success('Revisi diminta, PIC akan mendapat notifikasi');
      queryClient.invalidateQueries({ queryKey: ['tasks-mine'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-approval'] });
      setReviseTarget(null);
      setReviseNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tasks-mine'] });
    queryClient.invalidateQueries({ queryKey: ['tasks-approval'] });
    queryClient.invalidateQueries({ queryKey: ['content-plans'] });
  }

  /* ── Team stats ── */
  const teamDone    = teamTasks.filter(t => t.status === 'done').length;
  const teamPending = teamTasks.filter(t => t.status !== 'done').length;
  const teamLate    = teamTasks.filter(isTaskLate).length;

  const filteredTeamTasks = useMemo(() => {
    if (teamFilter === 'done')    return teamTasks.filter(t => t.status === 'done');
    if (teamFilter === 'pending') return teamTasks.filter(t => t.status !== 'done');
    if (teamFilter === 'late')    return teamTasks.filter(isTaskLate);
    return teamTasks;
  }, [teamTasks, teamFilter]);

  const sections = [
    { key: 'mine' as const,     label: 'Tugas Saya',      count: myTasks.length },
    ...(canApprove ? [{ key: 'approval' as const, label: 'Perlu Disetujui', count: approvalTasks.length }] : []),
    ...(isManager  ? [{ key: 'team' as const,     label: 'Progress Tim',    count: teamTasks.length }] : []),
  ];

  const activeTasks = activeSection === 'mine' ? myTasks : activeSection === 'approval' ? approvalTasks : filteredTeamTasks;
  const isLoading   = activeSection === 'mine' ? loadingMine : activeSection === 'approval' ? loadingApproval : loadingTeam;

  return (
    <>
      <div className="bg-white rounded-card border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {sections.map(s => (
            <button key={s.key} type="button" onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
                activeSection === s.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {s.label}
              {s.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeSection === s.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Progress Tim: stat cards + filter ── */}
        {activeSection === 'team' && !loadingTeam && (
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total Task',    value: teamTasks.length, color: 'text-gray-800',    bg: 'bg-gray-50',      border: 'border-gray-200' },
                { label: 'Selesai',       value: teamDone,         color: 'text-emerald-700', bg: 'bg-emerald-50',   border: 'border-emerald-200' },
                { label: 'Belum Selesai', value: teamPending,      color: 'text-blue-700',    bg: 'bg-blue-50',      border: 'border-blue-200' },
                { label: 'Telat',         value: teamLate,         color: 'text-red-700',     bg: 'bg-red-50',       border: 'border-red-200' },
              ].map(stat => (
                <div key={stat.label} className={`rounded-card border ${stat.border} ${stat.bg} px-4 py-3`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{stat.label}</p>
                  <p className={`text-[22px] font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            {/* Filter chips */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-medium">Filter:</span>
              {([
                { key: 'all',     label: 'Semua' },
                { key: 'pending', label: 'Belum Selesai' },
                { key: 'done',    label: 'Selesai' },
                { key: 'late',    label: 'Telat' },
              ] as { key: TeamFilter; label: string }[]).map(f => (
                <button key={f.key} type="button" onClick={() => setTeamFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    teamFilter === f.key
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand hover:text-brand'
                  }`}>
                  {f.label}
                  {f.key === 'late' && teamLate > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{teamLate}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-10 text-center text-[13px] text-gray-400">Memuat...</div>
        ) : activeTasks.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-gray-400">
            {activeSection === 'mine'     ? 'Tidak ada tugas yang di-assign ke kamu.'
            : activeSection === 'approval' ? 'Tidak ada task yang perlu disetujui.'
            : 'Tidak ada task yang sesuai filter.'}
          </div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <TH>Aksi</TH>
                <TH wide>Nama Task</TH>
                <TH wide>Content Plan</TH>
                <TH>PIC</TH>
                <TH>Deadline</TH>
                <TH>Status</TH>
                {activeSection === 'team' && <TH>Ketepatan</TH>}
              </tr>
            </thead>
            <tbody>
              {activeTasks.map(task => {
                const st   = getTaskBadge(task.status, task.submit_count ?? 0, task.revision_count ?? 0);
                const late = isTaskLate(task);

                const canSubmitTask  = task.status === 'pending' && task.pic_user_id === user?.id;
                const canApproveTask = canApprove && task.status === 'submitted';

                const dropdownItems: TaskActionItem[] = [
                  {
                    label: 'Detail',
                    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                    onClick: () => task.content_plan && router.push(`/content-plans/${task.content_plan.id}`),
                    disabled: !task.content_plan,
                  },
                  {
                    label: 'Submit Task',
                    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
                    onClick: () => setSubmitTarget(task),
                    disabled: !canSubmitTask,
                    dividerBefore: true,
                  },
                  {
                    label: 'Setujui Task',
                    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
                    onClick: () => approveMutation.mutate(task.id),
                    disabled: !canApproveTask,
                  },
                  {
                    label: 'Minta Revisi',
                    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                    onClick: () => { setReviseTarget(task); setReviseNotes(''); },
                    disabled: !canApproveTask,
                    danger: true,
                  },
                  {
                    label: 'Log Histori',
                    icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                    onClick: () => setHistoryTarget(task),
                    dividerBefore: true,
                  },
                ];

                return (
                  <tr key={task.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors ${late ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2.5 w-[44px]">
                      <TaskActionDropdown items={dropdownItems} />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className={`font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.name}</p>
                      {task.status === 'pending' && task.submission_notes && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-700">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          <span className="italic line-clamp-1">Revisi: {task.submission_notes}</span>
                        </div>
                      )}
                      {task.status === 'submitted' && task.submission_notes && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{task.submission_notes}</p>
                      )}
                      {task.file_url && (
                        <a href={task.file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline mt-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          {task.file_name ?? 'Lihat File'}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {task.content_plan ? (
                        <Link href={`/content-plans/${task.content_plan.id}`}
                          className="inline-flex items-center gap-1 text-brand hover:text-brand-hover hover:underline font-medium line-clamp-1 group">
                          {task.content_plan.title}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </Link>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                      {task.pic || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[12px] ${late ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {task.deadline ? fmtDate(task.deadline) : <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    {activeSection === 'team' && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {task.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Tepat Waktu
                          </span>
                        ) : late ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Telat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            On Track
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {submitTarget && (
        <TaskSubmitModal task={submitTarget} onClose={() => setSubmitTarget(null)} onSuccess={invalidate} />
      )}

      {historyTarget && (
        <TaskHistoryModal task={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      {/* Modal Minta Revisi */}
      {reviseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setReviseTarget(null); setReviseNotes(''); }} />
          <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-[14px] font-bold text-gray-900">Minta Revisi Task</h3>
            <p className="text-[12px] text-gray-500">
              Task <span className="font-semibold text-gray-700">{reviseTarget.name}</span> akan dikembalikan ke PIC untuk diperbaiki.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                Catatan Revisi <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <textarea
                value={reviseNotes}
                onChange={e => setReviseNotes(e.target.value)}
                rows={3}
                placeholder="Jelaskan apa yang perlu diperbaiki..."
                className="w-full border border-gray-200 rounded-btn px-3 py-2 text-[13px] focus:outline-none focus:border-brand resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button"
                onClick={() => { setReviseTarget(null); setReviseNotes(''); }}
                className="px-4 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-btn transition-colors">
                Batal
              </button>
              <button type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ taskId: reviseTarget.id, notes: reviseNotes })}
                className="px-4 py-2 text-[12px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-btn transition-colors disabled:opacity-60">
                {rejectMutation.isPending ? 'Memproses...' : 'Kirim Permintaan Revisi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════ */
export default function ContentPlansPage() {
  const user = useAuthStore(s => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PageTab>('plans');
  const [calendarSubTab, setCalendarSubTab] = useState<'plans' | 'tasks'>('plans');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectTargetStatus, setRejectTargetStatus] = useState<string>('pending_approval');
  const [rejectNotes, setRejectNotes] = useState('');
  const [publishWarnTasks, setPublishWarnTasks] = useState<{ id: string; name: string; status: string }[]>([]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['content-plans', { search, status: statusFilter, channel: channelFilter }],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      let query = supabase
        .from('content_plans')
        .select(`
          id, title, content_type, channel, status, scheduled_date, deadline_date,
          topic, caption, created_by, created_at,
          creator:users!created_by(id, name),
          assignees:content_assignees(id, role, user:users(id, name)),
          submissions:content_submissions(id, status),
          tasks:content_plan_tasks(id, name, deadline, status, pic)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);
      if (channelFilter) query = query.eq('channel', channelFilter);
      if (search) query = query.ilike('title', `%${search}%`);

      const { data } = await query;
      return (data ?? []) as unknown as ContentPlan[];
    },
  });

  /* ── Mutations ── */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-plans/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
    },
    onSuccess: () => {
      toast.success('Content plan dihapus');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      setDeleteId(null);
    },
    onError: () => toast.error('Gagal menghapus content plan'),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-plans/${id}/submit`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? 'Gagal mengajukan'); }
    },
    onSuccess: () => {
      toast.success('Plan diajukan untuk persetujuan');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-plans/${id}/approve`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? 'Gagal menyetujui'); }
    },
    onSuccess: () => {
      toast.success('Plan disetujui');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/content-plans/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_notes: notes }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? 'Gagal menolak'); }
    },
    onSuccess: () => {
      toast.success('Plan ditolak');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      setRejectTarget(null);
      setRejectNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-plans/${id}/publish`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw body;
    },
    onSuccess: () => {
      toast.success('Plan diajukan untuk publish!');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    },
    onError: (err: { message?: string; incomplete_tasks?: { id: string; name: string }[] }) => {
      if (err.incomplete_tasks?.length) {
        setPublishWarnTasks(
          err.incomplete_tasks.map(t => ({ id: t.id, name: t.name, status: 'pending' }))
        );
      } else {
        toast.error(err.message ?? 'Gagal mengajukan publish');
      }
    },
  });

  const approvePublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-plans/${id}/approve-publish`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? 'Gagal menyetujui publish'); }
    },
    onSuccess: () => {
      toast.success('Plan berhasil dipublish!');
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canCreate = user?.role === 'content_planner' || user?.role === 'admin';

  function buildMenuItems(plan: ContentPlan): MenuItem[] {
    const role = user?.role;
    const status = plan.status;
    const isOwner = plan.created_by === user?.id;
    const assignees = (plan.assignees ?? []) as { id: string; role: string; user?: { id: string; name: string } }[];
    const isAssigned = assignees.some(a => (a.user as { id: string } | undefined)?.id === user?.id);
    const canManagePlan = role === 'admin' || (role === 'content_planner' && isOwner);
    const canApprove = role === 'admin' || role === 'manager_marketing';
    const isCreative = role === 'designer' || role === 'videographer';
    const items: MenuItem[] = [];

    items.push({ label: 'Detail', icon: IcoEye, onClick: () => router.push(`/content-plans/${plan.id}`) });

    if (canManagePlan && (status === 'draft' || status === 'rejected')) {
      items.push({ label: 'Edit', icon: IcoEdit, onClick: () => router.push(`/content-plans/${plan.id}/edit`) });
    }
    if (canManagePlan && (status === 'draft' || status === 'rejected')) {
      items.push({ label: 'Ajukan untuk Persetujuan', icon: IcoSend, onClick: () => submitMutation.mutate(plan.id), dividerBefore: true });
    }
    if (canApprove && status === 'pending_approval') {
      items.push({ label: 'Setujui Plan', icon: IcoCheck, onClick: () => approveMutation.mutate(plan.id), dividerBefore: true });
      items.push({ label: 'Tolak Plan', icon: IcoX, onClick: () => { setRejectTarget(plan.id); setRejectTargetStatus('pending_approval'); setRejectNotes(''); }, danger: true });
    }
    if (isCreative && isAssigned && status === 'approved') {
      items.push({ label: 'Upload Hasil Kerja', icon: IcoUpload, onClick: () => router.push(`/content-plans/${plan.id}`), dividerBefore: true });
    }
    if (canManagePlan && status === 'approved') {
      const planTasks = (plan.tasks ?? []) as { id: string; name: string; deadline: string; status: string }[];
      const incompleteTasks = planTasks.filter(t => t.status !== 'done');
      items.push({
        label: 'Ajukan Publish',
        icon: IcoGlobe,
        dividerBefore: true,
        onClick: () => {
          if (incompleteTasks.length > 0) {
            setPublishWarnTasks(incompleteTasks.map(t => ({ id: t.id, name: t.name, status: t.status })));
          } else {
            submitPublishMutation.mutate(plan.id);
          }
        },
      });
    }
    if (canApprove && status === 'pending_publish') {
      items.push({ label: 'Setujui Publish', icon: IcoCheck, onClick: () => approvePublishMutation.mutate(plan.id), dividerBefore: true });
      items.push({ label: 'Kembalikan ke Produksi', icon: IcoX, onClick: () => { setRejectTarget(plan.id); setRejectTargetStatus('pending_publish'); setRejectNotes(''); }, danger: true });
    }
    if (canManagePlan && status === 'draft') {
      items.push({ label: 'Hapus', icon: IcoTrash, onClick: () => setDeleteId(plan.id), danger: true, dividerBefore: true });
    }

    return items;
  }

  /* ── Tab definitions ── */
  const TABS: { key: PageTab; label: string }[] = [
    { key: 'plans',    label: 'Content Plan' },
    { key: 'calendar', label: 'Kalender Plan' },
    { key: 'tasks',    label: 'Task' },
  ];

  return (
    <div className="p-6 space-y-0">

      {/* ── Tab Bar ── */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: Content Plan ══ */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Filters + tombol buat */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Cari judul..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-btn text-[13px] focus:outline-none focus:border-brand w-52 bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-btn px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand bg-white text-gray-700"
            >
              <option value="">Semua Status</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="border border-gray-200 rounded-btn px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand bg-white text-gray-700"
            >
              <option value="">Semua Channel</option>
              {CHANNELS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {(search || statusFilter || channelFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setChannelFilter(''); }}
                className="text-[12px] text-gray-400 hover:text-gray-600 px-2 transition-colors"
              >
                Reset
              </button>
            )}
            {canCreate && (
              <div className="ml-auto">
                <Button onClick={() => setShowCreateModal(true)}>+ Buat Plan Baru</Button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
            {isLoading ? (
              <div className="p-10 text-center text-[13px] text-gray-400">Memuat...</div>
            ) : plans.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-gray-400">
                {search || statusFilter || channelFilter ? 'Tidak ada hasil yang cocok.' : 'Belum ada content plan.'}
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <TH>Aksi</TH>
                    <TH>Tgl Dibuat</TH>
                    <TH>Tanggal Tayang</TH>
                    <TH>Tipe</TH>
                    <TH wide>Judul</TH>
                    <TH>Penjelasan</TH>
                    <TH>PIC</TH>
                    <TH>Status</TH>
                    <TH>Tasks</TH>
                    <TH>Catatan</TH>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(plan => {
                    const typeMeta = getTypeMeta(plan.content_type);
                    const planTasks = (plan.tasks ?? []) as { id: string; name: string; deadline: string }[];
                    const taskCount = planTasks.length;
                    const picName = (plan.creator as { name: string } | undefined)?.name ?? '-';
                    const menuItems = buildMenuItems(plan);

                    return (
                      <tr key={plan.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70 transition-colors">
                        <td className="px-3 py-2.5 w-[44px]">
                          <ActionDropdown plan={plan} items={menuItems} />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-[12px] text-gray-500">
                            {fmtDate(plan.created_at) ?? <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="text-[12px] font-medium text-gray-800">
                            {fmtDate(plan.scheduled_date) ?? <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${typeMeta.color}`}>
                            {typeMeta.icon}{typeMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px] max-w-[280px]">
                          <Link href={`/content-plans/${plan.id}`} className="text-gray-800 font-medium hover:text-brand line-clamp-1">
                            {plan.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px]">
                          {plan.topic
                            ? <span className="text-gray-600 line-clamp-1">{plan.topic}</span>
                            : <span className="text-gray-300 italic">tak ada</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{picName}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={plan.status} /></td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {taskCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[11px] font-medium">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                              </svg>
                              {taskCount} task
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[120px]">
                          {plan.caption
                            ? <span className="text-gray-600 line-clamp-1">{plan.caption}</span>
                            : <span className="text-gray-300 italic">tak ada</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: Kalender Plan ══ */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setCalendarSubTab('plans')}
              className={`px-4 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                calendarSubTab === 'plans'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Jadwal Tayang
            </button>
            <button
              type="button"
              onClick={() => setCalendarSubTab('tasks')}
              className={`px-4 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                calendarSubTab === 'tasks'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Deadline Task
            </button>
          </div>

          {isLoading
            ? <div className="bg-white rounded-card border border-gray-200 p-10 text-center text-[13px] text-gray-400">Memuat kalender...</div>
            : calendarSubTab === 'plans'
              ? <CalendarView plans={plans} />
              : <TaskCalendarView plans={plans} />
          }
        </div>
      )}

      {/* ══ TAB: Task ══ */}
      {activeTab === 'tasks' && <TasksView />}

      {/* ── Modals ── */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Hapus Content Plan"
        description="Yakin ingin menghapus content plan ini? Aksi ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        danger
      />

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectTarget(null)} />
          <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              {rejectTargetStatus === 'pending_publish' ? 'Kembalikan ke Produksi' : 'Tolak Plan'}
            </h3>
            <p className="text-[13px] text-gray-500">
              {rejectTargetStatus === 'pending_publish'
                ? 'Plan akan dikembalikan ke tahap produksi. Berikan catatan perbaikan.'
                : 'Berikan catatan agar content planner bisa memperbaiki.'}
            </p>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">
                Catatan <span className="text-danger">*</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
                placeholder={rejectTargetStatus === 'pending_publish' ? 'Apa yang perlu diperbaiki...' : 'Tulis alasan penolakan...'}
                className="w-full border border-gray-200 rounded-btn px-3 py-2 text-sm focus:outline-none focus:border-brand resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" type="button" onClick={() => setRejectTarget(null)}>Batal</Button>
              <Button
                variant="danger" type="button"
                loading={rejectMutation.isPending}
                onClick={() => rejectNotes.trim() && rejectMutation.mutate({ id: rejectTarget, notes: rejectNotes })}
              >
                {rejectTargetStatus === 'pending_publish' ? 'Kembalikan' : 'Tolak Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish Warning Modal ── */}
      {publishWarnTasks.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPublishWarnTasks([])} />
          <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-gray-900">Task Belum Selesai</h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Plan tidak bisa dipublish karena masih ada task yang belum selesai.
                </p>
              </div>
            </div>
            {/* Task list */}
            <div className="px-5 py-4 max-h-60 overflow-y-auto">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Task yang belum selesai ({publishWarnTasks.length})
              </p>
              <div className="space-y-1.5">
                {publishWarnTasks.map(t => {
                  const badge = t.status === 'submitted'
                    ? { label: 'Menunggu Review', bg: 'bg-amber-100', text: 'text-amber-700' }
                    : { label: 'Belum Dikerjakan', bg: 'bg-gray-100', text: 'text-gray-500' };
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-btn bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span className="text-[12px] font-medium text-gray-700 truncate">{t.name}</span>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <Button type="button" onClick={() => setPublishWarnTasks([])}>
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}

      <ContentPlanFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
