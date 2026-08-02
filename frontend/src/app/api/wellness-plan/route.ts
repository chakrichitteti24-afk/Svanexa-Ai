import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/services/wellness-plan-service';
import { format } from 'date-fns';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Get wellness mode from user preferences
    const { data: prefs } = await supabase.from('user_preferences').select('theme').eq('user_id', userId).maybeSingle();
    const wellnessMode = prefs?.theme || 'general';

    const service = new WellnessPlanService(supabase as any);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data: prefs } = await supabase.from('user_preferences').select('theme').eq('user_id', userId).maybeSingle();
    const wellnessMode = prefs?.theme || 'general';
    const service = new WellnessPlanService(supabase as any);
    const result = await service.getDailyWellnessPlan(userId, todayStr, wellnessMode);
    
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
