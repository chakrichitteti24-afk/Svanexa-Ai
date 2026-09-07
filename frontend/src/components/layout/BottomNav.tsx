'use client';

import { memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, CalendarHeart, Award, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { useTranslation } from '@/i18n/useTranslation';

interface MobileNavItemConfig {
  key: 'today' | 'cycle' | 'plan' | 'you';
  href: string;
  icon: any;
}

const mobileNavConfig: MobileNavItemConfig[] = [
  { key: 'today', href: '/dashboard', icon: Sparkles },
  { key: 'cycle', href: '/cycle', icon: CalendarHeart },
  { key: 'plan', href: '/wellness-plan', icon: Award },
  { key: 'you', href: '/profile', icon: User },
];

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  // Hide BottomNav on check-in page so questionnaire action controls are completely unobstructed on mobile
  if (pathname === '/check-in') {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-6 max-w-md mx-auto z-40 md:hidden',
        'apple-dock h-[62px] px-2 py-1.5',
        'transition-all duration-300 select-none'
      )}
    >
      <div className="grid grid-cols-4 items-center justify-items-center h-full w-full relative">
        {mobileNavConfig.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/dashboard' && pathname === '/') ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const label = t(`nav.${item.key}`);

          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch={true}
              onClick={() => triggerHaptic('selection')}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full min-h-[44px] gap-0.5 px-1 py-1 rounded-full transition-colors duration-150 select-none relative group cursor-pointer apple-tactile',
                isActive ? 'text-foreground font-semibold' : 'text-muted-foreground/80 hover:text-foreground font-medium'
              )}
            >
              {/* Apple Spring Active Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="apple-dock-active-pill"
                  className="absolute inset-x-1.5 inset-y-1 bg-white/[0.12] rounded-full -z-10 border border-white/[0.14] shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 32,
                    mass: 0.8,
                  }}
                />
              )}

              <div className="relative">
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'text-primary scale-105' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                {isActive && (
                  <motion.span
                    layoutId="apple-dock-dot"
                    className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-primary rounded-full"
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
              </div>

              <span
                className={cn(
                  'text-[10.5px] leading-tight tracking-tight font-medium transition-colors',
                  isActive ? 'text-foreground font-semibold' : 'text-muted-foreground/80'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

