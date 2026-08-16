import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // ── Fast-path: skip auth for API routes and static files ──────────────────
  // This eliminates the 6-11s Supabase network call on every API/asset request.
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith('/api/');
  const isStaticAsset = pathname.startsWith('/_next/') || pathname.startsWith('/favicon');

  if (isApiRoute || isStaticAsset) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write any logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');

  // Protect all app routes
  const isAppRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/profile') ||
    pathname.startsWith('/check-in') || pathname.startsWith('/cycle') ||
    pathname.startsWith('/skin') || pathname.startsWith('/reports') ||
    pathname.startsWith('/wellness-plan') || pathname.startsWith('/companion') ||
    pathname.startsWith('/store');

  if (!user && !isAuthRoute && isAppRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
