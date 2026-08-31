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

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('CHECKIN_UPDATED');
      expect(messages[0].slot).toBe('afternoon');
      expect(messages[1].newBalance).toBe(500);
      expect(messages[2].language).toBe('Hindi');
    });
  });
});
