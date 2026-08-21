import { NextResponse } from 'next/server';

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  emoji: string;
  uvIndex: number;
  uvLevel: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  uvAdvice: string;
  hydrationAdvice: string;
  skinAdvice: string;
  outdoorAdvice: string;
  windSpeed: number;
  isDay: boolean;
  city?: string;
}

// Translate WMO Weather interpretation codes (WW)
export function interpretWeatherCode(code: number, isDay: boolean = true): { condition: string; emoji: string } {
  switch (code) {
    case 0:
      return { condition: 'Clear Sky', emoji: isDay ? '☀️' : '🌙' };
    case 1:
      return { condition: 'Mainly Clear', emoji: isDay ? '🌤️' : '🌤️' };
    case 2:
      return { condition: 'Partly Cloudy', emoji: '⛅' };
    case 3:
      return { condition: 'Overcast', emoji: '☁️' };
    case 45:
    case 48:
      return { condition: 'Foggy', emoji: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { condition: 'Drizzle', emoji: '🌦️' };
    case 56:
    case 57:
      return { condition: 'Freezing Drizzle', emoji: '🌨️' };
    case 61:
    case 63:
    case 65:
      return { condition: 'Rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { condition: 'Freezing Rain', emoji: '🌧️' };
    case 71:
    case 73:
    case 75:
      return { condition: 'Snowfall', emoji: '❄️' };
    case 77:
      return { condition: 'Snow Grains', emoji: '❄️' };
    case 80:
    case 81:
    case 82:
      return { condition: 'Rain Showers', emoji: '🌦️' };
    case 85:
    case 86:
      return { condition: 'Snow Showers', emoji: '🌨️' };
    case 95:
      return { condition: 'Thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { condition: 'Thunderstorm with Hail', emoji: '⛈️' };
    default:
      return { condition: 'Clear', emoji: isDay ? '☀️' : '🌙' };
  }
}

export function getUvCategory(uv: number): {
  level: 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
  advice: string;
} {
  if (uv < 3) {
    return {
      level: 'Low',
      advice: 'Minimal sun protection needed. Safe for outdoor walks.',
    };
  }
  if (uv < 6) {
    return {
      level: 'Moderate',
      advice: 'Apply SPF 30+ sunscreen and wear sunglasses if staying outside.',
    };
  }
  if (uv < 8) {
    return {
      level: 'High',
      advice: 'High UV! Apply broad-spectrum SPF 50+ and seek shade midday.',
    };
  }
  if (uv < 11) {
    return {
      level: 'Very High',
      advice: 'Extra protection required. Avoid direct sun exposure between 11 AM - 3 PM.',
    };
  }
  return {
    level: 'Extreme',
    advice: 'Extreme UV rays! Stay indoors or fully covered with high SPF & UV hat.',
  };
}

export function generateWellnessAdvice(
  temp: number,
  humidity: number,
  uv: number,
  condition: string
): { hydrationAdvice: string; skinAdvice: string; outdoorAdvice: string } {
  // Hydration
  let hydrationAdvice = 'Stay steady with your daily 2.0L hydration goal.';
  if (temp >= 28 || (humidity < 40 && temp >= 22)) {
    hydrationAdvice = 'Warm/dry conditions — consider an extra +250ml to +500ml water today 💧';
  } else if (temp <= 10) {
    hydrationAdvice = 'Cooler weather — warm herbal teas or infused water can keep hydration high 🍵';
  }

  // Skin Advice
  let skinAdvice = 'Maintain your gentle barrier skincare routine.';
  if (uv >= 6) {
    skinAdvice = 'High UV Index — Broad-spectrum SPF 30+/50+ is essential today ✨';
  } else if (humidity < 40) {
    skinAdvice = 'Dry air detected — Layer with a nourishing ceramide moisturizer to lock in hydration 🧴';
  } else if (humidity >= 75) {
    skinAdvice = 'Humid atmosphere — Lightweight gel moisturizers will feel breathable on your skin 🌿';
  }

  // Outdoor Advice
  let outdoorAdvice = 'Great day for fresh air and gentle movement.';
  if (condition.includes('Thunderstorm') || condition.includes('Rain Showers') || condition.includes('Heavy Rain')) {
    outdoorAdvice = 'Rainy weather — indoor stretching or yoga is ideal today 🧘‍♀️';
  } else if (temp >= 32) {
    outdoorAdvice = 'High heat — schedule outdoor walks for early morning or sunset 🌅';
  } else if (temp >= 16 && temp <= 26 && uv < 8) {
    outdoorAdvice = 'Ideal pleasant conditions for a 15-20 min hormone-balancing walk 🌸';
  }

  return { hydrationAdvice, skinAdvice, outdoorAdvice };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let lat = searchParams.get('lat');
    let lon = searchParams.get('lon');
    const city = searchParams.get('city') || undefined;

    // Default to New York coordinates if no geolocation provided (fallback)
    if (!lat || !lon) {
      lat = '40.7128';
      lon = '-74.0060';
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { success: false, error: 'Invalid latitude or longitude' },
        { status: 400 }
      );
    }

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=uv_index_max&timezone=auto`;

    const res = await fetch(apiUrl, {
      next: { revalidate: 900 }, // Cache on server edge for 15 mins
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo API returned status ${res.status}`);
    }

    const json = await res.json();
    const current = json.current || {};
    const daily = json.daily || {};

    const temp = Math.round(current.temperature_2m ?? 22);
    const apparentTemp = Math.round(current.apparent_temperature ?? temp);
    const humidity = Math.round(current.relative_humidity_2m ?? 50);
    const weatherCode = current.weather_code ?? 0;
    const isDay = current.is_day === 1;
    const windSpeed = Math.round(current.wind_speed_10m ?? 8);
    const uvIndex = Math.round(daily.uv_index_max?.[0] ?? (isDay ? 4 : 0));

    const { condition, emoji } = interpretWeatherCode(weatherCode, isDay);
    const { level: uvLevel, advice: uvAdvice } = getUvCategory(uvIndex);
    const { hydrationAdvice, skinAdvice, outdoorAdvice } = generateWellnessAdvice(
      temp,
      humidity,
      uvIndex,
      condition
    );

    const weatherData: WeatherData = {
      temperature: temp,
      apparentTemperature: apparentTemp,
      humidity,
      weatherCode,
      condition,
      emoji,
      uvIndex,
      uvLevel,
      uvAdvice,
      hydrationAdvice,
      skinAdvice,
      outdoorAdvice,
      windSpeed,
      isDay,
      city,
    };

    return NextResponse.json(
      {
        success: true,
        data: weatherData,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error: any) {
    console.error('[weather GET error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Could not fetch weather data',
      },
      { status: 500 }
    );
  }
}
