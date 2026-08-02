import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/services/wellness-plan-service';
import { format } from 'date-fns';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fallback if not passed via URL segments, read from body
    let planId = '';
    let taskId = '';
    let status: 'pending' | 'completed' | 'skipped' | undefined = undefined;

    try {
      const body = await req.json();
      planId = body.planId;
      taskId = body.taskId;
      status = body.status;
    } catch {
      // Fallback
    }

    if (!planId || !taskId) {
      return NextResponse.json({ success: false, error: 'planId and taskId are required in body' }, { status: 400 });
    }

    const userId = user.id;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const service = new WellnessPlanService(supabase as any);
    const result = await service.toggleTask(userId, planId, taskId, todayStr, status);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
