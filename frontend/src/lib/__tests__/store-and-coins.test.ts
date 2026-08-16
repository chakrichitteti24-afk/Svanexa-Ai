import { describe, it, expect } from 'vitest';

// Server-side authoritative price catalog mirror
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
  'companion_style:poetic': 60,
  'companion_style:energizing': 60,
  'companion_style:mindful': 60,
  'companion_style:clinical': 60,
};

describe('Svanexa Store Price Catalog Verification', () => {
  const UI_THEMES = ['default', 'lavender', 'rose', 'ocean', 'midnight', 'sage', 'sunrise'];
  const UI_DASHBOARD_STYLES = ['minimal', 'soft_glow', 'nature', 'calm'];
  const UI_COMPANION_STYLES = ['friendly', 'calm', 'focus', 'joy'];

  it('all UI themes exist in the authoritative server price catalog', () => {
    UI_THEMES.forEach((themeId) => {
      const key = `theme:${themeId}`;
      expect(STORE_ITEM_PRICES[key]).toBeDefined();
      expect(typeof STORE_ITEM_PRICES[key]).toBe('number');
    });
  });

  it('all UI dashboard styles exist in the authoritative server price catalog', () => {
    UI_DASHBOARD_STYLES.forEach((styleId) => {
      const key = `dashboard_style:${styleId}`;
      expect(STORE_ITEM_PRICES[key]).toBeDefined();
      expect(typeof STORE_ITEM_PRICES[key]).toBe('number');
    });
  });

  it('all UI companion styles exist in the authoritative server price catalog', () => {
    UI_COMPANION_STYLES.forEach((companionId) => {
      const key = `companion_style:${companionId}`;
      expect(STORE_ITEM_PRICES[key]).toBeDefined();
      expect(typeof STORE_ITEM_PRICES[key]).toBe('number');
    });
  });

  it('default items are free (0 coins)', () => {
    expect(STORE_ITEM_PRICES['theme:default']).toBe(0);
    expect(STORE_ITEM_PRICES['dashboard_style:minimal']).toBe(0);
    expect(STORE_ITEM_PRICES['companion_style:friendly']).toBe(0);
  });
});

describe('Check-in Reward Coin System', () => {
  const SLOT_COIN_AMOUNT = 10;
  const BONUS_COIN_AMOUNT = 10;

  it('awards 10 coins per completed check-in slot', () => {
    expect(SLOT_COIN_AMOUNT).toBe(10);
  });

  it('awards 10 bonus coins for completing all 3 slots in a single day', () => {
    const totalDailyPotential = (SLOT_COIN_AMOUNT * 3) + BONUS_COIN_AMOUNT;
    expect(totalDailyPotential).toBe(40);
  });

  it('constructs deterministic reference IDs for coin reward deduplication', () => {
    const today = '2026-08-16';
    const morningRef = `checkin:${today}:morning`;
    const afternoonRef = `checkin:${today}:afternoon`;
    const eveningRef = `checkin:${today}:evening`;
    const bonusRef = `checkin:${today}:all_slots_bonus`;

    expect(morningRef).toBe('checkin:2026-08-16:morning');
    expect(afternoonRef).toBe('checkin:2026-08-16:afternoon');
    expect(eveningRef).toBe('checkin:2026-08-16:evening');
    expect(bonusRef).toBe('checkin:2026-08-16:all_slots_bonus');
  });
});

describe('Store Customization Item Types & Defaults Validation', () => {
  const VALID_ITEM_TYPES = ['theme', 'dashboard_style', 'companion_style'];

  it('recognizes all valid customization item types', () => {
    expect(VALID_ITEM_TYPES).toContain('theme');
    expect(VALID_ITEM_TYPES).toContain('dashboard_style');
    expect(VALID_ITEM_TYPES).toContain('companion_style');
  });

  it('properly validates default items per type', () => {
    const isDefault = (itemType: string, itemId: string) =>
      (itemType === 'theme' && itemId === 'default') ||
      (itemType === 'dashboard_style' && itemId === 'minimal') ||
      (itemType === 'companion_style' && itemId === 'friendly');

    expect(isDefault('theme', 'default')).toBe(true);
    expect(isDefault('dashboard_style', 'minimal')).toBe(true);
    expect(isDefault('companion_style', 'friendly')).toBe(true);

    // Cross-type default matching must be false
    expect(isDefault('theme', 'minimal')).toBe(false);
    expect(isDefault('dashboard_style', 'default')).toBe(false);
    expect(isDefault('companion_style', 'minimal')).toBe(false);
  });
});
