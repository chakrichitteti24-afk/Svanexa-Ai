'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Coins, Loader2, AlertCircle, Star } from 'lucide-react';
import { apiFetch } from '@/utils/api-client';
import { useHerSync } from '@/context/HerSyncContext';

type Slot = 'morning' | 'afternoon' | 'evening';

interface SlotRewardState {
  claimed: boolean;
  claiming: boolean;
  error: string | null;
  justClaimed: boolean; // triggers brief animation
}

interface CheckinRewardBarProps {
  /** Which slots have been successfully completed */
  completedSlots: Partial<Record<Slot, boolean>>;
  /** Which slots are already claimed (from server) */
  initialClaimedSlots: Partial<Record<Slot, boolean>>;
  /** Whether the daily bonus has already been claimed */
  initialBonusClaimed: boolean;
  /** Active slot for this session */
  activeSlot: Slot;
}

const SLOT_CONFIG: Record<Slot, { label: string; icon: string; color: string; bgColor: string }> = {
  morning:   { label: 'Morning',   icon: '🌅', color: 'text-amber-500',  bgColor: 'bg-amber-500/10 border-amber-500/25' },
  afternoon: { label: 'Afternoon', icon: '☀️', color: 'text-orange-500', bgColor: 'bg-orange-500/10 border-orange-500/25' },
  evening:   { label: 'Evening',   icon: '🌙', color: 'text-violet-500', bgColor: 'bg-violet-500/10 border-violet-500/25' },
};

