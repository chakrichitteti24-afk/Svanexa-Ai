'use client';

import { useHerSync } from '@/context/HerSyncContext';
import { Award, CheckCircle2, Lock, Droplets, Flame, Coins, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface Badge {
  id: string;
  name: string;
  category: 'streak' | 'checkin' | 'water' | 'coins';
  icon: string;
  description: string;
  isUnlocked: boolean;
}

export function HabitBadges() {
  const { currentStreak, totalCheckIns, todayLog, coinBalance } = useHerSync();

  const badges: Badge[] = [
    {
      id: 'starter',
      name: 'Wellness Starter',
      category: 'checkin',
      icon: '🌱',
      description: 'Completed your 1st wellness check-in',
      isUnlocked: totalCheckIns >= 1,
    },
    {
      id: 'streak_7',
      name: '7-Day Consistency',
      category: 'streak',
      icon: '🔥',
      description: 'Maintained a 7-day active check-in streak',
      isUnlocked: currentStreak >= 7,
    },
    {
      id: 'streak_30',
      name: '30-Day Legend',
      category: 'streak',
      icon: '👑',
      description: 'Maintained a 30-day active check-in streak',
      isUnlocked: currentStreak >= 30,
    },
    {
      id: 'hydration_hero',
      name: 'Hydration Hero',
      category: 'water',
      icon: '💧',
      description: 'Logged 2.0+ Liters of water in a day',
      isUnlocked: (todayLog?.water ?? 0) >= 2.0,
    },
    {
      id: 'coin_collector',
      name: 'Coin Collector',
      category: 'coins',
      icon: '🪙',
      description: 'Earned 50+ Svanexa Coins',
      isUnlocked: coinBalance >= 50,
    },
    {
      id: 'pcos_champion',
      name: 'PCOS Care Champion',
      category: 'checkin',
      icon: '✨',
      description: 'Completed 10+ daily check-in slots',
      isUnlocked: totalCheckIns >= 10,
    },
  ];

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm sm:text-base font-bold text-white">Collectible Badges</h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
          {unlockedCount} / {badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((badge) => (
          <motion.div
            key={badge.id}
            whileHover={{ scale: 1.02 }}
            className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 ${
              badge.isUnlocked
                ? 'bg-purple-500/10 border-purple-500/30 shadow-md shadow-purple-500/5'
                : 'bg-white/[0.015] border-white/5 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl">{badge.icon}</span>
              {badge.isUnlocked ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-white/30" />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-white leading-snug">{badge.name}</p>
              <p className="text-[10px] text-[#9d91c4] leading-tight line-clamp-2 mt-0.5">
                {badge.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
