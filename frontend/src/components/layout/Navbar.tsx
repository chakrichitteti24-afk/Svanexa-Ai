'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { CoinBalanceBadge } from '@/components/ui/CoinBalanceBadge';
import Image from 'next/image';
import Link from 'next/link';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 flex items-center justify-between px-4 sticky top-0 z-40 md:hidden bg-[rgba(10,8,18,0.88)] backdrop-blur-2xl border-b border-[rgba(168,85,247,0.1)] shrink-0">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="w-7 h-7 rounded-lg overflow-hidden shadow-md shadow-violet-500/30 relative">
          <Image src="/logo.jpg" alt="Svanexa" fill className="object-cover" />
        </div>
        <span className="text-base font-bold gradient-text tracking-tight">Svanexa</span>
      </Link>

      <div className="flex items-center gap-3">
        {/* Coin Badge */}
        <CoinBalanceBadge />

        {/* Hamburger → Slide-in Sidebar with Auto-Close on Item Select */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="inline-flex items-center justify-center w-9 h-9 rounded-xl hover:bg-white/5 text-[#9d91c4] transition-colors">
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
