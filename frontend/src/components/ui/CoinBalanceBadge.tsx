'use client';

import { useHerSync } from '@/context/HerSyncContext';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export function CoinBalanceBadge({ className }: { className?: string }) {
  const { coinBalance, coinAnimation } = useHerSync();

  return (
    <div className={`relative inline-flex items-center ${className || ''}`}>
      <Link
        href="/store"
        aria-label="Svanexa Store - Coin Balance"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 font-semibold text-xs transition-all duration-200 shadow-sm shadow-amber-500/10 group cursor-pointer"
      >
        <span className="text-sm transition-transform duration-200 group-hover:scale-110">🪙</span>
        <span>{coinBalance}</span>
      </Link>

      {/* Floating Micro-Animation when coins are awarded (+10 🪙) */}
      <AnimatePresence>
        {coinAnimation && (
          <motion.div
            key={coinAnimation.id}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -22, scale: 1.1 }}
            exit={{ opacity: 0, y: -35, scale: 0.9 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-50 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-extrabold text-xs px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1 whitespace-nowrap"
          >
            <span>+{coinAnimation.amount}</span>
            <span>🪙</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
