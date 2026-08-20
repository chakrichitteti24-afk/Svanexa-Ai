'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  CalendarHeart,
  Award,
  User,
} from 'lucide-react';
import { triggerHaptic } from '@/utils/haptics';

interface NavTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: NavTab[] = [
  { name: 'Today', href: '/dashboard', icon: Sparkles },
  { name: 'Cycle', href: '/cycle', icon: CalendarHeart },
  { name: 'Care Plan', href: '/wellness-plan', icon: Award },
  { name: 'You', href: '/profile', icon: User },
];

export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[rgba(12,10,22,0.92)] backdrop-blur-2xl border-t border-[rgba(168,85,247,0.15)] shadow-[0_-10px_25px_rgba(0,0,0,0.5)] transition-all duration-300 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {TABS.map(tab => {
          const isActive =
            pathname === tab.href ||
            (tab.href === '/dashboard' && pathname === '/') ||
            (tab.href !== '/dashboard' && pathname.startsWith(tab.href));

          const IconComponent = tab.icon;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              prefetch={true}
              onClick={() => triggerHaptic('selection')}
              className={`flex-1 flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200 relative group cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {/* Active Ambient Glow Pill */}
              {isActive && (
                <div className="absolute inset-x-2 inset-y-1 bg-gradient-to-tr from-pink-500/20 via-violet-500/15 to-transparent rounded-2xl -z-10 border border-pink-500/25 shadow-[0_0_12px_rgba(236,72,153,0.2)]" />
              )}

              <div className="relative">
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? 'text-pink-400 scale-110'
                      : 'text-muted-foreground group-hover:text-violet-300'
                  }`}
                />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-pink-400 rounded-full shadow-[0_0_6px_#ec4899]" />
                )}
              </div>

              <span
                className={`text-[11px] mt-0.5 tracking-tight font-medium transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-muted-foreground'
                }`}
              >
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
