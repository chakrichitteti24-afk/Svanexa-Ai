'use client';

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { CoinBalanceBadge } from '@/components/ui/CoinBalanceBadge';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import Image from 'next/image';
import Link from 'next/link';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 flex items-center justify-between px-4 sticky top-0 z-40 md:hidden bg-background/80 backdrop-blur-3xl border-b border-border/40 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05)] shrink-0 transition-colors duration-300">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 group apple-tactile">
        <div className="w-7 h-7 rounded-lg overflow-hidden shadow-md shadow-primary/25 ring-1 ring-white/20 relative">
          <Image src="/logo.jpg" alt="Svanexa" fill className="object-cover" />
        </div>
        <span className="text-base font-bold gradient-text tracking-tight">Svanexa</span>
      </Link>

      <div className="flex items-center gap-1.5">
        {/* Language Switcher */}
        <LanguageSelector variant="compact" align="end" />

        {/* Privacy Glance Toggle */}
        <PrivacyToggle />

        {/* Notification Bell */}
        <NotificationBell dropdownAlign="right" />

        {/* Coin Badge */}
        <CoinBalanceBadge />

        {/* Hamburger → Slide-in Sidebar with Auto-Close on Item Select */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer apple-tactile">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-72 border-r-0 bg-transparent"
          >
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="h-full flex flex-col">
              <Sidebar className="w-full flex" onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

