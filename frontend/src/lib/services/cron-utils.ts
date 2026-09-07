import { createClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '@/types/notifications';

export function validateCronRequest(req: Request): { authorized: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  // In production, CRON_SECRET is strictly required
  if (isProd && !cronSecret) {
    console.error('[cron] Security error: CRON_SECRET is not configured in production environment.');
    return { authorized: false, error: 'Cron secret is not configured' };
  }

  if (!cronSecret) {
    // Permitted only in local development when no secret is configured
    return { authorized: true };
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const expectedAuth = `Bearer ${cronSecret}`;

  if (authHeader && authHeader.trim() === expectedAuth) {
    return { authorized: true };
  }

  return { authorized: false, error: 'Unauthorized cron request' };
}

export function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-key';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[cron] WARNING: SUPABASE_SERVICE_ROLE_KEY not set.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function getUserPreferencesMap(
  supabase: any,
  userIds: string[]
): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>();
  if (!userIds || userIds.length === 0) return map;

  try {
    const { data: rows, error } = await supabase
      .from('user_preferences')
      .select('user_id, notifications_enabled, notification_settings, timezone')
      .in('user_id', userIds);

    if (error) {
      console.warn('[cron] Error fetching user_preferences:', error.message);
    }

    if (rows) {
      for (const r of rows) {
        let raw: any = {};
        if (r.notification_settings) {
          raw = typeof r.notification_settings === 'string'
            ? JSON.parse(r.notification_settings)
            : r.notification_settings;
        } else {
          raw = { enabled: r.notifications_enabled ?? true };
        }

        const prefs: NotificationPreferences = {
          enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : (r.notifications_enabled ?? true),
          browserPush: raw.browserPush !== undefined ? Boolean(raw.browserPush) : true,
          soundEnabled: raw.soundEnabled !== undefined ? Boolean(raw.soundEnabled) : true,
          morningCheckin: raw.morningCheckin !== undefined ? Boolean(raw.morningCheckin) : (raw.checkinAlerts ?? true),
          afternoonCheckin: raw.afternoonCheckin !== undefined ? Boolean(raw.afternoonCheckin) : (raw.checkinAlerts ?? true),
          eveningCheckin: raw.eveningCheckin !== undefined ? Boolean(raw.eveningCheckin) : (raw.checkinAlerts ?? true),
          wellnessTasks: raw.wellnessTasks !== undefined ? Boolean(raw.wellnessTasks) : true,
          wellnessPlan: raw.wellnessPlan !== undefined ? Boolean(raw.wellnessPlan) : true,
          coinsRewards: raw.coinsRewards !== undefined ? Boolean(raw.coinsRewards) : true,
          cycleTracker: raw.cycleTracker !== undefined ? Boolean(raw.cycleTracker) : (raw.cycleAlerts ?? true),
          aiCompanion: raw.aiCompanion !== undefined ? Boolean(raw.aiCompanion) : (raw.lunaInsights ?? true),
          repeatUntilCheckinComplete: Boolean(raw.repeatUntilCheckinComplete),
          recurringIntervalMinutes: typeof raw.recurringIntervalMinutes === 'number' ? raw.recurringIntervalMinutes : 30,
          timezone: raw.timezone || r.timezone || 'Asia/Kolkata',
          reminderSchedule: {
            morningTime: raw.reminderSchedule?.morningTime || '08:30',
            afternoonTime: raw.reminderSchedule?.afternoonTime || '14:00',
            eveningTime: raw.reminderSchedule?.eveningTime || '21:30',
          },
        };
        map.set(r.user_id, prefs);
      }
    }
  } catch (err) {
    console.warn('[cron] Exception in getUserPreferencesMap:', err);
  }

  return map;
}

// ─── Privacy-First, Calm, Generic Notification Content ────────────────────────
// Strict Rule: Never include sensitive health details on lock screens.

export function buildCheckinMessage(
  name: string,
  slot: 'morning' | 'afternoon' | 'evening' | 'streak',
  streak: number
): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? name.trim() : '';
  const greeting = cleanName ? `, ${cleanName}` : '';

  switch (slot) {
    case 'morning':
      return {
        title: `🌅 Good morning${greeting}`,
        body: `Whenever you have a calm moment, take 60 seconds to check in with how your body is feeling today. No rush — wishing you a peaceful day ahead! 🌸`,
      };
    case 'afternoon':
      return {
        title: `☀️ Midday wellness pause${greeting}`,
        body: `Just a gentle check-in to see how you're feeling this afternoon. Remember to pause, take a deep breath, and care for yourself. 🌿`,
      };
    case 'evening':
      return {
        title: `🌙 Evening reflection${greeting}`,
        body: `Before winding down tonight, take a quiet minute to log your daily wellness notes. Wishing you restful sleep and recovery. ✨`,
      };
    case 'streak':
      return {
        title: streak > 0
          ? `✨ A gentle evening reminder${greeting}`
          : `🌸 Daily wellness check-in${greeting}`,
        body: streak > 0
          ? `You've taken wonderful care of your health for ${streak} days! If you have a free minute before sleep, your daily reflection is waiting for you.`
          : `Whenever you're ready, take 60 seconds to log today's check-in. Every small step matters for your health.`,
      };
    default:
      return {
        title: `🌸 Gentle daily check-in${greeting}`,
        body: `Take 60 seconds to check in with your wellness today whenever it's most convenient for you.`,
      };
  }
}

