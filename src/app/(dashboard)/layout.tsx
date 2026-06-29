'use client';
import { useEffect } from 'react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import Sidebar from '@/components/ui/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAuthStore } from '@/store/authStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useRealtimeSubscription();
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    async function syncUser() {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const profile = await res.json();
      if (profile?.id) setUser(profile);
    }
    syncUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
