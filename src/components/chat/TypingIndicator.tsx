'use client';

import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  aiName: string;
}

export default function TypingIndicator({ aiName }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 px-4 py-3 bg-secondary/30 backdrop-blur-md border border-border/30 rounded-2xl w-fit max-w-[80%] shadow-sm"
    >
      <div className="flex gap-1.5 items-center">
        <motion.span
          className="w-2.5 h-2.5 bg-pink-500 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1, delay: 0 }}
        />
        <motion.span
          className="w-2.5 h-2.5 bg-violet-500 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
        />
        <motion.span
          className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
        />
      </div>
      <span className="text-sm font-medium text-muted-foreground animate-pulse">
        {aiName} is typing...
      </span>
    </motion.div>
  );
}
