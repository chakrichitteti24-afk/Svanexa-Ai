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
  const [weather, setWeather] = useState<WeatherData | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('svanexa_weather_cache_v1');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(!weather);
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

      const res = await fetch(url);
      const result = await res.json();

      if (res.ok && result.success && result.data) {
        setWeather(result.data);
        try {
          sessionStorage.setItem('svanexa_weather_cache_v1', JSON.stringify(result.data));
        } catch {}
      } else {
        throw new Error(result.error || 'Failed to fetch weather');
      }
    } catch (err: any) {
      console.warn('Weather widget fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      fetchWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocationName('Your Location');
        fetchWeather(latitude, longitude, 'Your Location');
      },
      (err) => {
        console.warn('Geolocation warning (using default location):', err.message);
        setLocationName('Current Area');
        fetchWeather();
      },
      { timeout: 8000, maximumAge: 600000 }
    );
  }, [fetchWeather]);

  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only — requestLocation is stable via useCallback([fetchWeather]) and fetchWeather has []

  if (loading && !weather) {
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
            onClick={requestLocation}
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
      className={`rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-card/80 via-card/60 to-violet-950/20 border border-violet-500/20 backdrop-blur-xl shadow-lg shadow-purple-500/5 space-y-3.5 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-pink-400" /> {locationName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${uvBadgeColor}`}>
            ☀️ UV Index: {weather.uvIndex} ({weather.uvLevel})
          </span>

          <button
            type="button"
            onClick={requestLocation}
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
