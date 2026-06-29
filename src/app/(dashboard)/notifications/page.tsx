'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Notification } from '@/types';
import Link from 'next/link';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return res.json() as Promise<{ data: Notification[]; unread_count: number }>;
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => fetch('/api/notifications', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readOneMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifikasi</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} belum dibaca</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm"
            onClick={() => readAllMutation.mutate()}
            loading={readAllMutation.isPending}>
            Tandai semua dibaca
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400">Memuat...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-10 text-center">
          <p className="text-2xl mb-2">🔔</p>
          <p className="text-sm text-gray-400">Belum ada notifikasi.</p>
        </div>
      ) : (
        <div className="bg-white rounded-card shadow-card divide-y divide-gray-50">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`flex items-start gap-3 p-4 transition-colors ${
                !notif.read_at ? 'bg-brand-faint' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read_at ? 'bg-brand' : 'bg-transparent'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{notif.message}</p>
                {notif.content_plan && (
                  <Link
                    href={`/content-plans/${notif.content_plan_id}`}
                    className="text-xs text-brand hover:underline mt-0.5 block"
                  >
                    Lihat plan →
                  </Link>
                )}
                <p className="text-xs text-gray-400 mt-1">{formatDate(notif.created_at, 'dd MMM yyyy HH:mm')}</p>
              </div>
              {!notif.read_at && (
                <button
                  onClick={() => readOneMutation.mutate(notif.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  ✓
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
