import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { extractDateFromRequest } from '@/utils/date-utils';

type CheckinSlot = 'morning' | 'afternoon' | 'evening';
const VALID_SLOTS: CheckinSlot[] = ['morning', 'afternoon', 'evening'];

async function safeUpsert(
  supabase: any,
  table: string,
  match: Record<string, any>,
  payload: Record<string, any>
) {
  try {
    const { data: existingRows, error: selectErr } = await supabase
      .from(table)
      .select('id')
      .match(match)
      .limit(1);

    if (selectErr) {
      console.warn(`[${table}] select warning: ${selectErr.message}`);
      return;
    }

    const firstId = existingRows && existingRows.length > 0 ? existingRows[0].id : null;

    if (firstId) {
      const { error } = await supabase.from(table).update(payload).eq('id', firstId);
      if (error) console.warn(`[${table}] update warning: ${error.message}`);
    } else {
      const { error } = await supabase.from(table).insert({ ...match, ...payload });
      if (error) {
        // If insert failed (e.g. duplicate key), try matching update
        const { error: fallbackUpdateErr } = await supabase.from(table).update(payload).match(match);
        if (fallbackUpdateErr) console.warn(`[${table}] fallback update warning: ${fallbackUpdateErr.message}`);
      }
    }
  } catch (err: any) {
    console.warn(`[${table}] safeUpsert catch:`, err?.message);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    const userId = user?.id || null;

    const body = await req.json();
    const { slot, data, date: bodyDate } = body;

    const today = bodyDate || extractDateFromRequest(req);

    if (!slot || !VALID_SLOTS.includes(slot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid check-in period. Must be morning, afternoon, or evening.' },
        { status: 400 }
      );
    }

    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing check-in date.' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing check-in assessment data payload.' },
        { status: 400 }
      );
    }

    if (!data.answers || typeof data.answers !== 'object' || Object.keys(data.answers).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Check-in questionnaire answers are required.' },
        { status: 400 }
      );
    }

    const completedAt = new Date().toISOString();

    // If user is guest/unauthenticated, return clean guest success response
    if (!userId) {
      return NextResponse.json({
        success: true,
        data: {
          slot,
          date: today,
          completedAt,
          allSlotsComplete: false,
          completedSlots: [slot],
          isGuest: true,
          message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} check-in saved successfully (Guest session).`,
        },
      }, { status: 200 });
    }

    // ── Save to dedicated granular log tables safely ───────────────────────────
    try {
      // 1. Mood log
      const moodState = data?.indicators?.mood?.state || data?.moodState;
      const moodText =
        moodState === 'Positive'
          ? 'uplifted'
          : moodState === 'Low'
          ? 'down'
          : 'neutral';

      const stressScore = data?.indicators?.stress?.score || data?.averageScore || 2.5;

      await safeUpsert(
        supabase,
        'mood_logs',
        { user_id: userId, date: today },
        { mood: moodText, intensity: Math.round(Number(stressScore) * 2) }
      );

      // 2. Sleep log (if sleep rating provided)
      const sleepScore = data?.indicators?.sleepRating || data?.sleep;
      if (sleepScore) {
        const approxHours =
          sleepScore === 5 ? 8.5 : sleepScore === 4 ? 7.5 : sleepScore === 3 ? 6.5 : sleepScore === 2 ? 5.0 : 4.0;

        await safeUpsert(
          supabase,
          'sleep_logs',
          { user_id: userId, date: today },
          { duration_hours: approxHours }
        );
      }

      // 3. Water log (if hydration rating provided)
      const hydrationScore = data?.indicators?.hydrationRating || data?.water;
      if (hydrationScore) {
        const approxMl = Number(hydrationScore) * 500;
        await safeUpsert(
          supabase,
          'water_logs',
          { user_id: userId, date: today },
          { amount_ml: approxMl }
        );
      }

      // 4. Exercise log (if activity rating provided)
      const activityScore = data?.answers?.m_movement || data?.answers?.a_movement || data?.answers?.e_winddown || data?.exercise;
      if (activityScore) {
        const approxMins = Number(activityScore) >= 4 ? 30 : Number(activityScore) === 3 ? 20 : Number(activityScore) === 2 ? 10 : 0;
        if (approxMins > 0) {
          await safeUpsert(
            supabase,
            'exercise_logs',
            { user_id: userId, date: today },
            { duration_minutes: approxMins, type: 'daily_activity', intensity: approxMins >= 30 ? 'moderate' : 'light' }
          );
        }
      }

      // 5. Save to checkin_slots table (if table exists)
      await safeUpsert(
        supabase,
        'checkin_slots',
        { user_id: userId, date: today, slot },
        {
          completed_at: completedAt,
          mood: moodText,
          sleep_hours: sleepScore ? Number(sleepScore) * 1.6 : null,
          stress: Math.min(10, Math.max(1, Math.round(Number(stressScore) * 2))),
        }
      );

      // 6. Update wellness streak
      try {
        const { data: streakRows } = await supabase
          .from('wellness_streaks')
          .select('*')
          .eq('user_id', userId)
          .limit(1);

        const streak = streakRows && streakRows.length > 0 ? streakRows[0] : null;

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let newCurrent = 1;
        let newLongest = 1;

        if (streak) {
          if (streak.last_active_date === today) {
            newCurrent = streak.current_streak || 1;
            newLongest = streak.longest_streak || 1;
          } else if (streak.last_active_date === yesterday) {
            newCurrent = (streak.current_streak || 0) + 1;
            newLongest = Math.max(streak.longest_streak || 0, newCurrent);
          } else {
            newCurrent = 1;
            newLongest = Math.max(streak.longest_streak || 0, 1);
          }
        }

        const streakPayload = {
          user_id: userId,
          current_streak: newCurrent,
          longest_streak: newLongest,
          last_active_date: today,
          weekly_consistency: 100,
          updated_at: new Date().toISOString(),
        };

        if (streak?.id) {
          await supabase.from('wellness_streaks').update(streakPayload).eq('id', streak.id);
        } else {
          const { error: streakInsertErr } = await supabase.from('wellness_streaks').insert(streakPayload);
          if (streakInsertErr) {
            await supabase.from('wellness_streaks').update(streakPayload).eq('user_id', userId);
          }
        }
      } catch (streakErr) {
        console.warn('Skipping streak sync in checkin:', streakErr);
      }
    } catch (granularErr) {
      console.warn('Skipping granular logs sync:', granularErr);
    }

    // ── Save slot data into daily_checkins.summary (authoritative JSON store) ──
    const { data: existingRows } = await supabase
      .from('daily_checkins')
      .select('id, summary')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    let slotMeta: Record<string, any> = {};
    if (existing?.summary) {
      try {
        slotMeta = JSON.parse(existing.summary);
      } catch {
        slotMeta = {};
      }
    }
    if (typeof slotMeta !== 'object' || slotMeta === null) slotMeta = {};

    // Store slot data — preserve existing claimed flag
    slotMeta[slot] = {
      completed: true,
      completedAt,
      data,
      claimed: slotMeta[slot]?.claimed ?? false,
    };

    const newSummary = JSON.stringify(slotMeta);

    // Save with robust 3-step fallback:
    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from('daily_checkins')
        .update({ summary: newSummary, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateErr) {
        throw new Error(`daily_checkins update failed: ${updateErr.message}`);
      }
    } else {
      const { error: insertErr } = await supabase
        .from('daily_checkins')
        .insert({
          user_id: userId,
          date: today,
          summary: newSummary,
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        // If insert failed (e.g. concurrent creation or unique violation), update by user_id and date
        const { error: fallbackUpdateErr } = await supabase
          .from('daily_checkins')
          .update({ summary: newSummary, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('date', today);

        if (fallbackUpdateErr) {
          throw new Error(`daily_checkins save failed: ${fallbackUpdateErr.message}`);
        }
      }
    }

    // ── Determine completed slots ─────────────────────────────────────────────
    const completedSlots = Object.keys(slotMeta).filter((k) => slotMeta[k]?.completed);
    const allSlotsComplete = VALID_SLOTS.every((s) => completedSlots.includes(s));

    return NextResponse.json({
      success: true,
      data: {
        slot,
        date: today,
        completedAt,
        allSlotsComplete,
        completedSlots,
        message: `${slot.charAt(0).toUpperCase() + slot.slice(1)} check-in saved successfully.`,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('[checkin POST error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
