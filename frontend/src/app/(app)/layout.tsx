'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingCompanion } from '@/components/chat/FloatingCompanion';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HerSyncProvider, useHerSync } from '@/context/HerSyncContext';
import { PWAInstaller } from '@/components/ui/PWAInstaller';
import { createClient } from '@/utils/supabase/client';
import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authState, setAuthState] = useState<'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'>('INITIALIZING');

  useEffect(() => {
    let isSubscribed = true;
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!isSubscribed) return;

        if (!session?.user) {
          setAuthState('UNAUTHENTICATED');
          router.replace('/login');
          return;
        }

        setAuthState('AUTHENTICATED');
      } catch (err) {
        console.error('Auth check error in AppLayout:', err);
        if (isSubscribed) {
          setAuthState('UNAUTHENTICATED');
          router.replace('/login');
        }
      }
    };
    checkAuth();

    return () => {
      isSubscribed = false;
    };
  }, [router]);

  if (authState !== 'AUTHENTICATED') {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <HerSyncProvider>
      <ThemeSync />
      <div className="flex h-screen h-[100dvh] overflow-hidden bg-background">
        <Sidebar className="hidden md:flex border-r border-border/40 shrink-0" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          
          <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 max-w-full smooth-scroll">
            {children}
          </main>
          
          <FloatingCompanion />
          <PWAInstaller />
          
          <BottomNav />
        </div>
      </div>
    </HerSyncProvider>
  );
}

function ThemeSync() {
  const { wellnessMode, activeTheme, activeDashboardStyle } = useHerSync();
  useEffect(() => {
    try {
      document.body.setAttribute('data-mode', wellnessMode || 'general');
      document.body.setAttribute('data-theme', activeTheme || 'default');
      document.body.setAttribute('data-dashboard-style', activeDashboardStyle || 'minimal');
    } catch {}
  }, [wellnessMode, activeTheme, activeDashboardStyle]);
  return null;
}
