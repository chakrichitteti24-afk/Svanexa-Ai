'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Droplets,
  Wind,
  ShieldAlert,
  RotateCcw,
  MapPin,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import type { WeatherData } from '@/app/api/weather/route';
import { apiFetch } from '@/utils/api-client';

interface WeatherWidgetProps {
  compact?: boolean;
  className?: string;
  showSkinFocus?: boolean;
}

export function WeatherWidget({
  compact = false,
  className = '',
  showSkinFocus = false,
}: WeatherWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('Local Weather');

  const fetchWeather = useCallback(async (lat?: number, lon?: number, locName?: string) => {
    setLoading(true);
    setLocationError(null);
    try {
      let url = '/api/weather';
      if (lat !== undefined && lon !== undefined) {
        url += `?lat=${lat}&lon=${lon}`;
        if (locName) url += `&city=${encodeURIComponent(locName)}`;
      }

      const res = await apiFetch(url);
      const result = await res.json();

      if (res.ok && result.success && result.data) {
        setWeather(result.data);
        if (locName) setLocationName(locName);
        try {
          sessionStorage.setItem(
            'svanexa_weather_cache_v1',
            JSON.stringify({
              data: result.data,
              timestamp: Date.now(),
              locationName: locName || 'Current Area',
            })
          );
        } catch {}
      } else {
        throw new Error(result.error || 'Failed to fetch weather');
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[WeatherWidget] fetch note:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(async (forcePrompt = false) => {
    if (typeof window === 'undefined') return;

    // 1. If we already have fresh weather in state and this is not a manual user refresh, no need to query geolocation again
    if (!forcePrompt && weather) {
      return;
    }

    // 2. If geolocation is not supported in this browser, silently fetch default weather
    if (!navigator.geolocation) {
      fetchWeather();
      return;
    }

    // 3. If user already denied in this session and not forcing prompt, silently use default weather
    try {
      if (!forcePrompt && sessionStorage.getItem('svanexa_geo_declined') === '1') {
        fetchWeather();
        return;
      }
    } catch {}

    // 4. Check navigator.permissions if available to avoid triggering browser blocked notice
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied' && !forcePrompt) {
          fetchWeather();
          return;
        }
      } catch {
        // Continue if permissions query is unsupported
      }
    }

    // 5. Query geolocation with shorter timeout and silent fallback
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          sessionStorage.removeItem('svanexa_geo_declined');
        } catch {}
        setLocationName('Your Location');
        fetchWeather(latitude, longitude, 'Your Location');
      },
      (err) => {
        // Normal fallback: user denied permission or timeout expired
        try {
          sessionStorage.setItem('svanexa_geo_declined', '1');
        } catch {}
        if (process.env.NODE_ENV === 'development') {
          console.debug('[WeatherWidget] Geolocation unavailable, using default location:', err.message);
        }
        setLocationName('Current Area');
        fetchWeather();
      },
      { timeout: 5000, maximumAge: 600000 }
    );
  }, [fetchWeather, weather]);

  useEffect(() => {
    setMounted(true);
    let cachedWeather: WeatherData | null = null;
    let cachedLoc = 'Local Weather';
    try {
      const cached = sessionStorage.getItem('svanexa_weather_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.data && parsed?.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          cachedWeather = parsed.data;
        } else if (!parsed?.timestamp && parsed?.temperature) {
          cachedWeather = parsed;
        }
        if (parsed?.locationName) cachedLoc = parsed.locationName;
      }
    } catch {}

    if (cachedWeather) {
      setWeather(cachedWeather);
      setLocationName(cachedLoc);
      setLoading(false);
    } else {
      requestLocation(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || (loading && !weather)) {
    return (
      <div
        className={`rounded-3xl p-4 bg-card/60 border border-violet-500/20 backdrop-blur-md flex items-center justify-center gap-2 text-xs text-muted-foreground min-h-[135px] ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
        <span>Loading live weather insights...</span>
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  const uvBadgeColor =
    weather.uvIndex < 3
      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
      : weather.uvIndex < 6
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : weather.uvIndex < 8
      ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
      : 'bg-rose-500/15 border-rose-500/30 text-rose-400';

  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-card/70 border border-violet-500/20 backdrop-blur-md text-xs ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{weather.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <span>{weather.temperature}°C</span>
              <span className="text-[11px] font-normal text-muted-foreground truncate">
                • {weather.condition}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              UV {weather.uvIndex} ({weather.uvLevel}) • {weather.humidity}% Humidity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${uvBadgeColor}`}>
            UV {weather.uvIndex}
          </span>
          <button
            type="button"
            onClick={() => requestLocation(true)}
            disabled={loading}
            aria-label="Refresh weather"
            className="p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all active:scale-95"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-3xl p-4 sm:p-5 bg-card/75 border border-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-3.5 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary" /> {locationName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${uvBadgeColor}`}>
            ☀️ UV Index: {weather.uvIndex} ({weather.uvLevel})
          </span>

          <button
            type="button"
            onClick={() => requestLocation(true)}
            disabled={loading}
            aria-label="Refresh weather data"
            className="p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all active:scale-95"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Temperature & Weather Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl sm:text-4xl">{weather.emoji}</span>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-foreground font-mono">
                {weather.temperature}°C
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Feels like {weather.apparentTemperature}°C
              </span>
            </div>
            <p className="text-xs font-semibold text-foreground/90">{weather.condition}</p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/30">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-foreground/90">{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/30">
            <Wind className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-foreground/90">{weather.windSpeed} km/h</span>
          </div>
        </div>
      </div>

      {/* Contextual Wellness & Skin AI Advice */}
      <div className="p-3 rounded-2xl bg-secondary/20 border border-border/30 space-y-1.5">
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-pink-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            {showSkinFocus ? (
              <p className="font-medium text-foreground/90 leading-snug">
                <span className="font-bold text-pink-300">Skin & UV Tip: </span>
                {weather.skinAdvice}
              </p>
            ) : (
              <>
                <p className="font-medium text-foreground/90 leading-snug">
                  <span className="font-bold text-cyan-300">Hydration Tip: </span>
                  {weather.hydrationAdvice}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <span className="font-semibold text-foreground/80">Outdoor Focus: </span>
                  {weather.outdoorAdvice}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
