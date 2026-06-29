'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Notification } from '@/types';

export function useRealtimeSubscription() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowser();

    const plansChannel = supabase
      .channel('content_plans_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'content_plans',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      })
      .subscribe();

    const notifChannel = supabase
      .channel(`notifications_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const notif = payload.new as Notification;
        toast.info(notif.message, { duration: 5000 });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(plansChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [user, queryClient]);
}
