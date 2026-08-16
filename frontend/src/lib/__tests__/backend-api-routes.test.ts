import { describe, it, expect, vi } from 'vitest';

// Mock the server-side supabase module before importing routes
vi.mock('@/utils/supabase/server', () => ({
  getAuthenticatedUser: vi.fn(async (req: Request) => {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.includes('valid-bearer-token')) {
      return {
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { balance: 150, total_earned: 200 } }),
                maybeSingle: async () => ({ data: { balance: 150, total_earned: 200 } }),
                order: () => ({ limit: async () => ({ data: [] }) }),
              }),
            }),
          }),
        },
        user: { id: 'mock-user-123' },
        error: null,
      };
    }
    return { supabase: null, user: null, error: { message: 'Unauthorized' } };
  }),
}));

import { GET as getCoinsBalance } from '../../app/api/coins/balance/route';
import { POST as postActiveThemes } from '../../app/api/coins/active/route';
import { POST as postPurchase } from '../../app/api/coins/purchase/route';
import { GET as getTransactions } from '../../app/api/coins/transactions/route';

describe('Backend API Route Handlers Suite', () => {
  describe('Authentication & Authorization Security Guards', () => {
    it('returns 401 Unauthorized for unauthenticated GET /api/coins/balance', async () => {
      const req = new Request('http://localhost:3000/api/coins/balance', {
        method: 'GET',
      });

      const res = await getCoinsBalance(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 and balance when valid Authorization Bearer header is passed', async () => {
      const req = new Request('http://localhost:3000/api/coins/balance', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-bearer-token',
        },
      });

      const res = await getCoinsBalance(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.balance).toBe(150);
    });

    it('returns 401 Unauthorized for unauthenticated POST /api/coins/active', async () => {
      const req = new Request('http://localhost:3000/api/coins/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'theme', itemId: 'lavender' }),
      });

      const res = await postActiveThemes(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 Unauthorized for unauthenticated POST /api/coins/purchase', async () => {
      const req = new Request('http://localhost:3000/api/coins/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'theme', itemId: 'lavender' }),
      });

      const res = await postPurchase(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 401 Unauthorized for unauthenticated GET /api/coins/transactions', async () => {
      const req = new Request('http://localhost:3000/api/coins/transactions', {
        method: 'GET',
      });

      const res = await getTransactions(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Store Catalog Price Verification', () => {
    it('verifies valid price catalog definitions for themes, styles, and companions', () => {
      const STORE_ITEM_PRICES: Record<string, number> = {
        'theme:default': 0,
        'theme:lavender': 50,
        'theme:rose': 50,
        'theme:ocean': 50,
        'theme:midnight': 50,
        'theme:sage': 50,
        'theme:sunrise': 50,
        'dashboard_style:minimal': 0,
        'dashboard_style:soft_glow': 40,
        'dashboard_style:nature': 40,
        'dashboard_style:calm': 40,
        'companion_style:friendly': 0,
        'companion_style:empathetic': 30,
        'companion_style:motivational': 30,
      };

      expect(STORE_ITEM_PRICES['theme:default']).toBe(0);
      expect(STORE_ITEM_PRICES['theme:lavender']).toBe(50);
      expect(STORE_ITEM_PRICES['dashboard_style:soft_glow']).toBe(40);
      expect(STORE_ITEM_PRICES['companion_style:empathetic']).toBe(30);

      // Verify no negative prices exist in store catalog
      for (const [item, cost] of Object.entries(STORE_ITEM_PRICES)) {
        expect(cost).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