/** Floating +10 coin particle shown after a successful claim */
function CoinBurst({ amount, onDone }: { amount: number; onDone: () => void }) {
  return (
    <motion.div
      className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none z-50 flex items-center gap-1 text-amber-400 font-extrabold text-lg drop-shadow-lg select-none"
      initial={{ opacity: 1, y: 0, scale: 0.8 }}
      animate={{ opacity: 0, y: -40, scale: 1.2 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      <span>🪙</span>
      <span>+{amount}</span>
    </motion.div>
  );
}

export function CheckinRewardBar({
  completedSlots,
  initialClaimedSlots,
  initialBonusClaimed,
  activeSlot,
}: CheckinRewardBarProps) {
  const { updateCoinBalanceLocally, triggerCoinAnimation } = useHerSync();

  const [slotStates, setSlotStates] = useState<Record<Slot, SlotRewardState>>({
    morning:   { claimed: !!initialClaimedSlots.morning,   claiming: false, error: null, justClaimed: false },
    afternoon: { claimed: !!initialClaimedSlots.afternoon, claiming: false, error: null, justClaimed: false },
    evening:   { claimed: !!initialClaimedSlots.evening,   claiming: false, error: null, justClaimed: false },
  });

  const [bonusState, setBonusState] = useState<{
    claimed: boolean;
    claiming: boolean;
    error: string | null;
    justClaimed: boolean;
  }>({
    claimed: initialBonusClaimed,
    claiming: false,
    error: null,
    justClaimed: false,
  });

  useEffect(() => {
    setSlotStates(prev => ({
      morning:   { ...prev.morning,   claimed: prev.morning.claimed   || !!initialClaimedSlots.morning },
      afternoon: { ...prev.afternoon, claimed: prev.afternoon.claimed || !!initialClaimedSlots.afternoon },
      evening:   { ...prev.evening,   claimed: prev.evening.claimed   || !!initialClaimedSlots.evening },
    }));
  }, [initialClaimedSlots]);

  useEffect(() => {
    if (initialBonusClaimed) {
      setBonusState(prev => ({ ...prev, claimed: true }));
    }
  }, [initialBonusClaimed]);

  const claimingRef = useRef<Record<string, boolean>>({});

  const claimSlot = useCallback(async (slot: Slot) => {
    if (claimingRef.current[slot]) return; // prevent double-click
    claimingRef.current[slot] = true;

    setSlotStates(prev => ({
      ...prev,
      [slot]: { ...prev[slot], claiming: true, error: null },
    }));

    try {
      const res = await apiFetch('/api/health/checkin/claim', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Couldn't claim your reward. Please try again.");
      }

      if (result.data.alreadyClaimed || result.data.awarded) {
        // Always mark as claimed if awarded OR already-claimed (persisted from previous session)
        setSlotStates(prev => ({
          ...prev,
          [slot]: { claimed: true, claiming: false, error: null, justClaimed: result.data.awarded },
        }));

        if (result.data.awarded && result.data.coinsEarned > 0) {
          updateCoinBalanceLocally(result.data.newBalance, result.data.coinsEarned);
          triggerCoinAnimation(result.data.coinsEarned);
        }

        // Clear justClaimed after animation finishes
        setTimeout(() => {
          setSlotStates(prev => ({
            ...prev,
            [slot]: { ...prev[slot], justClaimed: false },
          }));
        }, 1000);
      }
    } catch (err: any) {
      setSlotStates(prev => ({
        ...prev,
        [slot]: { ...prev[slot], claiming: false, error: err.message || "Couldn't claim reward. Please try again." },
      }));
    } finally {
      claimingRef.current[slot] = false;
    }
  }, [updateCoinBalanceLocally, triggerCoinAnimation]);

  const claimBonus = useCallback(async () => {
    if (claimingRef.current['bonus']) return;
    claimingRef.current['bonus'] = true;

    setBonusState(prev => ({ ...prev, claiming: true, error: null }));

    try {
      const res = await apiFetch('/api/health/checkin/claim', {
        method: 'POST',
        body: JSON.stringify({ claimBonus: true }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "Couldn't claim your bonus. Please try again.");
      }

      setBonusState({
        claimed: true,
        claiming: false,
        error: null,
        justClaimed: result.data.bonusAwarded,
      });

      if (result.data.bonusAwarded && result.data.coinsEarned > 0) {
        updateCoinBalanceLocally(result.data.newBalance, result.data.coinsEarned);
        triggerCoinAnimation(result.data.coinsEarned);
      }

      setTimeout(() => {
        setBonusState(prev => ({ ...prev, justClaimed: false }));
      }, 1000);
    } catch (err: any) {
      setBonusState(prev => ({
        ...prev,
        claiming: false,
        error: err.message || "Couldn't claim bonus. Please try again.",
      }));
    } finally {
      claimingRef.current['bonus'] = false;
    }
  }, [updateCoinBalanceLocally, triggerCoinAnimation]);

  // Determine if bonus should be shown
  const allSlotsClaimed = (Object.keys(SLOT_CONFIG) as Slot[]).every(s => slotStates[s].claimed);
  const allSlotsCompleted = (Object.keys(SLOT_CONFIG) as Slot[]).every(s => !!completedSlots[s]);
  const showBonus = allSlotsClaimed || bonusState.claimed;

  return (
    <div className="w-full space-y-3">
      {/* Per-slot reward rows — only show completed slots */}
      {(Object.keys(SLOT_CONFIG) as Slot[])
        .filter(slot => completedSlots[slot])
        .map(slot => {
          const cfg = SLOT_CONFIG[slot];
          const st = slotStates[slot];
          const isActive = slot === activeSlot;

          return (
            <div
              key={slot}
              className={`flex items-center justify-between gap-3 p-4 rounded-2xl border ${cfg.bgColor} transition-all`}
            >
              {/* Left: slot label */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label} Check-in</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {st.claimed ? 'Reward collected' : 'Reward available'}
                  </p>
                </div>
              </div>

              {/* Right: claim button */}
              <div className="relative flex-shrink-0">
                {st.justClaimed && (
                  <CoinBurst amount={10} onDone={() => {}} />
                )}

                {st.claimed ? (
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Claimed</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => claimSlot(slot)}
                      disabled={st.claiming}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all min-h-[36px] min-w-[110px] justify-center"
                    >
                      {st.claiming ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Coins className="w-3.5 h-3.5" />
                          <span>Claim +10 🪙</span>
                        </>
                      )}
                    </button>

                    <AnimatePresence>
                      {st.error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 max-w-[150px] text-right"
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>{st.error}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* Daily Bonus section — only visible when all 3 slots are completed & claimed */}
      <AnimatePresence>
        {showBonus && allSlotsCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 transition-all"
          >
            {/* Left */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl flex-shrink-0">🌟</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-500">Daily Bonus</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {bonusState.claimed ? 'Full day streak bonus collected!' : 'All 3 check-ins complete!'}
                </p>
              </div>
            </div>

            {/* Right: bonus claim button */}
            <div className="relative flex-shrink-0">
              {bonusState.justClaimed && (
                <CoinBurst amount={10} onDone={() => {}} />
              )}

              {bonusState.claimed ? (
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-emerald-500" />
                  <span>Bonus Claimed</span>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={claimBonus}
                    disabled={bonusState.claiming}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all min-h-[36px] min-w-[130px] justify-center"
                  >
                    {bonusState.claiming ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Star className="w-3.5 h-3.5" />
                        <span>Claim +10 Bonus 🪙</span>
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {bonusState.error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 max-w-[150px] text-right"
                      >
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>{bonusState.error}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
