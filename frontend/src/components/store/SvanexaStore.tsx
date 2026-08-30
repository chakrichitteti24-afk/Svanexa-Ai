'use client';

import { useState, useEffect } from 'react';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, History, Loader2, Heart, ShieldCheck, Coins } from 'lucide-react';
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
    previewBg: 'from-purple-600/40 via-fuchsia-500/30 to-pink-500/30',
    accentColor: '#a855f7',
  },
  {
    id: 'lavender',
    name: 'Lavender Dreams',
    type: 'theme',
    cost: 50,
    description: 'Soft glass and soothing lavender tones',
    previewBg: 'from-purple-500/50 via-indigo-400/40 to-slate-800/40',
    accentColor: '#c084fc',
  },
  {
    id: 'rose',
    name: 'Rose Bloom',
    type: 'theme',
    cost: 50,
    description: 'Blush coral and graceful rose glow',
    previewBg: 'from-rose-500/50 via-pink-400/40 to-slate-800/40',
    accentColor: '#fb7185',
  },
  {
    id: 'ocean',
    name: 'Ocean Breeze',
    type: 'theme',
    cost: 50,
    description: 'Cyan waters and refreshing sky blue',
    previewBg: 'from-sky-500/50 via-cyan-400/40 to-slate-800/40',
    accentColor: '#38bdf8',
  },
  {
    id: 'midnight',
    name: 'Midnight Galaxy',
    type: 'theme',
    cost: 50,
    description: 'Dark galaxy violet and space indigo',
    previewBg: 'from-indigo-600/50 via-purple-900/40 to-slate-950/60',
    accentColor: '#818cf8',
  },
  {
    id: 'sage',
    name: 'Calm Sage',
    type: 'theme',
    cost: 50,
    description: 'Eucalyptus green and natural sage',
    previewBg: 'from-emerald-500/50 via-teal-400/40 to-slate-800/40',
    accentColor: '#34d399',
  },
  {
    id: 'sunrise',
    name: 'Warm Sunrise',
    type: 'theme',
    cost: 50,
    description: 'Golden hour amber and soft peach',
    previewBg: 'from-amber-500/50 via-orange-400/40 to-slate-800/40',
    accentColor: '#fbbf24',
  },
  {
    id: 'cherry',
    name: 'Cherry Blossom',
    type: 'theme',
    cost: 75,
    description: 'Delicate sakura pink and warm blush tones',
    previewBg: 'from-pink-400/50 via-rose-300/40 to-pink-900/40',
    accentColor: '#f472b6',
  },
  {
    id: 'arctic',
    name: 'Arctic Frost',
    type: 'theme',
    cost: 75,
    description: 'Crisp icy blue and silver shimmer',
    previewBg: 'from-blue-300/50 via-slate-400/30 to-slate-900/50',
    accentColor: '#93c5fd',
  },
  {
    id: 'neon',
    name: 'Neon Pulse',
    type: 'theme',
    cost: 100,
    description: 'Electric violet and cyberpunk neon glow',
    previewBg: 'from-violet-600/60 via-fuchsia-500/50 to-pink-600/40',
    accentColor: '#d946ef',
  },
  {
    id: 'honey',
    name: 'Golden Honey',
    type: 'theme',
    cost: 75,
    description: 'Warm honey gold and caramel warmth',
    previewBg: 'from-yellow-500/50 via-amber-400/40 to-orange-900/40',
    accentColor: '#f59e0b',
  },
  {
    id: 'storm',
    name: 'Storm Cloud',
    type: 'theme',
    cost: 75,
    description: 'Moody grey and dramatic deep slate',
    previewBg: 'from-slate-500/50 via-zinc-600/40 to-slate-950/60',
    accentColor: '#94a3b8',
  },
  {
    id: 'mint',
    name: 'Mint Fresh',
    type: 'theme',
    cost: 50,
    description: 'Cool spearmint green and soft aqua',
    previewBg: 'from-green-400/50 via-teal-300/40 to-slate-800/40',
    accentColor: '#4ade80',
  },
  {
    id: 'twilight',
    name: 'Twilight Dusk',
    type: 'theme',
    cost: 100,
    description: 'Deep plum, dusk orange and violet horizon',
    previewBg: 'from-purple-900/60 via-rose-800/40 to-orange-900/30',
    accentColor: '#c026d3',
  },
];


