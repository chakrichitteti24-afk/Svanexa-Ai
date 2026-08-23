import { createClient } from '@supabase/supabase-js';

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

export interface SimpleWeather {
  temp: number; condition: string; emoji: string;
  isHot: boolean; isRainy: boolean; isCold: boolean;
  humidity: number; uvIndex: number; isHighUV: boolean;
}

export async function fetchWeatherForCron(lat = 17.385, lon = 78.4867): Promise<SimpleWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,relative_humidity_2m,weather_code,is_day&daily=uv_index_max&timezone=Asia%2FKolkata`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const current = json.current || {};
    const daily = json.daily || {};
    const temp = Math.round(current.temperature_2m ?? 28);
    const humidity = Math.round(current.relative_humidity_2m ?? 60);
    const weatherCode = current.weather_code ?? 0;
    const uvIndex = Math.round(daily.uv_index_max?.[0] ?? 5);
    const isRainy = [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherCode);
    const isCloudy = [2,3,45,48].includes(weatherCode);
    let condition = 'Clear'; let emoji = 'sunny';
    if (isRainy)       { condition = 'Rainy';    emoji = 'rainy'; }
    else if (isCloudy) { condition = 'Cloudy';   emoji = 'cloudy'; }
    else if (temp>=34) { condition = 'Very Hot'; emoji = 'hot'; }
    else if (temp>=28) { condition = 'Warm';     emoji = 'warm'; }
    else if (temp<=15) { condition = 'Cool';     emoji = 'cool'; }
    return { temp, condition, emoji, isHot: temp>=30, isRainy, isCold: temp<=15, humidity, uvIndex, isHighUV: uvIndex>=6 };
  } catch { return null; }
}

function weatherPrefix(w: SimpleWeather | null): string {
  if (!w) return '';
  if (w.isHot)   return `It's deg C outside today, stay cool and drink lots of water! `;
  if (w.isRainy) return `It's raining outside today, perfect time to stay in and reflect. `;
  if (w.isCold)  return `It's a bit chilly today (deg C), wrap up warm! `;
  return `It's a lovely deg C  day! `;
}

export function buildCheckinMessage(
  name: string,
  slot: 'morning' | 'afternoon' | 'evening' | 'streak',
  streak: number,
  w: SimpleWeather | null
): { title: string; body: string } {
  const pre = weatherPrefix(w);
  if (slot === 'morning') return {
    title: `Good morning, ! How are you feeling today?`,
    body: `Come on, your 60-second morning check-in is waiting! Log how you slept, your mood and energy. Let's make today a great wellness day for you`,
  };
  if (slot === 'afternoon') return {
    title: `Hey ! Quick midday check-in?`,
    body: `How's your afternoon going? Take just one minute to log your energy, stress and how your body feels. Your AI is listening and learning from you`,
  };
  if (slot === 'evening') return {
    title: `Evening reflection time, !`,
    body: `Before you wind down, please save today's evening check-in! Your daily reflection helps track your wellness patterns. Only 60 seconds, you can do it!`,
  };
  return {
    title: streak > 0 ? `, your -day streak is on the line!` : `Hey , your body is waiting to be heard!`,
    body: streak > 0
      ? `You have checked in  days in a row, don't break it now! Midnight is close. Open Svanexa and save your reflection before the day ends`
      : `You haven't checked in today yet. Your health data matters. Come on, let's log how you are really feeling! It only takes a minute`,
  };
}

