'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, CalendarHeart, Sparkles, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Cycle', href: '/cycle', icon: CalendarHeart },
  { name: 'Check-In', href: '/check-in', icon: CheckSquare },
  { name: 'Wellness', href: '/wellness-plan', icon: Sparkles },
  { name: 'Store', href: '/store', icon: ShoppingBag },
  { name: 'Profile', href: '/profile', icon: User },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 md:hidden',
        'bg-[#0a0812]/95 border-t border-purple-500/15',
        'backdrop-blur-2xl shadow-lg shadow-black/50',
        'h-[calc(3.75rem+env(safe-area-inset-bottom))]',
        'pb-[max(0.35rem,env(safe-area-inset-bottom))]',
        'w-full max-w-full overflow-hidden'
      )}
    >
      <div className="grid grid-cols-6 items-center justify-items-center h-full w-full max-w-lg mx-auto px-1">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full min-h-[44px] gap-0.5 px-0.5 py-1 transition-all duration-200 select-none',
                isActive ? 'text-pink-500 font-bold' : 'text-[#7c739d] hover:text-[#b4a9d9] font-medium'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-9 h-6 rounded-full transition-all duration-200',
                  isActive ? 'bg-pink-500/15 text-pink-500 shadow-sm shadow-pink-500/10' : 'bg-transparent'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 transition-transform duration-200',
                    isActive ? 'scale-110 stroke-[2.2px]' : 'stroke-[1.8px]'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] leading-none tracking-tight truncate max-w-full',
                  isActive ? 'text-pink-400 font-bold' : 'text-[#7c739d]'
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
