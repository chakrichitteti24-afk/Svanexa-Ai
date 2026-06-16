import { createClient } from '@/utils/supabase/client';

/**
 * A fetch wrapper that automatically:
 * 1. Resolves relative API paths against process.env.NEXT_PUBLIC_BACKEND_URL.
 * 2. Injects the active Supabase user session token in the 'Authorization: Bearer <token>' header.
 * 3. Incorporates standard JSON content-type headers.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  
  // Retrieve the access token from the active session
  let token: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch (err) {
    console.warn('Failed to retrieve Supabase session for API authentication:', err);
  }

  const headers = new Headers(init?.headers);
  
  // Set default Content-Type if not already specified
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject Bearer token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const url = input.startsWith('/') ? `${backendUrl}${input}` : input;

  return fetch(url, {
    ...init,
    headers,
  });
}
