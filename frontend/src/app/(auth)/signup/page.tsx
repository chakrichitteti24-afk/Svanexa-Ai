'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, User, MessageCircleHeart, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [aiName, setAiName] = useState('Luna');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          ai_name: aiName,
          date_of_birth: dob,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Account created successfully! Welcome to HerSync.');
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-700 py-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-pink-500" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Join HerSync</h1>
          <p className="text-sm text-muted-foreground">Create your personalized wellness space.</p>
        </div>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSignUp} className="space-y-4">
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-background border-border/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-background border-border/60"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-500" /> What should we call you?
                </Label>
                <Input 
                  id="username"
                  placeholder="e.g. Priya"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 bg-background border-border/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="aiName" className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageCircleHeart className="w-3.5 h-3.5 text-violet-500" /> Name your AI Companion
                </Label>
                <Input 
                  id="aiName"
                  placeholder="e.g. Luna"
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  className="h-11 bg-background border-border/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dob" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" /> Date of Birth
                </Label>
                <Input 
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="h-11 bg-background border-border/60 text-foreground"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-full mt-6 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-medium transition-transform active:scale-95"
                disabled={loading || !email || !password || !username || !aiName || !dob}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground pb-4">
          Already have an account?{' '}
          <Link href="/login" className="text-pink-500 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
