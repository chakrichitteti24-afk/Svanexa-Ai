'use client';

import React, { useRef, useEffect } from 'react';
import { SendHorizontal, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  aiName: string;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  aiName,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate scrollHeight properly
    textarea.style.height = 'auto';

    // Calculate height (line-height is approx 22px, so 5 lines is ~110px)
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 120; // Allow 5 lines max before scrolling

    if (scrollHeight > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${Math.max(24, scrollHeight)}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit();
    }
  };

  return (
    <div 
      className="w-full px-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-md border-t border-border/30"
      style={{
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <form onSubmit={handleFormSubmit} className="relative max-w-2xl mx-auto flex items-end gap-2">
        <div className="flex-1 flex items-end gap-2 bg-secondary/35 dark:bg-secondary/20 border border-border/40 hover:border-border/60 focus-within:border-pink-500/50 focus-within:ring-2 focus-within:ring-pink-500/10 rounded-[28px] px-4 py-2.5 shadow-sm transition-all duration-200 backdrop-blur-xl">
          {/* Sparkles / Utility Icon on the left for premium feel */}
          <div className="p-1 rounded-full text-muted-foreground/60 hover:text-pink-500 hover:bg-pink-500/5 cursor-pointer transition-colors duration-200 self-end mb-0.5">
            <Sparkles className="w-4.5 h-4.5" />
          </div>

          {/* Growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${aiName}...`}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 py-1 max-h-[120px] min-h-[24px] overflow-hidden focus:ring-0 focus:outline-none"
            disabled={isLoading}
            style={{ WebkitOverflowScrolling: 'touch' }}
          />

          {/* Send / Loading Button inside the bubble for modern iOS design */}
          <div className="self-end mb-0.5 ml-1">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center justify-center h-8.5 w-8.5 rounded-full bg-pink-500/20 text-pink-500"
                >
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                </motion.div>
              ) : (
                <motion.button
                  key="send-btn"
                  type="submit"
                  disabled={!value.trim()}
                  whileTap={value.trim() ? { scale: 0.9 } : {}}
                  className={`flex items-center justify-center h-8.5 w-8.5 rounded-full transition-all duration-200 ${
                    value.trim()
                      ? 'bg-gradient-to-tr from-pink-500 to-violet-600 text-white shadow-md hover:shadow-lg cursor-pointer'
                      : 'bg-muted-foreground/10 text-muted-foreground/30 cursor-not-allowed'
                  }`}
                >
                  <SendHorizontal className="w-4.5 h-4.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </form>
      {/* Keyboard-safe spacer or fine print */}
      <div className="text-[10px] text-center text-muted-foreground/40 mt-2 pb-1">
        {aiName} can make mistakes. Verify important medical or health info.
      </div>
    </div>
  );
}
