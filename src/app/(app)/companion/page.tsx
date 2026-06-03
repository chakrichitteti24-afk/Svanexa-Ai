'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { getCompanionResponse } from '@/lib/gemini';
import { CycleIntelligenceEngine } from '@/lib/cycle-intelligence';
import { Send, Bot, User, Trash2, Settings2 } from 'lucide-react';

type Message = {
  role: 'user' | 'model';
  content: string;
};

export default function CompanionPage() {
  const [messages, setMessages] = useLocalStorage<Message[]>('hersync_chat_history', []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companionName, setCompanionName] = useLocalStorage('hersync_companion_name', 'HerSync AI');
  const [language, setLanguage] = useLocalStorage('hersync_language', 'English');
  const [personality, setPersonality] = useLocalStorage('hersync_personality', 'Friendly');
  const [hasPCOS] = useLocalStorage('hersync_has_pcos', false);
  const [cycles] = useLocalStorage<any[]>('hersync_cycles', []);
  const [checkIns] = useLocalStorage<any>('hersync_checkins', {});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));

    const engine = new CycleIntelligenceEngine(cycles, checkIns, hasPCOS);
    const analytics = engine.analyzeCycles();
    const prediction = engine.predictNextPeriod();
    const healthScore = engine.calculateHealthScore();
    const recentCheckIns = engine.getRecentCheckIns(14);
    
    // Calculate simple trends for summary
    const avgSleep = recentCheckIns.length > 0 ? (recentCheckIns.reduce((a, b) => a + b.sleep, 0) / recentCheckIns.length).toFixed(1) : 'unknown';
    const avgWater = recentCheckIns.length > 0 ? (recentCheckIns.reduce((a, b) => a + b.water, 0) / recentCheckIns.length).toFixed(1) : 'unknown';

    // Count common symptoms
    const symptomCounts: Record<string, number> = {};
    recentCheckIns.forEach(c => {
      if (c.acne > 5) symptomCounts['acne'] = (symptomCounts['acne'] || 0) + 1;
      if (c.bloating === 'severe' || c.bloating === 'moderate') symptomCounts['bloating'] = (symptomCounts['bloating'] || 0) + 1;
      if (c.cramps === 'severe' || c.cramps === 'moderate') symptomCounts['cramps'] = (symptomCounts['cramps'] || 0) + 1;
    });
    const commonSymptoms = Object.keys(symptomCounts).filter(k => symptomCounts[k] > 2);

    const healthSummaryObj = {
      pcos: hasPCOS,
      avg_cycle_length: analytics.avgCycleLength,
      cycle_regularity: analytics.regularityStatus,
      cycle_health_score: healthScore.score,
      avg_sleep: avgSleep,
      avg_water: avgWater,
      common_symptoms: commonSymptoms,
      recent_period_prediction: prediction ? `${prediction.earliestDate.toLocaleDateString()} - ${prediction.latestDate.toLocaleDateString()}` : 'Unknown'
    };

    const response = await getCompanionResponse(
      userMessage,
      history,
      language,
      personality,
      companionName,
      JSON.stringify(healthSummaryObj)
    );

    setMessages([...newMessages, { role: 'model', content: response || 'Error occurred.' }]);
    setIsLoading(false);
  };

  const renderSettingsContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Companion Name</label>
        <Input 
          value={companionName} 
          onChange={e => setCompanionName(e.target.value)} 
          className="h-11 bg-background"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Language</label>
        <Select value={language} onValueChange={(val) => setLanguage(val || '')}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Hindi">Hindi (हिंदी)</SelectItem>
            <SelectItem value="Telugu">Telugu (తెలుగు)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Personality</label>
        <Select value={personality} onValueChange={(val) => setPersonality(val || '')}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Friendly">Friendly & Empathetic</SelectItem>
            <SelectItem value="Professional">Professional & Direct</SelectItem>
            <SelectItem value="Motivational">Motivational Coach</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button 
        variant="outline" 
        className="w-full h-11 text-red-500 hover:text-red-600 hover:bg-red-500/10 mt-6 border-red-500/30" 
        onClick={() => setMessages([])}
      >
        <Trash2 className="w-4 h-4 mr-2" /> Clear Chat
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] animate-in fade-in duration-500">
      {/* Title Header - Compact on Mobile */}
      <div className="hidden sm:block mb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">AI Companion</h1>
        <p className="text-xs text-muted-foreground">Your 24/7 personal wellness assistant. Ask anything, no judgment.</p>
      </div>

      <div className="flex flex-row gap-4 h-full min-h-0 flex-1">
        {/* Settings Sidebar (Desktop Only) */}
        <div className="hidden md:block w-64 shrink-0">
          <Card className="h-full border-border/50 bg-card/60 backdrop-blur-xs flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" /> Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {renderSettingsContent()}
            </CardContent>
          </Card>
        </div>

        {/* Chat Area - WhatsApp-like full height flex layout */}
        <Card className="flex-1 flex flex-col overflow-hidden border-pink-500/20 bg-card/40 backdrop-blur-xs">
          <CardHeader className="border-b bg-secondary/15 py-3 px-4 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{companionName}</CardTitle>
                <CardDescription className="text-[10px] leading-tight">Always here to support you</CardDescription>
              </div>
            </div>
            
            {/* Settings Trigger for Mobile Only */}
            <Sheet>
              <SheetTrigger className="md:hidden inline-flex items-center justify-center p-2 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                <Settings2 className="w-5 h-5" />
              </SheetTrigger>
              <SheetContent side="right" className="p-6 w-80">
                <SheetTitle className="text-lg font-bold flex items-center gap-2 mb-6">
                  <Settings2 className="w-5 h-5 text-primary" /> Companion Settings
                </SheetTitle>
                {renderSettingsContent()}
              </SheetContent>
            </Sheet>
          </CardHeader>

          {/* Chat Messages Area */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col bg-background/30">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center px-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-primary opacity-60" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Meet {companionName}</h3>
                <p className="text-xs text-muted-foreground mb-6">Ask questions about cycle symptoms, stress-relief strategies, sleep habits, or general health insights.</p>
                <div className="flex flex-col gap-2 w-full">
                  <Button variant="secondary" className="w-full text-xs h-10 justify-start px-4 rounded-xl" onClick={() => setInput('What are some good exercises for PCOS?')}>
                    💡 What are some good exercises for PCOS?
                  </Button>
                  <Button variant="secondary" className="w-full text-xs h-10 justify-start px-4 rounded-xl" onClick={() => setInput('How can I manage my stress levels?')}>
                    💡 How can I manage my stress levels?
                  </Button>
                  <Button variant="secondary" className="w-full text-xs h-10 justify-start px-4 rounded-xl" onClick={() => setInput('Can you recommend a soothing nighttime routine?')}>
                    💡 Can you recommend a soothing nighttime routine?
                  </Button>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white ${msg.role === 'user' ? 'bg-primary' : 'bg-gradient-to-br from-pink-500 to-violet-500'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-3.5 rounded-2xl shadow-xs text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-xs' : 'bg-card border border-border/40 text-foreground rounded-tl-xs'}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border/40 rounded-tl-xs flex items-center gap-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Sticky Input Bar at Bottom */}
          <div className="p-3 border-t bg-secondary/15 shrink-0">
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2 max-w-3xl mx-auto">
              <Input 
                placeholder={`Chat with ${companionName}...`}
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1 rounded-full bg-background border-border/60 h-11 px-4 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full bg-pink-600 hover:bg-pink-500 text-white w-11 h-11 shrink-0 transition-transform active:scale-95" 
                disabled={isLoading || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