export function buildWellnessTaskMessage(): { title: string; body: string } {
  return {
    title: '✨ Gentle Wellness Tasks',
    body: 'You have a wellness task waiting for you today whenever you are ready. Take it one step at a time! 🌸',
  };
}

export function buildWellnessPlanMessage(): { title: string; body: string } {
  return {
    title: '📋 Your Daily Care Plan',
    body: 'Your personalized wellness care plan for today is ready whenever you would like to view it.',
  };
}

export function buildCoinsMessage(): { title: string; body: string } {
  return {
    title: '🪙 Svanexa Rewards',
    body: 'Thank you for caring for your health today — your check-in coins are ready to collect!',
  };
}

export function buildCycleMessage(): { title: string; body: string } {
  return {
    title: '🌸 Cycle Tracker Update',
    body: 'Your daily wellness cycle insights are ready to view whenever you have a moment.',
  };
}

export function buildAICompanionMessage(aiName = 'Luna'): { title: string; body: string } {
  return {
    title: `🤖 ${aiName} AI`,
    body: `${aiName} has a gentle, supportive thought for your wellness journey today.`,
  };
}

export interface SimpleWeather {
  temp: number;
  condition: string;
  emoji: string;
  isHot: boolean;
  isRainy: boolean;
  isCold: boolean;
  humidity: number;
  uvIndex: number;
  isHighUV: boolean;
}

export async function fetchWeatherForCron(lat = 17.385, lon = 78.4867): Promise<SimpleWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&daily=uv_index_max&timezone=Asia%2FKolkata`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current || {};
    const daily = json.daily || {};
    const temp = Math.round(current.temperature_2m ?? 28);
    const humidity = Math.round(current.relative_humidity_2m ?? 60);
    const weatherCode = current.weather_code ?? 0;
    const uvIndex = Math.round(daily.uv_index_max?.[0] ?? 5);
    const isRainy = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);
    const isCloudy = [2, 3, 45, 48].includes(weatherCode);
    let condition = 'Clear';
    let emoji = '☀️';
    if (isRainy) {
      condition = 'Rainy';
      emoji = '🌧️';
    } else if (isCloudy) {
      condition = 'Cloudy';
      emoji = '☁️';
    } else if (temp >= 34) {
      condition = 'Very Hot';
      emoji = '🔥';
    } else if (temp >= 28) {
      condition = 'Warm';
      emoji = '☀️';
    } else if (temp <= 15) {
      condition = 'Cool';
      emoji = '❄️';
    }
    return {
      temp,
      condition,
      emoji,
      isHot: temp >= 30,
      isRainy,
      isCold: temp <= 15,
      humidity,
      uvIndex,
      isHighUV: uvIndex >= 6,
    };
  } catch {
    return null;
  }
}

export function buildHydrationMessage(name?: string, waterLogged = 0, w?: SimpleWeather | null): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? `, ${name.trim()}` : '';
  return {
    title: `💧 Gentle Hydration Reminder${cleanName}`,
    body: 'Take a mindful pause and enjoy a fresh glass of water whenever you have a moment. Your body will appreciate it! 🌿',
  };
}

export function buildSupplementsMessage(name?: string, w?: SimpleWeather | null): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? `, ${name.trim()}` : '';
  return {
    title: `💊 Gentle Care Plan Reminder${cleanName}`,
    body: 'A kind reminder for your daily wellness plan and routine whenever it suits your schedule today.',
  };
}

export function buildSkinMessage(name?: string, w?: SimpleWeather | null): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? `, ${name.trim()}` : '';
  return {
    title: `🧴 Evening Skincare Journal${cleanName}`,
    body: 'A gentle reminder to jot down your skin notes before you head to sleep tonight. Rest well! 🌙',
  };
}

export function buildWeatherWellnessMessage(name?: string, w?: SimpleWeather): { title: string; body: string } {
  const cleanName = name && name.trim() && name !== 'there' ? `, ${name.trim()}` : '';
  return {
    title: `☀️ Daily Wellness Forecast${cleanName}`,
    body: 'Here is your daily wellness forecast to help you stay comfortable, balanced, and energized today.',
  };
}