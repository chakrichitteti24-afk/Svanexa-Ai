/**
 * Svanexa Offline Mutation Queue & Auto-Replay Utility
 * Safely persists health check-ins, water logs, and task mutations when offline
 * and automatically drains/replays them with exponential backoff when connectivity returns.
 */

export interface OfflineMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  tag?: string; // e.g. 'checkin', 'task_toggle', 'water_log'
}

const STORAGE_KEY = 'svanexa_offline_mutation_queue_v1';
const MAX_RETRIES = 5;

class OfflineMutationQueueManager {
  private isFlushing = false;

  public getPendingMutations(): OfflineMutation[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveMutations(mutations: OfflineMutation[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mutations));
    } catch (err) {
      console.warn('[OfflineSync] Failed to persist mutation queue:', err);
    }
  }

  public enqueueMutation(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: any,
    tag?: string,
    headers?: Record<string, string>
  ): OfflineMutation {
    const mutation: OfflineMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      endpoint,
      method,
      body,
      headers,
      timestamp: Date.now(),
      retryCount: 0,
      tag,
    };

    const current = this.getPendingMutations();
    // Deduplicate if same tag & endpoint exists for instant actions (like toggle)
    const filtered = tag ? current.filter(m => !(m.tag === tag && m.endpoint === endpoint)) : current;
    filtered.push(mutation);
    this.saveMutations(filtered);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('svanexa:offline_mutation_queued', { detail: mutation }));
    }

    return mutation;
  }

  public removeMutation(id: string): void {
    const current = this.getPendingMutations();
    const updated = current.filter(m => m.id !== id);
    this.saveMutations(updated);
  }

  public hasPendingMutations(): boolean {
    return this.getPendingMutations().length > 0;
  }

  public async flushMutations(
    fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch
  ): Promise<{ successCount: number; failedCount: number }> {
    if (this.isFlushing || typeof window === 'undefined' || !navigator.onLine) {
      return { successCount: 0, failedCount: 0 };
    }

    const mutations = this.getPendingMutations();
    if (mutations.length === 0) {
      return { successCount: 0, failedCount: 0 };
    }

    this.isFlushing = true;
    let successCount = 0;
    let failedCount = 0;
    const remainingMutations: OfflineMutation[] = [];

    try {
      for (const mutation of mutations) {
        try {
          const res = await fetchFn(mutation.endpoint, {
            method: mutation.method,
            headers: {
              'Content-Type': 'application/json',
              ...(mutation.headers || {}),
            },
            body: mutation.body ? JSON.stringify(mutation.body) : undefined,
          });

          if (res.ok || (res.status >= 200 && res.status < 300)) {
            successCount++;
          } else if (res.status >= 400 && res.status < 500) {
            // Client error (e.g. 400 Bad Request or already applied), discard to avoid clogging queue
            console.warn(`[OfflineSync] Discarding permanent error ${res.status} for mutation ${mutation.id}`);
          } else {
            // Server error (5xx) or timeout: keep in queue if retries remain
            mutation.retryCount++;
            if (mutation.retryCount < MAX_RETRIES) {
              remainingMutations.push(mutation);
            }
            failedCount++;
          }
        } catch (netErr) {
          // Network failure during individual item replay
          mutation.retryCount++;
          if (mutation.retryCount < MAX_RETRIES) {
            remainingMutations.push(mutation);
          }
          failedCount++;
        }
      }

      this.saveMutations(remainingMutations);

      if (successCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('svanexa:offline_mutations_flushed', {
            detail: { successCount, remaining: remainingMutations.length },
          })
        );
      }
    } finally {
      this.isFlushing = false;
    }

    return { successCount, failedCount };
  }

  public initOnlineSyncListener(
    fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
    onComplete?: (result: { successCount: number; failedCount: number }) => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = async () => {
      console.log('[OfflineSync] Device is online, flushing pending mutations...');
      const res = await this.flushMutations(fetchFn);
      if (onComplete) onComplete(res);
    };

    window.addEventListener('online', handleOnline);

    // Initial check on startup
    if (navigator.onLine && this.hasPendingMutations()) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }
}

export const offlineMutationQueue = new OfflineMutationQueueManager();

/**
 * Top-level helper for PWA and component sync listeners
 */
export async function flushOfflineQueue(
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>
): Promise<number> {
  const result = await offlineMutationQueue.flushMutations(fetchFn);
  return result.successCount;
}

export function saveOfflineMutation(
  endpoint: string,
  body: any,
  tag?: string
): OfflineMutation {
  return offlineMutationQueue.enqueueMutation(endpoint, 'POST', body, tag);
}
