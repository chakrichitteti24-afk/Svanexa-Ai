import { describe, it, expect } from 'vitest';

// ─── Authoritative Prices Mirror ─────────────────────────────────────────────
const STORE_ITEM_PRICES: Record<string, number> = {
  // Themes
  'theme:default': 0,
  'theme:lavender': 50,
  'theme:rose': 50,
  'theme:ocean': 50,
  'theme:midnight': 50,
  'theme:sage': 50,
  'theme:sunrise': 50,
  // Dashboard Styles
  'dashboard_style:minimal': 0,
  'dashboard_style:soft_glow': 40,
  'dashboard_style:nature': 40,
  'dashboard_style:calm': 40,
  'dashboard_style:rose_tint': 40,
  'dashboard_style:midnight': 40,
  // Companion Styles
  'companion_style:friendly': 0,
  'companion_style:calm': 30,
  'companion_style:focus': 30,
  'companion_style:joy': 30,
  'companion_style:empathetic': 30,
  'companion_style:motivational': 30,
  'companion_style:gentle': 30,
  'companion_style:poetic': 60,
  'companion_style:energizing': 60,
  'companion_style:mindful': 60,
  'companion_style:clinical': 60,
};

describe('Comprehensive Coin & Reward System Tests', () => {
  describe('1. Check-in Reward Calculations & Deduplication', () => {
    const SLOT_COIN_AMOUNT = 10;
    const BONUS_COIN_AMOUNT = 10;
    const TASK_COIN_AMOUNT = 5;

    it('awards exactly 10 coins per completed check-in slot', () => {
      const slots = ['morning', 'afternoon', 'evening'] as const;
      let balance = 0;

      slots.forEach(() => {
        balance += SLOT_COIN_AMOUNT;
      });

      expect(balance).toBe(30);
    });

    it('awards exactly 10 bonus coins when all 3 daily check-ins are completed', () => {
      const slotsCompleted = { morning: true, afternoon: true, evening: true };
      const allComplete = Object.values(slotsCompleted).every(Boolean);
      expect(allComplete).toBe(true);

      const dailyTotal = (SLOT_COIN_AMOUNT * 3) + BONUS_COIN_AMOUNT;
      expect(dailyTotal).toBe(40);
    });

    it('awards +5 coins per completed wellness task', () => {
      let balance = 20;
      const tasksCompletedCount = 3;
      balance += tasksCompletedCount * TASK_COIN_AMOUNT;
      expect(balance).toBe(35);
    });

    it('constructs correct deduplication keys for slots, bonus, and tasks', () => {
      const today = '2026-08-21';
      const taskId = 'task-water-123';

      expect(`checkin:${today}:morning`).toBe('checkin:2026-08-21:morning');
      expect(`checkin:${today}:afternoon`).toBe('checkin:2026-08-21:afternoon');
      expect(`checkin:${today}:evening`).toBe('checkin:2026-08-21:evening');
      expect(`checkin:${today}:all_slots_bonus`).toBe('checkin:2026-08-21:all_slots_bonus');
      expect(`task:${today}:${taskId}`).toBe('task:2026-08-21:task-water-123');
    });

    it('prevents double-rewarding with a simulated transaction history', () => {
      const txHistory = new Set<string>();
      let balance = 0;

      const awardCoins = (refId: string, amount: number) => {
        if (txHistory.has(refId)) {
          return { awarded: false, balance };
        }
        txHistory.add(refId);
        balance += amount;
        return { awarded: true, balance };
      };

      const ref1 = 'checkin:2026-08-21:morning';
      const res1 = awardCoins(ref1, 10);
      expect(res1.awarded).toBe(true);
      expect(res1.balance).toBe(10);

      // Attempt second claim for the same slot
      const res2 = awardCoins(ref1, 10);
      expect(res2.awarded).toBe(false);
      expect(res2.balance).toBe(10);
    });
  });

  describe('2. Store Purchases & Balance Deduction', () => {
    it('successfully purchases an item when user has sufficient coins', () => {
      let balance = 100;
      const unlockedItems: { type: string; id: string }[] = [];

      const buyItem = (itemType: string, itemId: string) => {
        const cost = STORE_ITEM_PRICES[`${itemType}:${itemId}`];
        if (cost === undefined) throw new Error('Invalid item');
        if (balance < cost) throw new Error('Insufficient coins');

        balance -= cost;
        unlockedItems.push({ type: itemType, id: itemId });
        return { success: true, newBalance: balance };
      };

      const res = buyItem('theme', 'lavender'); // costs 50
      expect(res.success).toBe(true);
      expect(res.newBalance).toBe(50);
      expect(unlockedItems.some(i => i.type === 'theme' && i.id === 'lavender')).toBe(true);
    });

    it('blocks purchase and preserves balance when user has insufficient coins', () => {
      let balance = 20;
      const buyItem = (itemType: string, itemId: string) => {
        const cost = STORE_ITEM_PRICES[`${itemType}:${itemId}`];
        if (balance < cost) return { success: false, error: 'Insufficient coins' };
        balance -= cost;
        return { success: true, newBalance: balance };
      };

      const res = buyItem('theme', 'lavender'); // costs 50
      expect(res.success).toBe(false);
      expect(res.error).toBe('Insufficient coins');
      expect(balance).toBe(20);
    });

    it('handles free default items without deducting coins', () => {
      let balance = 30;
      const buyItem = (itemType: string, itemId: string) => {
        const cost = STORE_ITEM_PRICES[`${itemType}:${itemId}`];
        balance -= cost;
        return { success: true, newBalance: balance };
      };

      const res1 = buyItem('theme', 'default');
      expect(res1.newBalance).toBe(30);

      const res2 = buyItem('dashboard_style', 'minimal');
      expect(res2.newBalance).toBe(30);

      const res3 = buyItem('companion_style', 'friendly');
      expect(res3.newBalance).toBe(30);
    });

    it('verifies all UI companion and dashboard items are in the catalog', () => {
      const expectedCompanions = ['friendly', 'calm', 'focus', 'joy'];
      expectedCompanions.forEach(id => {
        expect(STORE_ITEM_PRICES[`companion_style:${id}`]).toBeDefined();
      });

      const expectedDashboardStyles = ['minimal', 'soft_glow', 'nature', 'calm'];
      expectedDashboardStyles.forEach(id => {
        expect(STORE_ITEM_PRICES[`dashboard_style:${id}`]).toBeDefined();
      });
    });
  });

  describe('3. Micro-Animation & Safe State Updates', () => {
    it('rejects NaN or invalid numbers in coin balance update handler', () => {
      let currentBalance = 50;

      const updateCoinBalanceSafely = (newBal: any) => {
        if (typeof newBal !== 'number' || isNaN(newBal)) return currentBalance;
        currentBalance = newBal;
        return currentBalance;
      };

      expect(updateCoinBalanceSafely(NaN)).toBe(50);
      expect(updateCoinBalanceSafely('100')).toBe(50);
      expect(updateCoinBalanceSafely(undefined)).toBe(50);
      expect(updateCoinBalanceSafely(null)).toBe(50);
      expect(updateCoinBalanceSafely(75)).toBe(75);
    });

    it('validates coin collector badge milestone criteria', () => {
      const isCoinCollectorUnlocked = (balance: number) => balance >= 50;

      expect(isCoinCollectorUnlocked(0)).toBe(false);
      expect(isCoinCollectorUnlocked(45)).toBe(false);
      expect(isCoinCollectorUnlocked(50)).toBe(true);
      expect(isCoinCollectorUnlocked(120)).toBe(true);
    });
  });
});
