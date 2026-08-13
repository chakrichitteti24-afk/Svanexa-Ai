'use client';

import { useState, useEffect } from 'react';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Sparkles, Check, History, Loader2, Heart, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

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
      await setActiveCustomization(item.type, item.id);
      toast.success(`${item.name} activated!`);
      return;
    }

    if (coinBalance < item.cost) {
      toast.error('Keep checking in to earn more coins.');
      return;
    }

    if (purchasingId) return;

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

  const tabList: { id: 'themes' | 'dashboard' | 'companion' | 'history'; label: string; icon: any }[] = [
    { id: 'themes', label: 'Themes', icon: Sparkles },
    { id: 'dashboard', label: 'Dashboard', icon: ShieldCheck },
    { id: 'companion', label: 'AI Luna', icon: Heart },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12 w-full">
      {/* Top Banner - HarmonyOS Fluid Glass Box */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[rgba(24,18,45,0.92)] to-[rgba(15,12,30,0.92)] p-4 sm:p-6 md:p-8 border border-purple-500/20 shadow-2xl backdrop-blur-2xl"
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] sm:text-xs font-semibold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Svanexa Store</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Visual Rewards & Themes 🪙
            </h1>
            <p className="text-xs sm:text-sm text-[#9d91c4] max-w-xl leading-relaxed">
              Earn Svanexa Coins by completing daily check-ins and tasks. Spend them on custom themes & styles.
            </p>
          </div>

          {/* Balance Widget */}
          <div className="w-full sm:w-auto bg-gradient-to-br from-amber-500/15 to-yellow-500/5 border border-amber-500/30 p-3 sm:p-4 rounded-2xl flex items-center justify-between sm:justify-start gap-3.5 shrink-0 shadow-lg shadow-amber-500/10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">
              🪙
            </div>
            <div className="text-right sm:text-left">
              <p className="text-[11px] sm:text-xs text-amber-300/80 font-medium">Your Balance</p>
              <p className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight">{coinBalance} Coins</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs - HarmonyOS Sliding Pill System */}
      <div className="relative p-1 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
        {tabList.map((tab) => {
          const isSelected = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-200 shrink-0 select-none ${
                isSelected ? 'text-purple-200' : 'text-[#9d91c4] hover:text-white hover:bg-white/5'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeStoreTabPill"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  className="absolute inset-0 bg-purple-500/25 border border-purple-500/40 rounded-xl shadow-md"
                />
              )}
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" />
              <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid of Items */}
      <AnimatePresence mode="wait">
        {activeTab !== 'history' ? (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5"
          >
            {currentCategoryItems.map((item) => {
              const unlocked = isUnlocked(item.type, item.id);
              const active = isActive(item.type, item.id);
              const canAfford = coinBalance >= item.cost;
              const isBusy = purchasingId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  className={`relative group rounded-2xl sm:rounded-3xl p-4 sm:p-5 border backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${
                    active
                      ? 'bg-purple-500/10 border-purple-500/50 shadow-xl shadow-purple-500/15'
                      : unlocked
                      ? 'bg-white/[0.03] border-white/10 hover:border-purple-500/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-purple-500/5'
                      : 'bg-white/[0.02] border-white/5 opacity-90'
                  }`}
                >
                  {/* Item Preview Icon & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${item.previewBg} flex items-center justify-center border border-white/10 shadow-sm shrink-0`}
                    >
                      <span className="text-sm sm:text-base" style={{ color: item.accentColor }}>
                        ●
                      </span>
                    </div>

                    {active ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : unlocked ? (
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] sm:text-xs font-semibold">
                        Unlocked
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] sm:text-xs font-bold flex items-center gap-1">
                        🪙 {item.cost}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-1 mb-4">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{item.name}</h3>
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
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 cursor-pointer active:scale-95'
                        : canAfford
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95'
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
          </motion.div>
        ) : (
          /* Transaction History Tab */
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 backdrop-blur-xl"
          >
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" /> Transaction History Logs
            </h2>

            {loadingTx ? (
              <div className="py-12 flex justify-center text-purple-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#9d91c4] text-center py-8">
                No transactions yet. Complete daily check-ins to earn your first coins!
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white">{tx.description}</p>
                      <p className="text-[10px] text-[#7c71a4]">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ${
                        tx.amount > 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 🪙
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
