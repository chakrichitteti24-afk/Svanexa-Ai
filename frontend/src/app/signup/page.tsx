'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Heart, User, Lock, Mail, ChevronRight, Loader2, Baby, Activity, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ModeCard = ({ mode, title, icon: Icon, description, wellnessMode, setWellnessMode }: { mode: string, title: string, icon: any, description: string, wellnessMode: string, setWellnessMode: (m: any) => void }) => (
  <div 
    onClick={() => setWellnessMode(mode as any)}
    className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${
      wellnessMode === mode 
        ? 'border-pink-500 bg-pink-500/10' 
        : 'border-border hover:border-pink-500/50 bg-card'
    }`}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-lg ${wellnessMode === mode ? 'bg-pink-500/20 text-pink-500' : 'bg-secondary text-muted-foreground'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className={`font-semibold ${wellnessMode === mode ? 'text-pink-500' : 'text-foreground'}`}>{title}</h3>
    </div>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);

export default function SignUpPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [aiName, setAiName] = useState('Luna');
  const [wellnessMode, setWellnessMode] = useState<'general' | 'pcos' | 'pregnancy'>('general');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && isMounted) {
          window.location.href = '/dashboard';
          return;
        }
      } catch {
        // Ignore auth error on mount
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }
    checkSession();
    return () => { isMounted = false; };
  }, [supabase]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      setError('');
      setStep(2);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            username: firstName,
            ai_name: aiName,
            wellness_mode: wellnessMode,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Please log in.');
          setLoading(false);
          return;
        }
        throw signUpError;
      }
      
      if (!authData.user) throw new Error('Failed to create account');

      // CASE 1B: Email confirmation required (session is null)
      if (!authData.session) {
        setIsEmailSent(true);
        setLoading(false);
        return;
      }

      // CASE 1A: Instant session available (auto-confirm enabled)
      // Upsert profile and defaults exactly once
      await Promise.all([
        supabase.from('profiles').upsert(
          {
            id: authData.user.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            ai_name: aiName || 'Luna',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ),
        supabase.from('user_preferences').upsert(
          { user_id: authData.user.id, theme: wellnessMode, push_notifications: true },
          { onConflict: 'user_id' }
        ),
        supabase.from('wellness_streaks').upsert(
          { user_id: authData.user.id, current_streak: 0, longest_streak: 0 },
          { onConflict: 'user_id' }
        )
      ]);

      // Direct redirect to dashboard
      window.location.href = '/dashboard';

    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Please log in.');
      } else {
        setError(err.message || 'An error occurred during sign up.');
      }
      setLoading(false);
    }
  };


  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-pink-500/20 animate-pulse">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (isEmailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4 selection:bg-pink-500/20">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-500 text-white mb-2 shadow-lg shadow-pink-500/20">
              <Mail className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Check Your Email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <span className="font-semibold text-foreground">{email}</span>
            </p>
          </div>

          <Card className="border-pink-500/10 shadow-xl shadow-pink-500/5 bg-card/60 backdrop-blur-xl p-6 space-y-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please click the link inside the email to confirm your account and log into Svanexa AI.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md h-11 mt-2"
            >
              Go to Sign In <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 selection:bg-pink-500/20">
      <div className="w-full max-w-xl space-y-8 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-500 text-white mb-2 shadow-lg shadow-pink-500/20">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Join Svanexa</h1>
          <p className="text-sm text-muted-foreground">Your AI-powered wellness journey begins here.</p>
        </div>

        <Card className="border-pink-500/10 shadow-xl shadow-pink-500/5 bg-card/60 backdrop-blur-xl relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-secondary">
            <motion.div 
              className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
              initial={{ width: '50%' }}
              animate={{ width: step === 1 ? '50%' : '100%' }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <CardContent className="pt-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleNextStep} 
                  className="space-y-5"
                >
                  <div className="flex space-x-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          placeholder="Jane"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          placeholder="Doe"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="jane@example.com"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md h-11"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.form>
              )}

              {step === 2 && (
                <motion.form 
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSignUp} 
                  className="space-y-6"
                >
                  
                  <div className="space-y-2">
                    <Label htmlFor="aiName" className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-500"/> Name your AI Companion
                    </Label>
                    <p className="text-xs text-muted-foreground">Your AI assistant will use this name to chat with you.</p>
                    <Input
                      id="aiName"
                      type="text"
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      required
                      placeholder="e.g. Luna, Maya, Sage"
                      className="text-pink-500 font-medium"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-pink-500"/> Select Wellness Mode
                    </Label>
                    <div className="grid grid-cols-1 gap-3">
                      <ModeCard 
                        mode="general" 
                        title="General Wellness" 
                        icon={Heart} 
                        description="Focus on sleep, mood, hydration, and overall well-being." 
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                      <ModeCard 
                        mode="pcos" 
                        title="PCOS / PCOD" 
                        icon={Activity} 
                        description="Tailored tracking for irregular cycles and hormonal symptoms." 
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                      <ModeCard 
                        mode="pregnancy" 
                        title="Pregnancy" 
                        icon={Baby} 
                        description="Track weekly milestones, mother wellness, and baby development." 
                        wellnessMode={wellnessMode}
                        setWellnessMode={setWellnessMode}
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                      {error}
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="w-24 h-11"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md h-11"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                      {loading ? 'Creating Account...' : 'Complete Signup'}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-sm text-center text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-pink-500 hover:text-pink-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
