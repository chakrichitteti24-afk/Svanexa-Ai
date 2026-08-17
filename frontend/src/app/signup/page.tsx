'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Heart, User, Lock, Mail, ChevronRight, Loader2, Baby, Activity, Eye, EyeOff, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ModeCard = ({ mode, title, icon: Icon, description, wellnessMode, setWellnessMode }: { mode: string, title: string, icon: any, description: string, wellnessMode: string, setWellnessMode: (m: any) => void }) => {
  const isSelected = wellnessMode === mode;
  return (
    <div 
      onClick={() => setWellnessMode(mode as any)}
      className={`p-3.5 sm:p-4 rounded-xl cursor-pointer border-2 transition-all active:scale-[0.98] select-none flex items-start gap-3.5 ${
        isSelected 
          ? 'border-pink-500 bg-pink-500/10 shadow-sm shadow-pink-500/10' 
          : 'border-border/60 hover:border-pink-500/40 bg-card/80'
      }`}
    >
      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-pink-500/20 text-pink-500' : 'bg-secondary text-muted-foreground'}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-sm sm:text-base font-semibold ${isSelected ? 'text-pink-500' : 'text-foreground'}`}>{title}</h3>
          {isSelected ? (
            <CheckCircle2 className="w-4 h-4 text-pink-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
};

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
      if (!firstName.trim()) {
        setError('Please enter your first name');
        return;
      }
      if (!lastName.trim()) {
        setError('Please enter your last name');
        return;
      }
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

      // Regardless of session state (auto-confirm or not), attempt to initialize profiles
      await Promise.all([
        supabase.from('profiles').upsert(
          {
            id: authData.user.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            ai_name: aiName || 'Luna',
            active_theme: wellnessMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ),
        supabase.from('wellness_streaks').upsert(
          { user_id: authData.user.id, current_streak: 0, longest_streak: 0 },
          { onConflict: 'user_id' }
        )
      ]);

      if (!authData.session) {
        // If email confirm is still on in Supabase dashboard, we need to show an error or redirect to login.
        router.push('/login?message=Account created. If confirmation is required, check your email. Otherwise, log in.');
      } else {
        window.location.href = '/dashboard';
      }

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
      <div className="flex flex-col items-center justify-center min-h-dvh bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-pink-500/20 animate-pulse">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background py-8 px-4 sm:py-12 sm:px-6 w-full max-w-full overflow-x-hidden selection:bg-pink-500/20">
      <div className="w-full max-w-md mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-300">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-500 text-white mb-1 shadow-lg shadow-pink-500/20">
            <Heart className="w-6 h-6 fill-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Join Svanexa
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Your AI-powered wellness journey begins here.
          </p>
        </div>

        {/* Segmented Tab Control */}
        <div className="w-full grid grid-cols-2 p-1 rounded-xl bg-secondary/50 border border-border/40">
          <Link href="/login" className="text-center py-2.5 sm:py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="text-center py-2.5 sm:py-2 text-sm font-semibold rounded-lg bg-background shadow-sm text-foreground transition-all">
            Sign Up
          </Link>
        </div>

        {/* Card Form */}
        <Card className="border-pink-500/15 shadow-xl shadow-pink-500/5 bg-card/60 backdrop-blur-xl relative overflow-hidden py-0 gap-0">
          
          {/* Top Step Progress Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-secondary">
            <motion.div 
              className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
              initial={{ width: step === 1 ? '50%' : '100%' }}
              animate={{ width: step === 1 ? '50%' : '100%' }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <CardContent className="pt-6 pb-6 px-4 sm:px-6">
            
            {/* Step Indicator Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pink-500/20 text-pink-500 text-[11px] font-bold">
                  {step}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {step === 1 ? 'Account Information' : 'Wellness & AI Setup'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                Step {step} of 2
              </span>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form 
                  key="step1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleNextStep} 
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-xs sm:text-sm font-medium text-foreground">First Name</Label>
                      <div className="relative flex items-center">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          placeholder="Jane"
                          className="pl-10 pr-4"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-xs sm:text-sm font-medium text-foreground">Last Name</Label>
                      <div className="relative flex items-center">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          placeholder="Doe"
                          className="pl-10 pr-4"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-foreground">Email Address</Label>
                    <div className="relative flex items-center">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="jane@example.com"
                        className="pl-10 pr-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-foreground">Password</Label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        className="pl-10 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-medium text-foreground">Confirm Password</Label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                        className="pl-10 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-xs sm:text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl break-words">
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md shadow-pink-500/20 h-11 font-semibold mt-2 rounded-xl"
                  >
                    Continue <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.form>
              )}

              {step === 2 && (
                <motion.form 
                  key="step2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSignUp} 
                  className="space-y-4 sm:space-y-5"
                >
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="aiName" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                      <Sparkles className="w-4 h-4 text-pink-500"/> Name your AI Companion
                    </Label>
                    <p className="text-xs text-muted-foreground">Your AI assistant will use this name to chat with you.</p>
                    <div className="relative flex items-center">
                      <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500 pointer-events-none" />
                      <Input
                        id="aiName"
                        type="text"
                        value={aiName}
                        onChange={(e) => setAiName(e.target.value)}
                        required
                        placeholder="e.g. Luna, Maya, Sage"
                        className="pl-10 pr-4 text-pink-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                      <Activity className="w-4 h-4 text-pink-500"/> Select Wellness Mode
                    </Label>
                    <div className="grid grid-cols-1 gap-2.5">
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-xs sm:text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl break-words">
                      {error}
                    </motion.div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="h-11 px-5 shrink-0 font-medium rounded-xl border-border/80 hover:bg-secondary transition-colors"
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white shadow-md shadow-pink-500/20 h-11 min-w-0 font-semibold px-4 text-sm rounded-xl transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2 shrink-0" /> : null}
                      <span>{loading ? 'Creating Account...' : 'Complete Signup'}</span>
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground/80 px-4">
          By continuing, you agree to Svanexa&apos;s wellness guidelines and terms.
        </p>
      </div>
    </div>
  );
}
