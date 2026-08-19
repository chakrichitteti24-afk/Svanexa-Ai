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
        'bg-[rgba(10,8,18,0.96)] border-r border-[rgba(168,85,247,0.1)]',
        'backdrop-blur-2xl',
        className
      )}
    >
      {/* Logo + Notification Bell + Privacy + Coin Badge */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-[rgba(168,85,247,0.1)] shrink-0 gap-1.5">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 group min-w-0">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-violet-500/30 relative shrink-0">
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
                    ? 'bg-gradient-to-r from-pink-500/20 to-violet-500/15 text-white border border-pink-500/20'
                    : 'text-[#7c71a4] hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4.5 w-4.5 shrink-0',
                    isActive ? 'text-pink-400' : 'text-[#7c71a4] group-hover:text-violet-400'
                  )}
                />
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-pink-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[rgba(168,85,247,0.1)] shrink-0">
        <p className="text-[10px] text-[#7c71a4] text-center leading-relaxed">
          Svanexa AI is not medical advice.
        </p>
      </div>
    </div>
  );
}