const DASHBOARD_STYLE_ITEMS: StoreItem[] = [
  {
    id: 'minimal',
    name: 'Minimal Clean',
    type: 'dashboard_style',
    cost: 0,
    description: 'Uncluttered layout with fine borders',
    previewBg: 'from-slate-700/40 to-slate-900/60',
    accentColor: '#94a3b8',
  },
  {
    id: 'soft_glow',
    name: 'Soft Glow',
    type: 'dashboard_style',
    cost: 40,
    description: 'Ambient neon glow around widgets',
    previewBg: 'from-purple-500/40 to-pink-500/40',
    accentColor: '#e879f9',
  },
  {
    id: 'nature',
    name: 'Nature Serenity',
    type: 'dashboard_style',
    cost: 40,
    description: 'Organic green highlights & borders',
    previewBg: 'from-emerald-500/40 to-teal-500/40',
    accentColor: '#34d399',
  },
  {
    id: 'calm',
    name: 'Calm Waters',
    type: 'dashboard_style',
    cost: 40,
    description: 'Tranquil ocean blue borders',
    previewBg: 'from-sky-500/40 to-blue-500/40',
    accentColor: '#38bdf8',
  },
  {
    id: 'crystal',
    name: 'Crystal Glass',
    type: 'dashboard_style',
    cost: 60,
    description: 'Ultra-clean glassmorphism with frosted panels',
    previewBg: 'from-white/10 via-white/5 to-slate-900/40',
    accentColor: '#e2e8f0',
  },
  {
    id: 'rose_gold',
    name: 'Rose Gold',
    type: 'dashboard_style',
    cost: 60,
    description: 'Luxury rose gold accents and soft warmth',
    previewBg: 'from-rose-400/40 via-pink-300/30 to-amber-700/20',
    accentColor: '#fb7185',
  },
  {
    id: 'midnight_ink',
    name: 'Midnight Ink',
    type: 'dashboard_style',
    cost: 60,
    description: 'Bold dark editorial with sharp contrast',
    previewBg: 'from-zinc-900/80 via-slate-950/70 to-black/60',
    accentColor: '#a78bfa',
  },
  {
    id: 'retro_wave',
    name: 'Retro Wave',
    type: 'dashboard_style',
    cost: 80,
    description: 'Synthwave neon gradients and vaporwave vibes',
    previewBg: 'from-fuchsia-600/50 via-purple-700/40 to-blue-900/40',
    accentColor: '#e879f9',
  },
  {
    id: 'parchment',
    name: 'Warm Parchment',
    type: 'dashboard_style',
    cost: 40,
    description: 'Earthy warm tones and natural minimalism',
    previewBg: 'from-stone-500/40 via-amber-800/30 to-stone-900/50',
    accentColor: '#d6d3d1',
  },
];


