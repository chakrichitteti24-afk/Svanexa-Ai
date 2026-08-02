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
    "Take a deep breath. 😌"
  ],
  sad: [
    "I'm here for you. 💜",
    "Take it easy today.",
    "Sending virtual hugs! 🤗"
  ],
  angry: [
    "Hmph! Take a break! 😠",
    "Don't push yourself too hard!",
    "Let's just relax a bit."
  ],
  anxious: [
    "Deep breaths... you got this. ✨",
    "It's okay to rest.",
    "One step at a time! 🌱"
  ]
};

export function DashboardMascot() {
  const { todayLog } = useHerSync();
  const [mascotState, setMascotState] = useState<MascotState>('sitting');
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [xPos, setXPos] = useState(20);
  const [message, setMessage] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // AI Loop
  useEffect(() => {
    const loop = setInterval(() => {
      const containerWidth = containerRef.current?.clientWidth || 300;
      
      // 30% chance to say a message if sitting/cute/thinking/angry
      if (Math.random() < 0.3 && mascotState !== 'walking') {
        const mood = todayLog?.mood?.toLowerCase() || 'general';
        const msgs = (MESSAGES as any)[mood] || MESSAGES.general;
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        setMessage(msg);
        setTimeout(() => setMessage(null), 4000);
      }

      // Decide next action
      const actions: MascotState[] = ['walking', 'sitting', 'thinking', 'cute'];
      // If mood is angry/sad/anxious, add specific expressions to the pool
      if (todayLog?.mood === 'angry') actions.push('angry');
      
      const nextAction = actions[Math.floor(Math.random() * actions.length)];
      
      if (nextAction === 'walking') {
        const moveRight = Math.random() > 0.5;
        const newDirection = moveRight ? 'right' : 'left';
        
        // Calculate new X position within bounds (padding of 40px)
        const moveAmount = Math.floor(Math.random() * (containerWidth / 2)) + 50;
        let newX = moveRight ? xPos + moveAmount : xPos - moveAmount;
        
        // Clamp bounds with extra padding for speech bubbles
        if (newX < 30) {
          newX = 30;
          setDirection('right');
        } else if (newX > containerWidth - 110) {
          newX = containerWidth - 110;
          setDirection('left');
        } else {
          setDirection(newDirection);
        }

        setMascotState('walking');
        setXPos(newX);
        
        // Stop walking after 3-5 seconds
        setTimeout(() => {
          setMascotState('sitting');
        }, Math.random() * 2000 + 3000);
      } else {
        setMascotState(nextAction);
      }
      
    }, 8000); // Trigger a behavior every 8 seconds

    return () => clearInterval(loop);
  }, [xPos, todayLog, mascotState]);

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
    <div ref={containerRef} className="relative w-full h-16 pointer-events-none mb-[-1rem] z-20">
      <motion.div
        animate={{ x: xPos }}
        transition={{ type: 'tween', ease: 'linear', duration: mascotState === 'walking' ? 3 : 0.5 }}
        className="absolute bottom-0"
        style={{ width: '80px', height: '80px' }}
      >
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-3 py-1.5 rounded-full shadow-xl z-30 max-w-[120px] text-center break-words leading-tight flex items-center justify-center"
              style={{
                boxShadow: '0 4px 14px rgba(236,72,153,0.3)',
                border: '1px solid rgba(236,72,153,0.5)'
              }}
            >
              {message}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-b border-r border-pink-500/50" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ scaleX: direction === 'left' ? -1 : 1 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full relative"
          style={{ mixBlendMode: 'screen' }}
        >
          <Image
            src={getImageSrc()}
            alt="Dashboard Mascot"
            fill
            sizes="80px"
            style={{ objectFit: 'contain' }}
            priority
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
