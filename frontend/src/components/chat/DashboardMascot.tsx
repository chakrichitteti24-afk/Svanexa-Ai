'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useHerSync } from '@/context/HerSyncContext';

type MascotState = 'sitting' | 'walking' | 'thinking' | 'angry' | 'cute';

const MESSAGES = {
  general: [
    "I'm watching over you! ✨",
    "You're doing great today! 💜",
    "Did you drink water yet? 💧",
    "Hmm... thinking about wellness!",
    "Take a deep breath and smile. 😌"
  ],
  checkin_morning: "Good morning! Let's complete today's first check-in. 🌅",
  checkin_afternoon: "Hope you're having a good day! Let's continue today's wellness journey. ☀️",
  checkin_evening: "Before you sleep, let's complete today's final check-in. 🌙",
  all_completed: "You did amazing today! See you tomorrow. 🎉",
  tap_responses: [
    "🌸 Great job! Keep going.",
    "💜 You're building healthy habits!",
    "✨ One step closer to your goals!",
    "😊 I'm so proud of your consistency!",
    "🥹 You are doing wonderful today!"
  ]
};

export function DashboardMascot() {
  const { todayLog, checkinSlots, allSlotsComplete } = useHerSync();
  
  const [mascotState, setMascotState] = useState<MascotState>(() => {
    if (allSlotsComplete) return 'cute';
    const hour = new Date().getHours();
    if ((hour >= 6 && hour < 12 && !checkinSlots?.morning?.completed) ||
        (hour >= 12 && hour < 17 && !checkinSlots?.afternoon?.completed) ||
        (hour >= 17 && hour < 23 && !checkinSlots?.evening?.completed)) {
      return 'thinking';
    }
    return 'sitting';
  });

  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [xPos, setXPos] = useState(20);

  const [message, setMessage] = useState<string | null>(() => {
    const hour = new Date().getHours();
    if (allSlotsComplete) return MESSAGES.all_completed;
    if (hour >= 6 && hour < 12 && !checkinSlots?.morning?.completed) return MESSAGES.checkin_morning;
    if (hour >= 12 && hour < 17 && !checkinSlots?.afternoon?.completed) return MESSAGES.checkin_afternoon;
    if (hour >= 17 && hour < 23 && !checkinSlots?.evening?.completed) return MESSAGES.checkin_evening;
    return null;
  });

  const [isTapped, setIsTapped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Time-aware reminder auto-dismiss
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // AI Loop for roaming and spontaneous thoughts
  useEffect(() => {
    const loop = setInterval(() => {
      if (isTapped) return;
      const containerWidth = containerRef.current?.clientWidth || 300;
      
      // Spontaneous message trigger
      if (Math.random() < 0.35 && mascotState !== 'walking') {
        const msgs = MESSAGES.general;
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        setMessage(msg);
        setTimeout(() => setMessage(null), 4000);
      }

      // Decide next action
      const actions: MascotState[] = ['walking', 'sitting', 'thinking', 'cute'];
      if (todayLog?.mood === 'angry') actions.push('angry');
      
      const nextAction = actions[Math.floor(Math.random() * actions.length)];
      
      if (nextAction === 'walking') {
        const moveRight = Math.random() > 0.5;
        const newDirection = moveRight ? 'right' : 'left';
        
        const moveAmount = Math.floor(Math.random() * (containerWidth / 2)) + 40;
        let newX = moveRight ? xPos + moveAmount : xPos - moveAmount;
        
        if (newX < 20) {
          newX = 20;
          setDirection('right');
        } else if (newX > containerWidth - 100) {
          newX = containerWidth - 100;
          setDirection('left');
        } else {
          setDirection(newDirection);
        }

        setMascotState('walking');
        setXPos(newX);
        
        setTimeout(() => {
          setMascotState('sitting');
        }, Math.random() * 2000 + 3000);
      } else {
        setMascotState(nextAction);
      }
      
    }, 8000);

    return () => clearInterval(loop);
  }, [xPos, todayLog, mascotState, isTapped]);

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
      case 'walking': return '/mascot-walking.jpg';
      case 'thinking': return '/mascot-thinking.jpg';
      case 'angry': return '/mascot-angry.jpg';
      case 'cute': return '/mascot-cute.jpg';
      case 'sitting':
      default:
        return '/mascot-sitting.jpg';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-16 pointer-events-auto mb-[-0.75rem] z-20">
      <motion.div
        animate={{ x: xPos, y: allSlotsComplete ? [0, -8, 0] : [0, -3, 0] }}
        transition={{
          x: { type: 'tween', ease: 'linear', duration: mascotState === 'walking' ? 3 : 0.5 },
          y: { duration: allSlotsComplete ? 0.8 : 3, repeat: Infinity, ease: 'easeInOut' }
        }}
        onClick={handleTap}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="absolute bottom-0 cursor-pointer select-none"
        style={{ width: '76px', height: '76px' }}
      >
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md text-foreground text-[11px] font-semibold px-3.5 py-1.5 rounded-2xl shadow-2xl z-30 max-w-[150px] text-center break-words leading-snug flex items-center justify-center border border-pink-500/40 pointer-events-none"
              style={{ boxShadow: '0 8px 20px rgba(236,72,153,0.25)' }}
            >
              {message}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-card rotate-45 border-b border-r border-pink-500/40" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ scaleX: direction === 'left' ? -1 : 1 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full relative rounded-full overflow-hidden border-2 border-pink-500/50 shadow-md"
          style={{ filter: 'drop-shadow(0 4px 14px rgba(236, 72, 153, 0.45))' }}
        >
          <Image
            src={getImageSrc()}
            alt="Dashboard Mascot"
            fill
            sizes="76px"
            style={{ objectFit: 'cover' }}
            priority
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
