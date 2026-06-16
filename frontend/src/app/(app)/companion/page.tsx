'use client';

import { useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, MoreVertical, Trash2, Plus, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MessageList, { ChatMessage } from '@/components/chat/MessageList';
import ChatInput from '@/components/chat/ChatInput';
import SuggestedPrompts from '@/components/chat/SuggestedPrompts';
import { apiFetch } from '@/utils/api-client';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

export default function CompanionPage() {
  const supabase = createClient();
  const viewportHeight = useVisualViewport();

  const [userName, setUserName] = useState<string>('there');
  const [aiName, setAiName] = useState<string>('Luna');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username, ai_name')
          .eq('id', user.id)
          .single();
        if (data) {
          setUserName(data.username);
          setAiName(data.ai_name);
        }
      }
      setLoadingProfile(false);
    }
    loadProfile();
  }, [supabase]);

  // Init session
  useEffect(() => {
    if (loadingProfile) return;
    if (sessions.length === 0 || !activeSessionId) {
      startNewChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingProfile]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const startNewChat = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [], // Starts completely empty to trigger empty state screen
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
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
        if (newMessages.length === 2 && s.title === 'New Chat') {
          const first = newMessages[0]?.content || '';
          title = first.length > 28 ? first.slice(0, 28) + '…' : first;
        }
        return { ...s, messages: newMessages, updated_at: Date.now(), title };
      })
    );
  };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = (customMessage || inputMessage).trim();
    if (!messageToSend || isLoading || !activeSession) return;

    setInputMessage('');
    setIsLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: messageToSend, timestamp: Date.now() };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    updateActiveSession(newMessages);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: messageToSend,
          history: messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error('Chat API error');
      const { response } = await res.json();

      updateActiveSession([...newMessages, { role: 'model', content: response, timestamp: Date.now() }]);
    } catch {
      updateActiveSession([
        ...newMessages,
        {
          role: 'model',
          content: "I'm having a little trouble connecting right now. Can we try again in a moment? 💜",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center animate-pulse">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-[#5a527a]">Loading companion…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col w-full max-w-2xl mx-auto overflow-hidden relative"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        background: '#0a0a0f',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b z-20"
        style={{
          background: 'rgba(10,8,18,0.92)',
          backdropFilter: 'blur(24px)',
          borderColor: 'rgba(168,85,247,0.12)',
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-[#7c71a4] transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>

          <div className="flex items-center gap-2.5">
            {/* AI avatar with live indicator */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <BrainCircuit className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0a0a0f] status-online" />
            </div>

            <div>
              <h1 className="text-[15px] font-bold text-white leading-none">{aiName}</h1>
              <p className="text-[10px] text-[#5a527a] mt-0.5 font-medium">
                {isLoading ? 'typing…' : 'Online'}
              </p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-[#7c71a4] transition-colors">
            <MoreVertical className="w-4.5 h-4.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 border-[rgba(168,85,247,0.15)] bg-[rgba(18,16,28,0.98)] backdrop-blur-xl text-[#f0eeff]"
          >
            <DropdownMenuItem
              onClick={startNewChat}
              className="cursor-pointer text-sm gap-2 hover:bg-white/5 focus:bg-white/5"
            >
              <Plus className="w-4 h-4" /> New Chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={clearChatHistory}
              className="cursor-pointer text-sm gap-2 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400"
            >
              <Trash2 className="w-4 h-4" /> Clear History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages Scrollable Area OR Empty State */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center px-6 text-center select-none animate-in fade-in duration-500 overflow-y-auto">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25 mb-6 relative">
            <BrainCircuit className="w-8 h-8 text-white" />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#0a0a0f] status-online" />
          </div>
          
          <h2 className="text-2xl font-bold text-white tracking-tight leading-normal mb-1">
            Hi {userName} 💜
          </h2>
          <p className="text-[#9d91c4] text-base max-w-sm mb-8 leading-relaxed whitespace-pre-line">
            I'm {aiName}.{"\n"}How are you feeling today?
          </p>
          
          <div className="w-full max-w-sm">
            <p className="text-[10px] font-bold text-[#5a527a] uppercase tracking-wider mb-3 text-center">
              Suggested Actions
            </p>
            <SuggestedPrompts onPromptClick={(p) => handleSendMessage(p)} />
          </div>
        </div>
      ) : (
        <MessageList messages={messages} isLoading={isLoading} aiName={aiName} />
      )}

      {/* Input Form at bottom */}
      <div className="shrink-0 z-10">
        <ChatInput
          value={inputMessage}
          onChange={setInputMessage}
          onSubmit={() => handleSendMessage()}
          isLoading={isLoading}
          aiName={aiName}
        />
      </div>
    </div>
  );
}
