import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/wellness-plan-service';
import { format } from 'date-fns';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const wellnessService = new WellnessPlanService(supabase);
    const result = await wellnessService.getDailyWellnessPlan(user.id, todayStr);

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error in GET /api/wellness-plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, taskId } = await request.json();
    if (!planId || !taskId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const wellnessService = new WellnessPlanService(supabase);
    const result = await wellnessService.toggleTaskCompletion(user.id, planId, taskId, todayStr);

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error in POST /api/wellness-plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
