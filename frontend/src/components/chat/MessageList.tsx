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

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom('smooth'), 80);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  const formatTime = (timestamp?: number) => {
    try {
      return format(timestamp ? new Date(timestamp) : new Date(), 'h:mm a');
    } catch {
      return format(new Date(), 'h:mm a');
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.length > 0 && (
          <div className="flex items-center justify-center my-1">
            <span className="text-[10px] font-bold text-[#5a527a] tracking-widest uppercase bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
              Today
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLastAI = !isUser && idx === messages.length - 1 && !isLoading;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`flex w-full gap-2.5 items-end ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-white/[0.1] border border-white/[0.14] flex items-center justify-center shrink-0 mb-0.5 shadow-sm text-foreground">
                    <BrainCircuit className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={`relative text-[15px] sm:text-[16px] leading-relaxed break-words px-4 py-2.5 ${
                    isUser
                      ? 'max-w-[75%] bg-primary text-white rounded-2xl rounded-br-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.2)]'
                      : 'max-w-[85%] bg-white/[0.08] border border-white/[0.1] text-foreground rounded-2xl rounded-bl-sm backdrop-blur-md'
                  } ${isLastAI ? 'fade-in-up' : ''}`}
                >
                  {/* Message content */}
                  <span className="whitespace-pre-wrap">{msg.content}</span>

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] font-medium mt-1 text-right leading-none ${
                      isUser ? 'text-white/60' : 'text-muted-foreground'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0 mb-0.5 text-foreground">
                    <User className="w-4 h-4 text-[#9d91c4]" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="flex w-full gap-2.5 items-end justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-white/[0.1] border border-white/[0.14] flex items-center justify-center shrink-0 mb-0.5 shadow-sm text-foreground">
                <BrainCircuit className="w-4 h-4 text-primary" />
              </div>
              <TypingIndicator aiName={aiName} />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
