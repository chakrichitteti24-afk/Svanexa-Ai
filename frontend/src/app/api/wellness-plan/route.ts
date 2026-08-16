import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/services/wellness-plan-service';
import { extractDateFromRequest } from '@/utils/date-utils';
import { TaskTimeSlot } from '@/types/wellness-plan';

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const todayStr = extractDateFromRequest(req);

    // Get wellness mode from profile active_theme or default to general
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_theme')
      .eq('id', userId)
      .maybeSingle();

    const wellnessMode = (profile?.active_theme as string) || 'general';

    const service = new WellnessPlanService(supabase as any);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[wellness-plan GET error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    let todayStr = extractDateFromRequest(req);
    let slot: TaskTimeSlot | undefined = undefined;
    let forceRegenerate = false;
    let requestedMode: string | undefined = undefined;

    try {
      const body = await req.json();
      if (body.date) todayStr = body.date;
      if (body.slot && ['morning', 'afternoon', 'evening'].includes(body.slot)) {
        slot = body.slot as TaskTimeSlot;
      }
      if (body.regenerate || body.forceRegenerate) {
        forceRegenerate = true;
      }
      if (body.mode) {
        requestedMode = body.mode;
      }
    } catch {
      // Empty body is valid
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('active_theme')
      .eq('id', userId)
      .maybeSingle();

    const wellnessMode = requestedMode || (profile?.active_theme as string) || 'general';

    const service = new WellnessPlanService(supabase as any);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode, slot, forceRegenerate);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[wellness-plan POST error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
