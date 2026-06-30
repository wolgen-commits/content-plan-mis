'use client';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, nowInJakarta, STATUS_LABELS } from '@/lib/utils';
import Link from 'next/link';
import { ContentPlan, ContentPlanTask, ContentStatus } from '@/types';

/* ─── helpers ─── */
function isOverdue(dateStr: string | null, status: string) {
  if (!dateStr) return false;
  if (['published', 'done'].includes(status)) return false;
  return new Date(dateStr) < nowInJakarta();
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

/* ─── mini components ─── */
function KpiCard({ label, value, accent, sub }: { label: string; value: number; accent: string; sub?: string }) {
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent }} />
      <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-gray-400 mb-1">{label}</p>
      <p className="text-[26px] font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold text-gray-900">{children}</h2>
  );
}

function ProgressBar({ value, color = '#BB2649', bg = '#F3F4F6' }: { value: number; color?: string; bg?: string }) {
  return (
    <div className="w-full rounded-full h-[6px]" style={{ background: bg }}>
      <div className="h-[6px] rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  );
}

const STATUS_ACCENT: Record<string, string> = {
  draft:            '#A1A1AA',
  pending_approval: '#D97706',
  approved:         '#2563EB',
  pending_publish:  '#BB2649',
  rejected:         '#DC2626',
  published:        '#16A34A',
};

const CHANNEL_COLORS: Record<string, string> = {
  Instagram: '#E1306C',
  TikTok:    '#010101',
  YouTube:   '#FF0000',
  LinkedIn:  '#0A66C2',
  Twitter:   '#1DA1F2',
  Facebook:  '#1877F2',
  Website:   '#6366F1',
};

/* ─── main page ─── */
export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const today = nowInJakarta();
  const todayStr = today.toISOString().slice(0, 10);

  /* fetch all content plans with tasks */
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['dashboard-plans'],
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      const { data } = await sb
        .from('content_plans')
        .select(`
          id, title, status, channel, scheduled_date, deadline_date,
          kanban_column, created_at, created_by,
          creator:users!created_by(id, name),
          tasks:content_plan_tasks(id, name, deadline, status, pic_user_id,
            pic_user:users!pic_user_id(id, name))
        `)
        .order('created_at', { ascending: false });
      return (data ?? []) as unknown as ContentPlan[];
    },
  });

  /* fetch all tasks (flat) */
  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      const { data } = await sb
        .from('content_plan_tasks')
        .select('id, name, deadline, status, content_plan_id, pic_user_id, pic_user:users!pic_user_id(id, name)');
      return (data ?? []) as unknown as ContentPlanTask[];
    },
  });

  const loading = loadingPlans || loadingTasks;

  /* ── derived stats ── */
  const total = plans.length;

  const byStatus: Record<ContentStatus, number> = {
    draft: 0, pending_approval: 0, approved: 0,
    pending_publish: 0, rejected: 0, published: 0,
  };
  plans.forEach(p => { byStatus[p.status] = (byStatus[p.status] ?? 0) + 1; });

  /* overdue content plans */
  const overduePlans = plans.filter(p => isOverdue(p.deadline_date, p.status));

  /* pending approval queue */
  const pendingApproval = plans.filter(p => p.status === 'pending_approval');

  /* overdue tasks */
  const overdueTasks = allTasks.filter(t =>
    t.deadline && new Date(t.deadline) < today && !['done'].includes(t.status)
  );

  /* task stats */
  const taskTotal  = allTasks.length;
  const taskDone   = allTasks.filter(t => t.status === 'done').length;
  const taskPending = allTasks.filter(t => t.status === 'pending').length;
  const taskSubmitted = allTasks.filter(t => t.status === 'submitted').length;
  const taskRejected = allTasks.filter(t => t.status === 'rejected').length;

  /* by channel (plans can have multiple channels) */
  const byChannel: Record<string, number> = {};
  plans.forEach(p => {
    const channels = Array.isArray(p.channel) ? p.channel : [p.channel];
    channels.forEach((ch: string) => { byChannel[ch] = (byChannel[ch] ?? 0) + 1; });
  });
  const channelEntries = Object.entries(byChannel).sort((a, b) => b[1] - a[1]);

  /* creator performance */
  const creatorMap: Record<string, { name: string; total: number; published: number; rejected: number }> = {};
  plans.forEach(p => {
    const cid = p.created_by;
    const name = (p.creator as unknown as { name: string })?.name ?? 'Unknown';
    if (!creatorMap[cid]) creatorMap[cid] = { name, total: 0, published: 0, rejected: 0 };
    creatorMap[cid].total++;
    if (p.status === 'published') creatorMap[cid].published++;
    if (p.status === 'rejected')  creatorMap[cid].rejected++;
  });
  const creatorRows = Object.values(creatorMap).sort((a, b) => b.total - a.total).slice(0, 8);

  /* this month */
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthPlans = plans.filter(p => p.created_at.startsWith(thisMonth)).length;

  /* upcoming scheduled (next 7 days) */
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const upcoming = plans.filter(p => {
    if (!p.scheduled_date) return false;
    const d = new Date(p.scheduled_date);
    return d >= today && d <= in7 && p.status !== 'published';
  }).slice(0, 5);

  /* ── render ── */
  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[#BB2649] mb-1">Manager Overview</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Dashboard</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Selamat datang, <span className="font-semibold text-gray-700">{user?.name}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            {formatDate(todayStr, 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        {loading && (
          <span className="text-[11px] text-gray-400 animate-pulse mt-2">Memuat data…</span>
        )}
      </div>

      {/* Alert bar — overdue */}
      {(overduePlans.length > 0 || overdueTasks.length > 0) && (
        <div className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <p className="text-[12px] font-semibold text-red-700">Perhatian Diperlukan</p>
            <p className="text-[12px] text-red-600 mt-0.5">
              {overduePlans.length > 0 && <span><strong>{overduePlans.length}</strong> content plan melewati deadline.{' '}</span>}
              {overdueTasks.length > 0 && <span><strong>{overdueTasks.length}</strong> task melewati deadline.</span>}
            </p>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Plans" value={total} accent="#BB2649" sub={`+${thisMonthPlans} bulan ini`} />
        <KpiCard label="Draft" value={byStatus.draft} accent="#A1A1AA" />
        <KpiCard label="Menunggu Approval" value={byStatus.pending_approval} accent="#D97706" />
        <KpiCard label="Dalam Produksi" value={byStatus.approved} accent="#2563EB" />
        <KpiCard label="Siap Publish" value={byStatus.pending_publish} accent="#BB2649" />
        <KpiCard label="Published" value={byStatus.published} accent="#16A34A" />
      </div>

      {/* Row 2: Status breakdown + Channel + Task Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Status Breakdown */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Status Content Plan</SectionTitle>
            <span className="text-[11px] text-gray-400">{total} total</span>
          </div>
          <div className="space-y-3">
            {(Object.entries(byStatus) as [ContentStatus, number][]).map(([status, count]) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gray-600">{STATUS_LABELS[status]}</span>
                  <span className="text-[12px] font-semibold text-gray-800">{count} <span className="text-gray-400 font-normal">({pct(count, total)}%)</span></span>
                </div>
                <ProgressBar value={pct(count, total)} color={STATUS_ACCENT[status]} />
              </div>
            ))}
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Distribusi Channel</SectionTitle>
          </div>
          {channelEntries.length === 0
            ? <p className="text-[12px] text-gray-400 text-center py-8">Belum ada data</p>
            : (
              <div className="space-y-3">
                {channelEntries.map(([ch, count]) => (
                  <div key={ch}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[ch] ?? '#A1A1AA' }} />
                        <span className="text-[12px] text-gray-600">{ch}</span>
                      </div>
                      <span className="text-[12px] font-semibold text-gray-800">{count}</span>
                    </div>
                    <ProgressBar value={pct(count, total)} color={CHANNEL_COLORS[ch] ?? '#A1A1AA'} />
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Task Stats */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Status Task</SectionTitle>
            <span className="text-[11px] text-gray-400">{taskTotal} total</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Selesai (Done)',    count: taskDone,      color: '#16A34A' },
              { label: 'Pending',           count: taskPending,   color: '#A1A1AA' },
              { label: 'Submitted',         count: taskSubmitted, color: '#2563EB' },
              { label: 'Ditolak',           count: taskRejected,  color: '#DC2626' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gray-600">{item.label}</span>
                  <span className="text-[12px] font-semibold text-gray-800">
                    {item.count} <span className="text-gray-400 font-normal">({pct(item.count, taskTotal)}%)</span>
                  </span>
                </div>
                <ProgressBar value={pct(item.count, taskTotal)} color={item.color} />
              </div>
            ))}
          </div>
          {taskTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Completion Rate</span>
              <span className="text-[14px] font-bold" style={{ color: '#16A34A' }}>{pct(taskDone, taskTotal)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Overdue Plans + Pending Approval */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Overdue Content Plans */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <SectionTitle>Content Plan Terlambat</SectionTitle>
            </div>
            <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{overduePlans.length}</span>
          </div>
          {overduePlans.length === 0 ? (
            <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Tidak ada content plan yang terlambat</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
              {overduePlans.map(plan => {
                const daysLate = Math.floor((today.getTime() - new Date(plan.deadline_date!).getTime()) / 86400000);
                return (
                  <Link
                    key={plan.id}
                    href={`/content-plans/${plan.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{plan.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Deadline: {formatDate(plan.deadline_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <StatusBadge status={plan.status} />
                      <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        +{daysLate}h
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Approval */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <SectionTitle>Menunggu Approval</SectionTitle>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{pendingApproval.length}</span>
          </div>
          {pendingApproval.length === 0 ? (
            <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Tidak ada yang menunggu approval</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
              {pendingApproval.map(plan => (
                <Link
                  key={plan.id}
                  href={`/content-plans/${plan.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-gray-900 truncate">{plan.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Dibuat: {formatDate(plan.created_at)} ·{' '}
                      Oleh: {(plan.creator as unknown as { name: string })?.name ?? '-'}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Overdue Tasks + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Overdue Tasks */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <SectionTitle>Task Terlambat</SectionTitle>
            </div>
            <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">{overdueTasks.length}</span>
          </div>
          {overdueTasks.length === 0 ? (
            <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Semua task on-track</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
              {overdueTasks.slice(0, 8).map(task => {
                const daysLate = Math.floor((today.getTime() - new Date(task.deadline).getTime()) / 86400000);
                const statusColors: Record<string, string> = {
                  pending:   'text-gray-500 bg-gray-100',
                  submitted: 'text-blue-700 bg-blue-50',
                  rejected:  'text-red-700 bg-red-50',
                };
                return (
                  <div key={task.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{task.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        PIC: {(task.pic_user as unknown as { name: string })?.name ?? '-'} · Deadline: {formatDate(task.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[task.status] ?? 'text-gray-500 bg-gray-100'}`}>
                        {task.status}
                      </span>
                      <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        +{daysLate}h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Scheduled */}
        <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <SectionTitle>Jadwal 7 Hari ke Depan</SectionTitle>
            <span className="text-[11px] text-gray-400">{upcoming.length} konten</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Tidak ada jadwal dalam 7 hari ke depan</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcoming.map(plan => {
                const daysLeft = Math.ceil((new Date(plan.scheduled_date!).getTime() - today.getTime()) / 86400000);
                return (
                  <Link
                    key={plan.id}
                    href={`/content-plans/${plan.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{plan.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Jadwal: {formatDate(plan.scheduled_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <StatusBadge status={plan.status} />
                      <span className="text-[11px] font-medium text-blue-600">
                        {daysLeft === 0 ? 'Hari ini' : `${daysLeft}h lagi`}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Creator Performance */}
      <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <SectionTitle>Performa Content Planner</SectionTitle>
          <span className="text-[11px] text-gray-400">Berdasarkan semua waktu</span>
        </div>
        {creatorRows.length === 0 ? (
          <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Belum ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Planner</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-center">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-center">Published</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide text-center">Ditolak</th>
                  <th className="px-5 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {creatorRows.map((row, i) => {
                  const rate = pct(row.published, row.total);
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                            style={{ background: '#BB2649' }}>
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{row.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{row.published}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{row.rejected}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-[80px]">
                            <ProgressBar value={rate} color="#16A34A" />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-700 w-9 text-right">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 6: Recent Plans */}
      <div className="bg-white rounded-[10px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <SectionTitle>Content Plan Terbaru</SectionTitle>
          <Link href="/content-plans" className="text-[12px] text-[#BB2649] hover:underline font-medium">
            Lihat semua →
          </Link>
        </div>
        {plans.length === 0 ? (
          <p className="px-5 py-8 text-[12px] text-gray-400 text-center">Belum ada content plan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Judul</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Dibuat oleh</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Jadwal</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Deadline</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Tasks</th>
                  <th className="px-5 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plans.slice(0, 10).map(plan => {
                  const tasks = (plan.tasks ?? []) as ContentPlanTask[];
                  const tasksDone = tasks.filter(t => t.status === 'done').length;
                  const deadlineOverdue = isOverdue(plan.deadline_date, plan.status);
                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/content-plans/${plan.id}`} className="font-medium text-gray-900 hover:text-[#BB2649] transition-colors line-clamp-1">
                          {plan.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{(plan.creator as unknown as { name: string })?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(plan.scheduled_date)}</td>
                      <td className="px-4 py-3">
                        <span className={deadlineOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                          {formatDate(plan.deadline_date)}
                          {deadlineOverdue && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {tasks.length > 0
                          ? <span className="text-[11px] font-medium text-gray-600">{tasksDone}/{tasks.length}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={plan.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
