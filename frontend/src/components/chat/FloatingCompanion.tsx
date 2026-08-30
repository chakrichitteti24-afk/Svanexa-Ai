'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { 
  MoreVertical, Trash2, Plus, SendHorizontal, Sparkles, Copy, 
  CheckCircle2, X, MessageSquare, ArrowLeft, History, Clock, SquarePen 
} from 'lucide-react';
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

// Memoized Markdown renderer optimized for mobile readability
const MarkdownRenderer = memo(({ content }: { content?: string | null }) => {
  const safeText = typeof content === 'string' ? content : '';
  return (
    <div className="markdown-prose text-[13.5px] sm:text-[14px] leading-relaxed break-words">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0 text-[13.5px] sm:text-[14px] leading-relaxed text-[#F3EEFA]" {...props} />,
          h1: ({ node, ...props }) => <h1 className="text-base font-bold text-white mb-2 mt-1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-sm font-bold text-pink-300 mb-1.5 mt-2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xs font-bold text-violet-300 mb-1 mt-1.5 uppercase tracking-wide" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1.5 text-[13px] sm:text-[13.5px] text-[#F3EEFA]" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1.5 text-[13px] sm:text-[13.5px] text-[#F3EEFA]" {...props} />,
          li: ({ node, ...props }) => <li className="leading-snug" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-pink-400 pl-3 py-1 my-2 text-xs italic text-pink-100 bg-pink-500/10 rounded-r-lg" {...props} />
          ),
          strong: ({ node, ...props }) => <strong className="font-semibold text-white tracking-wide" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-pink-200" {...props} />,
          code: ({ node, inline, ...props }: any) => 
            inline ? (
              <code className="bg-black/30 rounded px-1.5 py-0.5 text-xs font-mono" style={{ color: 'var(--hs-pink)' }} {...props} />
            ) : (
              <code className="block bg-black/40 rounded-lg p-2.5 text-xs font-mono overflow-x-auto mb-2 border border-white/10" {...props} />
            )
        }}
      >
        {safeText}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export const FloatingCompanion = memo(function FloatingCompanion() {
  const { userName, aiName, isLoading: profileLoading, allSlotsComplete, todayLog } = useHerSync();
  const viewportHeight = useVisualViewport();
  const pathname = usePathname();

  const getDynamicAvatar = () => {
    if (allSlotsComplete) return '/ai-companion-happy.jpg';
    if (!todayLog || typeof todayLog.mood !== 'string') return '/ai-companion-sitting.jpg';
    const mood = todayLog.mood.toLowerCase();
    if (['sad', 'depressed', 'gloomy'].includes(mood)) return '/ai-companion-sad.jpg';
    if (['anxious', 'stress', 'overwhelmed', 'mood_swings', 'nervous'].includes(mood)) return '/ai-companion-anxious.jpg';
    if (['angry', 'frustrated', 'irritated'].includes(mood)) return '/ai-companion-angry.jpg';
    if (['happy', 'joyful', 'excited', 'calm', 'energetic'].includes(mood)) return '/ai-companion-happy.jpg';
    return '/ai-companion-neutral.jpg';
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
    pathname === '/profile'        ? 'Profile' : 'Svanexa'
  );

  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryView, setShowHistoryView] = useState(false);
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

  // Lock background body scroll when chat overlay is open on mobile
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle swipe down to close on mobile drag handle only
  const [startY, setStartY] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setStartY(e.touches[0].clientY);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startY === null) return;
    const endY = e.changedTouches[0].clientY;
    if (endY - startY > 80) setIsOpen(false); // Swipe down on handle
    setStartY(null);
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch {}
    }
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  };

  const startNewChat = () => {
    const now = new Date().getTime();
    const newSession: ChatSession = {
      id: generateUUID(),
      title: 'New Chat',
      messages: [],
      created_at: now,
      updated_at: now,
    };
    setSessions(prev => [newSession, ...(Array.isArray(prev) ? prev : [])]);
    setActiveSessionId(newSession.id);
    setShowHistoryView(false);
  };

  const deleteSession = (idToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSessions(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const updated = list.filter(s => s.id !== idToDelete);
      if (activeSessionId === idToDelete) {
        if (updated.length > 0) {
          setActiveSessionId(updated[0].id);
        } else {
          const now = Date.now();
          const fresh: ChatSession = {
            id: generateUUID(),
            title: 'New Chat',
            messages: [],
            created_at: now,
            updated_at: now,
          };
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return updated;
    });
  };

  const clearAllSessions = () => {
    const now = Date.now();
    const fresh: ChatSession = {
      id: generateUUID(),
      title: 'New Chat',
      messages: [],
      created_at: now,
      updated_at: now,
    };
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setShowHistoryView(false);
  };

  const isUserScrolledUpRef = useRef(false);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isFarFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
    isUserScrolledUpRef.current = isFarFromBottom;
  };

  const scrollToBottom = (force = false) => {
    if ((force || !isUserScrolledUpRef.current) && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
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
        if (!isUserScrolledUpRef.current && bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        return;
      }
      currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, messages: [...currentMessages, { role: 'model', content: currentText, timestamp: new Date().getTime(), isStreaming: true }] };
      }));
      wordIndex++;
      if (!isUserScrolledUpRef.current && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 30);
  };

  const fetchGreeting = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const prompt = `[GENERATE_GREETING] Please generate a short, personalized greeting (max 2 sentences) using my most recent logged data. If I have no data, reply exactly with: "Welcome back! Once you complete a few wellness check-ins, I'll start providing personalized insights."`;
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: prompt, history: [], userName, aiName, currentPage: pageLabel }),
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
    const sessionList = Array.isArray(sessions) ? sessions : [];
    if (sessionList.length === 0 || !activeSessionId) {
      startNewChat();
    } else {
      const current = sessionList.find(s => s.id === activeSessionId);
      if (current && Array.isArray(current.messages) && current.messages.length === 0 && !isLoading) {
        fetchGreeting(current.id);
      }
    }
  }, [isOpen, profileLoading, sessions?.length, activeSessionId, fetchGreeting, startNewChat, activeSessionId, isLoading]);

  const activeSession = (Array.isArray(sessions) ? sessions : []).find(s => s.id === activeSessionId);
  const messages = Array.isArray(activeSession?.messages) ? activeSession.messages : [];

  useEffect(() => {
    if (isOpen && !showHistoryView) {
      isUserScrolledUpRef.current = false;
      scrollToBottom(true);
    }
  }, [isOpen, showHistoryView]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(120, Math.max(24, ta.scrollHeight))}px`;
  }, [inputMessage]);

  const updateActiveSession = (newMessages: ChatMessage[]) => {
    if (!activeSessionId) return;
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSessionId) return s;
        let title = s.title;
        if (newMessages.length >= 1 && s.title === 'New Chat') {
          const userMsg = newMessages.find(m => m.role === 'user');
          if (userMsg) title = userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '…' : '');
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
    isUserScrolledUpRef.current = false;
    scrollToBottom(true);

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
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(content).catch(() => {});
      }
    } catch {}
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };


  if (profileLoading) return null;

  return (
    <>
      {/* Premium Minimal Vector AI Companion FAB */}
      <motion.button
        className={styles.fab}
        onClick={() => setIsOpen(v => !v)}
        aria-label="Open AI Companion"
        animate={
          isLoading
            ? { scale: [1, 1.06, 1] }
            : { scale: 1 }
        }
        transition={
          isLoading
            ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        {isLoading && (
          <motion.div
            className={styles.fabGlowRing}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <span className={styles.fabPulse} />
        <div className={styles.fabIconWrap}>
          <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-white fill-white/20 drop-shadow-md" />
        </div>
      </motion.button>

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
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                mass: 0.8,
              }}
              className={`${styles.panel} ${styles.desktopPanel}`}
            >
              <div
                className={styles.dragHandle}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              />
              
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerTitle}>
                  {showHistoryView ? (
                    <button 
                      onClick={() => setShowHistoryView(false)} 
                      className="flex items-center gap-1.5 text-xs text-pink-400 font-semibold hover:text-pink-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Chat
                    </button>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center text-white shadow-md relative shrink-0">
                        <Sparkles className="w-4 h-4 fill-white/20" />
                        <span className={styles.onlineIndicator} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{aiName}</div>
                        <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 600 }}>● Online · AI Coach</div>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.headerActions}>
                  {/* ChatGPT-style New Chat button */}
                  <button 
                    className={styles.iconButton} 
                    onClick={startNewChat} 
                    title="New Chat"
                    aria-label="New Chat"
                  >
                    <SquarePen className="w-4.5 h-4.5 text-[#e879f9]" />
                  </button>

                  {/* ChatGPT-style History Toggle button */}
                  <button 
                    className={styles.iconButton} 
                    onClick={() => setShowHistoryView(v => !v)} 
                    title={showHistoryView ? "View Current Chat" : "Chat History"}
                    aria-label="Chat History"
                  >
                    <History className={`w-4.5 h-4.5 ${showHistoryView ? 'text-pink-400' : 'text-[#a79bbf]'}`} />
                  </button>

                  {/* Close button */}
                  <button className={styles.iconButton} onClick={() => setIsOpen(false)} aria-label="Close Chat">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* View 1: ChatGPT-Style Chat History Drawer */}
              {showHistoryView ? (
                <div className={styles.historyView}>
                  <div className={styles.historyHeader}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-pink-400" />
                      <span className="text-sm font-bold text-white">Your Conversations</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                        {sessions.length}
                      </span>
                    </div>
                    <button
                      onClick={clearAllSessions}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear all
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    {sessions.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
                        <p className="text-xs">No saved conversations yet.</p>
                      </div>
                    ) : (
                      sessions.map((sess) => {
                        const isActive = sess.id === activeSessionId;
                        const msgCount = Array.isArray(sess.messages) ? sess.messages.length : 0;
                        const dateFormatted = sess.updated_at 
                          ? format(sess.updated_at, 'MMM d, h:mm a') 
                          : 'Recent';

                        return (
                          <div
                            key={sess.id}
                            onClick={() => {
                              setActiveSessionId(sess.id);
                              setShowHistoryView(false);
                            }}
                            className={`${styles.sessionItem} ${isActive ? styles.sessionItemActive : ''}`}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                              <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-pink-400' : 'text-muted-foreground'}`} />
                              <div className="flex flex-col overflow-hidden">
                                <span className={styles.sessionTitle}>
                                  {sess.title || 'Conversation'}
                                </span>
                                <div className={styles.sessionMeta}>
                                  <span>{dateFormatted}</span>
                                  <span>·</span>
                                  <span>{msgCount} {msgCount === 1 ? 'msg' : 'msgs'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Delete single conversation */}
                            <button
                              type="button"
                              onClick={(e) => deleteSession(sess.id, e)}
                              className={styles.sessionDeleteBtn}
                              title="Delete conversation"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={startNewChat}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-violet-500/20 border border-pink-500/30 text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-pink-500/30 transition-all cursor-pointer mt-2"
                  >
                    <Plus className="w-4 h-4 text-pink-400" /> Start New Chat
                  </button>
                </div>
              ) : (
                <>
                  {/* View 2: Active Chat Messages */}
                  <div className={styles.messageList} ref={scrollContainerRef} onScroll={handleScroll}>
                    {messages.length === 0 && isLoading && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <Sparkles className="w-10 h-10 animate-pulse text-[#e879f9]" />
                        <p className="text-sm opacity-80 text-[#e879f9]">Generating greeting...</p>
                      </div>
                    )}
                    
                    {messages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: isUser ? 16 : -16, scale: 0.96 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                          className={`${styles.messageWrapper} ${isUser ? styles.user : styles.ai}`}
                        >
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center text-white shadow-sm shrink-0 mt-0.5">
                              <Sparkles className="w-3.5 h-3.5 fill-white/20" />
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
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2 mt-2">
                        {SUGGESTED_PROMPTS.map(prompt => (
                          <button key={prompt} onClick={() => handleSendMessage(prompt)} className="bg-white/5 border border-white/10 text-sm px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-[#E2DDF0]">
                            {prompt}
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {isLoading && messages.length > 0 && (
                      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className={`${styles.messageWrapper} ${styles.ai}`}>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center text-white shadow-sm shrink-0 mt-0.5">
                          <Sparkles className="w-3.5 h-3.5 fill-white/20 animate-spin" />
                        </div>
                        <div className={`${styles.bubble} ${styles.aiBubble} flex items-center gap-2 px-4 py-3`}>
                          <span className="text-xs font-semibold text-[#e879f9] tracking-wide">Thinking</span>
                          <div className="flex gap-1.5 items-center">
                            <motion.span 
                              className="w-1.5 h-1.5 bg-[#e879f9] rounded-full" 
                              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} 
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} 
                            />
                            <motion.span 
                              className="w-1.5 h-1.5 bg-[#e879f9] rounded-full" 
                              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} 
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }} 
                            />
                            <motion.span 
                              className="w-1.5 h-1.5 bg-[#e879f9] rounded-full" 
                              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} 
                              transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }} 
                            />
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
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
