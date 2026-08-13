'use client';

import { useState, useEffect } from 'react';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Sparkles, Check, Lock, History, Loader2, ArrowLeft, Heart, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface StoreItem {
  id: string;
  name: string;
  type: 'theme' | 'dashboard_style' | 'companion_style';
  cost: number;
  description: string;
  previewBg: string;
  accentColor: string;
}

const THEME_ITEMS: StoreItem[] = [
  {
    id: 'default',
    name: 'Default Wellness',
    type: 'theme',
    cost: 0,
    description: 'Classic HerSync purple and rose glow',
    previewBg: 'from-violet-600/30 to-pink-500/20',
    accentColor: '#a855f7',
  },
  {
    id: 'lavender',
    name: 'Lavender Dreams',
    type: 'theme',
    cost: 50,
    description: 'Soft purple glass and soothing lavender tones',
    previewBg: 'from-purple-500/40 to-indigo-400/20',
    accentColor: '#c084fc',
  },
  {
    id: 'rose',
    name: 'Rose Bloom',
    type: 'theme',
    cost: 50,
    description: 'Warm blush coral and graceful rose petals',
    previewBg: 'from-rose-500/40 to-pink-400/20',
    accentColor: '#fb7185',
  },
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    type: 'theme',
    cost: 50,
    description: 'Deep cyan waters and refreshing sky blue',
    previewBg: 'from-sky-500/40 to-cyan-400/20',
    accentColor: '#38bdf8',
  },
  {
    id: 'midnight',
    name: 'Midnight Galaxy',
    type: 'theme',
    cost: 50,
    description: 'Sleek dark violet and deep space indigo',
    previewBg: 'from-indigo-600/40 to-slate-900/40',
    accentColor: '#818cf8',
  },
  {
    id: 'sage',
    name: 'Calm Sage',
    type: 'theme',
    cost: 50,
    description: 'Eucalyptus green and natural sage harmony',
    previewBg: 'from-emerald-500/40 to-teal-400/20',
    accentColor: '#34d399',
  },
  {
    id: 'sunrise',
    name: 'Warm Sunrise',
    type: 'theme',
    cost: 50,
    description: 'Golden hour amber and peach glow',
    previewBg: 'from-amber-500/40 to-orange-400/20',
    accentColor: '#fbbf24',
  },
];

const DASHBOARD_STYLE_ITEMS: StoreItem[] = [
  {
    id: 'minimal',
    name: 'Minimal Clean',
    type: 'dashboard_style',
    cost: 0,
    description: 'Sleek, uncluttered layout with fine borders',
    previewBg: 'from-slate-800/40 to-slate-900/40',
    accentColor: '#94a3b8',
  },
  {
    id: 'soft_glow',
    name: 'Soft Glow',
    type: 'dashboard_style',
    cost: 40,
    description: 'Ambient neon glow around health widgets',
    previewBg: 'from-purple-500/30 to-pink-500/30',
    accentColor: '#e879f9',
  },
  {
    id: 'nature',
    name: 'Nature Serenity',
    type: 'dashboard_style',
    cost: 40,
    description: 'Organic green highlights and soothing borders',
    previewBg: 'from-emerald-500/30 to-teal-500/30',
    accentColor: '#34d399',
  },
  {
    id: 'calm',
    name: 'Calm Waters',
    type: 'dashboard_style',
    cost: 40,
    description: 'Tranquil ocean blue borders and subtle shimmers',
    previewBg: 'from-sky-500/30 to-blue-500/30',
    accentColor: '#38bdf8',
  },
];

const COMPANION_STYLE_ITEMS: StoreItem[] = [
  {
    id: 'friendly',
    name: 'Friendly Luna',
    type: 'companion_style',
    cost: 0,
    description: 'Warm, encouraging, and supportive companion',
    previewBg: 'from-pink-500/30 to-purple-500/30',
    accentColor: '#ec4899',
  },
  {
    id: 'calm',
    name: 'Calm & Mindful',
    type: 'companion_style',
    cost: 30,
    description: 'Gentle, soothing tone prioritizing relaxation',
    previewBg: 'from-teal-500/30 to-sky-500/30',
    accentColor: '#2dd4bf',
  },
  {
    id: 'focus',
    name: 'Goal & Focus',
    type: 'companion_style',
    cost: 30,
    description: 'Structured, concise guidance for routines',
    previewBg: 'from-indigo-500/30 to-blue-500/30',
    accentColor: '#6366f1',
  },
  {
    id: 'joy',
    name: 'Joyful & Bright',
    type: 'companion_style',
    cost: 30,
    description: 'Upbeat, cheerful energy for daily motivation',
    previewBg: 'from-amber-500/30 to-orange-500/30',
    accentColor: '#f59e0b',
  },
];

