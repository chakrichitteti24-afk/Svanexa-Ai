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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoinBalanceBadge } from '@/components/ui/CoinBalanceBadge';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PrivacyToggle } from '@/components/ui/PrivacyToggle';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Daily Care Journal', href: '/check-in', icon: CheckSquare },
  { name: 'Cycle & Period Care', href: '/cycle', icon: CalendarHeart },
  { name: 'Skin Care & Glow', href: '/skin', icon: Droplets },
  { name: 'Wellness Care Plan', href: '/wellness-plan', icon: Award },
  { name: 'Svanexa Store', href: '/store', icon: ShoppingBag },
  { name: 'Reports', href: '/reports', icon: LineChart },
  { name: 'Profile', href: '/profile', icon: User },
];

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'w-64 flex flex-col h-full',
        'bg-sidebar border-r border-sidebar-border',
        'backdrop-blur-2xl transition-colors duration-300',
        className
      )}
    >
      {/* Logo + Notification Bell + Privacy + Coin Badge */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-sidebar-border shrink-0 gap-1.5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 group min-w-0">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-primary/20 relative shrink-0">
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
      <div className="flex-1 overflow-auto py-4 px-3 scrollbar-thin">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-primary/15 text-primary-foreground text-white border border-primary/30 shadow-xs ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-xs shadow-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border shrink-0">
        <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed">
          Svanexa AI is not medical advice.
        </p>
      </div>
    </div>
  );
}
