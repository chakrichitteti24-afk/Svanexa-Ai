import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: (url, options) =>
          fetch(url, options).catch((err) => {
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
