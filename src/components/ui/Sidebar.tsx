'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

/* ── Palette (match Sintegra sidebar, brand = Magenta) ── */
const BRAND = '#BB2649';
const SIDEBAR_BG = '#151518';
const SIDEBAR_HOVER = '#242429';
const SIDEBAR_TEXT = '#D4D4D8';
const SIDEBAR_TEXT_MUTED = '#A1A1AA';
const SIDEBAR_ACTIVE_BG = 'rgba(187, 38, 73, 0.22)';
const SIDEBAR_ACTIVE_BORDER = 'rgba(187, 38, 73, 0.48)';
const SIDEBAR_DIVIDER = 'rgba(63, 63, 70, 0.82)';

/* ── SVG Icon helper ── */
function Icon({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  megaphone: <><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  file: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  kanban: <><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="15" rx="1"/></>,
  upload: <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8-4-4m0 0L8 8m4-4v12"/>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

type NavChild = { href: string; label: string; icon: React.ReactNode; roles?: UserRole[] };
type NavLink   = { type: 'link';   key: string; href: string; label: string; icon: React.ReactNode; roles?: UserRole[] };
type NavModule = { type: 'module'; key: string; label: string; icon: React.ReactNode; children: NavChild[] };
type NavItem = NavLink | NavModule;

const NAV_ITEMS: NavItem[] = [
  { type: 'link', key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: <Icon>{ICONS.dashboard}</Icon> },
  { type: 'link', key: 'inbox', href: '/notifications', label: 'Kotak Masuk', icon: <Icon>{ICONS.inbox}</Icon> },
  {
    type: 'module', key: 'marketing', label: 'Marketing', icon: <Icon>{ICONS.megaphone}</Icon>,
    children: [
      { href: '/content-plans', label: 'Content Plans', icon: <Icon size={16}>{ICONS.file}</Icon> },
      { href: '/submissions',   label: 'Submissions',   icon: <Icon size={16}>{ICONS.upload}</Icon> },
    ],
  },
  {
    type: 'module', key: 'admin', label: 'Administrasi Sistem', icon: <Icon>{ICONS.settings}</Icon>,
    children: [
      { href: '/users', label: 'Manajemen User', icon: <Icon size={16}>{ICONS.users}</Icon>, roles: ['admin'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const [collapsed, setCollapsed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [popTop, setPopTop] = useState(0);
  const moduleRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const sidebarWidth = collapsed ? 56 : 210;

  function canSeeChild(c: NavChild) {
    return !c.roles || (user?.role ? c.roles.includes(user.role) : false);
  }
  function visibleChildren(m: NavModule) {
    return m.children.filter(canSeeChild);
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    item.type === 'link' ? true : visibleChildren(item).length > 0
  );

  function isLinkActive(href: string) {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }
  function isModuleActive(m: NavModule) {
    return m.children.some(c => isLinkActive(c.href));
  }

  const routeModule = visibleItems.find(i => i.type === 'module' && isModuleActive(i)) as NavModule | undefined;
  const openModule = NAV_ITEMS.find(i => i.type === 'module' && i.key === openKey) as NavModule | undefined;

  useEffect(() => { setOpenKey(null); }, [pathname]);

  function handleOpenPop(key: string) {
    if (openKey === key) { setOpenKey(null); return; }
    const btn = moduleRefs.current[key];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const mod = NAV_ITEMS.find(i => i.type === 'module' && i.key === key) as NavModule | undefined;
      const rows = Math.ceil((mod ? visibleChildren(mod).length : 0) / 3);
      const estimatedHeight = 60 + rows * 96;
      const top = rect.top + estimatedHeight > window.innerHeight
        ? Math.max(8, window.innerHeight - estimatedHeight - 8)
        : rect.top;
      setPopTop(top);
    }
    setOpenKey(key);
  }

  return (
    <>
      <aside
        className="hidden md:flex flex-shrink-0 flex-col z-30 border-r border-zinc-800 transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: sidebarWidth, backgroundColor: SIDEBAR_BG }}
      >
        {/* Logo + toggle */}
        <div className="flex h-[52px] flex-shrink-0 items-center border-b px-3" style={{ borderColor: SIDEBAR_DIVIDER }}>
          {!collapsed && (
            <div className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center" style={{ background: BRAND }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                <rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
              </svg>
            </div>
          )}
          {!collapsed && (
            <div className="ml-2.5 flex-1 min-w-0">
              <p className="truncate text-sm font-bold leading-[1.18] text-white">Magenta</p>
              <p className="mt-0.5 text-[9px] tracking-wide" style={{ color: SIDEBAR_TEXT_MUTED }}>ERP SYSTEM</p>
            </div>
          )}
          <button
            onClick={() => { setCollapsed(c => !c); setOpenKey(null); }}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
          {visibleItems.map(item => {
            const active = item.type === 'link' ? isLinkActive(item.href)
              : (openKey === item.key || (!openKey && routeModule?.key === item.key));

            const inner = (
              <>
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: active ? BRAND : BRAND + '24', color: active ? '#fff' : BRAND }}>
                  {item.icon}
                </div>
                {!collapsed && (
                  <>
                    <span className={cn('flex-1 truncate text-left text-[11px]', active ? 'font-semibold' : 'font-medium')}
                      style={{ color: active ? '#fff' : SIDEBAR_TEXT }}>
                      {item.label}
                    </span>
                    {item.type === 'module' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"
                        style={{ color: active ? '#FBCFE8' : '#71717A', transform: openKey === item.key ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    )}
                  </>
                )}
              </>
            );

            const btnStyle: React.CSSProperties = {
              backgroundColor: active ? SIDEBAR_ACTIVE_BG : 'transparent',
              boxShadow: active ? `inset 0 0 0 1px ${SIDEBAR_ACTIVE_BORDER}` : 'none',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '5px 0' : '5px 8px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            };

            return (
              <div key={item.key} className="relative mb-0.5">
                {item.type === 'link' ? (
                  <Link href={item.href} title={collapsed ? item.label : undefined}
                    className="group w-full flex items-center rounded-lg transition-colors duration-150"
                    style={btnStyle}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = SIDEBAR_HOVER; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    ref={el => { moduleRefs.current[item.key] = el; }}
                    onClick={() => handleOpenPop(item.key)}
                    title={collapsed ? item.label : undefined}
                    className="group w-full flex items-center rounded-lg transition-colors duration-150"
                    style={btnStyle}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = SIDEBAR_HOVER; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {inner}
                  </button>
                )}
                {active && (
                  <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: BRAND, boxShadow: `0 0 10px ${BRAND}66` }} />
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 flex-shrink-0" />

        {/* User */}
        {user && (
          <div className="flex items-center w-full flex-shrink-0"
            style={{ gap: collapsed ? 0 : 8, padding: collapsed ? '10px 0' : '10px 16px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: BRAND }}>
              {user.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <p className="truncate text-[11px] font-medium text-white">{user.name}</p>
                <p className="truncate text-[9px]" style={{ color: SIDEBAR_TEXT_MUTED }}>@{user.email?.split('@')[0]}</p>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── POP CARD ── */}
      {openKey && openModule && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenKey(null)} />
          <div className="fixed z-50 rounded-xl shadow-2xl p-4 w-72 border bg-white border-gray-200"
            style={{ top: popTop, left: sidebarWidth + 4 }}>
            {/* Header */}
            <div className="mb-3 flex items-center gap-2.5 border-b pb-3 border-gray-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: BRAND + '12', boxShadow: `inset 0 0 0 1px ${BRAND}30`, color: BRAND }}>
                {openModule.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold leading-none text-gray-700">{openModule.label}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Menu Modul</p>
              </div>
            </div>
            {/* Cards */}
            <div className="grid grid-cols-3 gap-1.5">
              {visibleChildren(openModule).map(child => {
                const sActive = isLinkActive(child.href);
                return (
                  <Link key={child.href} href={child.href} onClick={() => setOpenKey(null)}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center transition-all"
                    style={{ backgroundColor: sActive ? BRAND + '18' : BRAND + '12', boxShadow: sActive ? `inset 0 0 0 1px ${BRAND}70` : 'none' }}
                    onMouseEnter={e => { if (!sActive) e.currentTarget.style.backgroundColor = BRAND + '20'; }}
                    onMouseLeave={e => { if (!sActive) e.currentTarget.style.backgroundColor = BRAND + '12'; }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: sActive ? BRAND + '18' : BRAND + '22', color: BRAND }}>
                      {child.icon}
                    </div>
                    <span className={cn('text-[10px] leading-tight', sActive ? 'font-semibold' : 'font-medium')} style={{ color: BRAND }}>
                      {child.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