export function SvanexaStore() {
  const {
    coinBalance,
    unlockedItems,
    activeTheme,
    activeDashboardStyle,
    activeCompanionStyle,
    purchaseItem,
    setActiveCustomization,
  } = useHerSync();

  const [activeTab, setActiveTab] = useState<'themes' | 'dashboard' | 'companion' | 'history'>('themes');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      setLoadingTx(true);
      fetch('/api/coins/transactions')
        .then((res) => res.json())
        .then((res) => {
          if (res.success) setTransactions(res.data || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingTx(false));
    }
  }, [activeTab]);

  const isUnlocked = (type: string, id: string) => {
    if (id === 'default' || id === 'minimal' || id === 'friendly') return true;
    return unlockedItems.some((item) => item.type === type && item.itemId === id);
  };

  const isActive = (type: string, id: string) => {
    if (type === 'theme') return activeTheme === id;
    if (type === 'dashboard_style') return activeDashboardStyle === id;
    if (type === 'companion_style') return activeCompanionStyle === id;
    return false;
  };

  const handleAction = async (item: StoreItem) => {
    const unlocked = isUnlocked(item.type, item.id);
    const active = isActive(item.type, item.id);

    if (active) return;

    if (unlocked) {
      // Apply customization
      await setActiveCustomization(item.type, item.id);
      toast.success(`${item.name} activated!`);
      return;
    }

    // Purchase check
    if (coinBalance < item.cost) {
      toast.error('Keep checking in to earn more coins.');
      return;
    }

    if (purchasingId) return; // double-click protection

    setPurchasingId(item.id);
    try {
      const success = await purchaseItem(item.type, item.id, item.cost, item.name);
      if (success) {
        toast.success(`🎉 ${item.name} unlocked!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Purchase failed');
    } finally {
      setPurchasingId(null);
    }
  };

  const currentCategoryItems =
    activeTab === 'themes'
      ? THEME_ITEMS
      : activeTab === 'dashboard'
      ? DASHBOARD_STYLE_ITEMS
      : activeTab === 'companion'
      ? COMPANION_STYLE_ITEMS
      : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[rgba(24,18,45,0.9)] to-[rgba(15,12,30,0.9)] p-6 md:p-8 border border-purple-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Svanexa Store</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Visual Rewards & Themes 🪙
            </h1>
            <p className="text-sm text-[#9d91c4] max-w-xl">
              Earn Svanexa Coins by staying consistent with your daily check-ins and wellness tasks. Spend them on optional themes and customization styles.
            </p>
          </div>

          {/* Balance Widget */}
          <div className="bg-gradient-to-br from-amber-500/15 to-yellow-500/5 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4 shrink-0 shadow-lg shadow-amber-500/10">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl shadow-inner">
              🪙
            </div>
            <div>
              <p className="text-xs text-amber-300/80 font-medium">Your Balance</p>
              <p className="text-2xl font-black text-amber-300 tracking-tight">{coinBalance} Coins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/10">
        <button
          onClick={() => setActiveTab('themes')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'themes'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-[#9d91c4] hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Themes</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'dashboard'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-[#9d91c4] hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Dashboard Styles</span>
        </button>

        <button
          onClick={() => setActiveTab('companion')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'companion'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-[#9d91c4] hover:text-white hover:bg-white/5'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>AI Companion Styles</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'history'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md'
              : 'text-[#9d91c4] hover:text-white hover:bg-white/5'
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>
      </div>

      {/* Grid of Items */}
      {activeTab !== 'history' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentCategoryItems.map((item) => {
            const unlocked = isUnlocked(item.type, item.id);
            const active = isActive(item.type, item.id);
            const canAfford = coinBalance >= item.cost;
            const isBusy = purchasingId === item.id;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.025, y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                className={`relative group rounded-3xl p-5 border backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${
                  active
                    ? 'bg-purple-500/10 border-purple-500/50 shadow-xl shadow-purple-500/15'
                    : unlocked
                    ? 'bg-white/[0.03] border-white/10 hover:border-purple-500/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-purple-500/5'
                    : 'bg-white/[0.02] border-white/5 opacity-90'
                }`}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.previewBg} flex items-center justify-center border border-white/10 shadow-sm`}
                  >
                    <span className="text-base" style={{ color: item.accentColor }}>
                      ●
                    </span>
                  </div>

                  {active ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  ) : unlocked ? (
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1">
                      🪙 {item.cost}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-1 mb-5">
                  <h3 className="text-base font-bold text-white tracking-tight">{item.name}</h3>
                  <p className="text-xs text-[#9d91c4] leading-relaxed">{item.description}</p>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleAction(item)}
                  disabled={isBusy || (!unlocked && !canAfford)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                      : unlocked
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 cursor-pointer'
                      : canAfford
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer'
                      : 'bg-white/5 text-[#7c71a4] border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Unlocking...
                    </>
                  ) : active ? (
                    'Applied'
                  ) : unlocked ? (
                    'Apply Theme'
                  ) : canAfford ? (
                    <>Unlock for {item.cost} 🪙</>
                  ) : (
                    <>Need {item.cost - coinBalance} more 🪙</>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Transaction History Tab */
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" /> Transaction Logs
          </h2>

          {loadingTx ? (
            <div className="py-12 flex justify-center text-purple-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-[#9d91c4] text-center py-8">
              No transactions yet. Complete daily check-ins to earn your first coins!
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-white">{tx.description}</p>
                    <p className="text-[10px] text-[#7c71a4]">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      tx.amount > 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 🪙
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
