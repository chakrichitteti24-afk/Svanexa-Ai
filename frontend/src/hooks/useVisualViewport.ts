'use client';

import { useState, useEffect } from 'react';

/**
 * A hook that returns the active height of the visual viewport.
 * Useful for mobile browsers when the virtual keyboard opens,
 * which resizes the visual viewport but not necessarily the window or dvh.
 */
export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const visualViewport = window.visualViewport;
    
    const updateHeight = () => {
      if (visualViewport) {
        setViewportHeight(visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    // Listen to resize on visual viewport (e.g. keyboard show/hide)
    if (visualViewport) {
      visualViewport.addEventListener('resize', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    // Set initial size
    updateHeight();

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateHeight);
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, []);

  return viewportHeight;
}
