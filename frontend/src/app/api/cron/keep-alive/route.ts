import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateCronRequest } from '@/lib/services/cron-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: 'Supabase env vars missing' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lightweight ping — just fetch a single row from a small table
    const { error } = await supabase.from('profiles').select('id').limit(1);

    if (error) {
      console.error('[keep-alive] Supabase ping failed:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('[keep-alive] Supabase pinged successfully at', new Date().toISOString());
    return NextResponse.json({ success: true, pinged_at: new Date().toISOString() });
  } catch (err: any) {
    console.error('[keep-alive] Unexpected error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
