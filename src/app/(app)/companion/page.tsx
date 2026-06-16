'use client';

import { useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, MoreVertical, Trash2, BrainCircuit, Loader2 } from 'lucide-react';
import Link from 'next/link';
// getCompanionResponse is now handled server-side via /api/chat
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
  const [cycles] = useLocalStorage<any[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<Record<string, any>>('hersync_checkins', {});
  const [skinEntries] = useLocalStorage<any[]>('hersync_skin', []);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch profile
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

  // Ensure an active session exists when profile loads
  useEffect(() => {
    if (loadingProfile) return;

    if (sessions.length === 0 || !activeSessionId) {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        messages: [
          {
            role: 'model',
            content: `Hey ${userName} 😊 I'm ${aiName}. It's nice to see you again. How are you feeling today?`,
            timestamp: Date.now()
          }
        ],
        created_at: Date.now(),
        updated_at: Date.now()
      };
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
    }
  }, [sessions.length, activeSessionId, userName, aiName, loadingProfile, setSessions, setActiveSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const updateActiveSession = (newMessages: ChatMessage[]) => {
    if (!activeSessionId) return;
    
    // Auto-generate title from first user message if it's "New Chat"
    let newTitle = activeSession?.title;
    if (newMessages.length === 3 && activeSession?.title === 'New Chat') {
      const firstUserMsg = newMessages[1].content;
      newTitle = firstUserMsg.length > 25 ? firstUserMsg.substring(0, 25) + '...' : firstUserMsg;
    }

    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: newMessages, updated_at: Date.now(), title: newTitle || s.title };
      }
      return s;
    });
    setSessions(updatedSessions);
  };

  const startNewChat = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [
        {
          role: 'model',
          content: `Hi ${userName}! What's on your mind?`,
          timestamp: Date.now()
        }
      ],
      created_at: Date.now(),
      updated_at: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
  };

  const clearChatHistory = () => {
    startNewChat();
  };

  const handleSendMessage = async (customMessage?: string) => {
    const messageToSend = (customMessage || inputMessage).trim();
    if (!messageToSend || isLoading || !activeSession) return;

    // Clear input box
    setInputMessage('');
    setIsLoading(true);

    const userMsgObj: ChatMessage = { 
      role: 'user', 
      content: messageToSend, 
      timestamp: Date.now() 
    };

    const newMessages: ChatMessage[] = [...activeSession.messages, userMsgObj];
    updateActiveSession(newMessages);

    try {
      const chatResponse = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: messageToSend,
          history: activeSession.messages.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      });

      if (!chatResponse.ok) {
        throw new Error('Chat generation failed');
      }

      const chatData = await chatResponse.json();
      const response = chatData.response;
      
      const aiMsgObj: ChatMessage = { 
        role: 'model', 
        content: response, 
        timestamp: Date.now() 
      };
      
      updateActiveSession([...newMessages, aiMsgObj]);
    } catch (error) {
      const errorMsgObj: ChatMessage = { 
        role: 'model', 
        content: "I'm having a little trouble connecting right now. Can we try again in a moment?", 
        timestamp: Date.now() 
      };
      updateActiveSession([...newMessages, errorMsgObj]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col w-full max-w-2xl mx-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-hidden border-x border-border/10"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* App Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-secondary/50 text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center shadow-inner relative">
              <BrainCircuit className="w-5 h-5 text-white" />
              {isLoading && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              )}
            </div>
            <div>
              <h1 className="font-bold text-foreground leading-tight">{aiName}</h1>
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
              </p>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9 hover:bg-secondary/50 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            <MoreVertical className="w-5 h-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/40">
            <DropdownMenuItem onClick={startNewChat} className="cursor-pointer font-medium">
              Start New Chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={clearChatHistory} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive font-medium">
              <Trash2 className="w-4 h-4 mr-2" /> Clear History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Chat Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        aiName={aiName}
      />

      {/* Bottom suggestions & input */}
      <div className="flex flex-col bg-background/85 backdrop-blur-md shrink-0">
        {messages.length <= 1 && (
          <SuggestedPrompts
            onPromptClick={(prompt) => handleSendMessage(prompt)}
          />
        )}
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
