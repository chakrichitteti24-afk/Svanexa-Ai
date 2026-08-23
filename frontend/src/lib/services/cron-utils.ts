import { createClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '@/types/notifications';

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
      .select('user_id, notifications_enabled, notification_settings')
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
  switch (slot) {
    case 'morning':
      return {
        title: '🌅 Morning Check-In',
        body: 'Your morning check-in is ready.',
      };
    case 'afternoon':
      return {
        title: '☀️ Afternoon Check-In',
        body: 'Your afternoon wellness check-in is ready.',
      };
    case 'evening':
      return {
        title: '🌙 Evening Reflection',
        body: 'Your evening reflection is ready.',
      };
    case 'streak':
      return {
        title: '🔥 Daily Check-In',
        body: streak > 0
          ? `Save your reflection before midnight to keep your ${streak}-day streak active.`
          : 'Save your daily check-in to build your wellness streak.',
      };
    default:
      return {
        title: '🌸 Daily Check-In',
        body: 'Your Svanexa check-in is ready.',
      };
  }
}

export function buildWellnessTaskMessage(): { title: string; body: string } {
  return {
    title: '✨ Daily Wellness Tasks',
    body: 'You have a wellness task waiting for you.',
  };
}

export function buildWellnessPlanMessage(): { title: string; body: string } {
  return {
    title: '📋 Daily Wellness Plan',
    body: 'Your wellness plan for today is ready.',
  };
}

export function buildCoinsMessage(): { title: string; body: string } {
  return {
    title: '🪙 Svanexa Coins',
    body: 'You earned Svanexa Coins.',
  };
}

export function buildCycleMessage(): { title: string; body: string } {
  return {
    title: '🌸 Cycle Tracker',
    body: 'Your daily wellness cycle update is ready.',
  };
}

export function buildAICompanionMessage(aiName = 'Luna'): { title: string; body: string } {
  return {
    title: `🤖 ${aiName} AI`,
    body: `${aiName} has a gentle wellness thought for you.`,
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
  return {
    title: '💧 Hydration Reminder',
    body: 'Stay hydrated today with a fresh glass of water.',
  };
}

export function buildSupplementsMessage(name?: string, w?: SimpleWeather | null): { title: string; body: string } {
  return {
    title: '💊 Care Plan Routine',
    body: 'Time for your daily care plan routine.',
  };
}

export function buildSkinMessage(name?: string, w?: SimpleWeather | null): { title: string; body: string } {
  return {
    title: '🧴 Evening Skincare Journal',
    body: 'Log your evening skin condition before bed.',
  };
}

export function buildWeatherWellnessMessage(name?: string, w?: SimpleWeather): { title: string; body: string } {
  return {
    title: '☀️ Daily Wellness Forecast',
    body: 'Check your daily wellness forecast and stay comfortable today.',
  };
}