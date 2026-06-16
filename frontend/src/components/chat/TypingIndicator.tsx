'use client';

import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  aiName: string;
}

export default function TypingIndicator({ aiName }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-[rgba(255,255,255,0.06)] border border-[rgba(168,85,247,0.12)] w-fit">
      {/* Animated dots */}
      <div className="flex gap-1 items-center">
        {[0, 0.18, 0.36].map((delay, i) => (
          <motion.span
            key={i}
            className="block w-[5px] h-[5px] rounded-full bg-violet-400"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 0.9, delay, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <span className="text-[13px] font-medium text-[#7c71a4]">
        {aiName} is typing
      </span>
    </div>
  );
}
