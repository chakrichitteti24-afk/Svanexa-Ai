'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  CalendarHeart,
  Droplets,
  LineChart,
  Award,
  User,
  ShoppingBag,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoinBalanceBadge } from '@/components/ui/CoinBalanceBadge';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PrivacyToggle } from '@/components/ui/PrivacyToggle';

import { useTranslation } from '@/i18n/useTranslation';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

interface NavItemConfig {
  key: 'dashboard' | 'checkin' | 'cycle' | 'skin' | 'wellness' | 'rewards' | 'store' | 'reports' | 'profile';
  href: string;
  icon: any;
}

const navItemsConfig: NavItemConfig[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'checkin', href: '/check-in', icon: CheckSquare },
  { key: 'cycle', href: '/cycle', icon: CalendarHeart },
  { key: 'skin', href: '/skin', icon: Droplets },
  { key: 'wellness', href: '/wellness-plan', icon: Award },
  { key: 'rewards', href: '/rewards', icon: Gift },
  { key: 'store', href: '/store', icon: ShoppingBag },
  { key: 'reports', href: '/reports', icon: LineChart },
  { key: 'profile', href: '/profile', icon: User },
];

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        'w-64 flex flex-col h-full select-none',
        'bg-sidebar/85 border-r border-sidebar-border',
        'backdrop-blur-3xl shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] transition-colors duration-300',
        className
      )}
    >
      {/* Logo + Notification Bell + Privacy + Coin Badge */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-sidebar-border/80 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.04)] shrink-0 gap-1.5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 group min-w-0 apple-tactile">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-primary/25 ring-1 ring-white/20 relative shrink-0">
            <Image src="/logo.jpg" alt="Svanexa" fill className="object-cover" />
          </div>
          <span className="text-lg font-bold gradient-text tracking-tight truncate">Svanexa</span>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <PrivacyToggle />
          <NotificationBell dropdownAlign="left" />
          <CoinBalanceBadge />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-3.5 px-3 scrollbar-thin">
        <nav className="space-y-1">
          {navItemsConfig.map((item) => {
            const isActive = pathname === item.href;
            const label = t(`nav.${item.key}`);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group apple-tactile',
                  isActive
                    ? 'bg-primary/20 text-foreground font-semibold border border-primary/35 shadow-[0_2px_12px_var(--primary)]/15 ring-1 ring-primary/25'
                    : 'text-muted-foreground/90 hover:text-foreground hover:bg-white/[0.07]'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 shrink-0 transition-transform duration-150',
                    isActive ? 'text-primary scale-105 drop-shadow-[0_1px_6px_var(--primary)]/40' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <span className="flex-1 truncate">{label}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer with Language Selector & Medical Disclaimer */}
      <div className="px-3 py-3 border-t border-sidebar-border/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] shrink-0 space-y-2">
        <LanguageSelector variant="pill" />
        <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed">
          {t('nav.disclaimer')}
        </p>
      </div>
    </aside>
  );
}
