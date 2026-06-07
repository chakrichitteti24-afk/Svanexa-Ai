'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { getCompanionResponse, generateChatTitle } from '@/lib/gemini';
import { CycleIntelligenceEngine } from '@/lib/cycle-intelligence';
import { Send, Bot, User, Mic, MicOff, RefreshCw, Menu, Plus, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';

type Message = {
  role: 'user' | 'model';
  content: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
};

export default function CompanionPage() {
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Settings loaded from local storage
  const [companionName] = useLocalStorage('hersync_companion_name', 'HerSync AI');
  const [language] = useLocalStorage('hersync_language', 'English');
  const [personality] = useLocalStorage('hersync_personality', 'Friendly');
  const [hasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [cycles] = useLocalStorage<any[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<any>('hersync_checkins', {});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-cleanup sessions older than 7 days and set default active session
  useEffect(() => {
    const sevenDaysAgo = subDays(new Date(), 7).getTime();
    const validSessions = sessions.filter(s => s.updated_at > sevenDaysAgo);
    
    if (validSessions.length !== sessions.length) {
      setSessions(validSessions);
    }

    if (!activeSessionId && validSessions.length > 0) {
      setActiveSessionId(validSessions[0].id);
    }
  }, [sessions, activeSessionId, setSessions, setActiveSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = textToSend || input.trim();
    if (!messageContent || isLoading) return;

    if (!textToSend) setInput('');
    
    setIsLoading(true);

    const newUserMsg: Message = { role: 'user', content: messageContent };
    let currentSessionId = activeSessionId;
    let currentMessages = [...messages, newUserMsg];

    if (!currentSessionId) {
      // Create new session
      currentSessionId = crypto.randomUUID();
      const newSession: ChatSession = {
        id: currentSessionId,
        title: 'New Conversation',
        messages: currentMessages,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      setSessions([newSession, ...sessions]);
      setActiveSessionId(currentSessionId);
      
      // Async generate title
      generateChatTitle(messageContent).then(title => {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title } : s));
      });
    } else {
      // Update existing session immediately for UI
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: currentMessages, updated_at: Date.now() } 
          : s
      ));
    }

    // Prepare Context & Health Data
    const history = currentMessages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
    const engine = new CycleIntelligenceEngine(cycles, checkIns, hasPCOS);
    const analytics = engine.analyzeCycles();
    const prediction = engine.predictNextPeriod();
    const healthScore = engine.calculateHealthScore();
    const recentCheckIns = engine.getRecentCheckIns(14);
    
    const avgSleep = recentCheckIns.length > 0 ? (recentCheckIns.reduce((a, b) => a + b.sleep, 0) / recentCheckIns.length).toFixed(1) : '7.0';
    const avgWater = recentCheckIns.length > 0 ? (recentCheckIns.reduce((a, b) => a + b.water, 0) / recentCheckIns.length).toFixed(1) : '2.0';

    const healthSummaryObj = {
      pcos: hasPCOS,
      avg_cycle_length: analytics.avgCycleLength,
      cycle_regularity: analytics.regularityStatus,
      cycle_health_score: healthScore.score,
      avg_sleep: avgSleep,
      avg_water: avgWater,
      recent_period_prediction: prediction ? `${prediction.earliestDate.toLocaleDateString()} - ${prediction.latestDate.toLocaleDateString()}` : 'Unknown'
    };

    const response = await getCompanionResponse(
      messageContent,
      history,
      language,
      personality,
      companionName,
      JSON.stringify(healthSummaryObj)
    );

    // Save final AI response to session
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { ...s, messages: [...s.messages, { role: 'model', content: response || 'Error occurred.' }], updated_at: Date.now() } 
        : s
    ));
    setIsLoading(false);
  };

  const handleVoiceInput = () => {
    if (isRecording) {
      setIsRecording(false);
      const speechResults = [
        "How can I reduce bloating in my luteal phase?",
        "What are the best food suggestions for PCOS insulin spikes?",
        "Can you check my average sleep trend impact?"
      ];
      setInput(speechResults[Math.floor(Math.random() * speechResults.length)]);
      toast.success("Voice transcribed successfully!");
    } else {
      setIsRecording(true);
      toast.info("Listening... Speak now and press microphone again to finish.");
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    toast.success("Chat deleted.");
  };

  // Grouping for sidebar
  const todaySessions = sessions.filter(s => isToday(new Date(s.updated_at))).sort((a,b) => b.updated_at - a.updated_at);
  const yesterdaySessions = sessions.filter(s => isYesterday(new Date(s.updated_at))).sort((a,b) => b.updated_at - a.updated_at);
  const last7DaysSessions = sessions.filter(s => {
    const date = new Date(s.updated_at);
    return !isToday(date) && !isYesterday(date) && isAfter(date, subDays(new Date(), 7));
  }).sort((a,b) => b.updated_at - a.updated_at);

  const SessionGroup = ({ title, data }: { title: string, data: ChatSession[] }) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-6 px-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">{title}</h4>
        <div className="space-y-0.5">
          {data.map(session => (
            <button
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setIsSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between group transition-colors ${
                activeSessionId === session.id ? 'bg-secondary/80 text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate text-xs">{session.title}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div 
                  role="button"
                  onClick={(e) => deleteSession(e, session.id)} 
                  className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] relative animate-in fade-in duration-500 overflow-hidden bg-card/10 border border-border/20 rounded-2xl">
      
      {/* Premium Compact Header */}
      <div className="p-3 border-b bg-card/45 backdrop-blur-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger 
              render={<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" />}
            >
              <Menu className="w-4 h-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] p-0 flex flex-col border-r-border/40 bg-background/95 backdrop-blur-xl">
              <SheetHeader className="p-4 border-b border-border/40 text-left space-y-1">
                <SheetTitle className="text-sm font-bold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-pink-500" />
                  Chat History
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Chats are stored locally for 7 days.
                </SheetDescription>
              </SheetHeader>
              <div className="p-3">
                <Button onClick={startNewChat} className="w-full justify-start gap-2 h-11 bg-pink-600 hover:bg-pink-500 text-white rounded-xl shadow-xs">
                  <Plus className="w-4 h-4" />
                  New Conversation
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
                <SessionGroup title="Today" data={todaySessions} />
                <SessionGroup title="Yesterday" data={yesterdaySessions} />
                <SessionGroup title="Previous 7 Days" data={last7DaysSessions} />
                
                {sessions.length === 0 && (
                  <div className="text-center py-12 px-4 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-xs">No recent conversations.</p>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">{companionName}</h2>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-muted-foreground font-medium">Online • {personality}</span>
              </div>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            if(activeSessionId) {
              setSessions(prev => prev.map(s => s.id === activeSessionId ? {...s, messages: []} : s));
              toast.success("Chat cleared.");
            }
          }} 
          className="h-8 w-8 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
          title="Clear Current Chat"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/20 scrollbar-none">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-[280px] mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/5 flex items-center justify-center border border-pink-500/10">
              <Bot className="w-6 h-6 text-pink-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-xs text-foreground">Start a New Chat</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Ask about PCOS diet tips, sleep adjustments, cycle irregularity, bloating, or skincare routines.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2.5 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white ${msg.role === 'user' ? 'bg-pink-600' : 'bg-gradient-to-br from-pink-500 to-violet-500'}`}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                msg.role === 'user' 
                  ? 'bg-pink-600 text-white rounded-tr-xs' 
                  : 'bg-card border border-border/40 text-foreground rounded-tl-xs whitespace-pre-wrap'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-2.5 max-w-[90%]">
            <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-2xl bg-card border border-border/40 rounded-tl-xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Swipeable Quick Prompts & Sticky Input bar */}
      <div className="p-2.5 border-t bg-card/45 backdrop-blur-xs shrink-0 space-y-2.5">
        
        {/* Swipeable Prompts (horizontal scroll) */}
        {messages.length === 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x mask-gradient">
            <button 
              onClick={() => handleSend("What are the best exercises for PCOS?")}
              className="px-3 py-1.5 bg-secondary/30 hover:bg-secondary/50 border border-border/40 rounded-full text-[10px] text-muted-foreground hover:text-foreground shrink-0 snap-start transition-all"
            >
              🏋️ PCOS Workouts
            </button>
            <button 
              onClick={() => handleSend("How can I lower my stress levels and sleep better?")}
              className="px-3 py-1.5 bg-secondary/30 hover:bg-secondary/50 border border-border/40 rounded-full text-[10px] text-muted-foreground hover:text-foreground shrink-0 snap-start transition-all"
            >
              🧘 Stress & Sleep
            </button>
            <button 
              onClick={() => handleSend("What foods help with cycle regularities?")}
              className="px-3 py-1.5 bg-secondary/30 hover:bg-secondary/50 border border-border/40 rounded-full text-[10px] text-muted-foreground hover:text-foreground shrink-0 snap-start transition-all"
            >
              🥗 Period Nutrition
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-center">
          <Button 
            type="button" 
            size="icon" 
            onClick={handleVoiceInput}
            className={`rounded-full shrink-0 h-11 w-11 transition-all ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : 'bg-secondary/40 hover:bg-secondary/60 text-muted-foreground hover:text-foreground border border-border/30'
            }`}
            aria-label="Voice input"
          >
            {isRecording ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </Button>

          <Input 
            placeholder={`Message ${companionName}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 rounded-full bg-background border-border/50 h-11 px-4 text-xs focus-visible:ring-1 focus-visible:ring-pink-500"
            disabled={isLoading}
          />
          
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full bg-pink-600 hover:bg-pink-500 text-white w-11 h-11 shrink-0 transition-transform active:scale-95" 
            disabled={isLoading || !input.trim()}
          >
            <Send className="w-4.5 h-4.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
