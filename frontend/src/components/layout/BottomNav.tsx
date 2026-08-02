'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, CalendarHeart, BrainCircuit, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cycle', href: '/cycle', icon: CalendarHeart },
  { name: 'Check-In', href: '/check-in', icon: CheckSquare },
  { name: 'Profile', href: '/profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 md:hidden',
        'flex items-center justify-around',
        'h-16 pb-safe',
        'bg-[rgba(10,8,18,0.92)] border-t border-[rgba(168,85,247,0.12)]',
        'backdrop-blur-2xl'
      )}
    >
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200',
              isActive ? '' : 'text-[#5a527a] hover:text-[#9d91c4]'
            )}
            style={isActive ? { color: 'var(--hs-pink)' } : {}}
          >
            <div
              className={cn(
                'flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200'
              )}
              style={isActive ? { background: 'var(--hs-glow-pink)' } : {}}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  isActive ? 'stroke-[2px]' : 'stroke-[1.8px]'
                )}
              />
            </div>
            <span
              className={cn(
                'text-[10px] font-medium leading-none',
                isActive ? '' : 'text-[#5a527a]'
              )}
              style={isActive ? { color: 'var(--hs-pink)' } : {}}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
