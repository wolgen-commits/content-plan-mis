'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/store/authStore';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import Link from 'next/link';
import { Notification } from '@/types';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/content-plans': 'Content Plans',
  '/calendar':      'Kalender',
  '/kanban':        'Kanban Board',
  '/submissions':   'Submissions',
  '/notifications': 'Kotak Masuk',
  '/users':         'Manajemen User',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path + '/')) return title;
  }
  return 'Dashboard';
}

const AVATAR_COLORS = ['#BB2649', '#6D28D9', '#0369A1', '#065F46', '#92400E', '#1D4ED8'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

const NOTIF_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  plan_submitted:           { color: 'bg-amber-100 text-amber-600',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
  plan_approved:            { color: 'bg-emerald-100 text-emerald-600', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  plan_rejected:            { color: 'bg-red-100 text-red-500',        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
  submission_received:      { color: 'bg-blue-100 text-blue-600',      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> },
  submission_approved:      { color: 'bg-emerald-100 text-emerald-600', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  submission_rejected:      { color: 'bg-red-100 text-red-500',        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
  assigned_to_plan:         { color: 'bg-violet-100 text-violet-600',  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  assigned_to_task:         { color: 'bg-violet-100 text-violet-600',  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  task_submitted:           { color: 'bg-blue-100 text-blue-600',      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> },
  plan_deadline_approaching: { color: 'bg-orange-100 text-orange-500', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
};

/* ── Notification Dropdown ── */
function NotifDropdown({ onClose, anchorRect }: { onClose: () => void; anchorRect: DOMRect }) {
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('notifications')
        .select('id, type, message, read_at, created_at, content_plan_id, content_plan:content_plans(id, title)')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as unknown as Notification[];
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowser();
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowser();
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unread = notifications.filter(n => !n.read_at).length;

  // Position: anchor to right edge of bell button
  const top  = anchorRect.bottom + window.scrollY + 8;
  const right = window.innerWidth - anchorRect.right - window.scrollX;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top, right, zIndex: 9999 }}
      className="w-[360px] bg-white rounded-card border border-gray-200 shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-gray-900">Notifikasi</span>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-brand text-white text-[10px] font-bold min-w-[18px]">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-[11px] font-medium text-brand hover:text-brand-hover transition-colors"
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-[12px] text-gray-400">Memuat...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <p className="text-[12px] text-gray-400">Belum ada notifikasi</p>
          </div>
        ) : (
          notifications.map(notif => {
            const meta = NOTIF_ICONS[notif.type] ?? { color: 'bg-gray-100 text-gray-500', icon: null };
            const isUnread = !notif.read_at;
            const planId = notif.content_plan_id;
            const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: localeId });

            const content = (
              <div
                className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${isUnread ? 'bg-brand-faint' : ''}`}
                onClick={() => {
                  if (isUnread) markOneMutation.mutate(notif.id);
                  if (planId) onClose();
                }}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${meta.color}`}>
                  {meta.icon}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] leading-snug ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                    {notif.message}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo}</p>
                </div>
                {/* Unread dot */}
                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                )}
              </div>
            );

            return planId ? (
              <Link key={notif.id} href={`/content-plans/${planId}`} onClick={onClose}>
                {content}
              </Link>
            ) : (
              <div key={notif.id}>{content}</div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100">
        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-brand hover:bg-brand-faint transition-colors"
        >
          Lihat semua notifikasi
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>
    </div>,
    document.body
  );
}

/* ── Topbar ── */
export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [dark, setDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  function toggleDark() {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }

  function toggleNotif() {
    if (!notifOpen && bellRef.current) {
      setBellRect(bellRef.current.getBoundingClientRect());
    }
    setNotifOpen(v => !v);
  }

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    clearAuth();
    router.push('/login');
  }

  const pageTitle = getPageTitle(pathname);
  const initials  = user?.name?.charAt(0).toUpperCase() ?? '?';
  const bgColor   = avatarColor(user?.name ?? '');

  return (
    <header className="h-12 flex-shrink-0 bg-white border-b border-gray-300 flex items-center justify-between px-4">
      {/* Left: page title */}
      <h1 className="text-sm font-semibold text-gray-800 truncate">{pageTitle}</h1>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={dark ? 'Mode terang' : 'Mode gelap'}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-500"
        >
          {dark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Notification bell */}
        <button
          ref={bellRef}
          onClick={toggleNotif}
          className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors ${notifOpen ? 'bg-gray-100 text-brand' : 'hover:bg-gray-100 text-gray-500'}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && bellRect && (
          <NotifDropdown anchorRect={bellRect} onClose={() => setNotifOpen(false)} />
        )}

        {/* User avatar + name + logout */}
        <div className="flex items-center gap-2 pl-1">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: bgColor }}
          >
            {initials}
          </div>
          {user && (
            <span className="text-xs font-medium text-gray-800 hidden sm:block">{user.name}</span>
          )}
          <button
            onClick={handleLogout}
            title="Keluar"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-brand ml-0.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
