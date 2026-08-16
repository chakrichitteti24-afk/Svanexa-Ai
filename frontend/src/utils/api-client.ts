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
    console.warn('apiFetch auth header attach warning:', err);
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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

  return fetch(fullUrl, {
    ...init,
    headers,
  });
}

