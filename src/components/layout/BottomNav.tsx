'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, CalendarHeart, Sparkles, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Check-In', href: '/check-in', icon: CheckSquare },
  { name: 'Cycle', href: '/cycle', icon: CalendarHeart },
  { name: 'AI Companion', href: '/companion', icon: Sparkles },
  { name: 'Reports', href: '/reports', icon: LineChart },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border/40 bg-card/85 backdrop-blur-lg flex items-center justify-around px-2 z-40 md:hidden pb-safe">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-all duration-200 gap-0.5',
              isActive
                ? 'text-primary scale-105'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive ? 'text-primary stroke-[2.5px]' : 'stroke-[2px]')} />
            <span className="truncate max-w-[70px]">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
