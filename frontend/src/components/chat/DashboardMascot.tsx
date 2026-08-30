'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useHerSync } from '@/context/HerSyncContext';

type MascotState = 'sitting' | 'thinking' | 'cute';

const MESSAGES = {
  tap_responses: [
    "🌸 Great job! Keep going.",
    "💜 You're building healthy habits!",
    "✨ One step closer to your goals!",
    "😊 I'm so proud of your consistency!",
    "🥹 You are doing wonderful today!",
    "💧 Stay hydrated and take deep breaths!",
    "🌿 You've got this today!"
  ]
};

export const DashboardMascot = memo(function DashboardMascot() {
  const { allSlotsComplete } = useHerSync();
  const [mascotState, setMascotState] = useState<MascotState>(allSlotsComplete ? 'cute' : 'sitting');
  const [message, setMessage] = useState<string | null>(null);
  const [isTapped, setIsTapped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss tap message
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleTap = () => {
    setIsTapped(true);
    const expressions: MascotState[] = ['cute', 'thinking', 'sitting'];
    const nextExpr = expressions[Math.floor(Math.random() * expressions.length)];
    setMascotState(nextExpr);

    const randomResponse = MESSAGES.tap_responses[Math.floor(Math.random() * MESSAGES.tap_responses.length)];
    setMessage(randomResponse);

    setTimeout(() => {
      setMessage(null);
      setIsTapped(false);
    }, 3500);
  };

  const getImageSrc = () => {
    switch (mascotState) {
      case 'thinking': return '/mascot-thinking.jpg';
      case 'cute': return '/mascot-cute.jpg';
      case 'sitting':
      default:
        return '/mascot-sitting.jpg';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-16 pointer-events-auto mb-[-0.75rem] z-20 flex justify-center sm:justify-start sm:pl-4">
      <motion.div
        animate={{ y: allSlotsComplete ? [0, -5, 0] : [0, -2, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        onClick={handleTap}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative cursor-pointer select-none"
        style={{ width: '70px', height: '70px', touchAction: 'manipulation' }}
      >
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-xl text-foreground text-[11px] font-semibold px-3 py-1.5 rounded-2xl shadow-xl z-30 w-max max-w-[220px] text-center break-words leading-snug flex items-center justify-center border border-pink-500/40 pointer-events-none"
            >
              {message}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card rotate-45 border-b border-r border-pink-500/40" />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="w-full h-full relative rounded-full overflow-hidden border-2 border-pink-500/50 shadow-md transform-gpu"
          style={{ willChange: 'transform' }}
        >
          <Image
            src={getImageSrc()}
            alt="Dashboard Mascot"
            fill
            sizes="70px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      </motion.div>
    </div>
  );
});

