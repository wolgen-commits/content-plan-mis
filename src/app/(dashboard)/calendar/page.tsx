'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { STATUS_COLORS } from '@/lib/utils';
import { ContentPlan } from '@/types';
import { useEffect, useRef } from 'react';

export default function CalendarPage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const calendarRef = useRef<HTMLDivElement>(null);

  const { data: plans } = useQuery({
    queryKey: ['content-plans', 'calendar'],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('content_plans')
        .select('id, title, channel, status, scheduled_date')
        .not('scheduled_date', 'is', null);
      return (data ?? []) as unknown as ContentPlan[];
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const res = await fetch(`/api/content-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: date }),
      });
      if (!res.ok) throw new Error('Gagal reschedule.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-plans', 'calendar'] }),
  });

  const canDrag = user?.role === 'content_planner' || user?.role === 'admin';

  useEffect(() => {
    if (!calendarRef.current || !plans) return;

    let calendar: import('@fullcalendar/core').Calendar;

    (async () => {
      const { Calendar } = await import('@fullcalendar/core');
      const dayGridPlugin = (await import('@fullcalendar/daygrid')).default;
      const interactionPlugin = (await import('@fullcalendar/interaction')).default;

      const events = plans
        .filter(p => p.scheduled_date !== null)
        .map(p => ({
          id: p.id,
          title: p.title,
          date: p.scheduled_date as string,
          classNames: [STATUS_COLORS[p.status]?.split(' ')[0] ?? 'bg-gray-100'],
        }));

      calendar = new Calendar(calendarRef.current!, {
        plugins: [dayGridPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        events,
        editable: canDrag,
        eventDrop: (info) => {
          rescheduleMutation.mutate({ id: info.event.id, date: info.event.startStr });
        },
        locale: 'id',
        height: 'auto',
      });
      calendar.render();
    })();

    return () => {
      calendar?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, canDrag]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Kalender Konten</h1>
      <div className="bg-white rounded-card shadow-sm p-4">
        <div ref={calendarRef} />
      </div>
    </div>
  );
}
