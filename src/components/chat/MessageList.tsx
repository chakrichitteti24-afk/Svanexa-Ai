'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { BrainCircuit, User } from 'lucide-react';
import TypingIndicator from './TypingIndicator';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: number;
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  aiName: string;
}

export default function MessageList({ messages, isLoading, aiName }: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior });
    }
  };

  // Auto-scroll on initial load and when message count changes
  useEffect(() => {
    // Initial mount: instant scroll to bottom
    scrollToBottom('auto');
  }, []);

  useEffect(() => {
    // If a new message is added or loading state changes, smoothly scroll to bottom
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  // Helper to format timestamps safely
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return format(new Date(), 'h:mm a');
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch {
      return format(new Date(), 'h:mm a');
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-pink-500/10 scrollbar-track-transparent scroll-smooth"
      style={{
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Date Header for starting point */}
      <div className="text-center my-4">
        <span className="text-[10px] font-semibold text-muted-foreground/50 tracking-wider uppercase bg-secondary/30 px-3 py-1.5 rounded-full border border-border/20">
          Today
        </span>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`flex w-full gap-2 items-end ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center shadow-inner shrink-0 mb-1">
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`relative max-w-[75%] px-4 py-2.5 shadow-sm text-[15px] leading-relaxed transition-all duration-200 ${
                    isUser
                      ? 'bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 text-white rounded-3xl rounded-br-sm'
                      : 'bg-secondary/45 dark:bg-secondary/20 border border-border/30 text-foreground rounded-3xl rounded-bl-sm'
                  }`}
                >
                  {/* Message Content */}
                  <div className="pr-4 pb-2 whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>

                  {/* Timestamp aligned nicely in the bottom corner */}
                  <span
                    className={`absolute bottom-1.5 right-3 text-[9px] font-medium tracking-tight ${
                      isUser ? 'text-white/60' : 'text-muted-foreground/60'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex w-full gap-2 items-end justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center shadow-inner shrink-0 mb-1">
                <BrainCircuit className="w-4 h-4 text-white" />
              </div>
              <TypingIndicator aiName={aiName} />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}
