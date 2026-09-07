'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  Copy,
  Check,
  Share2,
  Gift,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  Info,
  ExternalLink,
  ChevronRight,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHerSync } from '@/context/HerSyncContext';
import { useNotifications } from '@/context/NotificationContext';
import { apiFetch } from '@/utils/api-client';
import { triggerHaptic } from '@/utils/haptics';
import {
  formatCoins,
  coinsToInr,
  REWARD_CONFIG,
} from '@/lib/rewards/rewards-config';
import { UserRewardSummary } from '@/lib/rewards/rewards-service';
import Link from 'next/link';
import { useTranslation } from '@/i18n/useTranslation';

export default function RewardsPage() {
  const { t } = useTranslation();
  const { coinBalance, updateCoinBalanceLocally, triggerCoinAnimation } = useHerSync();
  const { addCustomNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<UserRewardSummary | null>(null);

  // Copy state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Redemption Modal State
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Micro-burst animation state
  const [celebrationAmount, setCelebrationAmount] = useState<number | null>(null);

  const isRedeemingRef = useRef(false);

  const fetchSummary = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await apiFetch('/api/rewards/summary');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSummary(json.data);
          try {
            sessionStorage.setItem('svanexa_rewards_summary_cache', JSON.stringify(json.data));
          } catch {}
          if (typeof json.data.coinBalance === 'number') {
            updateCoinBalanceLocally(json.data.coinBalance);
          }
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[rewards/summary fetch warning]', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [updateCoinBalanceLocally]);

  useEffect(() => {
    // Instant cache hydration for zero-latency initial paint
    try {
      const cached = sessionStorage.getItem('svanexa_rewards_summary_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setSummary(parsed);
          setLoading(false);
        }
      }
    } catch {}
    fetchSummary(true);
  }, [fetchSummary]);

  // Sync with context balance
  const activeBalance = summary ? summary.coinBalance : coinBalance;
  const eligibleForRedeem = activeBalance >= REWARD_CONFIG.MIN_REDEMPTION_COINS;
  const inrEquivalence = coinsToInr(activeBalance);

  // Copy referral code
  const handleCopyCode = async () => {
    if (!summary?.referralCode) return;
    try {
      await navigator.clipboard.writeText(summary.referralCode);
      triggerHaptic('success');
      setCopiedCode(true);
      toast.success('Referral code copied to clipboard! 📋');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Unable to copy code.');
    }
  };

  // Copy referral link
  const handleCopyLink = async () => {
    if (!summary?.referralLink) return;
    try {
      await navigator.clipboard.writeText(summary.referralLink);
      triggerHaptic('success');
      setCopiedLink(true);
      toast.success('Referral link copied to clipboard! 🔗');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  // Native share referral link
  const handleShare = async () => {
    if (!summary) return;
    triggerHaptic('selection');
    const shareData = {
      title: 'Join me on Svanexa AI',
      text: 'Join me on Svanexa AI and explore a smarter wellness experience.',
      url: summary.referralLink,
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Handle Confirmed Redemption
  const handleConfirmRedemption = async () => {
    if (isRedeemingRef.current || redeeming) return;
    isRedeemingRef.current = true;
    setRedeeming(true);
    setRedeemError(null);
    triggerHaptic('medium');

    try {
      const res = await apiFetch('/api/rewards/redeem', {
        method: 'POST',
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Your redemption could not be processed. No Coins were deducted.');
      }

      // Success
      triggerHaptic('success');
      const newBal = result.data?.newBalance ?? Math.max(0, activeBalance - REWARD_CONFIG.MIN_REDEMPTION_COINS);
      updateCoinBalanceLocally(newBal);

      addCustomNotification({
        title: '₹100 Reward Request Received',
        message: 'Your 10,000 Coins redemption request has been queued for treasury processing.',
        category: 'system',
        priority: 'high',
        actionUrl: '/rewards',
        actionLabel: 'View Rewards',
      });

      toast.success('Redemption submitted successfully! 🎉', {
        description: '10,000 coins redeemed for ₹100. Request is in review.',
      });

      setShowRedeemModal(false);
      fetchSummary(true);
    } catch (err: any) {
      setRedeemError(err.message || 'Your redemption could not be processed. No Coins were deducted.');
      toast.error(err.message || 'Redemption failed.');
    } finally {
      setRedeeming(false);
      isRedeemingRef.current = false;
    }
  };

  if (loading && !summary) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 animate-pulse">
          <Coins className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          <span>Loading Svanexa Rewards...</span>
        </div>
      </div>
    );
  }

  const dailyEarned = summary?.dailyEarnedToday ?? 0;
  const dailyLimit = summary?.dailyCoinLimit ?? REWARD_CONFIG.DAILY_COIN_LIMIT;
  const dailyPercent = Math.min(100, Math.round((dailyEarned / dailyLimit) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              🪙 {t('nav.rewards')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            {t('rewards.title')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('rewards.subtitle')}
          </p>
        </div>

        <Link
          href="/store"
          className="inline-flex items-center gap-1.5 self-start sm:self-center px-4 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/50 text-xs font-semibold text-foreground transition-all"
        >
          <span>Visit Store Themes</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 🪙 1. HERO BALANCE CARD (Apple-Inspired Minimalist) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-amber-500/15 via-card/90 to-background border border-amber-500/30 shadow-xl shadow-amber-500/5 backdrop-blur-xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400/90">
              Total Coin Balance
            </span>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground font-mono flex items-center gap-2">
                <span>🪙</span>
                <span>{formatCoins(activeBalance)}</span>
              </span>
              <span className="text-sm sm:text-base font-bold text-amber-300">
                Svanexa Coins
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1 text-xs sm:text-sm text-muted-foreground">
              <span className="font-semibold text-foreground/90">
                10,000 Coins = ₹100
              </span>
              <span>•</span>
              <span>
                Current Value: <strong className="text-emerald-400 font-bold">₹{inrEquivalence}</strong>
              </span>
            </div>
          </div>

          {/* Daily Coins Limit Tracker (60 coins / day) */}
          <div className="p-4 rounded-2xl bg-secondary/60 border border-border/40 max-w-xs w-full space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">Today&apos;s Daily Limit</span>
              <span className="font-mono font-bold text-amber-400">
                {dailyEarned} / {dailyLimit} 🪙
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-background overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${dailyPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-tight">
              {dailyEarned >= dailyLimit
                ? 'Daily 60-coin activity cap reached for today! Resets at midnight.'
                : `${summary?.dailyLimitRemaining ?? 60} coins available to earn today.`}
            </p>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 🌟 2. WAYS TO EARN */}
        <div className="p-5 sm:p-6 rounded-3xl bg-card/80 border border-border/50 backdrop-blur-xl shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Ways to Earn
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">Daily & Milestones</span>
          </div>

          <div className="space-y-3">
            {/* Daily Check-in */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/40 hover:border-amber-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-bold text-foreground">Daily Check-in</p>
                  <span className="text-xs font-black text-amber-400 whitespace-nowrap">+10 to +40 🪙</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete your morning, afternoon & evening check-ins. Earn +10 per slot plus +10 daily streak bonus!
                </p>
                <Link
                  href="/check-in"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-400 hover:text-pink-300 mt-1.5"
                >
                  Go to Today&apos;s Check-In <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Refer Friends */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/40 hover:border-pink-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-bold text-foreground">Refer Friends</p>
                  <span className="text-xs font-black text-pink-400 whitespace-nowrap">+500 🪙</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Earn 500 Coins for every friend who joins with your link and verifies their account.
                </p>
              </div>
            </div>

            {/* Future Rewards */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/40 hover:border-violet-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold shrink-0 mt-0.5">
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-bold text-foreground">Future Rewards</p>
                  <span className="text-xs font-bold text-violet-400 whitespace-nowrap">Coming Soon</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wellness milestones, 7-day consistency challenges, and cycle care goals.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 🎁 3. REDEEM SECTION */}
        <div className="p-5 sm:p-6 rounded-3xl bg-card/80 border border-border/50 backdrop-blur-xl shadow-lg flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Gift className="w-4 h-4 text-emerald-400" />
                Redeem Coins
              </h2>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                10,000 Coins → ₹100
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Convert your hard-earned wellness coins into cash rewards. Minimum redemption threshold is 10,000 Coins.
            </p>

            <div className="p-4 rounded-2xl bg-secondary/40 border border-border/40 mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Threshold</span>
                <span className="font-bold text-foreground">10,000 Coins</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Reward Value</span>
                <span className="font-bold text-emerald-400 font-mono">₹100 INR</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-bold text-foreground font-mono">{formatCoins(activeBalance)} Coins</span>
              </div>

              {!eligibleForRedeem && (
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-400 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    You need {formatCoins(Math.max(0, REWARD_CONFIG.MIN_REDEMPTION_COINS - activeBalance))} more Coins to redeem ₹100.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!eligibleForRedeem}
              onClick={() => {
                triggerHaptic('medium');
                setShowRedeemModal(true);
              }}
              className="w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg min-h-[48px] cursor-pointer"
              style={{
                background: eligibleForRedeem
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: eligibleForRedeem ? '#FFFFFF' : 'var(--muted-foreground)',
                border: eligibleForRedeem ? 'none' : '1px solid var(--border)',
              }}
            >
              <Gift className="w-4 h-4" />
              <span>{eligibleForRedeem ? 'Redeem ₹100' : 'You need 10,000 Coins to redeem ₹100'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🤝 4. REFER & EARN SECTION */}
      <div className="p-5 sm:p-8 rounded-3xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/15 px-2.5 py-0.5 rounded-full border border-primary/25">
              <Gift className="w-3.5 h-3.5" /> Refer & Earn
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mt-1">
              Invite friends and earn 500 Coins for every successful referral.
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share your code with friends. When they create and verify their account, you earn +500 Coins automatically.
            </p>
          </div>
        </div>

        {/* Code & Action Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Referral Code Box */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Your Unique Referral Code
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xl sm:text-2xl font-semibold font-mono tracking-widest text-foreground select-all">
                {summary?.referralCode || 'SVX-......'}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-primary hover:opacity-95 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all cursor-pointer shrink-0"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Referral Link & Share Box */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Shareable Referral Link
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 rounded-xl bg-background/60 border border-border/60 hover:border-white/20 text-xs font-mono text-muted-foreground truncate text-left transition-colors cursor-pointer flex items-center justify-between"
              >
                <span className="truncate">
                  {summary?.referralLink ||
                    (summary?.referralCode
                      ? `https://svanexa-ai.vercel.app/signup?ref=${summary.referralCode}`
                      : 'https://svanexa-ai.vercel.app/signup?ref=...')}
                </span>
                <Copy className="w-3 h-3 text-muted-foreground shrink-0 ml-1.5" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary hover:opacity-95 active:scale-[0.98] text-white font-semibold text-xs transition-all cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </button>
            </div>
          </div>
        </div>

        {/* Referral Stats Cards */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-background/50 border border-border/40">
            <p className="text-[11px] text-muted-foreground font-semibold">Total Referrals</p>
            <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
              {summary?.stats.totalReferrals ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-background/50 border border-border/40">
            <p className="text-[11px] text-muted-foreground font-semibold">Completed</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400 mt-0.5">
              {summary?.stats.completedReferrals ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-background/50 border border-border/40">
            <p className="text-[11px] text-muted-foreground font-semibold">Earned Coins</p>
            <p className="text-lg sm:text-xl font-bold text-pink-400 font-mono mt-0.5">
              +{formatCoins((summary?.stats.completedReferrals ?? 0) * 500)} 🪙
            </p>
          </div>
        </div>
      </div>

      {/* 📜 5. REDEMPTION & TRANSACTION HISTORY (Tabs) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card/80 border border-border/50 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Transaction & Redemption Ledger
          </h3>
          <span className="text-xs text-muted-foreground font-medium">Supabase Verified</span>
        </div>

        {/* Redemptions Sub-List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Redemption History
          </h4>

          {summary?.recentRedemptions && summary.recentRedemptions.length > 0 ? (
            <div className="space-y-2">
              {summary.recentRedemptions.map((red) => (
                <div
                  key={red.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-secondary/40 border border-border/40 text-xs gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-bold text-foreground truncate">
                      ₹{red.inr_amount} Reward Request
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(red.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })} • {formatCoins(red.coins_redeemed)} Coins
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        red.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : red.status === 'PROCESSING'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : red.status === 'FAILED'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {red.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/80 py-2 italic">
              No redemptions requested yet. Earn 10,000 coins to redeem ₹100 cash reward.
            </p>
          )}
        </div>

        {/* Recent Ledger Activity */}
        <div className="space-y-3 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent Coin Ledger Activity
          </h4>

          {summary?.recentTransactions && summary.recentTransactions.length > 0 ? (
            <div className="divide-y divide-border/30">
              {summary.recentTransactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold shrink-0 text-sm ${
                      tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.amount > 0 ? `+${formatCoins(tx.amount)}` : formatCoins(tx.amount)} 🪙
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/80 py-2 italic">
              No coin transactions recorded yet. Complete daily check-ins to start earning.
            </p>
          )}
        </div>
      </div>

      {/* 🛑 CONFIRMATION MODAL (Apple-style Sheets / Modal) */}
      <AnimatePresence>
        {showRedeemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border/70 p-6 sm:p-7 shadow-2xl space-y-5"
            >
              <div className="space-y-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                  <Gift className="w-5 h-5" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  Redeem 10,000 Coins for ₹100?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your coins will be securely deducted and a ₹100 payout request will be queued.
                </p>
              </div>

              {/* Balance Breakdown */}
              <div className="p-4 rounded-2xl bg-secondary/50 border border-border/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your balance:</span>
                  <span className="font-mono font-bold text-foreground">{formatCoins(activeBalance)} Coins</span>
                </div>
                <div className="flex items-center justify-between text-rose-400">
                  <span>Coins deducted:</span>
                  <span className="font-mono font-bold">-10,000 Coins</span>
                </div>
                <div className="border-t border-border/30 pt-2 flex items-center justify-between font-bold">
                  <span className="text-foreground">After redemption:</span>
                  <span className="font-mono text-emerald-400">
                    {formatCoins(Math.max(0, activeBalance - 10000))} Coins
                  </span>
                </div>
              </div>

              {redeemError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{redeemError}</span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Real Money Payout: Payouts are verified and dispatched by the treasury team. Requests appear as <em>PENDING</em> until confirmation.
              </p>

              {/* Modal Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={() => setShowRedeemModal(false)}
                  className="py-3 px-4 rounded-full border border-border/60 hover:bg-secondary text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={redeeming}
                  onClick={handleConfirmRedemption}
                  className="py-3 px-4 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {redeeming ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Redemption</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
