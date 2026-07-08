'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { ArrowLeft, MoreVertical, Trash2, Plus, BrainCircuit, SendHorizontal, Sparkles, User, ChevronRight, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/utils/api-client';
import { useHerSync } from '@/context/HerSyncContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './companion.module.css';

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
  "Explain my report",
  "Cycle insights",
  "Skin care tips",
  "Sleep analysis",
  "Pregnancy progress",
  "Weekly summary"
];

// Memoized Markdown renderer to prevent re-renders of old messages during streaming
const MarkdownRenderer = memo(({ content }: { content: string }) => {
  return (
    <div className="markdown-prose text-[15px] leading-relaxed">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-md font-bold mt-2 mb-1" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
          code: ({ node, inline, ...props }: any) => 
            inline ? (
              <code className="bg-black/30 rounded px-1.5 py-0.5 text-sm font-mono" style={{ color: 'var(--hs-pink)' }} {...props} />
            ) : (
              <code className="block bg-black/40 rounded-lg p-3 text-sm font-mono overflow-x-auto mb-3 border border-white/10" {...props} />
            )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default function CompanionPage() {
  const viewportHeight = useVisualViewport();
  const { userName, aiName, isLoading: profileLoading } = useHerSync();
  const loadingProfile = profileLoading;

  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);



  const fetchGreeting = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const prompt = `[GENERATE_GREETING] Please generate a short, personalized greeting (max 2 sentences) using my most recent logged data. If I have no data, reply exactly with: "Welcome back! Once you complete a few wellness check-ins, I'll start providing personalized insights."`;
      
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          userName: userName,
          aiName: aiName
        }),
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
    if (loadingProfile) return;
    if (sessions.length === 0 || !activeSessionId) {
      startNewChat();
    } else {
      const current = sessions.find(s => s.id === activeSessionId);
      if (current && current.messages.length === 0 && !isLoading) {
        fetchGreeting(current.id);
      }
    }
  }, [loadingProfile, sessions.length, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(120, Math.max(24, ta.scrollHeight))}px`;
  }, [inputMessage]);

  const startNewChat = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    // Fetch greeting will trigger due to useEffect above
  };

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
          if (userMsg) {
            const first = userMsg.content;
            title = first.length > 28 ? first.slice(0, 28) + '…' : first;
          }
        }
        return { ...s, messages: newMessages, updated_at: Date.now(), title };
      })
    );
  };

  const streamMessage = (fullText: string, sessionId: string, currentMessages: ChatMessage[]) => {
    const words = fullText.split(' ');
    let currentText = '';
    let wordIndex = 0;

    const streamInterval = setInterval(() => {
      if (wordIndex >= words.length) {
        clearInterval(streamInterval);
        // Finalize
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          const updated = [...currentMessages, { role: 'model', content: fullText, timestamp: Date.now() }];
          return { ...s, messages: updated as ChatMessage[] };
        }));
        scrollToBottom();
        return;
      }
      
      currentText += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
      
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        const updated = [...currentMessages, { role: 'model', content: currentText, timestamp: Date.now(), isStreaming: true }];
        return { ...s, messages: updated as ChatMessage[] };
      }));
      
      wordIndex++;
      scrollToBottom();
    }, 30);
  };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = (customMessage || inputMessage).trim();
    if (!messageToSend || isLoading || !activeSession) return;

    setInputMessage('');
    setIsLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: messageToSend, timestamp: Date.now() };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    updateActiveSession(newMessages);
    
    // Simulate thinking state slightly to match ChatGPT
    scrollToBottom();

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: messageToSend,
          history: messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.content,
          })),
          userName: userName,
          aiName: aiName
        }),
      });

      if (!res.ok) throw new Error('Chat API error');
      const { response } = await res.json();

      setIsLoading(false);
      streamMessage(response, activeSessionId as string, newMessages);
    } catch {
      setIsLoading(false);
      updateActiveSession([
        ...newMessages,
        {
          role: 'model',
          content: "I'm having a little trouble connecting right now. Can we try again in a moment? 💜",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05050A]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--hs-pink)' }} />
      </div>
    );
  }

  return (
    <div className={styles.chatContainer} style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}>
      
      {/* Header */}
      <header className={styles.header}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className={styles.iconButton}>
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-3">
            <div className={styles.headerAvatarContainer}>
              <div className={styles.headerAvatar}>
                <BrainCircuit className="w-4 h-4 text-white" />
              </div>
              <span className={styles.onlineIndicator} />
            </div>
            <div>
              <h1 className={styles.headerTitle}>{aiName}</h1>
              <p className={styles.headerSubtitle}>
                {isLoading ? 'Thinking...' : 'Your AI Wellness Companion'}
              </p>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className={styles.iconButton}>
            <MoreVertical className="w-5 h-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#12101c] border-[#ffffff1a] text-white">
            <DropdownMenuItem onClick={startNewChat} className="cursor-pointer gap-2 hover:bg-white/10 focus:bg-white/10">
              <Plus className="w-4 h-4" /> New Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={clearChatHistory} className="cursor-pointer gap-2 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10">
              <Trash2 className="w-4 h-4" /> Clear History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div className={styles.messageList} ref={scrollContainerRef}>
        {messages.length === 0 && isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <BrainCircuit className="w-10 h-10 animate-pulse" style={{ color: 'var(--hs-pink)' }} />
              <p className="text-sm opacity-80" style={{ color: 'var(--hs-pink)' }}>Generating your personalized greeting...</p>
            </div>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`${styles.messageWrapper} ${isUser ? styles.user : styles.ai}`}
              >
                {!isUser && (
                  <div className={`${styles.messageAvatar} ${styles.aiAvatar}`}>
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className="flex flex-col gap-1 max-w-full">
                  <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                    
                    {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 bg-white/70 animate-pulse align-middle" />}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1 px-1">
                    <div className={`${styles.timestamp} ${isUser ? styles.userTimestamp : styles.aiTimestamp}`}>
                      {msg.timestamp ? format(msg.timestamp, 'h:mm a') : format(new Date(), 'h:mm a')}
                    </div>
                    {!isUser && !msg.isStreaming && (
                      <button 
                        onClick={() => handleCopy(msg.content, idx)}
                        className="text-[#8C82A6] hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
                        title="Copy message"
                      >
                        {copiedIndex === idx ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {isUser && (
                  <div className={`${styles.messageAvatar} ${styles.userAvatar}`}>
                    <User className="w-4 h-4 text-[#B3A8D6]" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Quick Suggestions - Only shown after the very first AI message */}
          {messages.length === 1 && messages[0].role === 'model' && !messages[0].isStreaming && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-2 mt-4 max-w-[85%] self-start"
            >
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button 
                  key={idx}
                  className="bg-white/5 border border-white/10 text-[#E2DDF0] px-4 py-2 rounded-full text-sm transition-all"
                  style={{
                    boxShadow: 'inset 0 0 0 1px transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--hs-glass-border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-gradient-color1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                  }}
                  onClick={() => handleSendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}

          {isLoading && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`${styles.messageWrapper} ${styles.ai}`}
            >
              <div className={`${styles.messageAvatar} ${styles.aiAvatar}`}>
                <BrainCircuit className="w-4 h-4 text-white" />
              </div>
              <div className={`${styles.bubble} ${styles.aiBubble}`} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--hs-pink)' }}>Thinking</span>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--hs-pink)' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <Sparkles className="w-5 h-5 text-[#9D4EDD] mb-1.5 mr-1" />
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Message ${aiName}…`}
            disabled={isLoading}
            className={styles.textarea}
            rows={1}
          />
          <button 
            className={styles.sendButton}
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
          </button>
        </div>
        <div className={styles.disclaimer}>
          {aiName} can make mistakes. Not a substitute for medical advice.
        </div>
      </div>

    </div>
  );
}
