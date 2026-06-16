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

export default function ChatInput({ value, onChange, onSubmit, isLoading, aiName }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 140;
    if (ta.scrollHeight > maxH) {
      ta.style.height = `${maxH}px`;
      ta.style.overflowY = 'auto';
    } else {
      ta.style.height = `${Math.max(22, ta.scrollHeight)}px`;
      ta.style.overflowY = 'hidden';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) onSubmit();
  };

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div
      className="w-full px-3 pt-2 bg-gradient-to-t from-[#0a0a0f] via-[rgba(10,10,15,0.96)] to-transparent backdrop-blur-lg border-t border-[rgba(168,85,247,0.1)]"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}
    >
      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto flex items-end gap-2">
        {/* Input container */}
        <div
          className="flex-1 flex items-end gap-2 rounded-[22px] px-3.5 py-2.5 transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: value.trim()
              ? '1px solid rgba(168,85,247,0.35)'
              : '1px solid rgba(168,85,247,0.12)',
            boxShadow: value.trim() ? '0 0 20px rgba(168,85,247,0.08)' : 'none',
          }}
        >
          {/* Left icon */}
          <div className="self-end mb-0.5 text-[#5a527a]">
            <Sparkles className="w-4 h-4" />
          </div>

          {/* Growing textarea - 16px font size prevents Safari auto-zoom */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${aiName}…`}
            disabled={isLoading}
            autoFocus
            className="flex-1 bg-transparent border-0 outline-none resize-none text-[16px] leading-relaxed text-[#f0eeff] placeholder:text-[#4d4668] py-0.5 max-h-[140px] min-h-[22px] focus:ring-0 scrollbar-thin"
            style={{ WebkitOverflowScrolling: 'touch' }}
          />

          {/* Send / Loading button */}
          <div className="self-end mb-0.5">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/15"
                >
                  <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
                </motion.div>
              ) : (
                <motion.button
                  key="send"
                  type="submit"
                  disabled={!canSend}
                  whileTap={canSend ? { scale: 0.9 } : {}}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                    canSend
                      ? 'bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-md shadow-violet-500/25 cursor-pointer'
                      : 'bg-white/5 text-[#4d4668] cursor-not-allowed'
                  }`}
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </form>

      {/* Disclaimer */}
      <p className="text-[10px] text-center text-[#3d3558] mt-1.5 pb-0.5">
        {aiName} can make mistakes. Not a substitute for medical advice.
      </p>
    </div>
  );
}
