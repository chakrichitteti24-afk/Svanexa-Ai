'use client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, User, MessageCircleHeart } from 'lucide-react';
import { ChatSession } from '@/app/(app)/companion/page';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useLocalStorage('hersync_user_name', '');
  const [companionName, setCompanionName] = useLocalStorage('hersync_companion_name', 'Luna');
  const [age, setAge] = useLocalStorage('hersync_user_age', '');
  const [hasOnboarded, setHasOnboarded] = useLocalStorage('hersync_onboarded', false);
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('hersync_chat_sessions', []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>('hersync_active_session', null);

  const [localName, setLocalName] = useState(name || '');
  const [localCompanionName, setLocalCompanionName] = useState(companionName || 'Luna');
  const [localAge, setLocalAge] = useState(age || '');

  useEffect(() => {
    if (name) setLocalName(name);
    if (companionName) setLocalCompanionName(companionName);
    if (age) setLocalAge(age);
  }, [name, companionName, age]);

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localName.trim() || !localAge.trim() || !localCompanionName.trim()) return;

    // Save minimal data
    setName(localName);
    setCompanionName(localCompanionName);
    setAge(localAge);
    setHasOnboarded(true);

    // Create the initial AI greeting session
    const welcomeId = crypto.randomUUID();
    const welcomeSession: ChatSession = {
      id: welcomeId,
      title: 'Welcome to HerSync',
      messages: [
        {
          role: 'model',
          content: `Hey ${localName}! 😊 I'm ${localCompanionName}. It's really nice to meet you. How has your day been so far?`
        }
      ],
      created_at: Date.now(),
      updated_at: Date.now()
    };

    setSessions([welcomeSession, ...sessions]);
    setActiveSessionId(welcomeId);

    // Redirect to companion
    router.push('/companion');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Decorative background blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-sm space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="w-6 h-6 text-pink-500" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome to HerSync</h1>
          <p className="text-sm text-muted-foreground">Let's get to know each other. No long forms, just the basics to get started.</p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleComplete} className="space-y-5">
              
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-500" /> What should I call you?
                </Label>
                <Input 
                  id="name"
                  placeholder="e.g. Priya"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="h-12 bg-background border-border/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="companionName" className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageCircleHeart className="w-3.5 h-3.5 text-violet-500" /> Name your AI Companion
                </Label>
                <Input 
                  id="companionName"
                  placeholder="e.g. Luna"
                  value={localCompanionName}
                  onChange={(e) => setLocalCompanionName(e.target.value)}
                  className="h-12 bg-background border-border/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="age" className="text-xs font-semibold">Your Age</Label>
                <Input 
                  id="age"
                  type="number"
                  placeholder="e.g. 25"
                  value={localAge}
                  onChange={(e) => setLocalAge(e.target.value)}
                  className="h-12 bg-background border-border/60"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 rounded-full mt-4 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-medium text-sm transition-transform active:scale-95"
                disabled={!localName.trim() || !localAge.trim() || !localCompanionName.trim()}
              >
                Meet Your Companion ✨
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
