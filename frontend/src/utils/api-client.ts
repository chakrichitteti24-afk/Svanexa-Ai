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
  
  // Map old mock endpoints to the new Next.js routes
  if (input === '/api/v1/chat' || input === '/api/chat') {
    fullUrl = '/api/chat';
  } else if (input === '/api/v1/analyze' || input === '/api/analyze') {
    fullUrl = '/api/analyze';
  } else if (input === '/api/v1/wellness-plan' || input === '/api/wellness-plan') {
    fullUrl = '/api/wellness-plan';
  } else if (input === '/api/v1/health/summary' || input === '/api/health/summary') {
    fullUrl = '/api/health/summary';
  } else if (input === '/api/v1/health/checkin' || input === '/api/health/checkin') {
    fullUrl = '/api/health/checkin';
  } else if (input === '/api/v1/health/checkin-status' || input === '/api/health/checkin-status') {
    fullUrl = '/api/health/checkin-status';
  } else if (input.startsWith('/api/v1/wellness-plan/toggle/')) {
    // We are converting PATCH /api/v1/wellness-plan/toggle/:planId/:taskId
    // To POST /api/wellness-plan/toggle with body
    // This requires us to handle this specifically in the page.tsx or here.
    // It's cleaner to handle this mapping in page.tsx, but since we are modifying api-client,
    // wait, we changed it in the new Next.js route to expect POST with body, OR we could change the api route to match.
    // We did: { params: { planId: string; taskId: string } } but wait, Next.js requires folder structure `/api/wellness-plan/toggle/[planId]/[taskId]/route.ts` if we use params.
    // Since I created it at `/api/wellness-plan/toggle/route.ts`, I need to send planId and taskId in the body.
  }

  return fetch(fullUrl, {
    ...init,
    headers,
  });
}
