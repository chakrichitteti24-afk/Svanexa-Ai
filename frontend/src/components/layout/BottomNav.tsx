'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, CalendarHeart, Award, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';

const mobileNavItems = [
  { name: 'Today', href: '/dashboard', icon: Sparkles },
  { name: 'Cycle', href: '/cycle', icon: CalendarHeart },
  { name: 'Plan', href: '/wellness-plan', icon: Award },
  { name: 'You', href: '/profile', icon: User },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();

  // Hide BottomNav on check-in page so questionnaire action controls are completely unobstructed on mobile
  if (pathname === '/check-in') {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 md:hidden',
        'bg-sidebar/95 border-t border-sidebar-border',
        'backdrop-blur-2xl shadow-[0_-8px_25px_rgba(0,0,0,0.5)] transition-colors duration-300',
        'h-[calc(4rem+env(safe-area-inset-bottom,0px))]',
        'pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]',
        'w-full max-w-full'
      )}
    >
      <div className="grid grid-cols-4 items-center justify-items-center h-full w-full max-w-md mx-auto px-2">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/dashboard' && pathname === '/') ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              onClick={() => triggerHaptic('selection')}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full min-h-[48px] gap-1 px-1 py-1 rounded-2xl transition-all duration-200 select-none relative group cursor-pointer',
                isActive ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground font-medium'
              )}
            >
              {/* Active Ambient Pill Glow */}
              {isActive && (
                <div className="absolute inset-x-2 inset-y-1.5 bg-primary/15 rounded-2xl -z-10 border border-primary/30 shadow-[0_0_12px_var(--primary)]/20" />
              )}

              <div className="relative">
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-primary rounded-full shadow-xs shadow-primary" />
                )}
              </div>

              <span
                className={cn(
                  'text-[11px] leading-none tracking-tight font-medium transition-colors',
                  isActive ? 'text-foreground font-bold' : 'text-muted-foreground'
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
