'use client';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ContentPlan } from '@/types';

const KPI_CARDS = [
  { key: 'draft',       label: 'Draft',             accent: '#A1A1AA' },
  { key: 'pending',     label: 'Menunggu Approval',  accent: '#D97706' },
  { key: 'inProduction',label: 'Dalam Produksi',     accent: '#2563EB' },
  { key: 'done',        label: 'Selesai',            accent: '#16A34A' },
] as const;

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);

  const { data: plans = [] } = useQuery({
    queryKey: ['content-plans', 'dashboard'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('id, title, status, channel, scheduled_date, creator:users!created_by(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      return (data ?? []) as unknown as ContentPlan[];
    },
  });

  const stats = {
    draft:        plans.filter(p => p.status === 'draft').length,
    pending:      plans.filter(p => p.status === 'pending_approval').length,
    inProduction: plans.filter(p => p.status === 'in_production').length,
    done:         plans.filter(p => p.status === 'done').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-brand mb-1">Overview</p>
        <h1 className="text-[20px] font-bold text-gray-900 leading-tight">Dashboard</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Selamat datang, {user?.name}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CARDS.map(card => (
          <div
            key={card.key}
            className="bg-white rounded-card border border-gray-200 p-5 relative overflow-hidden shadow-sm"
          >
            {/* Colored top accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: card.accent }} />
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-gray-400 mb-2">
              {card.label}
            </div>
            <div className="text-[28px] font-bold text-gray-900 leading-none tracking-[-1px]">
              {stats[card.key]}
            </div>
          </div>
        ))}
      </div>

      {/* Recent plans */}
      <div className="bg-white rounded-card border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-[13px] font-semibold text-gray-900">Content Plans Terbaru</h2>
          <Link href="/content-plans" className="text-[12px] text-brand hover:underline font-medium">
            Lihat semua
          </Link>
        </div>

        {plans.length === 0 ? (
          <p className="px-5 py-10 text-[13px] text-gray-400 text-center">Belum ada content plan.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {plans.map(plan => (
              <Link
                key={plan.id}
                href={`/content-plans/${plan.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-[13px] font-medium text-gray-900">{plan.title}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{plan.channel} · {formatDate(plan.scheduled_date)}</p>
                </div>
                <StatusBadge status={plan.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
