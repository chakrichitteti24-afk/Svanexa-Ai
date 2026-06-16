'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, CalendarHeart, Sparkles, Droplets, LineChart, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Daily Check-In', href: '/check-in', icon: CheckSquare },
  { name: 'Cycle Tracker', href: '/cycle', icon: CalendarHeart },
  { name: 'Skin Tracker', href: '/skin', icon: Droplets },
  { name: 'AI Companion', href: '/companion', icon: Sparkles },
  { name: '✨ Wellness Plan (Premium)', href: '/wellness-plan', icon: Award },
  { name: 'Reports', href: '/reports', icon: LineChart },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn("w-64 flex flex-col h-full bg-card", className)}>
      <div className="h-16 flex items-center px-6 border-b border-border/40">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-pink-500" />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            HerSync
          </span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-6 px-4">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-primary' : '')} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
