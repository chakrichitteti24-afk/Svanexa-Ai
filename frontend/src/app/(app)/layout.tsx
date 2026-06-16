'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
      setLoading(false);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const hideFAB = pathname === '/check-in' || pathname === '/companion' || pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';

  if (!mounted || loading) return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar className="hidden md:flex border-r border-border/40" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
        
        {/* Floating Action Button (FAB) - Mobile Only */}
        {!hideFAB && (
          <Link
            href="/check-in"
            className={cn(
              "md:hidden fixed bottom-20 right-4 z-40",
              "flex items-center justify-center w-14 h-14 rounded-full",
              "bg-gradient-to-r from-pink-500 to-violet-500 text-white",
              "shadow-lg shadow-pink-500/20 active:scale-95 transition-all duration-200 animate-bounce"
            )}
            style={{ animationDuration: '3s' }}
            aria-label="Quick Check-In"
          >
            <Plus className="w-7 h-7 stroke-[2.5px]" />
          </Link>
        )}
        
        <BottomNav />
      </div>
    </div>
  );
}
