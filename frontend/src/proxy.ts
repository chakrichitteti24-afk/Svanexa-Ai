import { type NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.jpg, apple-icon.jpg
     * - manifest.webmanifest, manifest.json
     * - static asset file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.jpg|apple-icon.jpg|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
