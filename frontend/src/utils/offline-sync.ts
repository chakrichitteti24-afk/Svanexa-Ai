'use client';

const OFFLINE_QUEUE_KEY = 'svanexa_offline_checkins_v1';

export interface PendingCheckin {
  id: string;
  timestamp: number;
  payload: any;
}

export function saveOfflineCheckin(payload: any): void {
  try {
    const existingStr = localStorage.getItem(OFFLINE_QUEUE_KEY);
    let queue: PendingCheckin[] = [];
    if (existingStr) {
      const parsed = JSON.parse(existingStr);
      if (Array.isArray(parsed)) queue = parsed;
    }
    
    queue.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      payload,
    });

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Warning saving offline check-in', err);
  }
}

export async function flushOfflineQueue(apiFetchFunc: Function): Promise<number> {
  try {
    const existingStr = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!existingStr) return 0;
    
    const parsed = JSON.parse(existingStr);
    const queue: PendingCheckin[] = Array.isArray(parsed) ? parsed : [];
    if (!queue.length) return 0;


    let syncedCount = 0;
    const remainingQueue: PendingCheckin[] = [];

    for (const item of queue) {
      try {
        const res = await apiFetchFunc('/api/v1/health/checkin', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          syncedCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch {
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return syncedCount;
  } catch (err) {
    console.error('Error flushing offline queue', err);
    return 0;
  }
}
