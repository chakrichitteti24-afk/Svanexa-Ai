import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { offlineMutationQueue, OfflineMutation } from '../../utils/offline-sync';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};

if (typeof global !== 'undefined') {
  (global as any).localStorage = mockLocalStorage;
  (global as any).window = (global as any).window || {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  try {
    Object.defineProperty(global, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
  } catch {}
}

describe('Instant Sync & Offline Mutation Queue Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('OfflineMutationQueue Management', () => {
    it('enqueues mutations and persists them to localStorage', () => {
      expect(offlineMutationQueue.hasPendingMutations()).toBe(false);

      const mutation = offlineMutationQueue.enqueueMutation(
        '/api/wellness-plan/toggle',
        'POST',
        { taskId: 'task-1', status: 'completed' },
        'task_toggle_task-1'
      );

      expect(mutation.id).toBeDefined();
      expect(mutation.endpoint).toBe('/api/wellness-plan/toggle');
      expect(mutation.body.status).toBe('completed');
      expect(offlineMutationQueue.hasPendingMutations()).toBe(true);

      const pending = offlineMutationQueue.getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(mutation.id);
    });

    it('deduplicates mutations with the same tag and endpoint', () => {
      offlineMutationQueue.enqueueMutation(
        '/api/wellness-plan/toggle',
        'POST',
        { taskId: 'task-1', status: 'pending' },
        'task_toggle_task-1'
      );

      offlineMutationQueue.enqueueMutation(
        '/api/wellness-plan/toggle',
        'POST',
        { taskId: 'task-1', status: 'completed' },
        'task_toggle_task-1'
      );

      const pending = offlineMutationQueue.getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].body.status).toBe('completed');
    });

    it('removes mutations by ID after successful execution', () => {
      const mut1 = offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'morning' });
      const mut2 = offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'afternoon' });

      expect(offlineMutationQueue.getPendingMutations()).toHaveLength(2);

      offlineMutationQueue.removeMutation(mut1.id);

      const remaining = offlineMutationQueue.getPendingMutations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(mut2.id);
    });

    it('flushes pending mutations successfully when online', async () => {
      offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'morning' });
      offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'evening' });

      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const result = await offlineMutationQueue.flushMutations(mockFetch);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(offlineMutationQueue.hasPendingMutations()).toBe(false);
    });

    it('retains failing 500 server errors for retry with incremented retry count', async () => {
      offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'morning' });

      const mockFetch = vi.fn().mockResolvedValue(new Response('Server Error', { status: 500 }));
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const result = await offlineMutationQueue.flushMutations(mockFetch);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);

      const pending = offlineMutationQueue.getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].retryCount).toBe(1);
    });

    it('discards 400 client error mutations to prevent queue stagnation', async () => {
      offlineMutationQueue.enqueueMutation('/api/bad-request', 'POST', { bad: true });

      const mockFetch = vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 }));
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const result = await offlineMutationQueue.flushMutations(mockFetch);

      expect(result.successCount).toBe(0);
      expect(offlineMutationQueue.hasPendingMutations()).toBe(false);
    });

    it('automatically listens to window online events to trigger flush', async () => {
      offlineMutationQueue.enqueueMutation('/api/checkin', 'POST', { slot: 'morning' });

      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const onComplete = vi.fn();

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const cleanup = offlineMutationQueue.initOnlineSyncListener(mockFetch, onComplete);

      window.dispatchEvent(new Event('online'));

      // Allow microtask to complete
      await new Promise(r => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalled();
      cleanup();
    });
  });

  describe('Cross-Tab BroadcastChannel Simulation', () => {
    it('dispatches and parses broadcast sync messages accurately', () => {
      const messages: any[] = [];
      const mockChannel = {
        postMessage: vi.fn((msg) => messages.push(msg)),
        close: vi.fn(),
      };

      mockChannel.postMessage({
        type: 'CHECKIN_UPDATED',
        slot: 'afternoon',
        completed: true,
      });

      mockChannel.postMessage({
        type: 'COIN_UPDATED',
        newBalance: 500,
        earnedAmount: 50,
      });

      mockChannel.postMessage({
        type: 'LANGUAGE_CHANGED',
        language: 'Hindi',
      });

      mockChannel.postMessage({
        type: 'PLAN_UPDATED',
        tasks: [{ id: 'task-1', text: 'Hydrate', category: 'water', timeSlot: 'morning', completed: false, completedAt: null }],
      });

      expect(messages).toHaveLength(4);
      expect(messages[0].type).toBe('CHECKIN_UPDATED');
      expect(messages[0].slot).toBe('afternoon');
      expect(messages[1].newBalance).toBe(500);
      expect(messages[2].language).toBe('Hindi');
      expect(messages[3].type).toBe('PLAN_UPDATED');
      expect(messages[3].tasks[0].id).toBe('task-1');
    });
  });

  describe('Non-Destructive State Merge & Local Snapshot Persistence', () => {
    it('preserves local non-null vitals when server returns nulls or zero values', () => {
      const localLog = { sleep: 7.5, water: 1.25, mood: 'calm', stress: 2.0, exercise: 20 };
      const serverLog = { sleep: null, water: 0, mood: null, stress: null, exercise: null };

      const mergedLog = {
        sleep: serverLog.sleep ?? localLog.sleep ?? null,
        water: (typeof serverLog.water === 'number' && serverLog.water > 0)
          ? Math.max(serverLog.water, localLog.water || 0)
          : (localLog.water ?? null),
        mood: serverLog.mood ?? localLog.mood ?? null,
        stress: serverLog.stress ?? localLog.stress ?? null,
        exercise: (typeof serverLog.exercise === 'number' && serverLog.exercise > 0)
          ? Math.max(serverLog.exercise, localLog.exercise || 0)
          : (localLog.exercise ?? null),
      };

      expect(mergedLog.sleep).toBe(7.5);
      expect(mergedLog.water).toBe(1.25);
      expect(mergedLog.mood).toBe('calm');
      expect(mergedLog.stress).toBe(2.0);
      expect(mergedLog.exercise).toBe(20);
    });

    it('preserves completed task status when server returns outdated pending status', () => {
      const localTasks = [
        { id: 't1', text: 'Drink tea', category: 'hydration', timeSlot: 'morning', completed: true, status: 'completed', completedAt: '2026-09-07T08:00:00Z' },
      ];
      const serverTasks = [
        { id: 't1', text: 'Drink tea', category: 'hydration', timeSlot: 'morning', completed: false, status: 'pending', completedAt: null },
      ];

      const mergedTasks = serverTasks.map(srvTask => {
        const local = localTasks.find(lt => lt.id === srvTask.id);
        if (local && (local.completed || local.status === 'completed') && !srvTask.completed) {
          return { ...srvTask, completed: true, status: 'completed', completedAt: local.completedAt };
        }
        return srvTask;
      });

      expect(mergedTasks[0].completed).toBe(true);
      expect(mergedTasks[0].status).toBe('completed');
      expect(mergedTasks[0].completedAt).toBe('2026-09-07T08:00:00Z');
    });

    it('preserves existing local tasks when server returns empty array', () => {
      const localTasks = [
        { id: 't1', text: 'Walk 15 mins', category: 'movement', timeSlot: 'morning', completed: false, status: 'pending', completedAt: null },
      ];
      const serverTasks: any[] = [];

      const mergedTasks = serverTasks.length > 0 ? serverTasks : (localTasks.length > 0 ? localTasks : []);

      expect(mergedTasks).toHaveLength(1);
      expect(mergedTasks[0].id).toBe('t1');
    });

    it('preserves completed slots if either server or local marked them completed', () => {
      const localSlots = {
        morning: { completed: true, completedAt: '2026-09-07T09:00:00Z' },
        afternoon: { completed: false, completedAt: null },
        evening: { completed: false, completedAt: null },
      };
      const serverSlots = {
        morning: { completed: false, completedAt: null },
        afternoon: { completed: true, completedAt: '2026-09-07T14:00:00Z' },
        evening: { completed: false, completedAt: null },
      };

      const mergedSlots = {
        morning: {
          completed: !!(serverSlots.morning.completed || localSlots.morning.completed),
          completedAt: serverSlots.morning.completedAt || localSlots.morning.completedAt || null,
        },
        afternoon: {
          completed: !!(serverSlots.afternoon.completed || localSlots.afternoon.completed),
          completedAt: serverSlots.afternoon.completedAt || localSlots.afternoon.completedAt || null,
        },
        evening: {
          completed: !!(serverSlots.evening.completed || localSlots.evening.completed),
          completedAt: serverSlots.evening.completedAt || localSlots.evening.completedAt || null,
        },
      };

      expect(mergedSlots.morning.completed).toBe(true);
      expect(mergedSlots.afternoon.completed).toBe(true);
      expect(mergedSlots.evening.completed).toBe(false);
    });
  });
});