const COMPANION_STYLE_ITEMS: StoreItem[] = [
  {
    id: 'friendly',
    name: 'Friendly Luna',
    type: 'companion_style',
    cost: 0,
    description: 'Warm, encouraging & supportive',
    previewBg: 'from-pink-500/40 to-purple-500/40',
    accentColor: '#ec4899',
  },
  {
    id: 'calm',
    name: 'Calm & Mindful',
    type: 'companion_style',
    cost: 30,
    description: 'Gentle, soothing & relaxing',
    previewBg: 'from-teal-500/40 to-sky-500/40',
    accentColor: '#2dd4bf',
  },
  {
    id: 'focus',
    name: 'Goal & Focus',
    type: 'companion_style',
    cost: 30,
    description: 'Structured & concise guidance',
    previewBg: 'from-indigo-500/40 to-blue-500/40',
    accentColor: '#6366f1',
  },
  {
    id: 'joy',
    name: 'Joyful & Bright',
    type: 'companion_style',
    cost: 30,
    description: 'Upbeat & cheerful energy',
    previewBg: 'from-amber-500/40 to-orange-500/40',
    accentColor: '#f59e0b',
  },
  {
    id: 'sage',
    name: 'Wise Sage',
    type: 'companion_style',
    cost: 50,
    description: 'Thoughtful, philosophical & deeply insightful',
    previewBg: 'from-violet-600/40 to-indigo-700/40',
    accentColor: '#8b5cf6',
  },
  {
    id: 'coach',
    name: 'Bold Coach',
    type: 'companion_style',
    cost: 50,
    description: 'No-nonsense, direct & motivating energy',
    previewBg: 'from-red-500/40 to-orange-600/40',
    accentColor: '#ef4444',
  },
  {
    id: 'playful',
    name: 'Witty & Playful',
    type: 'companion_style',
    cost: 50,
    description: 'Light humour, fun facts & playful banter',
    previewBg: 'from-yellow-400/40 to-lime-500/40',
    accentColor: '#facc15',
  },
  {
    id: 'empath',
    name: 'Empathy First',
    type: 'companion_style',
    cost: 60,
    description: 'Deep emotional support, validation & care',
    previewBg: 'from-rose-500/40 to-fuchsia-600/40',
    accentColor: '#f43f5e',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    type: 'companion_style',
    cost: 60,
    description: 'Cozy late-night companion with soft night vibes',
    previewBg: 'from-slate-700/50 via-indigo-900/40 to-black/50',
    accentColor: '#818cf8',
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
    let ignore = false;
    if (activeTab === 'history') {
      const loadHistory = async () => {
        setLoadingTx(true);
        try {
          const res = await fetch('/api/coins/transactions');
          const data = await res.json();
          if (!ignore && data.success) {
            setTransactions(data.data || []);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (!ignore) setLoadingTx(false);
        }
      };
      loadHistory();
    }
    return () => {
      ignore = true;
    };
  }, [activeTab]);

  const isUnlocked = (type: string, id: string) => {
    if (id === 'default' || id === 'minimal' || id === 'friendly') return true;
    return unlockedItems.some((item) => item.type === type && item.itemId === id);
  };

  const isActive = (type: string, id: string) => {
    if (type === 'theme') return (activeTheme || 'default') === id;
    if (type === 'dashboard_style') return (activeDashboardStyle || 'minimal') === id;
    if (type === 'companion_style') return (activeCompanionStyle || 'friendly') === id;
    return false;
  };

  const handleAction = async (item: StoreItem) => {
    const unlocked = isUnlocked(item.type, item.id);
    const active = isActive(item.type, item.id);

    if (active) return;

    if (unlocked) {
      try {
        await setActiveCustomization(item.type, item.id);
        toast.success(`${item.name} applied!`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to apply style');
      }
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
        toast.success(`🎉 ${item.name} unlocked & applied!`);
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
    <div className="space-y-5 max-w-4xl mx-auto pb-16 w-full px-1 sm:px-0">
      {/* Ultra-Minimal Header */}
      <div className="flex items-center justify-between gap-4 pt-1 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Store
          </h1>
          <p className="text-xs text-[#9d91c4]">Personalize your app appearance</p>
        </div>

        {/* Minimal Balance Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold shadow-sm">
          <span>🪙</span>
          <span>{coinBalance} Coins</span>
        </div>
      </div>

      {/* Segmented Filter Control */}
      <div className="p-1 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
        {tabList.map((tab) => {
          const isSelected = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-150 shrink-0 select-none ${
                isSelected ? 'text-white font-semibold' : 'text-[#9d91c4] hover:text-white'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="minimalStoreTab"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  className="absolute inset-0 bg-white/10 border border-white/15 rounded-xl shadow-sm"
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Minimal Item Grid */}
      <AnimatePresence mode="wait">
        {activeTab !== 'history' ? (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5"
          >
            {currentCategoryItems.map((item) => {
              const unlocked = isUnlocked(item.type, item.id);
              const active = isActive(item.type, item.id);
              const canAfford = coinBalance >= item.cost;
              const isBusy = purchasingId === item.id;

              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between space-y-3.5 ${
                    active
                      ? 'bg-purple-500/10 border-purple-500/40 shadow-md shadow-purple-500/10'
                      : unlocked
                      ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      : 'bg-white/[0.015] border-white/5 opacity-85 hover:opacity-100'
                  }`}
                >
                  {/* Visual Preview Box */}
                  <div
                    className={`w-full h-20 rounded-xl bg-gradient-to-br ${item.previewBg} border border-white/10 relative overflow-hidden flex items-end p-2.5 shadow-inner`}
                  >
                    <span className="text-xs font-semibold text-white/90 drop-shadow">
                      {item.name}
                    </span>
                  </div>

                  {/* Minimal Subtext */}
                  <p className="text-[11px] text-[#9d91c4] leading-normal line-clamp-2">
                    {item.description}
                  </p>

                  {/* Clean Action Button */}
                  <button
                    onClick={() => handleAction(item)}
                    disabled={isBusy || (!unlocked && !canAfford)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                        : unlocked
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm cursor-pointer'
                        : canAfford
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm cursor-pointer font-bold'
                        : 'bg-white/5 text-[#7c71a4] border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : active ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Active
                      </>
                    ) : unlocked ? (
                      'Apply'
                    ) : canAfford ? (
                      <>Unlock ({item.cost} 🪙)</>
                    ) : (
                      <>{item.cost} 🪙</>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3"
          >
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-purple-400" /> Transaction History
            </h2>

            {loadingTx ? (
              <div className="py-8 flex justify-center text-purple-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-[#9d91c4] text-center py-6">
                No transactions yet. Complete daily check-ins to earn coins!
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-medium text-white">{tx.description}</p>
                      <p className="text-[10px] text-[#7c71a4]">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`font-bold text-xs ${
                        tx.amount > 0 ? 'text-emerald-400' : 'text-amber-400'
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
