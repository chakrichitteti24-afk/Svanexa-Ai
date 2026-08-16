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
  const [authState, setAuthState] = useState<'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR'>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const supabase = createClient();

    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isSubscribed) return;

        if (error) {
          console.warn('Session retrieval warning:', error.message);
        }

        if (session?.user) {
          setAuthState('AUTHENTICATED');
          setErrorMessage(null);
        } else {
          setAuthState('UNAUTHENTICATED');
          router.replace('/login');
        }
      } catch (err: any) {
        console.error('Auth verification error in AppLayout:', err);
        if (isSubscribed) {
          // If session cannot be read (network or unauthenticated), guide to login gracefully
          setAuthState('UNAUTHENTICATED');
          router.replace('/login');
        }
      }
    };

    verifySession();

    // Listen to live auth changes (e.g. sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isSubscribed) return;
      if (session?.user) {
        setAuthState('AUTHENTICATED');
        setErrorMessage(null);
      } else if (event === 'SIGNED_OUT' || !session) {
        setAuthState('UNAUTHENTICATED');
        router.replace('/login');
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (authState === 'INITIALIZING' || authState === 'UNAUTHENTICATED') {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <DashboardSkeleton />
      </div>
    );
  }

  if (authState === 'ERROR') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full text-center bg-card/90 border border-border/50 p-8 rounded-3xl shadow-xl space-y-4">
          <p className="text-sm text-muted-foreground">{errorMessage || 'Unable to verify your session.'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-6 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white font-bold text-xs shadow-md"
          >
            Retry
          </button>
        </div>
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
