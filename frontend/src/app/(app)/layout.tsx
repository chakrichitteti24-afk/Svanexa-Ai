'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { HerSyncProvider, useHerSync } from '@/context/HerSyncContext';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return;
      }
      
      setMounted(true);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  if (!mounted || loading) return <div className="min-h-screen bg-background" />;

  const isCompanion = pathname === '/companion';
  const hideFAB = isCompanion || pathname === '/check-in' || pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';

  return (
    <HerSyncProvider>
      <ThemeSync />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar className="hidden md:flex border-r border-border/40 shrink-0" />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Hide global mobile navbar on companion page to avoid double headers */}
          {!isCompanion && <Navbar />}
          
          <main
            className={cn(
              'flex-1 flex flex-col',
              isCompanion
                ? 'p-0 overflow-hidden'
                : 'overflow-y-auto p-4 md:p-8 pb-20 md:pb-8'
            )}
          >
            {children}
          </main>
          
          {/* Floating Action Button (FAB) - Mobile Only */}
          {!hideFAB && (
            <Link
              href="/check-in"
              className={cn(
                "md:hidden fixed bottom-20 right-4 z-40",
                "flex items-center justify-center w-14 h-14 rounded-full",
                "text-white",
                "shadow-lg active:scale-95 transition-all duration-200 animate-bounce"
              )}
              style={{ background: 'linear-gradient(135deg, var(--hs-violet), var(--hs-pink))', boxShadow: '0 8px 20px var(--hs-glow-pink)', animationDuration: '3s' }}
              aria-label="Quick Check-In"
            >
              <Plus className="w-7 h-7 stroke-[2.5px]" />
            </Link>
          )}
          
          {/* Hide bottom nav on companion page so chat is truly fullscreen with fixed input */}
          {!isCompanion && <BottomNav />}
        </div>
      </div>
    </HerSyncProvider>
  );
}

function ThemeSync() {
  const { wellnessMode } = useHerSync();
  useEffect(() => {
    document.body.setAttribute('data-mode', wellnessMode);
  }, [wellnessMode]);
  return null;
}
