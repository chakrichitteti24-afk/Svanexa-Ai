'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { MoreVertical, Trash2, Plus, SendHorizontal, Sparkles, Copy, CheckCircle2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/utils/api-client';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './FloatingCompanion.module.css';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

const SUGGESTED_PROMPTS = [
  "Analyze today's wellness",
  "Cycle insights",
  "Skin care tips",
  "Pregnancy progress"
];

// Memoized Markdown renderer
const MarkdownRenderer = memo(({ content }: { content: string }) => {
  return (
    <div className="markdown-prose text-[14px] leading-relaxed">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
          code: ({ node, inline, ...props }: any) => 
            inline ? (
              <code className="bg-black/30 rounded px-1 text-xs font-mono" style={{ color: 'var(--hs-pink)' }} {...props} />
            ) : (
              <code className="block bg-black/40 rounded p-2 text-xs font-mono overflow-x-auto mb-2 border border-white/10" {...props} />
            )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
MarkdownRenderer.displayName = 'MarkdownRenderer';

export function FloatingCompanion() {
  const { userName, aiName, isLoading: profileLoading, allSlotsComplete, todayLog } = useHerSync();
  const viewportHeight = useVisualViewport();
  const pathname = usePathname();

  const getDynamicAvatar = () => {
    if (allSlotsComplete) return '/mascot-cute.jpg';
    if (!todayLog || !todayLog.mood) return '/mascot-sitting.jpg';
    const mood = todayLog.mood.toLowerCase();
    if (['sad'].includes(mood)) return '/mascot-thinking.jpg'; // Thinking/empathetic
    if (['anxious', 'stress', 'overwhelmed', 'mood_swings'].includes(mood)) return '/mascot-thinking.jpg';
    if (['angry', 'frustrated'].includes(mood)) return '/mascot-angry.jpg';
    if (['happy', 'joyful', 'excited'].includes(mood)) return '/mascot-cute.jpg';
    return '/mascot-sitting.jpg';
  };
  
  const avatarSrc = getDynamicAvatar();

  // Derive a human-readable page label to pass to the AI
  const pageLabel = (
    pathname === '/dashboard'      ? 'Dashboard' :
    pathname === '/check-in'       ? 'Daily Check-in' :
    pathname === '/wellness-plan'  ? 'Wellness Plan' :
    pathname === '/cycle'          ? 'Cycle Tracker' :
    pathname === '/skin'           ? 'Skin Tracker' :
    pathname === '/reports'        ? 'Reports' :
    pathname === '/profile'        ? 'Profile' : 'HerSync'
  );

  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when pressing Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle swipe down to close on mobile
  const [startY, setStartY] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setStartY(e.touches[0].clientY);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startY === null) return;
    const endY = e.changedTouches[0].clientY;
    if (endY - startY > 100) setIsOpen(false); // Swipe down
    setStartY(null);
  };

  const startNewChat = () => {
    const now = new Date().getTime();
    const newSession: ChatSession = {
      id: crypto.randomUUID(), title: 'New Chat', messages: [], created_at: now, updated_at: now,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const streamMessage = (fullText: string, sessionId: string, currentMessages: ChatMessage[]) => {
    const words = fullText.split(' ');
    let currentText = '';
    let wordIndex = 0;

    const streamInterval = setInterval(() => {
      if (wordIndex >= words.length) {
        clearInterval(streamInterval);
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          return { ...s, messages: [...currentMessages, { role: 'model', content: fullText, timestamp: new Date().getTime() }] };
        }));
        if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return;
      }
      currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, messages: [...currentMessages, { role: 'model', content: currentText, timestamp: new Date().getTime(), isStreaming: true }] };
      }));
      wordIndex++;
      if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 30);
  };

  const fetchGreeting = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const prompt = `[GENERATE_GREETING] Please generate a short, personalized greeting (max 2 sentences) using my most recent logged data. If I have no data, reply exactly with: "Welcome back! Once you complete a few wellness check-ins, I'll start providing personalized insights."`;
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: prompt, history: [], userName, aiName }),
      });
      if (res.ok) {
        const { response } = await res.json();
        streamMessage(response, sessionId, []);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading || !isOpen) return;
    if (sessions.length === 0 || !activeSessionId) {
      startNewChat();
    } else {
      const current = sessions.find(s => s.id === activeSessionId);
      if (current && current.messages.length === 0 && !isLoading) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchGreeting(current.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, profileLoading, sessions.length, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages.length, isLoading, isOpen]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(120, Math.max(24, ta.scrollHeight))}px`;
  }, [inputMessage]);

  const clearChatHistory = () => {
    if (activeSessionId) {
      setSessions(prev => prev.filter(s => s.id !== activeSessionId));
    }
    startNewChat();
  };

  const updateActiveSession = (newMessages: ChatMessage[]) => {
    if (!activeSessionId) return;
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSessionId) return s;
        let title = s.title;
        if (newMessages.length >= 2 && s.title === 'New Chat') {
          const userMsg = newMessages.find(m => m.role === 'user');
          if (userMsg) title = userMsg.content.slice(0, 28) + (userMsg.content.length > 28 ? '…' : '');
        }
        return { ...s, messages: newMessages, updated_at: new Date().getTime(), title };
      })
    );
  };



  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = (customMessage || inputMessage).trim();
    if (!messageToSend || isLoading || !activeSession) return;
    setInputMessage('');
    setIsLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: messageToSend, timestamp: new Date().getTime() };
    const newMessages = [...messages, userMsg];
    updateActiveSession(newMessages);
    scrollToBottom();

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: messageToSend,
          history: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
          userName, aiName,
          currentPage: pageLabel,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const { response } = await res.json();
      setIsLoading(false);
      streamMessage(response, activeSessionId as string, newMessages);
    } catch {
      setIsLoading(false);
      updateActiveSession([...newMessages, { role: 'model', content: "Connection trouble. Try again soon. 💜", timestamp: new Date().getTime() }]);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (profileLoading) return null;

  return (
    <>
      {/* Anime Girl FAB */}
      <button
        className={styles.fab}
        onClick={() => setIsOpen(v => !v)}
        aria-label="Open AI Companion"
      >
        <span className={styles.fabPulse} />
        <Image
          src={avatarSrc}
          alt="AI Companion"
          width={56}
          height={56}
          className={styles.fabAvatar}
          priority
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={styles.overlay}
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              ref={panelRef}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className={`${styles.panel} ${styles.desktopPanel}`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className={styles.dragHandle} />
              
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  <div className={styles.headerAvatarWrap}>
                    <Image
                      src={avatarSrc}
                      alt={aiName}
                      width={34}
                      height={34}
                      className={styles.headerAvatar}
                    />
                    <span className={styles.onlineIndicator} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{aiName}</div>
                    <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 600 }}>● Online · AI Wellness Coach</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger className={styles.iconButton}>
                      <MoreVertical className="w-5 h-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[#12101c] border-[#ffffff1a] text-white">
                      <DropdownMenuItem onClick={startNewChat} className="cursor-pointer gap-2 hover:bg-white/10">
                        <Plus className="w-4 h-4" /> New Chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={clearChatHistory} className="cursor-pointer gap-2 text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" /> Clear History
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button className={styles.iconButton} onClick={() => setIsOpen(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className={styles.messageList} ref={scrollContainerRef}>
                {messages.length === 0 && isLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Sparkles className="w-10 h-10 animate-pulse text-[#e879f9]" />
                    <p className="text-sm opacity-80 text-[#e879f9]">Generating greeting...</p>
                  </div>
                )}
                
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${styles.messageWrapper} ${isUser ? styles.user : styles.ai}`}>
                      {!isUser && (
                        <div className={`${styles.messageAvatar} ${styles.aiAvatar}`}>
                          <Image src={avatarSrc} alt={aiName} width={28} height={28} className={styles.msgAvatar} />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 max-w-full overflow-hidden">
                        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
                          {isUser ? <span className="whitespace-pre-wrap">{msg.content}</span> : <MarkdownRenderer content={msg.content} />}
                          {msg.isStreaming && <span className="inline-block w-1.5 h-3 ml-1 bg-white/70 animate-pulse align-middle" />}
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <span className={`${styles.timestamp} ${isUser ? styles.userTimestamp : ''}`}>
                            {msg.timestamp ? format(msg.timestamp, 'h:mm a') : format(new Date(), 'h:mm a')}
                          </span>
                          {!isUser && !msg.isStreaming && (
                            <button onClick={() => handleCopy(msg.content, idx)} className="text-[#8C82A6] hover:text-white p-1">
                              {copiedIndex === idx ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {messages.length === 1 && messages[0].role === 'model' && !messages[0].isStreaming && !isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 mt-2">
                    {SUGGESTED_PROMPTS.map(prompt => (
                      <button key={prompt} onClick={() => handleSendMessage(prompt)} className="bg-white/5 border border-white/10 text-sm px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-[#E2DDF0]">
                        {prompt}
                      </button>
                    ))}
                  </motion.div>
                )}

                {isLoading && messages.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${styles.messageWrapper} ${styles.ai}`}>
                    <div className={`${styles.messageAvatar} ${styles.aiAvatar}`}>
                      <Image src={avatarSrc} alt={aiName} width={28} height={28} className={styles.msgAvatar} />
                    </div>
                    <div className={`${styles.bubble} ${styles.aiBubble} flex items-center gap-2 px-4 py-3`}>
                      <span className="text-sm font-medium text-[#e879f9]">Thinking</span>
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-[#e879f9] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#e879f9] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#e879f9] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} className="h-2" />
              </div>

              {/* Input */}
              <div className={styles.inputContainer}>
                <div className={styles.inputWrapper}>
                  <Sparkles className="w-4 h-4 text-[#9D4EDD] mb-1 mr-1" />
                  <textarea
                    ref={textareaRef} value={inputMessage} onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder={`Message ${aiName}…`} disabled={isLoading} className={styles.textarea} rows={1}
                  />
                  <button className={styles.sendButton} onClick={() => handleSendMessage()} disabled={!inputMessage.trim() || isLoading}>
                    <SendHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <div className={styles.disclaimer}>{aiName} can make mistakes.</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
