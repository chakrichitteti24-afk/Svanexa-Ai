'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, MoreVertical, Trash2, BrainCircuit, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getCompanionResponse } from '@/lib/gemini';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

export default function CompanionPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState<string>('there');
  const [aiName, setAiName] = useState<string>('Luna');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
            content: `Hey ${userName} 😊 I'm ${aiName}. It's nice to see you again. How are you feeling today?`
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

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
          content: `Hi ${userName}! What's on your mind?`
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || !activeSession) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    const newMessages: ChatMessage[] = [...activeSession.messages, { role: 'user', content: userMsg }];
    updateActiveSession(newMessages);

    try {
      const historyToPass = activeSession.messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));
      const response = await getCompanionResponse(
        userMsg, 
        historyToPass, 
        'English', 
        'Friendly', 
        aiName, 
        `User Name: ${userName}`
      );
      updateActiveSession([...newMessages, { role: 'model', content: response }]);
    } catch (error) {
      updateActiveSession([...newMessages, { 
        role: 'model', 
        content: "I'm having a little trouble connecting right now. Can we try again in a moment?" 
      }]);
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
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* App Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md z-10">
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

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-4 pb-4">
          <div className="text-center text-[10px] text-muted-foreground/60 font-medium mb-4">
            Today, {format(new Date(), 'h:mm a')}
          </div>
          
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-pink-500 to-violet-500 text-white rounded-br-sm' 
                    : 'bg-secondary/60 text-foreground border border-border/40 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-secondary/60 text-foreground border border-border/40 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/40">
        <form 
          onSubmit={handleSendMessage}
          className="flex items-end gap-2 bg-secondary/30 border border-border/50 p-1.5 rounded-3xl shadow-sm focus-within:ring-1 focus-within:ring-pink-500/30 focus-within:border-pink-500/50 transition-all"
        >
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Message ${aiName}...`}
            className="flex-1 bg-transparent border-0 focus-visible:ring-0 px-3 shadow-none text-[15px]"
            disabled={isLoading}
            autoComplete="off"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!inputMessage.trim() || isLoading}
            className={`rounded-full shrink-0 h-10 w-10 transition-all ${
              inputMessage.trim() ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[9px] text-muted-foreground/60">{aiName} can make mistakes. Consider verifying medical info.</p>
        </div>
      </div>
    </div>
  );
}
