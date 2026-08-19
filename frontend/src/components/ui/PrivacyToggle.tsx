'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { triggerHaptic } from '@/utils/haptics';

export function PrivacyToggle() {
  const [isPrivate, setIsPrivate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('svanexa_privacy_mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (isPrivate) {
      document.documentElement.setAttribute('data-privacy', 'active');
      document.body.setAttribute('data-privacy', 'active');
    }
  }, [isPrivate]);

  const togglePrivacy = () => {
    triggerHaptic('medium');
    const nextState = !isPrivate;
    setIsPrivate(nextState);
    localStorage.setItem('svanexa_privacy_mode', String(nextState));

    if (nextState) {
      document.documentElement.setAttribute('data-privacy', 'active');
      document.body.setAttribute('data-privacy', 'active');
      toast('👁️ Discreet Glance Mode Activated', {
        description: 'Sensitive reproductive & cycle terms are masked in public spaces.',
      });
    } else {
      document.documentElement.removeAttribute('data-privacy');
      document.body.removeAttribute('data-privacy');
      toast('👁️ Detailed Health Mode Restored', {
        description: 'Full clinical and cycle metrics are visible.',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={togglePrivacy}
      title={isPrivate ? 'Discreet Mode Active (Tap to show full details)' : 'Switch to Discreet Glance Mode'}
      className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
        isPrivate
          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/20'
          : 'hover:bg-secondary/50 text-muted-foreground border-transparent'
      }`}
    >
      {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
