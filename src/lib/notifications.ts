import { createAdminClient } from '@/lib/supabase/server';
import { NotificationType } from '@/types';

interface NotifyPayload {
  userIds: string[];
  type: NotificationType;
  message: string;
  contentPlanId?: string;
  data?: Record<string, unknown>;
}

export async function sendNotifications({
  userIds,
  type,
  message,
  contentPlanId,
  data,
}: NotifyPayload) {
  if (userIds.length === 0) return;
  const supabase = createAdminClient();
  await supabase.from('notifications').insert(
    userIds.map(userId => ({
      user_id: userId,
      type,
      message,
      content_plan_id: contentPlanId ?? null,
      data: data ?? null,
    }))
  );
}
