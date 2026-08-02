import { createClient } from './supabase/client';

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  headers.set('Content-Type', 'application/json');

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
