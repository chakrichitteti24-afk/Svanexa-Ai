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
              {/* Active Apple Frosted Pill */}
              {isActive && (
                <div className="absolute inset-x-2 inset-y-1 bg-white/[0.12] rounded-2xl -z-10 border border-white/[0.15] shadow-sm" />
              )}

              <div className="relative">
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive
                      ? 'text-foreground scale-105'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
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