export function buildHydrationMessage(name: string, waterLogged: number, w: SimpleWeather | null): { title: string; body: string } {
  const isHot = w?.isHot ?? false;
  const temp = w?.temp ?? null;
  if (waterLogged === 0) return {
    title: `Hey ! Have you had water today?`,
    body: isHot
      ? `It is deg C outside, that heat is draining your body fast! Please drink a big glass of water right now. Staying hydrated keeps your hormones balanced and skin glowing`
      : `You haven't logged any water yet. Drinking 2L a day helps reduce PCOS bloating, balance hormones and keep your skin clear. Start with a glass now!`,
  };
  return {
    title: `, keep sipping! You are at L so far`,
    body: isHot
      ? `It is really warm today (deg C) so your body needs even more water! Try to reach 2.5L today, grab a bottle and keep it close`
      : `You are doing great! You have had L so far. Try to hit 2.0 to 2.5L by tonight, it makes such a difference for your hormonal health`,
  };
}

export function buildSupplementsMessage(name: string, w: SimpleWeather | null): { title: string; body: string } {
  return {
    title: `Good morning, ! Supplement time`,
    body: w?.isHot
      ? `It is a warm day (deg C) which means your body needs extra nutrients! Have you taken your Inositol, Vitamin D or Omega-3 today? These little self-care acts add up`
      : `Hey ! Have you taken your daily supplements today? Inositol, Vitamin D and Omega-3 support insulin balance and hormone health. Just 30 seconds, take them now!`,
  };
}

export function buildSkinMessage(name: string, w: SimpleWeather | null): { title: string; body: string } {
  const ctx = w
    ? w.isHighUV  ? `Today had strong UV rays (UV index ) which can stress your skin. `
    : w.isHot     ? `Hot days like today (deg C) can cause extra oil and clogged pores. `
    : w.isRainy   ? `The rain and humidity today can affect your skin barrier. `
    : '' : '';
  return {
    title: `Evening skincare check-in, !`,
    body: `Before bed, please log how your skin looked and felt today. Any breakouts, dryness or glow moments? Tracking this helps Svanexa spot patterns with your cycle and stress levels`,
  };
}

export function buildCycleMessage(name: string, daysUntil: number): { title: string; body: string } {
  if (daysUntil === 0) return {
    title: `, your period may be starting today!`,
    body: `Your cycle tracker predicts your period could begin today or very soon. Make sure you have your essentials ready. You are so strong and Svanexa is with you every step`,
  };
  if (daysUntil === 1) return {
    title: `, your period is likely arriving tomorrow!`,
    body: `A gentle heads-up! Your period is predicted to arrive tomorrow. Rest well tonight, stay hydrated, eat warm nourishing food and take care of yourself. You deserve all the comfort`,
  };
  return {
    title: `, period coming in about  days`,
    body: `Your cycle tracker predicts your next period in about  days. Start preparing now, stock up on your essentials, plan gentle meals and listen to your body. Svanexa is tracking everything for you`,
  };
}

export function buildWeatherWellnessMessage(name: string, w: SimpleWeather): { title: string; body: string } {
  if (w.isHot && w.temp >= 35) return {
    title: `, it is really hot out there today!`,
    body: `It is deg C right now! Please do not step out without water. Drink at least 2.5L today, wear light clothing and avoid the afternoon sun between 12 and 3 PM. Your body will thank you`,
  };
  if (w.isRainy) return {
    title: `Hey , it is raining today!`,
    body: `A rainy day is the perfect excuse to cozy up, do gentle yoga and sip warm herbal tea. It is also the perfect day to journal your wellness. Don't forget your check-in!`,
  };
  if (w.isHighUV) return {
    title: `High UV alert today, ! Protect your skin`,
    body: `UV Index is  today, that is really strong! Please apply SPF 30+ before stepping out and reapply every 2 hours. High UV can worsen PCOS-related skin sensitivity`,
  };
  if (w.isCold) return {
    title: `, it is chilly today, please take care!`,
    body: `It is deg C, a cooler day! Warmth supports good circulation and reduces cramps. Layer up, enjoy a warm drink and do your check-in from your cozy spot`,
  };
  return {
    title: `Beautiful day today, ! How are you feeling?`,
    body: `It is a lovely deg C  day! The weather is perfect for a gentle 15-minute walk. Don't forget your wellness check-in and water intake today`,
  };
}