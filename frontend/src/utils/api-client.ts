import { createClient } from './supabase/client';
import { format } from 'date-fns';

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('apiFetch auth header note:', err);
    }
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Prevent browser & Next.js cache from returning stale sync data
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  try {
    const clientDate = format(new Date(), 'yyyy-MM-dd');
    headers.set('x-client-date', clientDate);
  } catch {}

  let fullUrl = input;

  // Map old /api/v1/ endpoints to the new Next.js routes (/api/...)
  if (input.startsWith('/api/v1/')) {
    fullUrl = input.replace('/api/v1/', '/api/');
  }

  // Add cache buster query for GET requests to guarantee instant freshness
  const method = (init?.method || 'GET').toUpperCase();
  if (method === 'GET') {
    const sep = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${sep}_t=${Date.now()}`;
  }

  return fetch(fullUrl, {
    cache: init?.cache || 'no-store',
    ...init,
    headers,
  });
}

