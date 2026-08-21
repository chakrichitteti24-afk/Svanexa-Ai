import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { WellnessPlanService } from '@/lib/services/wellness-plan-service';
import { extractDateFromRequest } from '@/utils/date-utils';

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

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

    if (isTaskCompleted) {
      const taskRef = `task:${todayStr}:${taskId}`;
      const TASK_COIN_AMOUNT = 5;

      // 1. Check if already awarded for this task
      let alreadyAwarded = false;
      try {
        const { data: existingTx } = await supabase
          .from('user_coin_transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('reference_id', taskRef)
          .limit(1)
          .maybeSingle();

        if (existingTx) {
          alreadyAwarded = true;
        }
      } catch (checkErr) {
        console.warn('[task coin check warning]', checkErr);
      }

      if (!alreadyAwarded) {
        // 2. Try PostgreSQL RPC
        let rpcSuccess = false;
        try {
          const { data: coinRes, error: coinErr } = await supabase.rpc('award_user_coins', {
            p_user_id: userId,
            p_amount: TASK_COIN_AMOUNT,
            p_type: 'wellness_task',
            p_ref_id: taskRef,
            p_description: 'Wellness task completed',
          });

          if (!coinErr && coinRes !== null && coinRes !== undefined) {
            if (typeof coinRes === 'object') {
              if (coinRes.awarded) {
                coinsEarned = typeof coinRes.amount === 'number' ? coinRes.amount : TASK_COIN_AMOUNT;
              }
              newBalance = typeof coinRes.new_balance === 'number' ? coinRes.new_balance : 0;
              rpcSuccess = true;
            } else if (typeof coinRes === 'number') {
              coinsEarned = TASK_COIN_AMOUNT;
              newBalance = coinRes;
              rpcSuccess = true;
            }
          }
        } catch (rpcErr) {
          console.warn('[award_user_coins task RPC fallback]', rpcErr);
        }

        // 3. Resilient Direct Table Operations Fallback
        if (!rpcSuccess) {
          try {
            const { data: curBal } = await supabase
              .from('user_coin_balances')
              .select('balance')
              .eq('user_id', userId)
              .maybeSingle();

            const currentBalance = typeof curBal?.balance === 'number' ? curBal.balance : 0;
            newBalance = currentBalance + TASK_COIN_AMOUNT;
            coinsEarned = TASK_COIN_AMOUNT;

            await supabase.from('user_coin_balances').upsert(
              {
                user_id: userId,
                balance: newBalance,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );

            const { error: txErr } = await supabase.from('user_coin_transactions').insert({
              user_id: userId,
              amount: TASK_COIN_AMOUNT,
              transaction_type: 'wellness_task',
              reference_id: taskRef,
              description: 'Wellness task completed',
            });

            if (txErr) {
              await supabase.from('user_coin_transactions').insert({
                user_id: userId,
                amount: TASK_COIN_AMOUNT,
                type: 'wellness_task',
                reference_id: taskRef,
                description: 'Wellness task completed',
              });
            }
          } catch (directErr) {
            console.warn('[direct task coin award fallback warning]', directErr);
          }
        }
      } else {
        // Fetch current balance
        try {
          const { data: balRow } = await supabase
            .from('user_coin_balances')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();
          newBalance = typeof balRow?.balance === 'number' ? balRow.balance : 0;
        } catch {}
      }
    } else {
      // Task unchecked or pending, get current balance
      try {
        const { data: balRow } = await supabase
          .from('user_coin_balances')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle();
        newBalance = typeof balRow?.balance === 'number' ? balRow.balance : 0;
      } catch {}
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
