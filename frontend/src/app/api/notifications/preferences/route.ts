import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '@/types/notifications';

export const dynamic = 'force-dynamic';

function mergePreferences(raw: any): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : (raw.notifications_enabled !== undefined ? Boolean(raw.notifications_enabled) : true),
    browserPush: raw.browserPush !== undefined ? Boolean(raw.browserPush) : true,
    soundEnabled: raw.soundEnabled !== undefined ? Boolean(raw.soundEnabled) : true,
    morningCheckin: raw.morningCheckin !== undefined ? Boolean(raw.morningCheckin) : (raw.checkinAlerts !== undefined ? Boolean(raw.checkinAlerts) : true),
    afternoonCheckin: raw.afternoonCheckin !== undefined ? Boolean(raw.afternoonCheckin) : (raw.checkinAlerts !== undefined ? Boolean(raw.checkinAlerts) : true),
    eveningCheckin: raw.eveningCheckin !== undefined ? Boolean(raw.eveningCheckin) : (raw.checkinAlerts !== undefined ? Boolean(raw.checkinAlerts) : true),
    wellnessTasks: raw.wellnessTasks !== undefined ? Boolean(raw.wellnessTasks) : true,
    wellnessPlan: raw.wellnessPlan !== undefined ? Boolean(raw.wellnessPlan) : true,
    coinsRewards: raw.coinsRewards !== undefined ? Boolean(raw.coinsRewards) : true,
    cycleTracker: raw.cycleTracker !== undefined ? Boolean(raw.cycleTracker) : (raw.cycleAlerts !== undefined ? Boolean(raw.cycleAlerts) : true),
    aiCompanion: raw.aiCompanion !== undefined ? Boolean(raw.aiCompanion) : (raw.lunaInsights !== undefined ? Boolean(raw.lunaInsights) : true),
    // Legacy support
    cycleAlerts: raw.cycleTracker !== undefined ? Boolean(raw.cycleTracker) : (raw.cycleAlerts !== undefined ? Boolean(raw.cycleAlerts) : true),
    checkinAlerts: raw.morningCheckin !== undefined ? Boolean(raw.morningCheckin) : (raw.checkinAlerts !== undefined ? Boolean(raw.checkinAlerts) : true),
    hydrationAlerts: raw.hydrationAlerts !== undefined ? Boolean(raw.hydrationAlerts) : true,
    supplementAlerts: raw.supplementAlerts !== undefined ? Boolean(raw.supplementAlerts) : true,
    skinAlerts: raw.skinAlerts !== undefined ? Boolean(raw.skinAlerts) : true,
    lunaInsights: raw.aiCompanion !== undefined ? Boolean(raw.aiCompanion) : (raw.lunaInsights !== undefined ? Boolean(raw.lunaInsights) : true),
    repeatUntilCheckinComplete: Boolean(raw.repeatUntilCheckinComplete),
    recurringIntervalMinutes: typeof raw.recurringIntervalMinutes === 'number' ? raw.recurringIntervalMinutes : 30,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Asia/Kolkata',
    reminderSchedule: {
      morningTime: raw.reminderSchedule?.morningTime || '08:30',
      afternoonTime: raw.reminderSchedule?.afternoonTime || '14:00',
      eveningTime: raw.reminderSchedule?.eveningTime || '21:30',
    },
  };
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to fetch notification preferences' },
        { status: 401 }
      );
    }

    // Fetch from user_preferences table in Supabase
    const { data: prefRow, error: prefErr } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefErr && prefErr.code !== 'PGRST116') {
      console.warn('Error querying user_preferences for notifications:', prefErr.message);
    }

    let loadedSettings: any = {};
    if (prefRow?.notification_settings) {
      loadedSettings = typeof prefRow.notification_settings === 'string'
        ? JSON.parse(prefRow.notification_settings)
        : prefRow.notification_settings;
    } else if (prefRow) {
      loadedSettings = {
        enabled: prefRow.notifications_enabled ?? true,
      };
    }

    const preferences = mergePreferences(loadedSettings);

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error: any) {
    console.error('Error in GET /api/notifications/preferences:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch preferences', preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to update notification preferences' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const incoming = body.preferences || body;

    // First fetch existing preferences to merge
    const { data: existingRow } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let currentSettings: any = {};
    if (existingRow?.notification_settings) {
      currentSettings = typeof existingRow.notification_settings === 'string'
        ? JSON.parse(existingRow.notification_settings)
        : existingRow.notification_settings;
    } else if (existingRow) {
      currentSettings = { enabled: existingRow.notifications_enabled ?? true };
    }

    const merged = mergePreferences({
      ...currentSettings,
      ...incoming,
      reminderSchedule: {
        ...(currentSettings.reminderSchedule || DEFAULT_NOTIFICATION_PREFERENCES.reminderSchedule),
        ...(incoming.reminderSchedule || {}),
      },
    });

    // Save to user_preferences table in Supabase
    // 1. Try with notification_settings column
    const upsertPayload: any = {
      user_id: user.id,
      notifications_enabled: merged.enabled,
      updated_at: new Date().toISOString(),
    };

    // Attempt upsert with notification_settings
    const { error: upsertErr } = await supabase
      .from('user_preferences')
      .upsert({
        ...upsertPayload,
        notification_settings: merged,
      }, { onConflict: 'user_id' });

    if (upsertErr) {
      // If notification_settings column does not exist yet, fallback to notifications_enabled
      console.warn('notification_settings column upsert fallback:', upsertErr.message);
      const { error: fallbackErr } = await supabase
        .from('user_preferences')
        .upsert(upsertPayload, { onConflict: 'user_id' });

      if (fallbackErr) {
        console.error('Error saving user_preferences:', fallbackErr);
        return NextResponse.json({ success: false, error: fallbackErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      preferences: merged,
      message: 'Notification preferences saved in Supabase successfully.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/notifications/preferences:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save preferences' },
      { status: 500 }
    );
  }
}