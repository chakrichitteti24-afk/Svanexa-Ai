'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AmbientTrack {
  id: string;
  name: string;
  url: string;
  type: 'rain' | 'binaural' | 'forest';
}

const SOUNDSCAPES: Record<string, { name: string; frequency: number; waveType: OscillatorType }> = {
  soft_rain: { name: 'Soft Rain Soundscape', frequency: 174, waveType: 'sine' },
  binaural_sleep: { name: '432Hz Binaural Sleep Wave', frequency: 432, waveType: 'sine' },
  forest_breeze: { name: 'Forest Nature Breeze', frequency: 528, waveType: 'triangle' },
};

export function AmbientAudioPlayer({ activeSoundscape }: { activeSoundscape?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const trackMeta = activeSoundscape && SOUNDSCAPES[activeSoundscape] ? SOUNDSCAPES[activeSoundscape] : null;

  const stopAudio = () => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {}
    setIsPlaying(false);
  };

  const startAudio = () => {
    if (!trackMeta) return;
    try {
      stopAudio();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = trackMeta.waveType;
      osc.frequency.setValueAtTime(trackMeta.frequency, ctx.currentTime);

      // Low volume for gentle ambient sound
      gain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      audioCtxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  if (!trackMeta) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-20 right-4 z-40 bg-slate-950/90 border border-purple-500/30 p-2.5 rounded-2xl shadow-xl backdrop-blur-xl flex items-center gap-3 text-xs text-white"
    >
      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
        <Music className="w-3.5 h-3.5" />
      </div>

      <div>
        <p className="font-semibold text-white text-[11px]">{trackMeta.name}</p>
        <p className="text-[9px] text-[#9d91c4]">Ambient Soundscape</p>
      </div>

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shadow-md transition-all cursor-pointer"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
    </motion.div>
  );
}
