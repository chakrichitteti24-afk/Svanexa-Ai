import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: (fetchUrl, options) =>
          fetch(fetchUrl, options).catch((err) => {
            // Safely catch network errors during token refresh / visibility change
            if (err instanceof TypeError && (err.message.includes('Failed to fetch') || err.message.includes('fetch'))) {
              return new Response(JSON.stringify({ error: 'Network error', message: err.message }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              });
            }
            throw err;
          }),
      },
    }
  );
}
