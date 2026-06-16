'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function Navbar() {
  return (
    <header className="h-16 border-b border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-pink-500" />
        <span className="font-bold">HerSync</span>
      </Link>
      <Sheet>
        <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground">
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="h-full flex flex-col">
            <Sidebar />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
