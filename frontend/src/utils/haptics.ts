'use client';

/**
 * Web Haptic Feedback Engine for Svanexa AI.
 * Provides subtle, tactile sensory vibrations on supported mobile devices (Android & iOS WebKit).
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection';

export function triggerHaptic(style: HapticStyle = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (style) {
      case 'light':
      case 'selection':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(40);
        break;
      case 'success':
        navigator.vibrate([15, 35, 30]);
        break;
      case 'warning':
        navigator.vibrate([40, 50, 40]);
        break;
      default:
        navigator.vibrate(15);
    }
  } catch {
    // Graceful fallback if device permissions restrict vibration
  }
}
