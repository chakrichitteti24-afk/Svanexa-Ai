'use client';

import { motion } from 'framer-motion';
import { Sparkles, Calendar, Moon, Heart, Smile } from 'lucide-react';

interface SuggestedPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const PROMPTS = [
  { text: 'How am I doing this week?', icon: Smile, color: 'text-emerald-500 bg-emerald-500/10' },
  { text: 'Tell me about my cycle.', icon: Calendar, color: 'text-pink-500 bg-pink-500/10' },
  { text: 'Skin care tips.', icon: Heart, color: 'text-violet-500 bg-violet-500/10' },
  { text: 'Help me improve sleep.', icon: Moon, color: 'text-indigo-500 bg-indigo-500/10' },
];

export default function SuggestedPrompts({ onPromptClick }: SuggestedPromptsProps) {
  return (
    <div className="relative w-full py-2 select-none overflow-hidden">
      {/* Soft gradient fades on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div className="flex gap-2 overflow-x-auto px-4 scrollbar-none snap-x snap-mandatory">
        {PROMPTS.map((prompt, index) => {
          const Icon = prompt.icon;
          return (
            <motion.button
              key={index}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPromptClick(prompt.text)}
              className="flex items-center gap-2 px-4 py-2.5 bg-card/60 hover:bg-card border border-border/40 hover:border-pink-500/30 rounded-full shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer whitespace-nowrap snap-center"
            >
              <div className={`p-1 rounded-full ${prompt.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-foreground/80">
                {prompt.text}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
