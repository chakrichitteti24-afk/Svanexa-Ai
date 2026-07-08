import { createClient } from './supabase/client';

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  headers.set('Content-Type', 'application/json');

  let fullUrl = input;
  
  // Map old mock endpoints to the real Express backend routes
  if (input === '/api/chat') {
    fullUrl = `${backendUrl}/api/v1/chat`;
  } else if (input === '/api/analyze') {
    fullUrl = `${backendUrl}/api/v1/analyze`;
  } else if (input === '/api/wellness-plan') {
    fullUrl = `${backendUrl}/api/v1/wellness-plan`;
  } else if (input === '/api/health/summary') {
    fullUrl = `${backendUrl}/api/v1/health/summary`;
  } else if (input.startsWith('/api/v1/')) {
    fullUrl = `${backendUrl}${input}`;
  } else if (!input.startsWith('http')) {
    fullUrl = `${backendUrl}${input}`;
  }

  return fetch(fullUrl, {
    ...init,
    headers,
  });
}
