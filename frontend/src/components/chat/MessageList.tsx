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
      className="flex-1 overflow-y-auto scrollbar-thin"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex flex-col gap-2 px-4 py-4 max-w-2xl mx-auto">
        {/* Date separator */}
        <div className="flex items-center justify-center my-2">
          <span className="text-[10px] font-semibold text-[#5a527a] tracking-wider uppercase bg-white/4 px-3 py-1 rounded-full border border-white/5">
            Today
          </span>
        </div>

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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-600 flex items-center justify-center shrink-0 mb-1 shadow-md shadow-violet-500/20">
                    <BrainCircuit className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`relative max-w-[78%] text-[14.5px] leading-relaxed break-words ${
                    isUser
                      ? 'bg-gradient-to-br from-pink-500 to-violet-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-lg shadow-pink-500/15'
                      : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(168,85,247,0.12)] text-[#f0eeff] rounded-2xl rounded-bl-md px-4 py-2.5'
                  } ${isLastAI ? 'fade-in-up' : ''}`}
                >
                  {/* Content — whitespace preserved for line breaks */}
                  <span className="whitespace-pre-wrap">{msg.content}</span>

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] font-medium mt-1 text-right leading-none ${
                      isUser ? 'text-white/50' : 'text-[#5a527a]'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(168,85,247,0.15)] flex items-center justify-center shrink-0 mb-1">
                    <User className="w-3.5 h-3.5 text-[#9d91c4]" />
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-violet-600 flex items-center justify-center shrink-0 mb-1 shadow-md shadow-violet-500/20">
                <BrainCircuit className="w-3.5 h-3.5 text-white" />
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
