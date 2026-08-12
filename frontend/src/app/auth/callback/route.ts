import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error, data: authData } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && authData?.user) {
      // Check if profile exists, if not create it (idempotent for OAuth first login)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single();
        
      if (!profile) {
        const email = authData.user.email || '';
        const fullName = authData.user.user_metadata?.full_name || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await Promise.all([
          supabase.from('profiles').upsert(
            {
              id: authData.user.id,
              first_name: firstName,
              last_name: lastName,
              email: email,
              ai_name: 'Luna', // Default AI name
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          ),
          supabase.from('user_preferences').upsert(
            { user_id: authData.user.id, theme: 'general', push_notifications: true },
            { onConflict: 'user_id' }
          ),
          supabase.from('wellness_streaks').upsert(
            { user_id: authData.user.id, current_streak: 0, longest_streak: 0 },
            { onConflict: 'user_id' }
          )
        ]);
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
