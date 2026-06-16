'use client';

import { motion } from 'framer-motion';
import { Smile, Calendar, Sparkles, Activity } from 'lucide-react';

interface SuggestedPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const PROMPTS = [
  { text: 'How am I doing today?', icon: Smile, color: 'text-emerald-400 bg-emerald-500/10' },
  { text: 'Cycle Insights', icon: Calendar, color: 'text-pink-400 bg-pink-500/10' },
  { text: 'Skin Tips', icon: Sparkles, color: 'text-violet-400 bg-violet-500/10' },
  { text: 'Mood Analysis', icon: Activity, color: 'text-indigo-400 bg-indigo-500/10' },
];

export default function SuggestedPrompts({ onPromptClick }: SuggestedPromptsProps) {
  return (
    <div className="relative w-full py-3 select-none overflow-hidden shrink-0 bg-[#0a0a0f]">
      {/* Soft gradient fades on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

      <div className="flex gap-2 overflow-x-auto px-4 scrollbar-none snap-x snap-mandatory">
        {PROMPTS.map((prompt, index) => {
          const Icon = prompt.icon;
          return (
            <motion.button
              key={index}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPromptClick(prompt.text)}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-white/5 border border-[rgba(168,85,247,0.12)] hover:border-pink-500/30 rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap snap-center"
            >
              <div className={`p-1 rounded-full ${prompt.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-[#f0eeff]">
                {prompt.text}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
