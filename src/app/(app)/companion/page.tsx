'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chatWithCompanion } from '@/app/actions/companion';
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

    const response = await chatWithCompanion(
      userMessage,
      history,
      language,
      personality,
      companionName,
      JSON.stringify(healthSummaryObj)
    );

    setMessages([...newMessages, { role: 'model', content: response.text || 'Error occurred.' }]);
    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">AI Companion</h1>
        <p className="text-muted-foreground">Your 24/7 personal wellness assistant. Ask anything, no judgment.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 h-full min-h-[500px]">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Companion Name</label>
                <Input value={companionName} onChange={e => setCompanionName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <Select value={language} onValueChange={(val) => setLanguage(val || '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi (हिंदी)</SelectItem>
                    <SelectItem value="Telugu">Telugu (తెలుగు)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Personality</label>
                <Select value={personality} onValueChange={(val) => setPersonality(val || '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Friendly">Friendly & Empathetic</SelectItem>
                    <SelectItem value="Professional">Professional & Direct</SelectItem>
                    <SelectItem value="Motivational">Motivational Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 mt-4" onClick={() => setMessages([])}>
                <Trash2 className="w-4 h-4 mr-2" /> Clear Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden border-pink-500/20">
          <CardHeader className="border-b bg-secondary/20 pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              {companionName}
            </CardTitle>
            <CardDescription>Always here to help with your PCOS journey.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center px-4">
                <Bot className="w-12 h-12 mb-4 opacity-20" />
                <p>Start a conversation! Try asking:</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={() => setInput('What are some good exercises for PCOS?')}>Exercises</Button>
                  <Button variant="secondary" size="sm" onClick={() => setInput('How can I manage my stress levels?')}>Stress Relief</Button>
                  <Button variant="secondary" size="sm" onClick={() => setInput('Can you recommend a soothing nighttime routine?')}>Night Routine</Button>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-pink-500 to-violet-500 text-white'}`}>
                    {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary rounded-tl-sm'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-4 rounded-2xl bg-secondary rounded-tl-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t bg-secondary/10">
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input 
                placeholder={`Chat with ${companionName}...`}
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1 rounded-full bg-background"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="rounded-full bg-pink-600 hover:bg-pink-500 text-white" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
