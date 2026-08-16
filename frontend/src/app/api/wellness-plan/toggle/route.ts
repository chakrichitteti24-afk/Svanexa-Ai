import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/services/wellness-plan-service';
import { extractDateFromRequest } from '@/utils/date-utils';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let planId = '';
    let taskId = '';
    let status: 'pending' | 'completed' | 'skipped' | undefined = undefined;
    let reqDate: string | undefined = undefined;

    try {
      const body = await req.json();
      planId = body.planId || '';
      taskId = body.taskId || '';
      status = body.status;
      reqDate = body.date;
    } catch {
      // Body parse error handled below
    }

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required in request body' }, { status: 400 });
    }

    const userId = user.id;
    const todayStr = reqDate || extractDateFromRequest(req);

    const service = new WellnessPlanService(supabase as any);
    const result = await service.toggleTask(userId, planId, taskId, todayStr, status);

    let coinsEarned = 0;
    let newBalance = 0;

    const isTaskCompleted = status === 'completed' || result?.tasks?.find((t: any) => t.id === taskId)?.completed;

    // Atomically award +5 coins if task status is completed
    if (isTaskCompleted) {
      try {
        const taskRef = `task:${todayStr}:${taskId}`;
        const { data: coinRes } = await supabase.rpc('award_user_coins', {
          p_user_id: userId,
          p_amount: 5,
          p_type: 'wellness_task',
          p_ref_id: taskRef,
          p_description: 'Wellness task completed',
        });

        if (coinRes?.awarded) {
          coinsEarned = coinRes.amount;
          newBalance = coinRes.new_balance;
        } else {
          newBalance = coinRes?.new_balance ?? 0;
        }
      } catch (coinErr) {
        console.warn('Skipping task coin award:', coinErr);
      }
    }

    return NextResponse.json({
      ...result,
      coinsEarned,
      newBalance,
    });
  } catch (error: any) {
    console.error('[wellness-plan/toggle POST error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
